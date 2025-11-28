#!/usr/bin/env python3
import os
import sys
import json
import tempfile
import shutil
import logging
import time
import traceback
import re
import uuid
import base64
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import pandas as pd
import pyarrow as pa

from requests.auth import HTTPBasicAuth
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Auth libs - keep both options (msal device flow or service principal)
try:
    import msal
except Exception:
    msal = None

try:
    from azure.identity import ClientSecretCredential
except Exception:
    ClientSecretCredential = None

# Kaggle
try:
    from kaggle.api.kaggle_api_extended import KaggleApi
except Exception:
    KaggleApi = None

# deltalake (may require native deps)
try:
    from deltalake import write_deltalake
except Exception:
    write_deltalake = None

# OneLake client
try:
    from azure.storage.filedatalake import DataLakeServiceClient
except Exception:
    DataLakeServiceClient = None

load_dotenv()

# ---------- Config & constants (from original app.py) ----------

logging.basicConfig(level=logging.WARNING)
log = logging.getLogger("combined-api")
log.setLevel(logging.INFO)

logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.identity").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("msal").setLevel(logging.WARNING)
logging.getLogger("requests").setLevel(logging.WARNING)

FABRIC_API = "https://api.fabric.microsoft.com/v1"
ONELAKE_DFS = process.env.get("ONELAKE_DFS", "https://onelake.dfs.fabric.microsoft.com")
DFS_VERSION = process.env.get("DFS_VERSION", "2023-11-03")
MAX_RESULTS = int(process.env.get("MAX_RESULTS", "5000"))
REQUEST_TIMEOUT = int(process.env.get("REQUEST_TIMEOUT", "30"))

TENANT_ID = process.env.get("FABRIC_TENANT_ID") or process.env.get("TENANT_ID") or process.env.get("TENANT")
CLIENT_ID = os.getenv("FABRIC_CLIENT_ID") or os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")

KAGGLE_USERNAME = os.getenv("KAGGLE_USERNAME")
KAGGLE_KEY = os.getenv("KAGGLE_KEY")

ONELAKE_URL = os.getenv("ONELAKE_URL")
FABRIC_API_BASE = FABRIC_API

CACHE_FILE = os.getenv("MSAL_CACHE_FILE", "msal_token_cache.bin")
TOKEN_FILE = os.getenv("FABRIC_TOKEN_FILE", "fabric_bearer_token.txt")

SCOPE_FABRIC = ["https://api.fabric.microsoft.com/.default"]
SCOPE_STORAGE = ["https://storage.azure.com/.default"]

# ---------- Extra config from new11.py (semantic model/report) ----------

# These are specific IDs for your semantic-model pipeline + report cloning
WORKSPACE_ID = "ff0344bf-6e5d-43a4-b16c-7365c951a55c"
PIPELINE_ID = "47f84edb-dad2-417d-9a0b-bf42f5121e65"
TEMPLATE_REPORT_ID = "7a06b2a4-90a7-499d-804e-f453f9bc52a0"

FABRIC_BASE = FABRIC_API_BASE  # keep a single Fabric base URL
PBI_BASE = "https://api.powerbi.com/v1.0/myorg"

FABRIC_SCOPE = "https://api.fabric.microsoft.com/.default"
PBI_SCOPE = "https://analysis.windows.net/powerbi/api/.default"

ADO_TEMPLATE_PATH = "/Template Semantic Model.SemanticModel"
GOLDEN_TABLE_REL = "definition/tables/Blinkit_Orders.tmdl"
GOLDEN_TABLE_NAME = "Blinkit_Orders"

PIPELINE_POLL_INTERVAL = 6
PIPELINE_POLL_TIMEOUT = 1800
MODEL_POLL_INTERVAL = 4
MODEL_POLL_ATTEMPTS = 120

# ---------- Token manager (Fabric + OneLake) ----------


class TokenManager:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init = False
        return cls._instance

    def __init__(self):
        if self._init:
            return
        self._init = True
        self.fabric_token: Optional[str] = None
        self.storage_token: Optional[str] = None
        self.expiry: Dict[str, float] = {}
        self._use_sp = bool(
            CLIENT_SECRET and CLIENT_ID and TENANT_ID and ClientSecretCredential is not None
        )
        if not self._use_sp and msal is None:
            log.warning("MSAL not available and SERVICE PRINCIPAL not configured - auth may fail.")

        if self._use_sp:
            self.cred = ClientSecretCredential(
                tenant_id=TENANT_ID, client_id=CLIENT_ID, client_secret=CLIENT_SECRET
            )
            log.info("TokenManager: using ClientSecretCredential (service principal).")
        else:
            if msal:
                self.cache = msal.SerializableTokenCache()
                if os.path.exists(CACHE_FILE):
                    try:
                        with open(CACHE_FILE, "r", encoding="utf-8") as fh:
                            self.cache.deserialize(fh.read())
                        log.info("MSAL token cache loaded")
                    except Exception:
                        log.info("Failed to load MSAL cache")
                authority = f"https://login.microsoftonline.com/{TENANT_ID}" if TENANT_ID else None
                self.app = msal.PublicClientApplication(
                    CLIENT_ID, authority=authority, token_cache=self.cache
                )
            else:
                self.app = None

    def _save_cache(self):
        if getattr(self, "cache", None):
            try:
                if self.cache.has_state_changed:
                    with open(CACHE_FILE, "w", encoding="utf-8") as fh:
                        fh.write(self.cache.serialize())
            except Exception:
                pass

    def get_token_for_fabric(self) -> Optional[str]:
        return self.get_token(SCOPE_FABRIC)

    def get_token_for_storage(self) -> Optional[str]:
        return self.get_token(SCOPE_STORAGE)

    def get_token(self, scopes: List[str]) -> Optional[str]:
        if self._use_sp:
            try:
                token = self.cred.get_token(*scopes)
                t = token.token if token else None
                if scopes == SCOPE_FABRIC:
                    self.fabric_token = t
                else:
                    self.storage_token = t
                return t
            except Exception:
                log.exception("Service principal token acquisition failed")
                return None

        if not self.app:
            log.error("No MSAL app configured")
            return None

        for acc in self.app.get_accounts():
            res = self.app.acquire_token_silent(scopes, acc)
            if res and "access_token" in res:
                token = res["access_token"]
                if scopes == SCOPE_FABRIC:
                    self.fabric_token = token
                else:
                    self.storage_token = token
                self._save_cache()
                return token

        flow = self.app.initiate_device_flow(scopes=scopes)
        if not flow:
            log.error("Failed to start device flow")
            return None
        print("\n=== DEVICE CODE AUTH ===")
        print(f"Visit: {flow['verification_uri']}")
        print(f"Code : {flow['user_code']}")
        input("After signing in, press Enter to continue...")
        res = self.app.acquire_token_by_device_flow(flow)
        if "access_token" not in res:
            log.error("Device flow failed: %s", res.get("error"))
            return None
        token = res["access_token"]
        if scopes == SCOPE_FABRIC:
            self.fabric_token = token
        else:
            self.storage_token = token
        self._save_cache()
        return token


# ---------- Generic Fabric helpers ----------

def api_get(url: str, token: str, params: dict = None) -> Optional[Dict]:
    try:
        r = requests.get(
            url,
            headers={"Authorization": f"Bearer {token}"},
            params=params or {},
            timeout=REQUEST_TIMEOUT,
        )
        if r.status_code == 200:
            return r.json()
        log.error("GET %s -> %s : %s", url, r.status_code, r.text)
        return None
    except Exception:
        log.exception("api_get failed")
        return None


def api_post(url: str, token: str, data: Dict) -> Tuple[Optional[Dict], Optional[requests.Response]]:
    try:
        r = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=data,
            timeout=60,
        )
        if r.status_code in (200, 201, 202):
            try:
                return r.json(), r
            except Exception:
                return {}, r
        log.error("POST %s -> %s : %s", url, r.status_code, r.text)
        return None, r
    except Exception:
        log.exception("api_post failed")
        return None, None


# ---------- Onelake listing ----------

def list_onelake_paths(
    ws_id: str, lh_id: str, path: str, token: str, recursive: bool = True
) -> List[Dict]:
    paths: List[Dict] = []
    cont = None
    for _ in range(10):
        params = {
            "resource": "filesystem",
            "recursive": str(recursive).lower(),
            "maxResults": str(MAX_RESULTS),
        }
        if path and path not in ["", "/"]:
            first = path.strip("/").split("/")[0]
            params["directory"] = first

        if cont:
            params["continuation"] = cont
        headers = {"Authorization": f"Bearer {token}", "x-ms-version": DFS_VERSION}
        try:
            r = requests.get(
                f"{ONELAKE_DFS}/{ws_id}/{lh_id}",
                headers=headers,
                params=params,
                timeout=REQUEST_TIMEOUT,
            )
            if r.status_code != 200:
                log.error("Onelake list returned %s: %s", r.status_code, r.text)
                break
            data = r.json()
            paths.extend(data.get("paths", []))
            cont = data.get("continuation")
            if not cont:
                break
        except Exception:
            log.exception("list_onelake_paths exception")
            break
    return paths


# ---------- Discovery helpers ----------

def get_workspaces(fabric_token: str) -> List[Dict]:
    data = api_get(f"{FABRIC_API_BASE}/workspaces", fabric_token)
    return data.get("value", []) if data else []


def get_lakehouses(ws_id: str, fabric_token: str) -> List[Dict]:
    data = api_get(f"{FABRIC_API_BASE}/workspaces/{ws_id}/lakehouses", fabric_token)
    return data.get("value", []) if data else []


def get_pipelines(ws_id: str, fabric_token: str) -> List[Dict]:
    data = api_get(
        f"{FABRIC_API_BASE}/workspaces/{ws_id}/items",
        fabric_token,
        params={"type": "DataPipeline"},
    )
    return data.get("value", []) if data else []


def get_tables(ws_id: str, lh_id: str, fabric_token: str, storage_token: str) -> List[Dict]:
    tables: List[Dict] = []
    api_data = api_get(
        f"{FABRIC_API_BASE}/workspaces/{ws_id}/lakehouses/{lh_id}/tables", fabric_token
    )
    if api_data:
        for t in api_data.get("value", []):
            tables.append({"id": t.get("id", ""), "name": t.get("name", ""), "source": "api"})
    if storage_token:
        paths = list_onelake_paths(ws_id, lh_id, "Tables", storage_token, True)
        for p in paths:
            if p.get("isDirectory") and "_delta_log" in p.get("name", ""):
                name = p["name"].split("/_delta_log")[0].split("/")[-1]
                if name and not any(tt["name"] == name for tt in tables):
                    tables.append({"id": "", "name": name, "source": "onelake"})
    return tables


# ---------- Prediction helpers ----------

def get_table_columns(
    workspace_id: str, lakehouse_id: str, table_name: str, fabric_token: str
) -> List[str]:
    url = (
        f"{FABRIC_API_BASE}/workspaces/{workspace_id}/lakehouses/"
        f"{lakehouse_id}/tables/{table_name}"
    )
    data = api_get(url, fabric_token)
    if data and "columns" in data:
        try:
            return [col["name"] for col in data["columns"]]
        except Exception:
            log.exception("Unexpected table/columns shape for %s", table_name)
            return []
    log.info("Could not fetch columns for table %s", table_name)
    return []


def get_delta_columns_from_onelake(workspace_id, lakehouse_id, table_name, storage_token):
    all_paths = list_onelake_paths(
        workspace_id,
        lakehouse_id,
        "Tables",
        storage_token,
        recursive=True
    )

    json_logs = [
        p for p in all_paths
        if p["name"].startswith(f"Tables/{table_name}/_delta_log/")
        and p["name"].endswith(".json")
    ]

    if not json_logs:
        print(f"[DEBUG] No delta log JSON files found for table: {table_name}")
        return []

    json_logs.sort(key=lambda x: x["name"])
    first_json = json_logs[0]["name"]

    print("[DEBUG] Using delta schema:", first_json)

    url = f"{ONELAKE_DFS}/{workspace_id}/{lakehouse_id}/{first_json}"
    headers = {
        "Authorization": f"Bearer {storage_token}",
        "x-ms-version": DFS_VERSION
    }

    response = requests.get(url, headers=headers)
    if response.status_code != 200:
        print("[DEBUG] Could not download delta_log:", response.text)
        return []

    for line in response.text.splitlines():
        try:
            entry = json.loads(line)
            if "metaData" in entry:
                schema_str = entry["metaData"]["schemaString"]
                schema_json = json.loads(schema_str)
                return [field["name"] for field in schema_json["fields"]]
        except Exception:
            continue

    return []


def get_prediction_pipelines_for_workspace(
    workspace_id: str, fabric_token: str
) -> List[Dict]:
    pipelines = get_pipelines(workspace_id, fabric_token)
    if not pipelines:
        return []

    prediction_like: List[Dict] = []
    for p in pipelines:
        name = (p.get("displayName") or p.get("name") or "").lower()
        if any(key in name for key in ["pred", "forecast", "ml", "model"]):
            prediction_like.append(p)

    return prediction_like or pipelines


# ---------- Kaggle helpers ----------

def setup_kaggle():
    if not (KAGGLE_USERNAME and KAGGLE_KEY):
        raise RuntimeError("KAGGLE_USERNAME/KAGGLE_KEY are not set")
    kaggle_dir = os.path.expanduser("~/.kaggle")
    os.makedirs(kaggle_dir, exist_ok=True)
    cfg_path = os.path.join(kaggle_dir, "kaggle.json")
    with open(cfg_path, "w") as f:
        json.dump({"username": KAGGLE_USERNAME, "key": KAGGLE_KEY}, f)
    os.environ["KAGGLE_CONFIG_DIR"] = kaggle_dir


def download_dataset(slug: str) -> Tuple[str, str]:
    if KaggleApi is None:
        raise RuntimeError("KaggleApi not available. Install kaggle package.")
    setup_kaggle()
    api = KaggleApi()
    api.authenticate()
    temp_dir = tempfile.mkdtemp()
    api.dataset_download_files(slug, path=temp_dir, unzip=True)
    return temp_dir, slug


# ---------- File reading & upload ----------

SUPPORTED_TABLE_EXTS = {".csv", ".tsv", ".json", ".parquet", ".xls", ".xlsx"}


def read_table_file(path: str) -> Dict[str, pd.DataFrame]:
    ext = Path(path).suffix.lower()
    name = Path(path).stem
    out = {}
    if ext == ".csv":
        try:
            df = pd.read_csv(path, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(path, encoding="latin1")
        out[name] = df
    elif ext == ".tsv":
        try:
            df = pd.read_csv(path, sep="\t", encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(path, sep="\t", encoding="latin1")
        out[name] = df
    elif ext == ".json":
        try:
            df = pd.read_json(path, lines=True)
            out[name] = df
        except ValueError:
            try:
                df = pd.read_json(path)
                out[name] = df
            except ValueError:
                log.warning("Failed to parse JSON as table: %s", path)
    elif ext == ".parquet":
        df = pd.read_parquet(path)
        out[name] = df
    elif ext in (".xls", ".xlsx"):
        try:
            xls = pd.read_excel(path, sheet_name=None)
            for sheet, df in xls.items():
                table_name = f"{name}__{sheet}".replace(" ", "_")
                out[table_name] = df
        except Exception:
            log.exception("Failed to read Excel file: %s", path)
    return out


def connect_fabric_filesystem():
    if DataLakeServiceClient is None:
        raise RuntimeError("azure-storage-file-datalake not available")
    if not ONELAKE_URL:
        raise RuntimeError("ONELAKE_URL is not configured")
    tm = TokenManager()
    storage_token = tm.get_token_for_storage()
    if storage_token and CLIENT_SECRET:
        try:
            credential = ClientSecretCredential(
                tenant_id=TENANT_ID, client_id=CLIENT_ID, client_secret=CLIENT_SECRET
            )
            client = DataLakeServiceClient(account_url=ONELAKE_URL, credential=credential)
            return client
        except Exception:
            log.exception(
                "DataLakeServiceClient with ClientSecretCredential failed; falling back to token"
            )
    raise RuntimeError(
        "Could not create DataLakeServiceClient: ensure azure.identity available and CLIENT_SECRET configured"
    )


def upload_to_fabric(temp_root: str, workspace_id: str, lakehouse_id: str) -> Dict[str, List[str]]:
    client = connect_fabric_filesystem()
    fs = client.get_file_system_client(workspace_id)
    table_root_base = f"{lakehouse_id}/Tables"
    raw_root_base = f"{lakehouse_id}/RawFiles"
    tables_created = []
    raw_files_uploaded = []
    local_root = tempfile.mkdtemp()
    try:
        for root, dirs, files in os.walk(temp_root):
            for file in files:
                local_file_path = os.path.join(root, file)
                rel_path = os.path.relpath(local_file_path, temp_root)
                ext = Path(file).suffix.lower()
                if ext in SUPPORTED_TABLE_EXTS:
                    try:
                        tables = read_table_file(local_file_path)
                        for tbl_name, df in tables.items():
                            safe_table_name = tbl_name.replace("/", "_").replace("\\", "_")
                            tables_created.append(safe_table_name)
                            table_local_dir = Path(local_root) / safe_table_name
                            table_local_dir.mkdir(parents=True, exist_ok=True)
                            try:
                                if write_deltalake is None:
                                    parquet_path = table_local_dir / f"{safe_table_name}.parquet"
                                    df.to_parquet(str(parquet_path), index=False)
                                else:
                                    pa_tbl = pa.Table.from_pandas(df)
                                    write_deltalake(str(table_local_dir), pa_tbl, mode="overwrite")
                            except Exception:
                                log.exception(
                                    "Failed to write delta/parquet for table %s", safe_table_name
                                )
                                continue
                            for t_root, t_dirs, t_files in os.walk(table_local_dir):
                                rel_t = os.path.relpath(t_root, table_local_dir)
                                dest_dir = f"{table_root_base}/{safe_table_name}"
                                if rel_t and rel_t != ".":
                                    dest_dir = f"{dest_dir}/{rel_t}"
                                try:
                                    fs.get_directory_client(dest_dir).create_directory()
                                except Exception:
                                    pass
                                for t_file in t_files:
                                    with open(os.path.join(t_root, t_file), "rb") as fh:
                                        dest_path = f"{dest_dir}/{t_file}"
                                        fs.get_file_client(dest_path).upload_data(
                                            fh, overwrite=True
                                        )
                    except Exception:
                        log.exception("Failed processing tabular file: %s", local_file_path)
                else:
                    try:
                        dest_dir = (
                            f"{raw_root_base}/{os.path.dirname(rel_path)}".rstrip("/")
                        )
                        try:
                            fs.get_directory_client(dest_dir).create_directory()
                        except Exception:
                            pass
                        dest_path = f"{dest_dir}/{os.path.basename(local_file_path)}"
                        with open(local_file_path, "rb") as fh:
                            fs.get_file_client(dest_path).upload_data(
                                fh, overwrite=True
                            )
                        raw_files_uploaded.append(rel_path)
                    except Exception:
                        log.exception("Failed to upload raw file: %s", local_file_path)
    finally:
        try:
            shutil.rmtree(local_root)
        except Exception:
            pass
    return {"tables_created": tables_created, "raw_files_uploaded": raw_files_uploaded}


# ---------- Pipeline runner ----------

def run_pipeline(workspace_id: str, pipeline_id: str, parameters: Dict[str, str]) -> Dict:
    tm = TokenManager()
    fabric_token = tm.get_token_for_fabric()
    if not fabric_token:
        return {"status": "error", "error": "could not acquire fabric token"}
    url = f"{FABRIC_API_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances?jobType=Pipeline"
    payload = {"executionData": {"parameters": parameters}}
    headers = {"Authorization": f"Bearer {fabric_token}", "Content-Type": "application/json"}
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=60)
        if r.status_code in (200, 201, 202):
            loc = r.headers.get("Location", "")
            out = {"status": "started" if r.status_code == 202 else "ok", "code": r.status_code}
            if loc:
                out["location"] = loc
                out["job_id"] = loc.split("/")[-1]
            try:
                out["response"] = r.json() if r.content else {}
            except Exception:
                out["response_text"] = r.text
            return out
        else:
            return {"status": "error", "code": r.status_code, "text": r.text}
    except Exception:
        log.exception("run_pipeline failed")
        return {"status": "exception", "error": traceback.format_exc()}


def poll_job_status(location: str):
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return {"status": "error", "error": "no token"}

    try:
        r = requests.get(
            location, headers={"Authorization": f"Bearer {token}"}, timeout=REQUEST_TIMEOUT
        )

        if r.status_code != 200:
            return {"status": "error", "code": r.status_code, "text": r.text}

        data = r.json()

        job_status = (
            data.get("status")
            or data.get("properties", {}).get("status")
            or data.get("properties", {}).get("state")
        )

        return {"status": job_status, "raw": data}

    except Exception as e:
        return {"status": "exception", "error": str(e)}


def check_table_exists(workspace_id: str, lakehouse_id: str, table_name: str) -> bool:
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return False

    url = f"{FABRIC_API_BASE}/workspaces/{workspace_id}/lakehouses/{lakehouse_id}/sql/query"
    sql = f"""
        SELECT name
        FROM sys.tables
        WHERE LOWER(name) = LOWER('{table_name.replace(" ", "_")}')
    """

    payload = {"query": sql}

    res, _ = api_post(url, token, payload)
    if not res:
        return False

    try:
        rows = res["results"][0]["rows"]
        return len(rows) > 0
    except Exception:
        return False


def table_exists_via_api(workspace_id: str, lakehouse_id: str, table_name: str) -> bool:
    tm = TokenManager()
    fabric_token = tm.get_token_for_fabric()
    storage_token = tm.get_token_for_storage()

    if not (fabric_token and storage_token):
        return False

    tables = get_tables(workspace_id, lakehouse_id, fabric_token, storage_token)

    target = table_name.lower().replace(" ", "")
    for t in tables:
        name = t["name"].lower().replace(" ", "")
        if name == target:
            return True

    return False


# ---------- Notebook cell placeholder ----------

notebook_parameters_cell = r"""
# Parameters
sourceTable = "default_source_table_name"
destinationTable = "default_destination_name"
...
# (the rest of your notebook parameter cell)
"""

# ---------- Flask app ----------

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# ---------- Core API endpoints (original app.py) ----------

@app.route("/workspaces", methods=["GET"])
def api_workspaces():
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return jsonify({"error": "could not acquire fabric token"}), 500
    ws = get_workspaces(token)
    return jsonify({"value": ws})


@app.route("/lakehouses", methods=["GET"])
def api_lakehouses():
    workspace_id = request.args.get("workspace_id")
    if not workspace_id:
        return jsonify({"error": "workspace_id is required"}), 400
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return jsonify({"error": "could not acquire fabric token"}), 500
    l = get_lakehouses(workspace_id, token)
    return jsonify({"value": l})


@app.route("/workspaces/<ws_id>/lakehouses", methods=["GET"])
def api_lakehouses_ws_path(ws_id):
    if not ws_id:
        return jsonify({"error": "workspace id required"}), 400
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return jsonify({"error": "could not acquire fabric token"}), 500
    l = get_lakehouses(ws_id, token)
    return jsonify({"value": l})


@app.route("/pipelines", methods=["GET"])
def api_pipelines():
    workspace_id = request.args.get("workspace_id")
    if not workspace_id:
        return jsonify({"error": "workspace_id is required"}), 400
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return jsonify({"error": "could not acquire fabric token"}), 500
    p = get_pipelines(workspace_id, token)
    return jsonify({"value": p})


@app.route("/tables", methods=["GET"])
def api_tables():
    workspace_id = request.args.get("workspace_id")
    lakehouse_id = request.args.get("lakehouse_id")
    if not workspace_id or not lakehouse_id:
        return jsonify({"error": "workspace_id & lakehouse_id are required"}), 400
    tm = TokenManager()
    fabric_token = tm.get_token_for_fabric()
    storage_token = tm.get_token_for_storage()
    if not (fabric_token and storage_token):
        return jsonify({"error": "could not acquire tokens"}), 500
    t = get_tables(workspace_id, lakehouse_id, fabric_token, storage_token)
    return jsonify({"value": t})


@app.route("/search", methods=["GET"])
def api_search():
    keyword = request.args.get("keyword")
    if not keyword or len(keyword) < 2:
        return jsonify({"datasets": []})
    try:
        setup_kaggle()
        api = KaggleApi()
        api.authenticate()
        results = api.dataset_list(search=keyword)
        output = []
        for d in results[:50]:
            output.append(
                {"slug": d.ref, "name": d.title, "url": f"https://www.kaggle.com/{d.ref}"}
            )
        return jsonify({"datasets": output})
    except Exception:
        log.exception("Kaggle search failed")
        return jsonify({"error": traceback.format_exc()}), 500


@app.route("/import", methods=["POST"])
def api_import():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}
    slugs = data.get("slugs")
    workspace_id = data.get("workspace_id")
    lakehouse_id = data.get("lakehouse_id")
    if not slugs and data.get("slug"):
        slugs = [data.get("slug")]
    if not slugs or not isinstance(slugs, list):
        return jsonify({"error": "slugs must be a list"}), 400
    if not workspace_id or not lakehouse_id:
        return jsonify({"error": "workspace_id & lakehouse_id are required"}), 400

    log.info(
        "[IMPORT] payload received: slugs=%s workspace_id=%s lakehouse_id=%s",
        slugs,
        workspace_id,
        lakehouse_id,
    )

    results = {}

    def process(slug):
        try:
            temp_dir, _ = download_dataset(slug)
            try:
                out = upload_to_fabric(temp_dir, workspace_id, lakehouse_id)
                return slug, {"status": "success", **out}
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            log.exception("import failed for %s", slug)
            return slug, {"status": "failed", "error": traceback.format_exc()}

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(process, s): s for s in slugs}
        for fut in as_completed(futures):
            slug_key, res = fut.result()
            results[slug_key] = res

    return jsonify({"status": "completed", "results": results})


@app.route("/run-pipeline", methods=["POST"])
def api_run_pipeline():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}

    workspace_id = data.get("workspace_id")
    pipeline_id = data.get("pipeline_id")
    lakehouse_id = data.get("lakehouse_id")
    source_table = data.get("sourceTable") or data.get("source")
    destination_table = data.get("destinationTable") or data.get("destination")

    if not (
        workspace_id
        and pipeline_id
        and lakehouse_id
        and source_table
        and destination_table
    ):
        return (
            jsonify(
                {
                    "error": "workspace_id, pipeline_id, lakehouse_id, sourceTable, destinationTable required"
                }
            ),
            400,
        )

    params = {"sourceTable": source_table, "destinationTable": destination_table}
    start_res = run_pipeline(workspace_id, pipeline_id, params)

    start_res["lakehouse_id"] = lakehouse_id
    start_res["destination_table"] = destination_table

    return jsonify(start_res)


@app.route("/debug-tables", methods=["GET"])
def debug_tables():
    workspace_id = request.args.get("workspace_id")
    lakehouse_id = request.args.get("lakehouse_id")

    tm = TokenManager()
    token = tm.get_token_for_storage()
    if not token:
        return {"error": "no storage token"}, 500

    paths = list_onelake_paths(workspace_id, lakehouse_id, "Tables", token, recursive=True)
    return jsonify(paths)


@app.route("/poll-job", methods=["GET"])
def api_poll_job():
    location = request.args.get("location")
    workspace_id = request.args.get("workspace_id")
    lakehouse_id = request.args.get("lakehouse_id")
    destination_table = request.args.get("destination_table")

    if not all([location, workspace_id, lakehouse_id, destination_table]):
        return (
            jsonify(
                {
                    "error": "location, workspace_id, lakehouse_id, destination_table are required"
                }
            ),
            400,
        )

    status_res = poll_job_status(location)
    job_status = status_res.get("status")

    if job_status and job_status.lower() in ("succeeded", "completed"):
        exists = table_exists_via_api(workspace_id, lakehouse_id, destination_table)

        if exists:
            return jsonify(
                {
                    "status": "success",
                    "pipeline_status": job_status,
                    "table_saved": True,
                }
            )

        return jsonify(
            {
                "status": "waiting",
                "pipeline_status": job_status,
                "table_saved": False,
            }
        )

    return jsonify(status_res)


@app.route("/prediction/columns", methods=["GET"])
def api_prediction_columns():
    workspace_id = request.args.get("workspace_id")
    lakehouse_id = request.args.get("lakehouse_id")
    table_name = request.args.get("table_name")

    if not (workspace_id and lakehouse_id and table_name):
        return jsonify({
            "error": "workspace_id, lakehouse_id and table_name are required"
        }), 400

    tm = TokenManager()
    fabric_token = tm.get_token_for_fabric()
    storage_token = tm.get_token_for_storage()

    if not fabric_token:
        return jsonify({"error": "could not acquire fabric token"}), 500

    columns = get_table_columns(workspace_id, lakehouse_id, table_name, fabric_token)
    print(f"[DEBUG] API columns for {table_name} →", columns)

    if not columns:
        if not storage_token:
            print("[DEBUG] No storage token → cannot fetch delta columns.")
            return jsonify({"columns": []})

        print("[DEBUG] Falling back to _delta_log schema extraction…")

        columns = get_delta_columns_from_onelake(
            workspace_id,
            lakehouse_id,
            table_name,
            storage_token
        )

        print(f"[DEBUG] Delta columns for {table_name} →", columns)

    return jsonify({"columns": columns})


@app.route("/prediction/pipelines", methods=["GET"])
def api_prediction_pipelines():
    workspace_id = request.args.get("workspace_id")
    if not workspace_id:
        return jsonify({"error": "workspace_id is required"}), 400

    tm = TokenManager()
    fabric_token = tm.get_token_for_fabric()
    if not fabric_token:
        return jsonify({"error": "could not acquire fabric token"}), 500

    pipelines = get_prediction_pipelines_for_workspace(workspace_id, fabric_token)
    return jsonify({"value": pipelines})


@app.route("/prediction/launch", methods=["POST"])
def api_prediction_launch():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({"error": "invalid JSON"}), 400

    workspace_id = data.get("workspace_id")
    pipeline_id = data.get("pipeline_id")
    lakehouse_id = data.get("lakehouse_id")
    parameters = data.get("parameters") or {}

    if not (workspace_id and pipeline_id and parameters):
        return (
            jsonify(
                {
                    "error": "workspace_id, pipeline_id and parameters required"
                }
            ),
            400,
        )

    result = run_pipeline(workspace_id, pipeline_id, parameters)

    if lakehouse_id:
        result["lakehouse_id"] = lakehouse_id

    dest = (
        parameters.get("destinationTable")
        or parameters.get("destination_table")
        or parameters.get("destination")
    )
    if dest:
        result["destination_table"] = dest

    return jsonify(result)


@app.route("/notebook-cell", methods=["GET"])
def api_notebook_cell():
    return jsonify({"cell": notebook_parameters_cell})


# ---------- Semantic model / report helpers (from new11.py) ----------

def load_credentials(path="credentials.json"):
    if not os.path.exists(path):
        raise ValueError("Missing credentials.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    req = ["tenant_id", "client_id", "client_secret", "ado_org", "ado_project", "ado_repo", "ado_pat"]
    missing = [k for k in req if k not in data or not data[k]]
    if missing:
        raise ValueError(f"Missing keys in credentials.json: {missing}")
    return data


def get_token(tenant, client, secret, scope):
    url = f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
    r = requests.post(
        url,
        data={
            "grant_type": "client_credentials",
            "client_id": client,
            "client_secret": secret,
            "scope": scope,
        },
    )
    if r.status_code >= 300:
        raise RuntimeError(f"Token error: {r.status_code} - {r.text[:2000]}")
    return r.json().get("access_token")


def ado_list_items(org, project, repo, path, pat):
    api_version = "7.1-preview.1"
    url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/items"
    params = {"scopePath": path, "recursionLevel": "Full", "includeContent": "false", "api-version": api_version}
    r = requests.get(url, params=params, auth=HTTPBasicAuth('', pat))
    if r.status_code >= 300:
        raise RuntimeError(f"ADO list failed: {r.status_code} - {r.text[:1000]}")
    return r.json().get("value", [])


def ado_get_item_content(org, project, repo, item_path, pat):
    api_version = "7.1-preview.1"
    url = f"https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repo}/items"
    params = {"path": item_path, "api-version": api_version, "includeContent": "true"}
    r = requests.get(url, params=params, auth=HTTPBasicAuth('', pat))
    if r.status_code == 200:
        try:
            jr = r.json()
            if "content" in jr:
                return base64.b64decode(jr["content"])
            return json.dumps(jr, indent=2).encode("utf-8")
        except Exception:
            return r.content
    raise RuntimeError(f"ADO get content failed: {r.status_code} - {r.text[:1000]}")


def ado_search_for_tmdls(org, project, repo, pat):
    items = ado_list_items(org, project, repo, "", pat)
    if not items:
        return []
    return [it for it in items if it.get("path", "").lower().endswith(".tmdl")]


def trigger_pipeline(fabric_token, params=None):
    url = f"{FABRIC_BASE}/workspaces/{WORKSPACE_ID}/items/{PIPELINE_ID}/jobs/Pipeline/instances"
    headers = {"Authorization": f"Bearer {fabric_token}", "Content-Type": "application/json"}
    body = {"executionData": {"parameters": params}} if params else {}
    r = requests.post(url, headers=headers, json=body)
    if r.status_code != 202:
        raise RuntimeError(f"Pipeline trigger failed: {r.status_code} - {r.text[:2000]}")
    loc = r.headers.get("Location")
    run_id = loc.rstrip("/").split("/")[-1]
    return run_id


def poll_pipeline(fabric_token, run_id, timeout=PIPELINE_POLL_TIMEOUT, interval=PIPELINE_POLL_INTERVAL):
    url = f"{FABRIC_BASE}/workspaces/{WORKSPACE_ID}/items/{PIPELINE_ID}/jobs/instances/{run_id}"
    headers = {"Authorization": f"Bearer {fabric_token}"}
    waited = 0
    while waited < timeout:
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            data = r.json()
            status = data.get("status")
            if status in ("Succeeded", "Completed"):
                return data
            if status in ("Failed", "Error", "Cancelled"):
                raise RuntimeError(f"Pipeline failed: {json.dumps(data, indent=2)[:3000]}")
        else:
            print(f"Warning: pipeline status fetch returned {r.status_code}")
        time.sleep(interval)
        waited += interval
    raise RuntimeError("Pipeline poll timed out")


def _unescape_string(s):
    if not isinstance(s, str):
        s = str(s)
    s = s.strip()
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1]
    try:
        s = s.encode('utf-8').decode('unicode_escape')
    except Exception:
        s = s.replace("\\\\", "\\").replace('\\"', '"').replace("\\'", "'")
    return s


def clean_columns(cols):
    if not cols:
        return None
    cleaned = []
    for c in cols:
        c_str = _unescape_string(c)
        c_str = c_str.replace('"', '').replace("'", "").replace("\\", "").strip()
        if c_str:
            cleaned.append(c_str)
    seen = set()
    out = []
    for x in cleaned:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out if out else None


def get_pipeline_activities(fabric_token, run_id, pipeline_data):
    url = f"{FABRIC_BASE}/workspaces/{WORKSPACE_ID}/datapipelines/pipelineruns/{run_id}/queryactivityruns"
    headers = {"Authorization": f"Bearer {fabric_token}", "Content-Type": "application/json"}
    run_start_str = pipeline_data.get('result', {}).get('runStartTime')
    if run_start_str:
        try:
            run_start = datetime.fromisoformat(run_start_str.replace('Z', '+00:00'))
            last_updated_after = (run_start - timedelta(minutes=5)).isoformat().replace('+00:00', 'Z')
        except Exception:
            last_updated_after = (datetime.utcnow() - timedelta(hours=1)).isoformat() + 'Z'
    else:
        last_updated_after = (datetime.utcnow() - timedelta(hours=1)).isoformat() + 'Z'
    last_updated_before = datetime.utcnow().isoformat() + 'Z'
    body = {
        "filters": [],
        "orderBy": [{"orderBy": "ActivityRunStart", "order": "DESC"}],
        "lastUpdatedAfter": last_updated_after,
        "lastUpdatedBefore": last_updated_before,
    }
    r = requests.post(url, headers=headers, json=body)
    if r.status_code != 200:
        raise RuntimeError(f"Failed to query activity runs: {r.status_code} - {r.text[:2000]}")
    payload = r.json()
    activities = payload if isinstance(payload, list) else payload.get("value", [])
    return activities


def extract_columns_from_activity_output(activity_output, table_name):
    candidates = []
    if isinstance(activity_output, dict):
        for k in ("result", "output", "exitValue", "message", "details"):
            v = activity_output.get(k)
            if v:
                candidates.append(v if isinstance(v, str) else json.dumps(v))
        if activity_output.get("result") and isinstance(activity_output["result"], dict):
            for k in ("exitValue", "output", "message"):
                v = activity_output["result"].get(k)
                if v:
                    candidates.append(v if isinstance(v, str) else json.dumps(v))
    else:
        candidates.append(str(activity_output))
    for cand in candidates:
        s = cand if isinstance(cand, str) else json.dumps(cand)
        try:
            parsed = json.loads(s)
            if isinstance(parsed, dict):
                if "columns" in parsed and isinstance(parsed["columns"], list):
                    return parsed["columns"]
                if "error" in parsed and isinstance(parsed["error"], str):
                    s = parsed["error"]
                else:
                    s = json.dumps(parsed)
            elif isinstance(parsed, list) and all(isinstance(x, str) for x in parsed):
                return parsed
        except Exception:
            pass
        patterns = [
            rf"Table\s+'{re.escape(table_name)}'\s+not found or could be read:\s*(\[[^\]]+\])",
            rf"Table\s+'{re.escape(table_name)}'\s+not found or could not be read:\s*(\[[^\]]+\])",
            r"columns\s*[:=]\s*(\[[^\]]+\])",
            r"Columns\s*[:=]\s*(\[[^\]]+\])",
            r"(\[[\s\r\n]*\"[^\]]+\"\s*\])",
        ]
        for patt in patterns:
            m = re.search(patt, s, re.IGNORECASE | re.DOTALL)
            if m:
                txt = m.group(1)
                try:
                    arr = json.loads(txt)
                    return arr
                except Exception:
                    inner = txt.strip().lstrip("[").rstrip("]")
                    parts = [p.strip().strip('"').strip("'") for p in inner.split(",") if p.strip()]
                    if parts:
                        return parts
        any_arr = re.search(r"(\[[\s\S]{1,2000}?\])", s)
        if any_arr:
            try:
                arr = json.loads(any_arr.group(1))
                if isinstance(arr, list):
                    return arr
            except Exception:
                pass
    return None


def get_columns_from_pipeline(fabric_token, run_id, table_name, pipeline_data):
    activities = get_pipeline_activities(fabric_token, run_id, pipeline_data)
    for act in activities:
        if act.get("activityType") == "TridentNotebook":
            output = act.get("output") or act.get("result") or act
            cols = extract_columns_from_activity_output(output, table_name)
            if cols:
                return cols
    root_exit = pipeline_data.get("result", {}).get("exitValue") or pipeline_data.get("result", {}).get("output")
    if root_exit:
        try:
            parsed = json.loads(root_exit)
            if isinstance(parsed, dict) and "error" in parsed and isinstance(parsed["error"], str):
                arrm = re.search(r"(\[[^\]]+\])", parsed["error"])
                if arrm:
                    try:
                        return json.loads(arrm.group(1))
                    except Exception:
                        pass
        except Exception:
            pass
    return None


def _find_table_block_indices_legacy(text, table_name):
    m = re.search(r'^\s*table\s+' + re.escape(table_name) + r'\s*$', text, flags=re.MULTILINE)
    if not m:
        m_any = re.search(r'^\s*table\s+\w+\s*$', text, flags=re.MULTILINE)
        if not m_any:
            return (None, None)
        start = m_any.start()
    else:
        start = m.start()
    part = re.search(r'^\s*partition\s+' + re.escape(table_name) + r'\b', text[start:], flags=re.MULTILINE)
    if part:
        part_start = start + part.start()
        next_table = re.search(r'^\s*table\s+\w+\s*$', text[part_start + 1 :], flags=re.MULTILINE)
        if next_table:
            part_end = part_start + 1 + next_table.start()
        else:
            part_end = len(text)
        return (start, part_start, part_start, part_end)
    else:
        next_table = re.search(r'^\s*table\s+\w+\s*$', text[start + 1 :], flags=re.MULTILINE)
        if next_table:
            end = start + 1 + next_table.start()
        else:
            end = len(text)
        return (start, end, None, None)


def transform_golden_legacy(golden_bytes, old_name, new_name, columns=None):
    text = golden_bytes.decode('utf-8', errors='replace')
    if not columns:
        new_text = text.replace(old_name, new_name)
        new_text = re.sub(
            r'(Item\s*=\s*")Files?/[^"]*(")',
            rf'\1Files/{new_name}\2',
            new_text,
            flags=re.IGNORECASE,
        )
        new_text = re.sub(
            r'(\blineageTag\s*:\s*)([^\r\n]+)',
            lambda m: f"{m.group(1)}{uuid.uuid4()}",
            new_text,
            flags=re.IGNORECASE,
        )
        return new_text.encode('utf-8')

    res = _find_table_block_indices_legacy(text, old_name)
    if not res or res[0] is None:
        print("Could not find original table block; falling back to rename-only.")
        return transform_golden_legacy(golden_bytes, old_name, new_name, columns=None)
    table_start, table_end, part_start, part_end = res

    lines = []
    lines.append(f"table {new_name}")
    lines.append(f"\tlineageTag: {uuid.uuid4()}")
    lines.append(f"\tsourceLineageTag: [dbo].[{new_name}]")
    lines.append("")

    for col in columns:
        col_guid = uuid.uuid4()
        lines.append(f"\tcolumn {col}")
        lines.append(f"\t\tdataType: string")
        lines.append(f"\t\tlineageTag: {col_guid}")
        lines.append(f"\t\tsourceLineageTag: {col}")
        lines.append(f"\t\tsummarizeBy: none")
        lines.append(f"\t\tsourceColumn: {col}")
        lines.append("")
        lines.append(f"\t\tannotation SummarizationSetBy = Automatic")
        lines.append("")

    lines.append(f"\tpartition {new_name} = entity")
    lines.append(f"\t\tmode: directLake")
    lines.append(f"\t\tsource")
    lines.append(f"\t\t\tentityName: {new_name}")
    lines.append(f"\t\t\texpressionSource: 'DirectLake - DataLakehouse'")
    new_block = "\n".join(lines) + "\n"

    if part_start is not None:
        tail = text[part_end:]
    else:
        tail = text[table_end:]
    prefix = text[:table_start]
    new_text = prefix + new_block + tail

    new_text = new_text.replace(old_name, new_name)
    new_text = re.sub(
        r'(\blineageTag\s*:\s*)([^\r\n]+)',
        lambda m: f"{m.group(1)}{uuid.uuid4()}",
        new_text,
        flags=re.IGNORECASE,
    )
    new_text = re.sub(
        r'(Item\s*=\s*")Files?/[^"]*(")',
        rf'\1Files/{new_name}\2',
        new_text,
        flags=re.IGNORECASE,
    )

    return new_text.encode('utf-8')


def build_parts_from_ado(creds, new_table_name, columns=None):
    items = ado_list_items(
        creds["ado_org"], creds["ado_project"], creds["ado_repo"], ADO_TEMPLATE_PATH, creds["ado_pat"]
    )
    parts = []
    golden = None
    for item in items:
        if item.get("isFolder"):
            continue
        rel = item["path"][len(ADO_TEMPLATE_PATH):].lstrip("/\\").replace("\\", "/")
        content = ado_get_item_content(
            creds["ado_org"],
            creds["ado_project"],
            creds["ado_repo"],
            item["path"],
            creds["ado_pat"],
        )
        if rel == GOLDEN_TABLE_REL:
            golden = content
            continue
        parts.append(
            {
                "path": rel,
                "payload": base64.b64encode(content).decode('utf-8'),
                "payloadType": "InlineBase64",
            }
        )
    if golden is None:
        cand = ado_search_for_tmdls(
            creds["ado_org"], creds["ado_project"], creds["ado_repo"], creds["ado_pat"]
        )
        if not cand:
            raise RuntimeError("No .tmdl found")
        golden = ado_get_item_content(
            creds["ado_org"], creds["ado_project"], creds["ado_repo"], cand[0]["path"], creds["ado_pat"]
        )

    transformed = transform_golden_legacy(golden, GOLDEN_TABLE_NAME, new_table_name, columns=columns)
    parts.append(
        {
            "path": f"definition/tables/{new_table_name}.tmdl",
            "payload": base64.b64encode(transformed).decode('utf-8'),
            "payloadType": "InlineBase64",
        }
    )
    return parts


def upload_parts_to_fabric(fabric_token, display_name, parts):
    endpoint = f"{FABRIC_BASE}/workspaces/{WORKSPACE_ID}/semanticModels"
    headers = {"Authorization": f"Bearer {fabric_token}", "Content-Type": "application/json"}
    body = {"displayName": display_name, "definition": {"parts": parts}}
    r = requests.post(endpoint, headers=headers, json=body)
    if r.status_code not in (200, 201, 202):
        raise RuntimeError(f"Upload failed: {r.text[:2000]}")
    status_url = r.headers.get("Location") or r.headers.get("location")
    if not status_url:
        return None
    for _ in range(MODEL_POLL_ATTEMPTS):
        time.sleep(MODEL_POLL_INTERVAL)
        pr = requests.get(status_url, headers=headers)
        if pr.status_code != 200:
            continue
        pj = pr.json()
        st = pj.get("status")
        if st == "Succeeded":
            return pj.get("result", {}).get("resourceId")
        if st == "Failed":
            raise RuntimeError(f"Model create failed: {json.dumps(pj.get('error', {}), indent=2)}")
    raise RuntimeError("Model create timed out")


def find_pbi_dataset(pbi_token, name):
    url = f"{PBI_BASE}/groups/{WORKSPACE_ID}/datasets"
    r = requests.get(url, headers={"Authorization": f"Bearer {pbi_token}"})
    if r.status_code != 200:
        raise RuntimeError(f"Failed to list datasets: {r.status_code}")
    for ds in r.json().get("value", []):
        if ds.get("name") == name:
            return ds.get("id")
    return None


def clone_pbi_report(pbi_token, template_id, dataset_id, new_name):
    url = f"{PBI_BASE}/groups/{WORKSPACE_ID}/reports/{template_id}/Clone"
    body = {"name": new_name, "targetModelId": dataset_id, "targetWorkspaceId": WORKSPACE_ID}
    r = requests.post(
        url,
        json=body,
        headers={"Authorization": f"Bearer {pbi_token}", "Content-Type": "application/json"},
    )
    if r.status_code >= 300:
        raise RuntimeError(f"Report clone failed: {r.status_code} - {r.text[:2000]}")
    return r.json()


def execute_model_creation(
    new_table,
    model_display=None,
    report_name=None,
    template_report_id=TEMPLATE_REPORT_ID,
    should_trigger=False,
):
    creds = load_credentials()
    fabric_token = get_token(creds["tenant_id"], creds["client_id"], creds["client_secret"], FABRIC_SCOPE)
    pbi_token = get_token(creds["tenant_id"], creds["client_id"], creds["client_secret"], PBI_SCOPE)

    model_display = model_display or f"{new_table} SM"
    report_name = report_name or f"{new_table} R"

    columns = None
    if should_trigger:
        run_id = trigger_pipeline(fabric_token, params={"table_name": new_table})
        pipeline_data = poll_pipeline(fabric_token, run_id)
        raw_cols = get_columns_from_pipeline(fabric_token, run_id, new_table, pipeline_data)
        columns = clean_columns(raw_cols)

    parts = build_parts_from_ado(creds, new_table, columns=columns)
    model_id = upload_parts_to_fabric(fabric_token, model_display, parts)
    time.sleep(20)
    dataset_id = find_pbi_dataset(pbi_token, model_display)
    if not dataset_id:
        raise RuntimeError("Dataset not found")
    clone_res = clone_pbi_report(pbi_token, template_report_id, dataset_id, report_name)
    return {
        "model_id": model_id,
        "dataset_id": dataset_id,
        "report_url": clone_res.get("webUrl"),
        "cleaned_columns": columns,
        "success": True,
    }


# ---------- Extra routes from new11.py (integrated) ----------

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"})


@app.route("/create-model", methods=["POST"])
def create_model():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON body provided"}), 400

        new_table = data.get("new_table")
        if not new_table:
            return jsonify({"error": "Missing required field: new_table"}), 400

        model_display = data.get("model_display")
        report_name = data.get("report_name")
        template_report_id = data.get("template_report_id", TEMPLATE_REPORT_ID)
        should_trigger = data.get("should_trigger", False)

        result = execute_model_creation(
            new_table=new_table,
            model_display=model_display,
            report_name=report_name,
            template_report_id=template_report_id,
            should_trigger=should_trigger,
        )
        return jsonify(result), 200

    except ValueError as e:
        return jsonify({"error": str(e), "success": False}), 400
    except RuntimeError as e:
        return jsonify({"error": str(e), "success": False}), 500
    except Exception as e:
        return jsonify({"error": f"Unexpected error: {str(e)}", "success": False}), 500


# ---------- Run ----------

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    log.info("Starting combined API on port %s", port)
    app.run(host="0.0.0.0", port=port, debug=True)