// // -----------------------
// // File: src/pages/NewPrediction.jsx
// // -----------------------
// import React, { useState, useEffect } from "react";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { useNavigate } from "react-router-dom";
// import { motion, AnimatePresence } from "framer-motion";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Badge } from "@/components/ui/badge";
// import {
//   AlertCircle,
//   Check,
//   RefreshCw,
//   Package,
//   Database,
//   Table2,
//   Calendar,
//   CheckCircle2,
//   Sparkles,
//   ArrowLeft,
//   ArrowRight,
//   PlayCircle,
// } from "lucide-react";

// // Import step components
// import Step1DataSource from "@/components/prediction/Datasource";
// import Step2Workspace from "@/components/prediction/SelectPipelineAndTables.jsx";
// import Step3AnalyticsSetup from "@/components/prediction/Tables";
// import Step5Parameters from "@/components/prediction/Step5Parameters";
// import Step6Review from "@/components/prediction/Step6Review";

// export default function NewPrediction() {
//   const navigate = useNavigate();
//   const queryClient = useQueryClient();

//   // Global UI / API state
//   const [error, setError] = useState(null);
//   const [importResult, setImportResult] = useState(null);
//   const [importLoading, setImportLoading] = useState(false);
//   const [currentStep, setCurrentStep] = useState(1);

//   const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
//   const [selectedLakehouseId, setSelectedLakehouseId] = useState("");

//   const [searchOpen, setSearchOpen] = useState(false);
//   const [searchValue, setSearchValue] = useState("");

//   // Step 3 local states
//   const [pipelines, setPipelines] = useState([]);
//   const [loadingPipelines, setLoadingPipelines] = useState(false);
//   const [selectedPipeline, setSelectedPipeline] = useState("");
//   const [selectedAnalyticsType, setSelectedAnalyticsType] = useState("");
//   // Important: selectedTable will be stored in formData.table_name and also mirrored in state if desired
//   // We'll primarily use formData.table_name as the single source of truth for selected table.
//   const [loadingTables, setLoadingTables] = useState(false);

//   const [formData, setFormData] = useState({
//     data_source_type: "",
//     kaggle_datasets: [],
//     kaggle_dataset_names: [],
//     job_name: "",
//     workspace_name: "",
//     workspace_id: "",
//     lakehouse_name: "",
//     lakehouse_id: "",
//     table_name: "",
//     prediction_columns: [],
//     pipeline_name: "",
//     analytics_type: "",
//     start_date: "",
//     end_date: "",
//     products: "",
//     forecast_horizon: 30,
//     results_table_name: "",
//   });

//   /* ------------------------------
//      KAGGLE SEARCH API (REAL TIME)
//   -------------------------------*/
//   const { data: datasets, isLoading: loadingDatasets, error: datasetsError } =
//     useQuery({
//       queryKey: ["kaggle-datasets", searchValue],
//       queryFn: async () => {
//         if (!searchValue || searchValue.length < 2) return { datasets: [] };
//         const response = await fetch(
//           `http://127.0.0.1:5000/search?keyword=${encodeURIComponent(
//             searchValue
//           )}`
//         );
//         if (!response.ok) throw new Error("Failed to search datasets");
//         return response.json();
//       },
//       enabled: searchValue.length >= 2,
//     });

//   /* ------------------------------
//      IMPORT DATASET MUTATION (multi-slug)
//   -------------------------------*/
//   const importMutation = useMutation({
//     mutationFn: async (payload) => {
//       const response = await fetch("http://127.0.0.1:5000/import", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });
//       if (!response.ok) {
//         const errorData = await response.json().catch(() => ({}));
//         throw new Error(errorData.error || "Import failed");
//       }
//       return response.json();
//     },
//     onMutate: () => {
//       setImportLoading(true);
//       setImportResult(null);
//     },
//     onSuccess: (data) => {
//       setImportResult({ type: "success", ...data });
//       if (selectedWorkspaceId && selectedLakehouseId) {
//         queryClient.invalidateQueries({
//           queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
//         });
//       }
//     },
//     onError: (err) => {
//       setImportResult({ type: "error", message: err.message });
//       setError(`Import Error: ${err.message}`);
//     },
//     onSettled: () => {
//       setImportLoading(false);
//     },
//   });

//   /* ------------------------------
//        FABRIC WORKSPACES
//   -------------------------------*/
//   const {
//     data: workspaces,
//     isLoading: loadingWorkspaces,
//     error: workspacesError,
//     refetch: refetchWorkspaces,
//   } = useQuery({
//     queryKey: ["workspaces"],
//     queryFn: async () => {
//       const response = await fetch("http://127.0.0.1:5000/workspaces");
//       if (!response.ok) throw new Error("Failed to fetch workspaces");
//       return response.json().then((data) => data.value || []);
//     },
//   });

//   /* ------------------------------
//        FABRIC LAKEHOUSES
//   -------------------------------*/
//   const {
//     data: lakehouses,
//     isLoading: loadingLakehouses,
//     error: lakehousesError,
//   } = useQuery({
//     queryKey: ["lakehouses", selectedWorkspaceId],
//     queryFn: async () => {
//       if (!selectedWorkspaceId) return null;
//       const response = await fetch(
//         `http://127.0.0.1:5000/lakehouses?workspace_id=${selectedWorkspaceId}`
//       );
//       if (!response.ok) throw new Error("Failed to fetch lakehouses");
//       return response.json().then((data) => data.value || []);
//     },
//     enabled: !!selectedWorkspaceId,
//   });

//   /* ------------------------------
//        FABRIC TABLES
//   -------------------------------*/
//   const {
//     data: tables,
//     isLoading: tablesQueryLoading,
//     error: tablesError,
//   } = useQuery({
//     queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
//     queryFn: async () => {
//       if (!selectedWorkspaceId || !selectedLakehouseId) return null;
//       const response = await fetch(
//         `http://127.0.0.1:5000/tables?workspace_id=${selectedWorkspaceId}&lakehouse_id=${selectedLakehouseId}`
//       );
//       if (!response.ok) throw new Error("Failed to fetch tables");
//       return response.json().then((d) => d.value || d);
//     },
//     enabled: !!selectedWorkspaceId && !!selectedLakehouseId,
//   });

//   // Mirror loadingTables to reflect query
//   useEffect(() => {
//     setLoadingTables(!!tablesQueryLoading);
//   }, [tablesQueryLoading]);

//   /* ------------------------------
//        FABRIC COLUMNS
//   -------------------------------*/
//   const {
//     data: columns,
//     isLoading: loadingColumns,
//     error: columnsError,
//   } = useQuery({
//     queryKey: [
//       "columns",
//       selectedWorkspaceId,
//       selectedLakehouseId,
//       formData.table_name,
//     ],
//     queryFn: async () => {
//       if (!selectedWorkspaceId || !selectedLakehouseId || !formData.table_name)
//         return null;
//       const response = await fetch(
//         `http://127.0.0.1:5000/tables?workspace_id=${selectedWorkspaceId}&lakehouse_id=${selectedLakehouseId}`
//       ); // Note: replace with actual columns endpoint if available
//       if (!response.ok) throw new Error("Failed to fetch columns");
//       return response.json();
//     },
//     enabled:
//       !!selectedWorkspaceId && !!selectedLakehouseId && !!formData.table_name,
//   });

//   /* ------------------------------
//        HANDLERS
//   -------------------------------*/
//   const handleChange = (field, value) => {
//     setFormData((prev) => ({ ...prev, [field]: value }));
//   };

//   const handleWorkspaceSelect = (workspaceId) => {
//     const workspace = workspaces?.find((w) => w.id === workspaceId);
//     if (!workspace) return;

//     setFormData((prev) => ({
//       ...prev,
//       workspace_id: workspaceId,
//       workspace_name: workspace.displayName,
//       lakehouse_id: "",
//       lakehouse_name: "",
//       table_name: "",
//       prediction_columns: [],
//     }));

//     setSelectedWorkspaceId(workspaceId);
//     setSelectedLakehouseId("");
//   };

//   const handleLakehouseSelect = (lakehouseId) => {
//     const lakehouse = lakehouses?.find((l) => l.id === lakehouseId);
//     if (!lakehouse) return;

//     setFormData((prev) => ({
//       ...prev,
//       lakehouse_id: lakehouseId,
//       lakehouse_name: lakehouse.displayName,
//       table_name: "",
//       prediction_columns: [],
//     }));

//     setSelectedLakehouseId(lakehouseId);
//   };

//   const handleTableSelect = (tableName) => {
//     setFormData((prev) => ({
//       ...prev,
//       table_name: tableName,
//       prediction_columns: [],
//     }));
//   };

//   const handleColumnToggle = (columnName) => {
//     setFormData((prev) => {
//       const exists = prev.prediction_columns.includes(columnName);
//       const updated = exists
//         ? prev.prediction_columns.filter((c) => c !== columnName)
//         : [...prev.prediction_columns, columnName];
//       return { ...prev, prediction_columns: updated };
//     });
//   };

//   // MULTI SELECT: when user clicks a dataset in Step1
//   const handleDatasetSelect = (ds) => {
//     setFormData((prev) => {
//       const slugs = Array.from(
//         new Set([...(prev.kaggle_datasets || []), ds.slug])
//       );
//       return {
//         ...prev,
//         kaggle_datasets: slugs,
//         kaggle_dataset_names: Array.from(
//           new Set([...(prev.kaggle_dataset_names || []), ds.name])
//         ),
//       };
//     });

//     setSearchValue("");
//     setSearchOpen(false);
//   };

//   const removeDataset = (slug) => {
//     setFormData((prev) => {
//       const idx = prev.kaggle_datasets.indexOf(slug);
//       if (idx === -1) return prev;
//       const newSlugs = prev.kaggle_datasets.filter((s) => s !== slug);
//       const newNames = prev.kaggle_dataset_names.filter((_, i) => i !== idx);
//       return {
//         ...prev,
//         kaggle_datasets: newSlugs,
//         kaggle_dataset_names: newNames,
//       };
//     });
//   };

//   // trigger import for selected slugs
//   const importSelectedDatasets = () => {
//     const workspaceId = formData.workspace_id || selectedWorkspaceId;
//     const lakehouseId = formData.lakehouse_id || selectedLakehouseId;

//     if (!workspaceId || !lakehouseId) {
//       setImportResult({
//         type: "error",
//         message:
//           "Please select both Workspace and Lakehouse before importing the dataset(s).",
//       });
//       setError("Select workspace & lakehouse before importing.");
//       return;
//     }

//     if (!formData.kaggle_datasets || formData.kaggle_datasets.length === 0) {
//       setImportResult({
//         type: "error",
//         message: "No datasets selected to import",
//       });
//       return;
//     }

//     importMutation.mutate({
//       slugs: formData.kaggle_datasets,
//       workspace_id: workspaceId,
//       lakehouse_id: lakehouseId,
//     });
//   };

//   // Check if step is complete for Next button
//   const isStepComplete = () => {
//     switch (currentStep) {
//       case 1:
//         return (
//           formData.data_source_type === "kaggle" &&
//           (formData.kaggle_datasets || []).length > 0
//         );
//       case 2:
//         return selectedWorkspaceId;
//       case 3:
//         return (
//           selectedPipeline &&
//           formData.table_name &&
//           selectedAnalyticsType
//         );
//       case 4:
//         return (
//           formData.start_date &&
//           formData.end_date &&
//           formData.forecast_horizon > 0
//         );
//       default:
//         // For step 5 (Review) there is no "Next" button
//         return true;
//     }
//   };

//   const steps = [
//     {
//       number: 1,
//       title: "Data Source",
//       icon: Package,
//       completed: currentStep > 1,
//     },
//     {
//       number: 2,
//       title: "Pipeline & Tables",
//       icon: Database,
//       completed: currentStep > 2,
//     },
//     {
//       number: 3,
//       title: "Analytics Setup",
//       icon: Table2,
//       completed: currentStep > 3,
//     },
//     {
//       number: 4,
//       title: "Parameters",
//       icon: Calendar,
//       completed: currentStep > 4,
//     },
//     {
//       number: 5,
//       title: "Review",
//       icon: CheckCircle2,
//       completed: false,
//     },
//   ];

//   const getDatasetDisplay = () =>
//     (formData.kaggle_dataset_names &&
//       formData.kaggle_dataset_names.join(", ")) ||
//     "Dataset";

//   useEffect(() => {
//     const apiError =
//       workspacesError ||
//       lakehousesError ||
//       tablesError ||
//       columnsError ||
//       datasetsError;

//     if (apiError) setError(`API Error: ${apiError.message}`);
//   }, [
//     workspacesError,
//     lakehousesError,
//     tablesError,
//     columnsError,
//     datasetsError,
//   ]);

//   useEffect(() => {
//     if (currentStep !== 1) {
//       setImportResult(null);
//     }
//   }, [currentStep]);

//   // Retry function for errors
//   const handleRetry = () => {
//     setError(null);
//     refetchWorkspaces();
//     queryClient.refetchQueries({ queryKey: ["lakehouses"] });
//     queryClient.refetchQueries({ queryKey: ["tables"] });
//   };

//   // -------------------------
//   // Fetch pipelines for the selected workspace (for Step 3)
//   // -------------------------
//   useEffect(() => {
//     if (!selectedWorkspaceId) {
//       setPipelines([]);
//       return;
//     }
//     setLoadingPipelines(true);
//     fetch(`http://127.0.0.1:5000/pipelines?workspace_id=${selectedWorkspaceId}`)
//       .then((res) => res.json())
//       .then((data) => setPipelines(data.value || []))
//       .catch(() => setPipelines([]))
//       .finally(() => setLoadingPipelines(false));
//   }, [selectedWorkspaceId]);

//   // -------------------------
//   // onPipelineRun callback: called by Step2 when pipeline finished & table_saved === true
//   // -------------------------
//   const handlePipelineRunResult = (result) => {
//     // result: { status: 'success'|'failed', destination_table, pipeline_id, pipeline_status, raw }
//     if (!result) return;

//     if (result.status === "success" && result.destination_table) {
//       // 1) store table in formData
//       setFormData((prev) => ({
//         ...prev,
//         table_name: result.destination_table,
//         pipeline_name: result.pipeline_id || prev.pipeline_name,
//       }));

//       // 2) set selected pipeline & analytics type placeholder
//       setSelectedPipeline(result.pipeline_id || "");
//       // analytics type left empty for user to choose
//       setSelectedAnalyticsType("");

//       // 3) ensure tables list refresh: invalidate react-query cache for tables
//       if (selectedWorkspaceId && selectedLakehouseId) {
//         queryClient.invalidateQueries({
//           queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
//         });
//       }

//       // 4) automatically go to step 3 (Analytics)
//       setCurrentStep(3);
//     } else {
//       // failed -> show error toast
//       setError(`Pipeline run failed: ${result?.pipeline_status || "unknown"}`);
//     }
//   };

//   // pretty animations
//   const cardMotion = {
//     initial: { opacity: 0, y: 8 },
//     animate: { opacity: 1, y: 0 },
//     exit: { opacity: 0, y: -8 },
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6">
//       <div className="max-w-6xl mx-auto">
//         {/* Header */}
//         <motion.div className="mb-6" layout>
//           <Card className="relative overflow-hidden border-2 border-transparent shadow-2xl bg-white/90">
//             <CardContent className="p-6 md:p-8">
//               <div className="flex items-center gap-4">
//                 <Button
//                   variant="ghost"
//                   size="icon"
//                   onClick={() => navigate("/dashboard")}
//                   className="h-12 w-12 rounded-full border border-indigo-100 hover:bg-indigo-50"
//                 >
//                   <ArrowLeft className="w-5 h-5 text-indigo-600" />
//                 </Button>
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3">
//                     <div className="p-2 bg-indigo-100 rounded-full">
//                       <Sparkles className="w-6 h-6 text-indigo-600" />
//                     </div>
//                     <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600">
//                       New Prediction Job
//                     </h1>
//                   </div>
//                   <p className="mt-2 text-gray-600">
//                     Configure forecasts in 5 animated steps — fast and visual.
//                   </p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </motion.div>

//         {/* Progress Bar */}
//         <motion.div className="mb-6">
//           <Card className="border-0 bg-white/80 shadow-lg">
//             <CardContent className="p-4">
//               <div className="flex items-center justify-between gap-3">
//                 {steps.map((step, i) => (
//                   <React.Fragment key={step.number}>
//                     <div className="flex flex-col items-center flex-1">
//                       <motion.div
//                         animate={{
//                           scale: currentStep === step.number ? 1.05 : 1,
//                         }}
//                         transition={{
//                           type: "spring",
//                           stiffness: 300,
//                           damping: 20,
//                         }}
//                         className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${
//                           step.completed
//                             ? "bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg"
//                             : currentStep === step.number
//                             ? "bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-xl"
//                             : "bg-gray-100 text-gray-400 border"
//                         }`}
//                       >
//                         {step.completed ? (
//                           <Check className="w-6 h-6" />
//                         ) : (
//                           <step.icon className="w-6 h-6" />
//                         )}
//                       </motion.div>
//                       <p
//                         className={`text-xs md:text-sm font-semibold text-center ${
//                           currentStep === step.number
//                             ? "text-indigo-600"
//                             : step.completed
//                             ? "text-green-600"
//                             : "text-gray-500"
//                         }`}
//                       >
//                         {step.title}
//                       </p>
//                     </div>
//                     {i < steps.length - 1 && (
//                       <div
//                         className={`h-1 flex-1 mx-2 rounded-full ${
//                           currentStep > step.number
//                             ? "bg-gradient-to-r from-green-400 to-green-600"
//                             : "bg-gray-200"
//                         }`}
//                       />
//                     )}
//                   </React.Fragment>
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         </motion.div>

//         {/* Error */}
//         <AnimatePresence>
//           {error && (
//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               className="mb-6"
//             >
//               <Alert className="border-2 border-red-200/50 bg-red-50/90 shadow">
//                 <AlertCircle className="w-5 h-5 text-red-600" />
//                 <AlertDescription className="flex items-center justify-between text-sm font-medium text-red-800">
//                   <span>{error}</span>
//                   <div className="flex items-center gap-2">
//                     <Button
//                       variant="ghost"
//                       size="sm"
//                       onClick={handleRetry}
//                     >
//                       <RefreshCw className="w-4 h-4" /> Retry
//                     </Button>
//                   </div>
//                 </AlertDescription>
//               </Alert>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Import Result */}
//         <AnimatePresence>
//           {importResult && (
//             <motion.div
//               initial={{ opacity: 0, y: 6 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0 }}
//               className="mb-6"
//             >
//               <Alert
//                 className={`border-2 shadow ${
//                   importResult.type === "success"
//                     ? "border-green-200/50 bg-green-50/90"
//                     : "border-red-200/50 bg-red-50/90"
//                 }`}
//               >
//                 {importResult.type === "success" ? (
//                   <Check className="w-5 h-5 text-green-600" />
//                 ) : (
//                   <AlertCircle className="w-5 h-5 text-red-600" />
//                 )}
//                 <AlertDescription className="text-sm font-medium">
//                   {importResult.type === "success" ? (
//                     <div>
//                       <p className="font-semibold text-green-800">
//                         Import finished
//                       </p>
//                       <div className="mt-2 text-xs text-gray-700">
//                         {Object.entries(importResult.results || {}).map(
//                           ([slug, res]) => (
//                             <div key={slug} className="mb-1">
//                               <strong>{slug}:</strong> {res.status}{" "}
//                               {res.error ? `- ${res.error}` : ""}
//                             </div>
//                           )
//                         )}
//                       </div>
//                     </div>
//                   ) : (
//                     <p className="font-semibold text-red-800">
//                       {importResult.message}
//                     </p>
//                   )}
//                 </AlertDescription>
//               </Alert>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Main Card */}
//         <Card className="overflow-hidden shadow-2xl">
//           <CardHeader className="border-b-0 p-6 bg-gradient-to-r from-white to-white/70">
//             <div className="flex items-center gap-3">
//               <div
//                 className={`p-2 rounded-full ${
//                   currentStep === 5 ? "bg-green-100" : "bg-indigo-50"
//                 }`}
//               >
//                 {currentStep === 1 && (
//                   <Package className="w-6 h-6 text-indigo-600" />
//                 )}
//                 {currentStep === 2 && (
//                   <Database className="w-6 h-6 text-indigo-600" />
//                 )}
//                 {currentStep === 3 && (
//                   <Database className="w-6 h-6 text-indigo-600" />
//                 )}
//                 {currentStep === 4 && (
//                   <Calendar className="w-6 h-6 text-indigo-600" />
//                 )}
//                 {currentStep === 5 && (
//                   <CheckCircle2 className="w-6 h-6 text-green-600" />
//                 )}
//               </div>
//               <CardTitle className="text-xl md:text-2xl font-bold text-gray-800">
//                 Step {currentStep}: {steps[currentStep - 1].title}
//               </CardTitle>
//             </div>
//           </CardHeader>

//           <CardContent className="p-6 md:p-8 lg:p-10">
//             <AnimatePresence exitBeforeEnter>
//               {currentStep === 1 && (
//                 <motion.div key="s1" {...cardMotion}>
//                   <Step1DataSource
//                     formData={formData}
//                     setFormData={setFormData}
//                     searchValue={searchValue}
//                     setSearchValue={setSearchValue}
//                     searchOpen={searchOpen}
//                     setSearchOpen={setSearchOpen}
//                     datasets={datasets}
//                     loadingDatasets={loadingDatasets}
//                     datasetsError={datasetsError}
//                     handleDatasetSelect={handleDatasetSelect}
//                     loadingWorkspaces={loadingWorkspaces}
//                     workspaces={workspaces}
//                     workspacesError={workspacesError}
//                     selectedWorkspaceId={selectedWorkspaceId}
//                     handleWorkspaceSelect={handleWorkspaceSelect}
//                     loadingLakehouses={loadingLakehouses}
//                     lakehouses={lakehouses}
//                     lakehousesError={lakehousesError}
//                     selectedLakehouseId={selectedLakehouseId}
//                     handleLakehouseSelect={handleLakehouseSelect}
//                     importLoading={importLoading}
//                     removeDataset={removeDataset}
//                     importSelectedDatasets={importSelectedDatasets}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 2 && (
//                 <motion.div key="s2" {...cardMotion}>
//                   <Step2Workspace
//                     workspaceId={selectedWorkspaceId}
//                     lakehouseId={selectedLakehouseId}
//                     onPipelineRun={handlePipelineRunResult}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 3 && (
//                 <motion.div key="s3" {...cardMotion}>
//                   <Step3AnalyticsSetup
//                     datasetName={getDatasetDisplay()}
//                     loadingPipelines={loadingPipelines}
//                     pipelines={pipelines}
//                     selectedPipelineId={selectedPipeline}
//                     setSelectedPipeline={setSelectedPipeline}   // <-- REQUIRED FIX
//                     setFormData={setFormData}
//                     loadingTables={loadingTables}
//                     tables={tables || []}
//                     selectedTable={formData.table_name}
//                     handleTableSelect={handleTableSelect}
//                     selectedAnalyticsType={selectedAnalyticsType}
//                     handleAnalyticsTypeSelect={(val) => {
//                         setSelectedAnalyticsType(val);
//                         handleChange("analytics_type", val);
//                     }}
//                 />


//                 </motion.div>
//               )}

//               {currentStep === 4 && (
//                 <motion.div key="s4" {...cardMotion}>
//                   <Step5Parameters
//                     formData={formData}
//                     handleChange={handleChange}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 5 && (
//                 <motion.div key="s5" {...cardMotion}>
//                   <Step6Review
//                     formData={formData}
//                     getDatasetDisplay={getDatasetDisplay}
//                     selectedWorkspaceId={selectedWorkspaceId}
//                     selectedLakehouseId={selectedLakehouseId}
//                   />
//                 </motion.div>
//               )}
//             </AnimatePresence>
//           </CardContent>

//           {/* Footer navigation */}
//           <div className="border-t border-gray-100/50 bg-gradient-to-r from-white to-white/60 p-6 flex items-center justify-between gap-4">
//             <div>
//               <Button
//                 variant="outline"
//                 onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
//                 disabled={currentStep === 1}
//                 className="px-6 h-12 mr-3"
//               >
//                 <ArrowLeft className="w-5 h-5 mr-2" /> Back
//               </Button>

//               {/* Quick action: import selected datasets (visible only on step1) */}
//               {currentStep === 1 && (
//                 <Button
//                   onClick={importSelectedDatasets}
//                   disabled={
//                     importLoading ||
//                     !(
//                       formData.kaggle_datasets &&
//                       formData.kaggle_datasets.length
//                     )
//                   }
//                   className="px-6 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
//                 >
//                   {importLoading ? "Importing..." : "Import Selected"}
//                 </Button>
//               )}
//             </div>

//             <div className="flex items-center gap-3">
//               {currentStep < 5 ? (
//                 <Button
//                   onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
//                   disabled={!isStepComplete() || importLoading}
//                   className={`px-6 h-12 rounded-xl shadow-lg transition-all ${
//                     isStepComplete() && !importLoading
//                       ? "bg-gradient-to-r from-indigo-500 to-pink-500 text-white"
//                       : "bg-gray-300 text-gray-500"
//                   }`}
//                 >
//                   Next <ArrowRight className="w-5 h-5 ml-2" />
//                 </Button>
//               ) : (
//                 <Button
//                   onClick={() => alert("Job submitted successfully!")}
//                   className="px-6 h-12 rounded-xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white"
//                 >
//                   <PlayCircle className="w-5 h-5 mr-2" /> Run Prediction
//                 </Button>
//               )}
//             </div>
//           </div>
//         </Card>
//       </div>

//       <style jsx>{`
//         @keyframes float {
//           0% {
//             transform: translateY(0);
//           }
//           50% {
//             transform: translateY(-6px);
//           }
//           100% {
//             transform: translateY(0);
//           }
//         }
//         .float {
//           animation: float 3s ease-in-out infinite;
//         }
//       `}</style>
//     </div>
//   );
// }











































// src/pages/NewPrediction.jsx
import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Check,
  RefreshCw,
  Package,
  Database,
  Table2,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  PlayCircle,
} from "lucide-react";

import api from "@/lib/api"; // centralized axios client pointing to VITE_API_URL

// Import step components
import Step1DataSource from "@/components/prediction/Datasource";
import Step2Workspace from "@/components/prediction/SelectPipelineAndTables.jsx";
import Step3AnalyticsSetup from "@/components/prediction/Tables";
import Step5Parameters from "@/components/prediction/Step5Parameters";
import Step6Review from "@/components/prediction/Step6Review";

export default function NewPrediction() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Global UI / API state
  const [error, setError] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedLakehouseId, setSelectedLakehouseId] = useState("");

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Step 3 local states
  const [pipelines, setPipelines] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [selectedAnalyticsType, setSelectedAnalyticsType] = useState("");
  // Important: selectedTable will be stored in formData.table_name and also mirrored in state if desired
  // We'll primarily use formData.table_name as the single source of truth for selected table.
  const [loadingTables, setLoadingTables] = useState(false);

  const [formData, setFormData] = useState({
    data_source_type: "",
    kaggle_datasets: [],
    kaggle_dataset_names: [],
    job_name: "",
    workspace_name: "",
    workspace_id: "",
    lakehouse_name: "",
    lakehouse_id: "",
    table_name: "",
    prediction_columns: [],
    pipeline_name: "",
    analytics_type: "",
    start_date: "",
    end_date: "",
    products: "",
    forecast_horizon: 30,
    results_table_name: "",
  });

  /* ------------------------------
     KAGGLE SEARCH API (REAL TIME)
  -------------------------------*/
  const {
    data: datasets,
    isLoading: loadingDatasets,
    error: datasetsError,
  } = useQuery({
    queryKey: ["kaggle-datasets", searchValue],
    queryFn: async () => {
      if (!searchValue || searchValue.length < 2) return { datasets: [] };
      const res = await api.get("/search", { params: { keyword: searchValue } });
      // backend returns { datasets: [...] } per your Flask code
      return res.data || { datasets: [] };
    },
    enabled: searchValue.length >= 2,
    keepPreviousData: true,
    staleTime: 1000 * 30,
  });

  /* ------------------------------
     IMPORT DATASET MUTATION (multi-slug)
  -------------------------------*/
  const importMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/import", payload);
      return res.data;
    },
    onMutate: () => {
      setImportLoading(true);
      setImportResult(null);
    },
    onSuccess: (data) => {
      setImportResult({ type: "success", ...data });
      if (selectedWorkspaceId && selectedLakehouseId) {
        queryClient.invalidateQueries({
          queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
        });
      }
    },
    onError: (err) => {
      const msg = err?.message || (err?.response?.data && JSON.stringify(err.response.data)) || "Import error";
      setImportResult({ type: "error", message: msg });
      setError(`Import Error: ${msg}`);
    },
    onSettled: () => {
      setImportLoading(false);
    },
  });

  /* ------------------------------
       FABRIC WORKSPACES
  -------------------------------*/
  const {
    data: workspaces,
    isLoading: loadingWorkspaces,
    error: workspacesError,
    refetch: refetchWorkspaces,
  } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const res = await api.get("/workspaces");
      // backend returns { value: [...] }
      return res.data?.value || [];
    },
    staleTime: 1000 * 60,
  });

  /* ------------------------------
       FABRIC LAKEHOUSES
  -------------------------------*/
  const {
    data: lakehouses,
    isLoading: loadingLakehouses,
    error: lakehousesError,
  } = useQuery({
    queryKey: ["lakehouses", selectedWorkspaceId],
    queryFn: async () => {
      if (!selectedWorkspaceId) return null;
      const res = await api.get("/lakehouses", { params: { workspace_id: selectedWorkspaceId } });
      return res.data?.value || [];
    },
    enabled: !!selectedWorkspaceId,
    keepPreviousData: true,
  });

  /* ------------------------------
       FABRIC TABLES
  -------------------------------*/
  const {
    data: tables,
    isLoading: tablesQueryLoading,
    error: tablesError,
  } = useQuery({
    queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
    queryFn: async () => {
      if (!selectedWorkspaceId || !selectedLakehouseId) return null;
      const res = await api.get("/tables", {
        params: { workspace_id: selectedWorkspaceId, lakehouse_id: selectedLakehouseId },
      });
      return res.data?.value || res.data || [];
    },
    enabled: !!selectedWorkspaceId && !!selectedLakehouseId,
    staleTime: 1000 * 30,
  });

  // Mirror loadingTables to reflect query
  useEffect(() => {
    setLoadingTables(!!tablesQueryLoading);
  }, [tablesQueryLoading]);

  /* ------------------------------
       FABRIC COLUMNS
  -------------------------------*/
  const {
    data: columns,
    isLoading: loadingColumns,
    error: columnsError,
  } = useQuery({
    queryKey: [
      "columns",
      selectedWorkspaceId,
      selectedLakehouseId,
      formData.table_name,
      // include folder/source if you use them
    ],
    queryFn: async () => {
      if (!selectedWorkspaceId || !selectedLakehouseId || !formData.table_name) return null;
      // Use prediction/columns endpoint to extract schema from delta log
      const params = {
        workspace_id: selectedWorkspaceId,
        lakehouse_id: selectedLakehouseId,
        table_name: formData.table_name,
      };
      // If you have folder/source available and want to supply them:
      // if (folder) params.folder = folder; if (source) params.source = source;
      const res = await api.get("/prediction/columns", { params });
      return res.data?.columns || [];
    },
    enabled: !!selectedWorkspaceId && !!selectedLakehouseId && !!formData.table_name,
    staleTime: 1000 * 30,
  });

  /* ------------------------------
       HANDLERS
  -------------------------------*/
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleWorkspaceSelect = (workspaceId) => {
    const workspace = workspaces?.find((w) => w.id === workspaceId);
    if (!workspace) return;

    setFormData((prev) => ({
      ...prev,
      workspace_id: workspaceId,
      workspace_name: workspace.displayName || workspace.name || "",
      lakehouse_id: "",
      lakehouse_name: "",
      table_name: "",
      prediction_columns: [],
    }));

    setSelectedWorkspaceId(workspaceId);
    setSelectedLakehouseId("");
  };

  const handleLakehouseSelect = (lakehouseId) => {
    const lakehouse = lakehouses?.find((l) => l.id === lakehouseId);
    if (!lakehouse) return;

    setFormData((prev) => ({
      ...prev,
      lakehouse_id: lakehouseId,
      lakehouse_name: lakehouse.displayName || lakehouse.name || "",
      table_name: "",
      prediction_columns: [],
    }));

    setSelectedLakehouseId(lakehouseId);
  };

  const handleTableSelect = (tableName) => {
    setFormData((prev) => ({
      ...prev,
      table_name: tableName,
      prediction_columns: [],
    }));
  };

  const handleColumnToggle = (columnName) => {
    setFormData((prev) => {
      const exists = prev.prediction_columns.includes(columnName);
      const updated = exists
        ? prev.prediction_columns.filter((c) => c !== columnName)
        : [...prev.prediction_columns, columnName];
      return { ...prev, prediction_columns: updated };
    });
  };

  // MULTI SELECT: when user clicks a dataset in Step1
  const handleDatasetSelect = (ds) => {
    setFormData((prev) => {
      const slugs = Array.from(new Set([...(prev.kaggle_datasets || []), ds.slug]));
      return {
        ...prev,
        kaggle_datasets: slugs,
        kaggle_dataset_names: Array.from(new Set([...(prev.kaggle_dataset_names || []), ds.name])),
      };
    });

    setSearchValue("");
    setSearchOpen(false);
  };

  const removeDataset = (slug) => {
    setFormData((prev) => {
      const idx = prev.kaggle_datasets.indexOf(slug);
      if (idx === -1) return prev;
      const newSlugs = prev.kaggle_datasets.filter((s) => s !== slug);
      const newNames = prev.kaggle_dataset_names.filter((_, i) => i !== idx);
      return {
        ...prev,
        kaggle_datasets: newSlugs,
        kaggle_dataset_names: newNames,
      };
    });
  };

  // trigger import for selected slugs
  const importSelectedDatasets = () => {
    const workspaceId = formData.workspace_id || selectedWorkspaceId;
    const lakehouseId = formData.lakehouse_id || selectedLakehouseId;

    if (!workspaceId || !lakehouseId) {
      setImportResult({
        type: "error",
        message:
          "Please select both Workspace and Lakehouse before importing the dataset(s).",
      });
      setError("Select workspace & lakehouse before importing.");
      return;
    }

    if (!formData.kaggle_datasets || formData.kaggle_datasets.length === 0) {
      setImportResult({
        type: "error",
        message: "No datasets selected to import",
      });
      return;
    }

    importMutation.mutate({
      slugs: formData.kaggle_datasets,
      workspace_id: workspaceId,
      lakehouse_id: lakehouseId,
    });
  };

  // Check if step is complete for Next button
  const isStepComplete = () => {
    switch (currentStep) {
      case 1:
        return formData.data_source_type === "kaggle" && (formData.kaggle_datasets || []).length > 0;
      case 2:
        return selectedWorkspaceId;
      case 3:
        return selectedPipeline && formData.table_name && selectedAnalyticsType;
      case 4:
        return formData.start_date && formData.end_date && formData.forecast_horizon > 0;
      default:
        return true;
    }
  };

  const steps = [
    { number: 1, title: "Data Source", icon: Package, completed: currentStep > 1 },
    { number: 2, title: "Pipeline & Tables", icon: Database, completed: currentStep > 2 },
    { number: 3, title: "Analytics Setup", icon: Table2, completed: currentStep > 3 },
    { number: 4, title: "Parameters", icon: Calendar, completed: currentStep > 4 },
    { number: 5, title: "Review", icon: CheckCircle2, completed: false },
  ];

  const getDatasetDisplay = () =>
    (formData.kaggle_dataset_names && formData.kaggle_dataset_names.join(", ")) || "Dataset";

  useEffect(() => {
    const apiError = workspacesError || lakehousesError || tablesError || columnsError || datasetsError;
    if (apiError) setError(`API Error: ${apiError.message || JSON.stringify(apiError)}`);
  }, [workspacesError, lakehousesError, tablesError, columnsError, datasetsError]);

  useEffect(() => {
    if (currentStep !== 1) {
      setImportResult(null);
    }
  }, [currentStep]);

  // Retry function for errors
  const handleRetry = () => {
    setError(null);
    refetchWorkspaces();
    queryClient.refetchQueries({ queryKey: ["lakehouses"] });
    queryClient.refetchQueries({ queryKey: ["tables"] });
  };

  // -------------------------
  // Fetch pipelines for the selected workspace (for Step 3)
  // -------------------------
  useEffect(() => {
    if (!selectedWorkspaceId) {
      setPipelines([]);
      return;
    }
    setLoadingPipelines(true);
    api
      .get("/pipelines", { params: { workspace_id: selectedWorkspaceId } })
      .then((res) => {
        setPipelines(res.data?.value || []);
      })
      .catch(() => setPipelines([]))
      .finally(() => setLoadingPipelines(false));
  }, [selectedWorkspaceId]);

  // -------------------------
  // onPipelineRun callback: called by Step2 when pipeline finished & table_saved === true
  // -------------------------
  const handlePipelineRunResult = (result) => {
    // result: { status: 'success'|'failed', destination_table, pipeline_id, pipeline_status, raw }
    if (!result) return;

    if (result.status === "success" && result.destination_table) {
      // 1) store table in formData
      setFormData((prev) => ({
        ...prev,
        table_name: result.destination_table,
        pipeline_name: result.pipeline_id || prev.pipeline_name,
      }));

      // 2) set selected pipeline & analytics type placeholder
      setSelectedPipeline(result.pipeline_id || "");
      setSelectedAnalyticsType("");

      // 3) ensure tables list refresh: invalidate react-query cache for tables
      if (selectedWorkspaceId && selectedLakehouseId) {
        queryClient.invalidateQueries({
          queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
        });
      }

      // 4) automatically go to step 3 (Analytics)
      setCurrentStep(3);
    } else {
      setError(`Pipeline run failed: ${result?.pipeline_status || "unknown"}`);
    }
  };

  // pretty animations
  const cardMotion = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div className="mb-6" layout>
          <Card className="relative overflow-hidden border-2 border-transparent shadow-2xl bg-white/90">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/dashboard")}
                  className="h-12 w-12 rounded-full border border-indigo-100 hover:bg-indigo-50"
                >
                  <ArrowLeft className="w-5 h-5 text-indigo-600" />
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-full">
                      <Sparkles className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600">
                      New Prediction Job
                    </h1>
                  </div>
                  <p className="mt-2 text-gray-600">
                    Configure forecasts in 5 animated steps — fast and visual.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Progress Bar */}
        <motion.div className="mb-6">
          <Card className="border-0 bg-white/80 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                {steps.map((step, i) => (
                  <React.Fragment key={step.number}>
                    <div className="flex flex-col items-center flex-1">
                      <motion.div
                        animate={{
                          scale: currentStep === step.number ? 1.05 : 1,
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${
                          step.completed
                            ? "bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg"
                            : currentStep === step.number
                            ? "bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-xl"
                            : "bg-gray-100 text-gray-400 border"
                        }`}
                      >
                        {step.completed ? <Check className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
                      </motion.div>
                      <p
                        className={`text-xs md:text-sm font-semibold text-center ${
                          currentStep === step.number ? "text-indigo-600" : step.completed ? "text-green-600" : "text-gray-500"
                        }`}
                      >
                        {step.title}
                      </p>
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-2 rounded-full ${
                          currentStep > step.number ? "bg-gradient-to-r from-green-400 to-green-600" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-6">
              <Alert className="border-2 border-red-200/50 bg-red-50/90 shadow">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <AlertDescription className="flex items-center justify-between text-sm font-medium text-red-800">
                  <span>{error}</span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleRetry}>
                      <RefreshCw className="w-4 h-4" /> Retry
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Import Result */}
        <AnimatePresence>
          {importResult && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
              <Alert
                className={`border-2 shadow ${importResult.type === "success" ? "border-green-200/50 bg-green-50/90" : "border-red-200/50 bg-red-50/90"}`}
              >
                {importResult.type === "success" ? <Check className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
                <AlertDescription className="text-sm font-medium">
                  {importResult.type === "success" ? (
                    <div>
                      <p className="font-semibold text-green-800">Import finished</p>
                      <div className="mt-2 text-xs text-gray-700">
                        {Object.entries(importResult.results || {}).map(([slug, res]) => (
                          <div key={slug} className="mb-1">
                            <strong>{slug}:</strong> {res.status} {res.error ? `- ${res.error}` : ""}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="font-semibold text-red-800">{importResult.message}</p>
                  )}
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Card */}
        <Card className="overflow-hidden shadow-2xl">
          <CardHeader className="border-b-0 p-6 bg-gradient-to-r from-white to-white/70">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${currentStep === 5 ? "bg-green-100" : "bg-indigo-50"}`}>
                {currentStep === 1 && <Package className="w-6 h-6 text-indigo-600" />}
                {currentStep === 2 && <Database className="w-6 h-6 text-indigo-600" />}
                {currentStep === 3 && <Database className="w-6 h-6 text-indigo-600" />}
                {currentStep === 4 && <Calendar className="w-6 h-6 text-indigo-600" />}
                {currentStep === 5 && <CheckCircle2 className="w-6 h-6 text-green-600" />}
              </div>
              <CardTitle className="text-xl md:text-2xl font-bold text-gray-800">
                Step {currentStep}: {steps[currentStep - 1].title}
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-6 md:p-8 lg:p-10">
            <AnimatePresence exitBeforeEnter>
              {currentStep === 1 && (
                <motion.div key="s1" {...cardMotion}>
                  <Step1DataSource
                    formData={formData}
                    setFormData={setFormData}
                    searchValue={searchValue}
                    setSearchValue={setSearchValue}
                    searchOpen={searchOpen}
                    setSearchOpen={setSearchOpen}
                    datasets={datasets}
                    loadingDatasets={loadingDatasets}
                    datasetsError={datasetsError}
                    handleDatasetSelect={handleDatasetSelect}
                    loadingWorkspaces={loadingWorkspaces}
                    workspaces={workspaces}
                    workspacesError={workspacesError}
                    selectedWorkspaceId={selectedWorkspaceId}
                    handleWorkspaceSelect={handleWorkspaceSelect}
                    loadingLakehouses={loadingLakehouses}
                    lakehouses={lakehouses}
                    lakehousesError={lakehousesError}
                    selectedLakehouseId={selectedLakehouseId}
                    handleLakehouseSelect={handleLakehouseSelect}
                    importLoading={importLoading}
                    removeDataset={removeDataset}
                    importSelectedDatasets={importSelectedDatasets}
                  />
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div key="s2" {...cardMotion}>
                  <Step2Workspace workspaceId={selectedWorkspaceId} lakehouseId={selectedLakehouseId} onPipelineRun={handlePipelineRunResult} />
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div key="s3" {...cardMotion}>
                  <Step3AnalyticsSetup
                    datasetName={getDatasetDisplay()}
                    loadingPipelines={loadingPipelines}
                    pipelines={pipelines}
                    selectedPipelineId={selectedPipeline}
                    setSelectedPipeline={setSelectedPipeline} // <-- keep setter
                    setFormData={setFormData}
                    loadingTables={loadingTables}
                    tables={tables || []}
                    selectedTable={formData.table_name}
                    handleTableSelect={handleTableSelect}
                    selectedAnalyticsType={selectedAnalyticsType}
                    handleAnalyticsTypeSelect={(val) => {
                      setSelectedAnalyticsType(val);
                      handleChange("analytics_type", val);
                    }}
                  />
                </motion.div>
              )}

              {currentStep === 4 && (
                <motion.div key="s4" {...cardMotion}>
                  <Step5Parameters formData={formData} handleChange={handleChange} />
                </motion.div>
              )}

              {currentStep === 5 && (
                <motion.div key="s5" {...cardMotion}>
                  <Step6Review formData={formData} getDatasetDisplay={getDatasetDisplay} selectedWorkspaceId={selectedWorkspaceId} selectedLakehouseId={selectedLakehouseId} />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>

          {/* Footer navigation */}
          <div className="border-t border-gray-100/50 bg-gradient-to-r from-white to-white/60 p-6 flex items-center justify-between gap-4">
            <div>
              <Button
                variant="outline"
                onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
                disabled={currentStep === 1}
                className="px-6 h-12 mr-3"
              >
                <ArrowLeft className="w-5 h-5 mr-2" /> Back
              </Button>

              {/* Quick action: import selected datasets (visible only on step1) */}
              {currentStep === 1 && (
                <Button
                  onClick={importSelectedDatasets}
                  disabled={importLoading || !(formData.kaggle_datasets && formData.kaggle_datasets.length)}
                  className="px-6 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                >
                  {importLoading ? "Importing..." : "Import Selected"}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {currentStep < 5 ? (
                <Button
                  onClick={() => setCurrentStep((s) => Math.min(5, s + 1))}
                  disabled={!isStepComplete() || importLoading}
                  className={`px-6 h-12 rounded-xl shadow-lg transition-all ${
                    isStepComplete() && !importLoading ? "bg-gradient-to-r from-indigo-500 to-pink-500 text-white" : "bg-gray-300 text-gray-500"
                  }`}
                >
                  Next <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button onClick={() => alert("Job submitted successfully!")} className="px-6 h-12 rounded-xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                  <PlayCircle className="w-5 h-5 mr-2" /> Run Prediction
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>

      <style jsx>{`
        @keyframes float {
          0% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
          100% {
            transform: translateY(0);
          }
        }
        .float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
