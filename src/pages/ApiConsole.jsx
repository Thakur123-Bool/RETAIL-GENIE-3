// src/pages/ApiConsole.jsx
import React, { useState } from "react";
import api from "@/lib/api"; // adjust alias if you don't use @ path

function JsonOutput({ data }) {
  return (
    <pre style={{ whiteSpace: "pre-wrap", maxHeight: 400, overflow: "auto", background: "#111", color: "#eee", padding: 12 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function ApiConsole() {
  const [loading, setLoading] = useState(false);
  const [out, setOut] = useState(null);
  const [err, setErr] = useState(null);

  // generic inputs
  const [workspaceId, setWorkspaceId] = useState("");
  const [lakehouseId, setLakehouseId] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [tableName, setTableName] = useState("");
  const [folder, setFolder] = useState("");
  const [source, setSource] = useState(""); // "api" or "onelake"
  const [keyword, setKeyword] = useState("");
  const [slugsText, setSlugsText] = useState("zynicide/wine-reviews"); // comma separated
  const [destinationTable, setDestinationTable] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [parametersText, setParametersText] = useState('{ "sourceTable": "src", "destinationTable": "dst" }');

  function showResult(res) {
    setOut(res);
    setErr(null);
  }
  function showError(e) {
    setErr(e);
    setOut(null);
  }

  async function call(fn) {
    setLoading(true);
    try {
      const r = await fn();
      showResult(r);
    } catch (e) {
      showError(e);
    } finally {
      setLoading(false);
    }
  }

  // ------------ actions ------------
  const getHealth = () => call(() => api.get("/health").then(r => r.data));
  const getWorkspaces = () => call(() => api.get("/workspaces").then(r => r.data));
  const getLakehouses = () => call(() => api.get("/lakehouses", { params: { workspace_id: workspaceId } }).then(r => r.data));
  const getLakehousesPath = () => call(() => api.get(`/workspaces/${workspaceId}/lakehouses`).then(r => r.data));
  const getPipelines = () => call(() => api.get("/pipelines", { params: { workspace_id: workspaceId } }).then(r => r.data));
  const getPredictionPipelines = () => call(() => api.get("/prediction/pipelines", { params: { workspace_id: workspaceId } }).then(r => r.data));
  const getTables = () => call(() => api.get("/tables", { params: { workspace_id: workspaceId, lakehouse_id: lakehouseId } }).then(r => r.data));
  const getPredictionColumns = () => call(() => api.get("/prediction/columns", { params: { workspace_id: workspaceId, lakehouse_id: lakehouseId, table_name: tableName, folder, source } }).then(r => r.data));
  const searchKaggle = () => call(() => api.get("/search", { params: { keyword } }).then(r => r.data));
  const importDatasets = () => {
    const slugs = slugsText.split(",").map(s => s.trim()).filter(Boolean);
    return call(() => api.post("/import", { slugs, workspace_id: workspaceId, lakehouse_id: lakehouseId }).then(r => r.data));
  };
  const runPipeline = () => call(() => api.post("/run-pipeline", {
    workspace_id: workspaceId,
    pipeline_id: pipelineId,
    lakehouse_id: lakehouseId,
    sourceTable: tableName,
    destinationTable: destinationTable
  }).then(r => r.data));
  const debugTables = () => call(() => api.get("/debug-tables", { params: { workspace_id: workspaceId, lakehouse_id: lakehouseId } }).then(r => r.data));
  const pollJob = () => call(() => api.get("/poll-job", { params: { location: locationUrl, workspace_id: workspaceId, lakehouse_id: lakehouseId, destination_table: destinationTable } }).then(r => r.data));
  const predictionPoll = () => call(() => api.get("/prediction/poll", { params: { location: locationUrl } }).then(r => r.data));
  const predictionLaunch = () => {
    let params;
    try {
      params = JSON.parse(parametersText);
    } catch (e) {
      showError({ message: "parameters JSON invalid", error: String(e) });
      return;
    }
    return call(() => api.post("/prediction/launch", { workspace_id: workspaceId, pipeline_id: pipelineId, lakehouse_id: lakehouseId, parameters: params }).then(r => r.data));
  };
  const predictionLaunchGeneric = () => predictionLaunch();
  const notebookCell = () => call(() => api.get("/notebook-cell").then(r => r.data));

  return (
    <div style={{ fontFamily: "Inter, Arial, sans-serif", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <h1>API Console — Retail Genie</h1>
      <p>Backend base: <code>{import.meta.env.VITE_API_URL || "NOT SET"}</code></p>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 20 }}>
        <div>
          <h3>Global inputs</h3>
          <div style={{ display: "grid", gap: 8 }}>
            <label>Workspace ID<input value={workspaceId} onChange={e => setWorkspaceId(e.target.value)} placeholder="workspace id" /></label>
            <label>Lakehouse ID<input value={lakehouseId} onChange={e => setLakehouseId(e.target.value)} placeholder="lakehouse id" /></label>
            <label>Pipeline ID<input value={pipelineId} onChange={e => setPipelineId(e.target.value)} placeholder="pipeline id" /></label>
            <label>Table Name<input value={tableName} onChange={e => setTableName(e.target.value)} placeholder="table name (display name)" /></label>
            <label>Folder (real folder)<input value={folder} onChange={e => setFolder(e.target.value)} placeholder="optional folder" /></label>
            <label>Source<input value={source} onChange={e => setSource(e.target.value)} placeholder='api or onelake' /></label>
            <label>Destination table<input value={destinationTable} onChange={e => setDestinationTable(e.target.value)} placeholder="destination table" /></label>
            <label>Location (job polling URL or job location)<input value={locationUrl} onChange={e => setLocationUrl(e.target.value)} placeholder="job location url" /></label>
          </div>

          <hr />

          <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <button onClick={getHealth} disabled={loading}>Health</button>

            <div style={{ marginTop: 8 }}>
              <button onClick={getWorkspaces} disabled={loading}>Get Workspaces</button>
              <button onClick={getLakehouses} disabled={loading} style={{ marginLeft: 8 }}>Get Lakehouses (query)</button>
              <button onClick={getLakehousesPath} disabled={loading} style={{ marginLeft: 8 }}>Get Lakehouses (path)</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={getPipelines} disabled={loading}>Get Pipelines</button>
              <button onClick={getPredictionPipelines} disabled={loading} style={{ marginLeft: 8 }}>Get Prediction Pipelines</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={getTables} disabled={loading}>Get Tables</button>
              <button onClick={getPredictionColumns} disabled={loading} style={{ marginLeft: 8 }}>Get Table Columns (prediction)</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <input placeholder="kaggle keyword" value={keyword} onChange={e => setKeyword(e.target.value)} />
              <button onClick={searchKaggle} disabled={loading} style={{ marginLeft: 8 }}>Search Kaggle</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <label>Slugs (comma)</label>
              <input value={slugsText} onChange={e => setSlugsText(e.target.value)} />
              <button onClick={importDatasets} disabled={loading} style={{ marginTop: 6 }}>Import Datasets</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={runPipeline} disabled={loading}>Run Pipeline</button>
              <button onClick={debugTables} disabled={loading} style={{ marginLeft: 8 }}>Debug Tables</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={pollJob} disabled={loading}>Poll Job (and check table exists)</button>
              <button onClick={predictionPoll} disabled={loading} style={{ marginLeft: 8 }}>Prediction Poll (raw)</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <label>Launch parameters (JSON)</label>
              <textarea style={{ width: "100%", height: 120 }} value={parametersText} onChange={e => setParametersText(e.target.value)} />
              <div style={{ marginTop: 8 }}>
                <button onClick={predictionLaunch} disabled={loading}>Launch Prediction Pipeline</button>
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <button onClick={notebookCell} disabled={loading}>Get Notebook Parameters Cell</button>
            </div>
          </div>
        </div>

        <aside>
          <h3>Response</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <strong>Status:</strong> {loading ? "loading..." : (err ? "error" : (out ? "ok" : "idle"))}
            </div>
            <div>
              <button onClick={() => { setOut(null); setErr(null); }}>Clear</button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            {err ? (
              <>
                <h4 style={{ color: "crimson" }}>Error</h4>
                <JsonOutput data={err} />
              </>
            ) : out ? (
              <>
                <h4>Output</h4>
                <JsonOutput data={out} />
              </>
            ) : (
              <div style={{ color: "#666" }}>No response yet</div>
            )}
          </div>
        </aside>
      </section>

      <hr style={{ marginTop: 24 }} />
      <p style={{ color: "#666" }}>
        Notes: the console uses <code>VITE_API_URL</code>. Ensure your frontend build environment variable is set to your backend (e.g. <code>https://retail-genie-3.onrender.com</code>).
      </p>
    </div>
  );
}
