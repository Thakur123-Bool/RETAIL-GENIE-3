import React from "react";
import { Badge } from "@/components/ui/badge";
import { Workflow, Table2, Brain } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Props:
 *  - datasetName
 *  - loadingPipelines
 *  - pipelines (array)
 *  - selectedPipelineId (string)
 *  - handlePipelineSelect (fn)
 *  - loadingTables
 *  - tables (array)  // expected shape: [{ name: 'tableName', ... }, ...]
 *  - selectedTable (string)   // controlled selected table (we will display it as selected)
 *  - handleTableSelect (fn)
 *  - selectedAnalyticsType (string)
 *  - handleAnalyticsTypeSelect (fn)
 */
export default function Step3AnalyticsSetup({
  datasetName,
  loadingPipelines,
  pipelines = [],
  selectedPipelineId,
  handlePipelineSelect,

  loadingTables,
  tables = [],
  selectedTable,
  handleTableSelect,

  selectedAnalyticsType,
  handleAnalyticsTypeSelect,
}) {
  // defensive: ensure tables is an array
  const tableList = Array.isArray(tables) ? tables : [];

  return (
    <div className="space-y-8">
      {/* Dataset Overview Badge */}
      <div className="p-3 bg-gradient-to-r from-indigo-50 via-white to-pink-50 rounded-xl border border-gray-100">
        <Badge>Dataset: {datasetName}</Badge>
      </div>

      {/* PIPELINE SELECT */}
      <div>
        <label className="text-lg font-semibold flex items-center gap-2">
          <Workflow className="w-5 h-5 text-indigo-600" /> Select Pipeline
          <span className="text-red-500">*</span>
        </label>

        {loadingPipelines ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : pipelines.length === 0 ? (
          <Alert className="mt-2">
            <AlertDescription>No pipelines found.</AlertDescription>
          </Alert>
        ) : (
          <Select value={selectedPipelineId} onValueChange={handlePipelineSelect}>
            <SelectTrigger className="h-14 rounded-xl border-2 mt-1">
              <SelectValue placeholder="Choose a pipeline..." />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* TABLE SELECT */}
      <div>
        <label className="text-lg font-semibold flex items-center gap-2">
          <Table2 className="w-5 h-5 text-purple-600" /> Select Table
          <span className="text-red-500">*</span>
        </label>

        {loadingTables ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : tableList.length === 0 ? (
          <Alert className="mt-2">
            <AlertDescription>No tables available.</AlertDescription>
          </Alert>
        ) : (
          <Select value={selectedTable} onValueChange={handleTableSelect}>
            <SelectTrigger className="h-14 rounded-xl border-2 mt-1">
              <SelectValue placeholder="Choose a table..." />
            </SelectTrigger>
            <SelectContent>
              {tableList.map((tbl) => (
                // tbl may be an object with name prop or a string
                <SelectItem key={tbl.name || tbl} value={tbl.name || tbl}>
                  {tbl.name || tbl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ANALYTICS TYPE SELECT */}
      <div>
        <label className="text-lg font-semibold flex items-center gap-2">
          <Brain className="w-5 h-5 text-green-600" /> Select Analytical Type
          <span className="text-red-500">*</span>
        </label>

        <Select value={selectedAnalyticsType} onValueChange={handleAnalyticsTypeSelect}>
          <SelectTrigger className="h-14 rounded-xl border-2 mt-1">
            <SelectValue placeholder="Choose an analytics type..." />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="descriptive"> Descriptive Analytics</SelectItem>
            <SelectItem value="diagnostic"> Diagnostic Analytics</SelectItem>
            <SelectItem value="predictive"> Predictive Analytics</SelectItem>
            <SelectItem value="prescriptive"> Prescriptive Analytics</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
