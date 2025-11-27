from pydantic import BaseModel
from typing import List, Dict, Optional
from datetime import datetime

class Workspace(BaseModel):
    id: str
    displayName: str
    type: Optional[str] = None
    description: Optional[str] = None

class Lakehouse(BaseModel):
    id: str
    displayName: str
    type: Optional[str] = None
    description: Optional[str] = None

class Table(BaseModel):
    name: str
    path: Optional[str] = None
    source: str
    format: str

class Column(BaseModel):
    name: str
    type: str
    nullable: bool

class SingleTableResponse(BaseModel):
    name: str
    path: Optional[str] = None
    source: str
    format: str
    columns: List[Column]

class RunNotebookRequest(BaseModel):
    workspace_id: str
    workspace_name: str
    lakehouse_id: str
    lakehouse_name: str
    table_name: str
    forecast_table: str = "forecast_perproduct_90days_rounded"
    stock_table: str = "Stock"
    prediction_column: str = "Predicted_Qty"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    forecast_horizon: int = 90
    results_table_name: str
    products: Optional[str] = None
    pipeline_name: Optional[str] = None
    user_email: Optional[str] = None

class JobStatus(BaseModel):
    job_id: str
    status: str  # queued, running, completed, failed
    progress: int
    notebook_id: Optional[str] = None
    session_id: Optional[str] = None
    result_table: Optional[str] = None
    message: str
    created_at: str
    updated_at: str
    user_details: Optional[Dict] = None