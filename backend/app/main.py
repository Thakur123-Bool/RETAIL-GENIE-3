import os
import json
import tempfile 
import shutil
import logging
import time
import traceback
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
import pandas as pd
import pyarrow as pa

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

# ---------- Config & constants ----------
# reduce noisy azure/request logging by default; keep warnings+errors visible
logging.basicConfig(level=logging.WARNING)
log = logging.getLogger("combined-api")
# keep module-level logger objects for your own info-level messages
log.setLevel(logging.INFO)

# also lower some very noisy libraries to WARNING
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.identity").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("msal").setLevel(logging.WARNING)
logging.getLogger("requests").setLevel(logging.WARNING)

# Use values from your original code if present
FABRIC_API = "https://api.fabric.microsoft.com/v1"
ONELAKE_DFS = os.getenv("ONELAKE_DFS", "https://onelake.dfs.fabric.microsoft.com")
DFS_VERSION = os.getenv("DFS_VERSION", "2023-11-03")
MAX_RESULTS = int(os.getenv("MAX_RESULTS", "5000"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))

# MSAL names (kept for backwards compatibility)
TENANT_ID = os.getenv("FABRIC_TENANT_ID") or os.getenv("TENANT_ID") or os.getenv("TENANT")
CLIENT_ID = os.getenv("FABRIC_CLIENT_ID") or os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")  # optional - if present, use service-principal flow

# Kaggle config
KAGGLE_USERNAME = os.getenv("KAGGLE_USERNAME")
KAGGLE_KEY = os.getenv("KAGGLE_KEY")

ONELAKE_URL = os.getenv("ONELAKE_URL")  # required for DataLakeServiceClient
FABRIC_API_BASE = FABRIC_API

# Token cache filenames
CACHE_FILE = os.getenv("MSAL_CACHE_FILE", "msal_token_cache.bin")
TOKEN_FILE = os.getenv("FABRIC_TOKEN_FILE", "fabric_bearer_token.txt")

# ---------- Token manager (supports device-flow MSAL and optionally service principal) ----------
SCOPE_FABRIC = ["https://api.fabric.microsoft.com/.default"]
SCOPE_STORAGE = ["https://storage.azure.com/.default"]


class TokenManager:
    """
    If CLIENT_SECRET present -> uses ClientSecretCredential (service principal).
    Otherwise falls back to MSAL device-flow (interactive).
    """
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
        self._use_sp = bool(CLIENT_SECRET and CLIENT_ID and TENANT_ID and ClientSecretCredential is not None)
        if not self._use_sp and msal is None:
            log.warning("MSAL not available and SERVICE PRINCIPAL not configured - auth may fail.")

        if self._use_sp:
            # service principal credential
            self.cred = ClientSecretCredential(tenant_id=TENANT_ID, client_id=CLIENT_ID, client_secret=CLIENT_SECRET)
            log.info("TokenManager: using ClientSecretCredential (service principal).")
        else:
            # msal public client (device flow)
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
                self.app = msal.PublicClientApplication(CLIENT_ID, authority=authority, token_cache=self.cache)
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
        # service principal path
        if self._use_sp:
            try:
                # azure.identity returns AccessToken with .token attribute
                token = self.cred.get_token(*scopes)  # azure.identity accepts scope string(s)
                t = token.token if token else None
                if scopes == SCOPE_FABRIC:
                    self.fabric_token = t
                else:
                    self.storage_token = t
                return t
            except Exception as e:
                log.exception("Service principal token acquisition failed")
                return None

        # msal/device-flow path
        if not self.app:
            log.error("No MSAL app configured")
            return None

        # try silent
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

        # device flow
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

# ---------- API helpers (get/post) ----------
def api_get(url: str, token: str, params: dict = None) -> Optional[Dict]:
    try:
        r = requests.get(url, headers={"Authorization": f"Bearer {token}"}, params=params or {}, timeout=REQUEST_TIMEOUT)
        if r.status_code == 200:
            return r.json()
        log.error("GET %s -> %s : %s", url, r.status_code, r.text)
        return None
    except Exception:
        log.exception("api_get failed")
        return None

def api_post(url: str, token: str, data: Dict) -> Tuple[Optional[Dict], Optional[requests.Response]]:
    try:
        r = requests.post(url, headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, json=data, timeout=60)
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

# ---------- Onelake listing (used to detect tables) ----------
def list_onelake_paths(ws_id: str, lh_id: str, path: str, token: str, recursive: bool = True) -> List[Dict]:
    paths: List[Dict] = []
    cont = None
    for _ in range(10):
        params = {"resource": "filesystem", "recursive": str(recursive).lower(), "maxResults": str(MAX_RESULTS)}
        if path and path not in ["/", ""]:
            params["directory"] = path.strip("/")
        if cont:
            params["continuation"] = cont
        headers = {"Authorization": f"Bearer {token}", "x-ms-version": DFS_VERSION}
        try:
            r = requests.get(f"{ONELAKE_DFS}/{ws_id}/{lh_id}", headers=headers, params=params, timeout=REQUEST_TIMEOUT)
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
    data = api_get(f"{FABRIC_API_BASE}/workspaces/{ws_id}/items", fabric_token, params={"type": "DataPipeline"})
    return data.get("value", []) if data else []

# def get_tables(ws_id: str, lh_id: str, fabric_token: str, storage_token: str) -> List[Dict]:
#     tables: List[Dict] = []
#     api_data = api_get(f"{FABRIC_API_BASE}/workspaces/{ws_id}/lakehouses/{lh_id}/tables", fabric_token)
#     if api_data:
#         for t in api_data.get("value", []):
#             tables.append({"id": t.get("id", ""), "name": t.get("name", ""), "source": "api"})
#     # also check onelake for delta folders to augment list
#     if storage_token:
#         paths = list_onelake_paths(ws_id, lh_id, "Tables", storage_token, True)
#         for p in paths:
#             if p.get("isDirectory") and "_delta_log" in p.get("name", ""):
#                 name = p["name"].split("/_delta_log")[0].split("/")[-1]
#                 if name and not any(tt["name"] == name for tt in tables):
#                     tables.append({"id": "", "name": name, "source": "onelake"})
#     return tables

def get_tables(ws_id: str, lh_id: str, fabric_token: str, storage_token: str) -> List[Dict]:
    tables = []

    # -------------------------------
    # 1) Fabric API tables
    # -------------------------------
    api_data = api_get(f"{FABRIC_API_BASE}/workspaces/{ws_id}/lakehouses/{lh_id}/tables", fabric_token)

    if api_data:
        for t in api_data.get("value", []):
            tables.append({
                "id": t.get("id", ""),
                "name": t.get("name", ""),
                "folder": t.get("location", "").split("/")[-1],  # REAL folder
                "source": "api",
            })

    # -------------------------------
    # 2) Onelake scan for delta tables
    # -------------------------------
    paths = list_onelake_paths(ws_id, lh_id, "Tables", storage_token, recursive=True)

    delta_folders = set()
    for p in paths:
        if p.get("isDirectory") and p["name"].endswith("_delta_log"):
            folder = p["name"].replace("/_delta_log", "").split("/")[-1]
            delta_folders.add(folder)

    for folder in sorted(delta_folders):
        if not any(t["folder"] == folder for t in tables):
            tables.append({
                "id": "",
                "name": folder,       # UI will show this
                "folder": folder,     # REAL folder used to read delta log
                "source": "onelake",
            })

    return tables


def get_table_columns(workspace_id: str, lakehouse_id: str, table_name: str, fabric_token: str) -> List[str]:
    """
    Fetch real column names for a given Lakehouse table.
    Extracted from apps.py prediction helper.
    """
    url = f"{FABRIC_API_BASE}/workspaces/{workspace_id}/lakehouses/{lakehouse_id}/tables/{table_name}"
    data = api_get(url, fabric_token)
    if data and "columns" in data:
        try:
            return [col["name"] for col in data.get("columns", []) if isinstance(col, dict) and "name" in col]
        except Exception:
            log.exception("Failed to parse columns for table %s", table_name)
    log.info("Could not fetch columns for table %s", table_name)
    return []

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

# ---------- File reading & upload (same as your code) ----------
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
    # prefer service principal if available
    tm = TokenManager()
    storage_token = tm.get_token_for_storage()
    if storage_token and CLIENT_SECRET:
        # if using service principal we can construct DataLakeServiceClient with credential instead of token
        try:
            credential = ClientSecretCredential(tenant_id=TENANT_ID, client_id=CLIENT_ID, client_secret=CLIENT_SECRET)
            client = DataLakeServiceClient(account_url=ONELAKE_URL, credential=credential)
            return client
        except Exception:
            log.exception("DataLakeServiceClient with ClientSecretCredential failed; falling back to token")
    # fallback to token-based client (requires azure sdk support for token credentialless + SAS-like patterns)
    # For simplicity, use ClientSecretCredential if present. Otherwise raise error.
    raise RuntimeError("Could not create DataLakeServiceClient: ensure azure.identity available and CLIENT_SECRET configured")

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
                                    # fallback: write parquet if deltalake missing
                                    parquet_path = table_local_dir / f"{safe_table_name}.parquet"
                                    df.to_parquet(str(parquet_path), index=False)
                                else:
                                    pa_tbl = pa.Table.from_pandas(df)
                                    write_deltalake(str(table_local_dir), pa_tbl, mode="overwrite")
                            except Exception:
                                log.exception("Failed to write delta/parquet for table %s", safe_table_name)
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
                                        fs.get_file_client(dest_path).upload_data(fh, overwrite=True)
                    except Exception:
                        log.exception("Failed processing tabular file: %s", local_file_path)
                else:
                    try:
                        dest_dir = f"{raw_root_base}/{os.path.dirname(rel_path)}".rstrip("/")
                        try:
                            fs.get_directory_client(dest_dir).create_directory()
                        except Exception:
                            pass
                        dest_path = f"{dest_dir}/{os.path.basename(local_file_path)}"
                        with open(local_file_path, "rb") as fh:
                            fs.get_file_client(dest_path).upload_data(fh, overwrite=True)
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
        r = requests.get(location, headers={"Authorization": f"Bearer {token}"}, timeout=REQUEST_TIMEOUT)

        if r.status_code != 200:
            return {"status": "error", "code": r.status_code, "text": r.text}

        data = r.json()

        job_status = (
            data.get("status") or
            data.get("properties", {}).get("status") or
            data.get("properties", {}).get("state")
        )

        return {
            "status": job_status,
            "raw": data
        }

    except Exception as e:
        return {"status": "exception", "error": str(e)}
    

def check_table_exists(workspace_id: str, lakehouse_id: str, table_name: str) -> bool:
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return False

    # Fabric SQL query endpoint
    url = f"{FABRIC_API_BASE}/workspaces/{workspace_id}/lakehouses/{lakehouse_id}/sql/query"

    # SQL to check table
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
    except:
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

def resolve_table_path(workspace_id, lakehouse_id, table_name, source):
    if source == "api":
        return f"{ONELAKE_DFS}/{workspace_id}/{lakehouse_id}/Tables/{table_name}/_delta_log"
    else:
        return f"{ONELAKE_DFS}/{workspace_id}/{lakehouse_id}/{table_name}/_delta_log"


# ---------- Notebook cell (string) ----------
notebook_parameters_cell = r"""
# Parameters
sourceTable = "default_source_table_name"
destinationTable = "default_destination_name"
...
# (the rest of your notebook parameter cell)
"""

# ---------- Flask app & endpoints ----------
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route("/workspaces", methods=["GET"])
def api_workspaces():
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return jsonify({"error": "could not acquire fabric token"}), 500
    ws = get_workspaces(token)
    return jsonify({"value": ws})

# keep existing query-parameter endpoint (existing frontend code uses this)
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

# NEW: compatibility route (some frontends call /workspaces/<id>/lakehouses)
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
        return jsonify({"error":"workspace_id is required"}), 400
    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return jsonify({"error":"could not acquire fabric token"}), 500
    p = get_pipelines(workspace_id, token)
    return jsonify({"value": p})

@app.route("/prediction/pipelines", methods=["GET"])
def api_prediction_pipelines():
    """
    Return pipelines that look like prediction/ML pipelines.
    Heuristic copied from apps.py: filter by name containing pred/forecast/ml/model.
    """
    workspace_id = request.args.get("workspace_id")
    if not workspace_id:
        return jsonify({"error": "workspace_id is required"}), 400

    tm = TokenManager()
    token = tm.get_token_for_fabric()
    if not token:
        return jsonify({"error": "could not acquire fabric token"}), 500

    pipelines = get_pipelines(workspace_id, token)
    # Prefer prediction-style pipelines
    pred_pipes = [
        p for p in pipelines
        if any(
            kw in (p.get("displayName") or p.get("name") or "").lower()
            for kw in ["pred", "forecast", "ml", "model"]
        )
    ]
    if not pred_pipes:
        pred_pipes = pipelines

    return jsonify({"value": pred_pipes})

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

@app.route("/prediction/columns", methods=["GET"])
def api_prediction_columns():
    workspace_id = request.args.get("workspace_id")
    lakehouse_id = request.args.get("lakehouse_id")
    table_name = request.args.get("table_name")   # Display name
    folder = request.args.get("folder")           # NEW — REAL folder path
    source = request.args.get("source")           # "api" | "onelake"

    if not (workspace_id and lakehouse_id and table_name):
        return jsonify({"error": "workspace_id, lakehouse_id, table_name required"}), 400

    tm = TokenManager()
    fabric_token = tm.get_token_for_fabric()
    storage_token = tm.get_token_for_storage()

    if not (fabric_token and storage_token):
        return jsonify({"columns": [], "warning": "no tokens"}), 200

    # ---------------------------------------------------------
    # 1️⃣ Determine correct delta directory path
    # ---------------------------------------------------------

    # If frontend provides real folder, use it immediately
    if folder:
        real_path = f"Tables/{folder}"

    else:
        # TABLE CAME FROM API
        if source == "api":
            meta_url = f"{FABRIC_API}/workspaces/{workspace_id}/lakehouses/{lakehouse_id}/tables/{table_name}"
            meta = api_get(meta_url, fabric_token)

            if meta and "location" in meta:
                # Fabric API returns something like: "Tables/Blinkit_Orders"
                real_path = meta["location"].strip("/")
            else:
                real_path = f"Tables/{table_name}"
        else:
            # OneLake discovered table
            real_path = f"Tables/{table_name}"

    # ---------------------------------------------------------
    # 2️⃣ Access delta log
    # ---------------------------------------------------------

    base_url = f"{ONELAKE_DFS}/{workspace_id}/{lakehouse_id}/{real_path}/_delta_log"
    headers = {"Authorization": f"Bearer {storage_token}", "x-ms-version": DFS_VERSION}

    r = requests.get(base_url, headers=headers, params={"resource": "directory"}, timeout=30)
    if r.status_code != 200:
        return jsonify({"columns": [], "warning": f"cannot access delta log: {r.status_code}"}), 200

    files = [
        p["name"] for p in r.json().get("paths", [])
        if p["name"].endswith(".json")
    ]

    if not files:
        return jsonify({"columns": [], "warning": "no delta log json"}), 200

    latest = sorted(files)[-1]
    log_url = f"{base_url}/{latest}"

    r2 = requests.get(log_url, headers=headers, timeout=30)
    if r2.status_code != 200:
        return jsonify({"columns": [], "warning": "cannot read log"}), 200

    log_entries = [json.loads(line) for line in r2.text.splitlines()]

    # ---------------------------------------------------------
    # 3️⃣ Extract schemaString (Fabric Delta)
    # ---------------------------------------------------------
    for e in log_entries:
        meta = e.get("metaData")
        if meta and "schemaString" in meta:
            try:
                schema = json.loads(meta["schemaString"])
                cols = [f["name"] for f in schema.get("fields", [])]
                return jsonify({"columns": cols})
            except:
                pass

    # ---------------------------------------------------------
    # 4️⃣ Extract schema (classic delta)
    # ---------------------------------------------------------
    for e in log_entries:
        add = e.get("add")
        if add and "schema" in add:
            try:
                schema = json.loads(add["schema"])
                cols = [f["name"] for f in schema.get("fields", [])]
                return jsonify({"columns": cols})
            except:
                pass

    # If nothing found
    return jsonify({"columns": [], "warning": "schema not found"}), 200




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
            output.append({"slug": d.ref, "name": d.title, "url": f"https://www.kaggle.com/{d.ref}"})
        return jsonify({"datasets": output})
    except Exception:
        log.exception("Kaggle search failed")
        return jsonify({"error": traceback.format_exc()}), 500

@app.route("/import", methods=["POST"])
def api_import():
    # robust JSON parsing: accept application/json and also fallback
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}
    slugs = data.get("slugs")
    workspace_id = data.get("workspace_id")
    lakehouse_id = data.get("lakehouse_id")
    # Accept single "slug" also
    if not slugs and data.get("slug"):
        slugs = [data.get("slug")]
    if not slugs or not isinstance(slugs, list):
        return jsonify({"error":"slugs must be a list"}), 400
    if not workspace_id or not lakehouse_id:
        return jsonify({"error":"workspace_id & lakehouse_id are required"}), 400

    # Log incoming payload for easier debugging (your frontend should show this payload in devtools as well)
    log.info("[IMPORT] payload received: slugs=%s workspace_id=%s lakehouse_id=%s", slugs, workspace_id, lakehouse_id)

    results = {}
    def process(slug):
        try:
            temp_dir, _ = download_dataset(slug)
            try:
                out = upload_to_fabric(temp_dir, workspace_id, lakehouse_id)
                return slug, {"status":"success", **out}
            finally:
                shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            log.exception("import failed for %s", slug)
            return slug, {"status":"failed", "error": traceback.format_exc()}

    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {ex.submit(process, s): s for s in slugs}
        for fut in as_completed(futures):
            slug_key, res = fut.result()
            results[slug_key] = res

    return jsonify({"status":"completed", "results": results})



@app.route("/run-pipeline", methods=["POST"])
def api_run_pipeline():
    """
    Cleaning (or generic) pipeline launcher.
    For prediction pipelines, prefer /prediction/launch which allows full parameter dict.
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}

    workspace_id = data.get("workspace_id")
    pipeline_id = data.get("pipeline_id")
    lakehouse_id = data.get("lakehouse_id")  # IMPORTANT
    source_table = data.get("sourceTable") or data.get("source")
    destination_table = data.get("destinationTable") or data.get("destination")

    if not (workspace_id and pipeline_id and lakehouse_id and source_table and destination_table):
        return jsonify({"error": "workspace_id, pipeline_id, lakehouse_id, sourceTable, destinationTable required"}), 400

    params = {"sourceTable": source_table, "destinationTable": destination_table}
    start_res = run_pipeline(workspace_id, pipeline_id, params)

    # Attach lakehouse id + destination table for follow-up polling
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

    paths = list_onelake_paths(workspace_id, lakehouse_id, "Tables", token, recursive=False)
    return jsonify(paths)

@app.route("/poll-job", methods=["GET"])
def api_poll_job():
    location = request.args.get("location")
    workspace_id = request.args.get("workspace_id")
    lakehouse_id = request.args.get("lakehouse_id")
    destination_table = request.args.get("destination_table")

    if not all([location, workspace_id, lakehouse_id, destination_table]):
        return jsonify({"error": "location, workspace_id, lakehouse_id, destination_table are required"}), 400

    status_res = poll_job_status(location)
    job_status = status_res.get("status")

    # treat completed as success
    if job_status and job_status.lower() in ("succeeded", "completed"):
        
        # **IMPORTANT**: DO NOT normalize name here 
        exists = table_exists_via_api(workspace_id, lakehouse_id, destination_table)

        if exists:
            return jsonify({
                "status": "success",
                "pipeline_status": job_status,
                "table_saved": True
            })

        return jsonify({
            "status": "waiting",
            "pipeline_status": job_status,
            "table_saved": False
        })

    return jsonify(status_res)

@app.route("/prediction/poll", methods=["GET"])
def api_prediction_poll():
    """
    Lightweight polling endpoint for prediction pipelines.
    It just forwards to poll_job_status and returns raw job status,
    without checking for any table existence.
    """
    location = request.args.get("location")
    if not location:
        return jsonify({"error": "location is required"}), 400

    status_res = poll_job_status(location)
    return jsonify(status_res)

@app.route("/prediction/launch", methods=["POST"])
def api_prediction_launch():
    """
    Launch a prediction pipeline programmatically.
    Body JSON:
    {
        "workspace_id": "...",
        "pipeline_id": "...",
        "lakehouse_id": "...",   # optional but recommended
        "parameters": {
            "sourceTable": "...",
            "destinationTable": "...",
            "dateColumn": "...",
            "targetColumn": "...",
            "startDate": "...",
            "endDate": "...",
            "forecastHorizon": "...",
            "filterColumn": "...",
            "productFilters": "...",
            "selectedColumns": "col1,col2,...",
            "modelType": "classification|regression|timeseries",
            ...
        }
    }
    This mirrors the functionality of run_prediction_pipeline() in apps.py
    but in a non-interactive HTTP form usable by your React UI.
    """

    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({"error": "invalid JSON"}), 400

    workspace_id = data.get("workspace_id")
    pipeline_id = data.get("pipeline_id")
    lakehouse_id = data.get("lakehouse_id")
    parameters  = data.get("parameters") or {}

    if not (workspace_id and pipeline_id and parameters):
        return jsonify({"error": "workspace_id, pipeline_id and parameters required"}), 400

    # Reuse your existing run_pipeline() logic
    result = run_pipeline(workspace_id, pipeline_id, parameters)

    # Attach lakehouse_id + destinationTable (if provided) for polling
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

# ---------- Run ----------
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    log.info("Starting combined API on port %s", port)
    app.run(host="0.0.0.0", port=port, debug=True)
