// src/api/base44Client.js
export const base44 = {
  entities: {
    PredictionJob: {
      list: async (sort = '', limit = 10) => {
        return [
          {
            id: 1,
            job_name: "Holiday Season Demand Analysis",
            workspace_name: "RetailAnalytics_Prod",
            status: "in_progress",
            progress_percentage: 65,
            created_date: "2025-10-23T10:00:00Z",
            forecast_horizon: 60,
            start_date: "2025-09-01",
            end_date: "2025-10-22"
          },
          {
            id: 2,
            job_name: "Q1 2024 Sales Forecast",
            workspace_name: "RetailAnalytics_Prod",
            status: "completed",
            progress_percentage: 100,
            created_date: "2025-10-23T08:00:00Z",
            execution_completed: "2025-10-23T12:00:00Z",
            forecast_horizon: 90,
            report_url: "https://app.powerbi.com/report"
          },
          {
            id: 3,
            job_name: "Weekly Inventory Optimization",
            workspace_name: "InventoryWorkspace",
            status: "Pending",
            progress_percentage: 100,
            created_date: "2025-10-23T08:00:00Z",
            execution_completed: "2025-10-23T12:00:00Z",
            forecast_horizon: 14,
            report_url: "https://app.powerbi.com/report"
          }
        ];
      },
      filter: async (filters, sort) => {
        return [];
      },
      create: async (data) => {
        console.log("Creating job:", data);
        return { id: Date.now(), ...data };
      }
    }
  }
};