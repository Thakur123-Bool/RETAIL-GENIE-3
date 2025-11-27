# main.py
import os
import json
import tempfile
import shutil
import logging
import traceback
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
# NOTE: heavy libs (pandas, pyarrow, deltalake, kaggle, azure.storage...) are NOT imported here at top-level.
# They will be imported inside functions that use them (lazy import) to avoid long startup time.

from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Optional dependencies - imported lazily where used.
try:
    import msal
except Exception:
    msal = None

try:
    from azure.identity import ClientSecretCredential
except Exception:
    ClientSecretCredential = None

load_dotenv()

# ---------- Config & constants ----------
logging.basicConfig(level=logging.WARNING)
log = logging.getLogger("combined-api")
log.setLevel(logging.INFO)

# quiet noisy libraries
logging.getLogger("azure").setLevel(logging.WARNING)
logging.getLogger("azure.identity").setLevel(logging.WARNING)
logging.getLogger("azure.core.pipeline.policies.http_logging_policy").setLevel(logging.WARNING)
logging.getLogger("msal").setLevel(logging.WARNING)
logging.getLogger("requests").setLevel(logging.WARNING)

FABRIC_API = "https://api.fabric.microsoft.com/v1"
ONELAKE_DFS = os.getenv("ONELAKE_DFS", "https://onelake.dfs.fabric.microsoft.com")
DFS_VERSION = os.getenv("DFS_VERSION", "2023-11-03")
MAX_RESULTS = int(os.getenv("MAX_RESULTS", "5000"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))

TENANT_ID = os.getenv("FABRIC_TENANT_ID") or os.getenv("TENANT_ID") or os.getenv("TENANT")
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

# convenience: whether to disable device flow (non-interactive environment)
DISABLE_DEVICE_FLOW = os.getenv("DISABLE_DEVICE_FLOW", "0") in ("1", "true", "True")


class TokenManager:
    """
    Supports service principal (azure.identity) or MSAL device flow.
    If DISABLE_DEVICE_FLOW==True -> device flow will not be started and get_token will return None.
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
        # use service principal only if all values present and azure.identity is available
        self._use_sp = bool(CLIENT_SECRET and CLIENT_ID and TENANT_ID and ClientSecretCredential is not None)

        if not self._use_sp and msal is None:
            log.warning("MSAL not available and SERVICE PRINCIPAL not configured - auth may fail.")

        if self._use_sp:
            # create credential now (this is lightweight)
            self.cred = ClientSecretCredential(
                tenant_id=TENANT_ID, client_id=CLIENT_ID, client_secret=CLIENT_SECRET
            )
            log.info("TokenManager: using ClientSecretCredential (service principal).")
        else:
            # prepare MSAL PublicClientApplication only if msal is present and device flow allowed
            if msal and not DISABLE_DEVICE_FLOW:
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
                # either msal not installed or device flow disabled -> do not create app
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

        # if device flow explicitly disabled -> don't block
        if DISABLE_DEVICE_FLOW:
            log.warning("Device flow disabled via DISABLE_DEVICE_FLOW; skipping interactive auth.")
            return None

        # msal/device-flow path
        if not self.app:
            log.error("No MSAL app configured")
            return None

        # try silent first
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

        # device flow (interactive) - this will block, so disabled above in non-interactive envs
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


# ---------- API helpers ----------
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
    # also check onelake for delta folders to augment list
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


# ---------- Kaggle helpers (lazy import) ----------
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
    # lazy import KaggleApi
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
    except Exception:
        raise RuntimeError("KaggleApi not available. Install kaggle package.")
    setup_kaggle()
    api = KaggleApi()
    api.authenticate()
    temp_dir = tempfile.mkdtemp()
    api.dataset_download_files(slug, path=temp_dir, unzip=True)
    return temp_dir, slug


# ---------- File reading & upload (lazy imports for heavy libs) ----------
SUPPORTED_TABLE_EXTS = {".csv", ".tsv", ".json", ".parquet", ".xls", ".xlsx"}


def read_table_file(path: str) -> Dict[str, "pd.DataFrame"]:
    # lazy import pandas
    try:
        import pandas as pd
    except Exception as e:
        raise RuntimeError("pandas not available") from e

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
    # lazy import DataLakeServiceClient
    try:
        from azure.storage.filedatalake import DataLakeServiceClient
    except Exception:
        DataLakeServiceClient = None

    if DataLakeServiceClient is None:
        raise RuntimeError("azure-storage-file-datalake not available")
    if not ONELAKE_URL:
        raise RuntimeError("ONELAKE_URL is not configured")

    tm = TokenManager()
    storage_token = tm.get_token_for_storage()

    if storage_token and CLIENT_SECRET:
        # prefer ClientSecretCredential path (safer)
        try:
            credential = ClientSecretCredential(
                tenant_id=TENANT_ID, client_id=CLIENT_ID, client_secret=CLIENT_SECRET
            )
            client = DataLakeServiceClient(account_url=ONELAKE_URL, credential=credential)
            return client
        except Exception:
            log.exception("DataLakeServiceClient with ClientSecretCredential failed; falling back to token")

    # Fallback: attempt to construct client with credential (may fail if environment not supported)
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
                                # lazy import deltalake and pyarrow if available
                                try:
                                    from deltalake import write_deltalake
                                except Exception:
                                    write_deltalake = None
                                try:
                                    import pyarrow as pa
                                except Exception:
                                    pa = None

                                if write_deltalake is None:
                                    # fallback: write parquet using pandas if deltalake missing
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
    try:
        r = requests.post(url, headers={"Authorization": f"Bearer {fabric_token}", "Content-Type": "application/json"}, json=payload, timeout=60)
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


# ---------- Notebook cell (string) ----------
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


# HEALTH CHECK: Lightweight and safe for non-interactive environments
@app.route("/health", methods=["GET"])
def health_check():
    """
    Quick health check for Render / load balancers.
    Must NOT perform interactive auth or heavy imports.
    """
    info = {
        "status": "ok",
        "env": {
            "DISABLE_DEVICE_FLOW": os.getenv("DISABLE_DEVICE_FLOW", "0"),
            "CLIENT_SECRET_present": bool(CLIENT_SECRET),
            "PORT": os.getenv("PORT", ""),
        },
    }
    return jsonify(info), 200


# --- API endpoints (kept unchanged; they lazy-import heavy libs themselves when needed) ---
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
        from kaggle.api.kaggle_api_extended import KaggleApi
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


@app.route("/prescriptive/launch", methods=["POST"])
def api_prescriptive_launch():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400

    workspace_id = data.get("workspace_id")
    pipeline_id = data.get("pipeline_id")
    lakehouse_id = data.get("lakehouse_id")
    parameters = data.get("parameters") or {}

    if not (workspace_id and pipeline_id and parameters):
        return jsonify({
            "error": "workspace_id, pipeline_id and parameters are required"
        }), 400

    result = run_pipeline(workspace_id, pipeline_id, parameters)
    if lakehouse_id:
        result["lakehouse_id"] = lakehouse_id
    destination = parameters.get("destinationTable")
    if destination:
        result["destination_table"] = destination
    return jsonify(result)


@app.route("/diagnostic/launch", methods=["POST"])
def api_diagnostic_launch():
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        return jsonify({"error": "Invalid JSON"}), 400

    workspace_id = data.get("workspace_id")
    pipeline_id = data.get("pipeline_id")
    lakehouse_id = data.get("lakehouse_id")
    parameters = data.get("parameters") or {}

    if not (workspace_id and pipeline_id and parameters):
        return jsonify({
            "error": "workspace_id, pipeline_id and parameters are required"
        }), 400

    result = run_pipeline(workspace_id, pipeline_id, parameters)
    if lakehouse_id:
        result["lakehouse_id"] = lakehouse_id
    destination_table = parameters.get("destinationTable")
    if destination_table:
        result["destination_table"] = destination_table
    return jsonify(result)


@app.route("/notebook-cell", methods=["GET"])
def api_notebook_cell():
    return jsonify({"cell": notebook_parameters_cell})


# ---------- Run ----------
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    log.info("Starting combined API on port %s", port)
    # debug=True is okay for local; Render runs via gunicorn which will import this module but won't execute this block.
    app.run(host="0.0.0.0", port=port, debug=True)