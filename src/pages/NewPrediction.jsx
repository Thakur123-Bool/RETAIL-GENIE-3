// import React, { useState, useEffect } from "react";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { useNavigate } from "react-router-dom";

// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Command, CommandItem, CommandList } from "@/components/ui/command";
// import { Badge } from "@/components/ui/badge";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Skeleton } from "@/components/ui/skeleton"; // Assuming you have shadcn/ui Skeleton; add if not

// import {
//   ArrowLeft,
//   ArrowRight,
//   PlayCircle,
//   Database,
//   Table2,
//   Calendar,
//   Package,
//   CheckCircle2,
//   Sparkles,
//   Search,
//   AlertCircle,
//   Check,
//   RefreshCw // NEW: For retry icon
// } from "lucide-react";

// export default function NewPrediction() {
//   const navigate = useNavigate();
//   const queryClient = useQueryClient();

//   const [error, setError] = useState(null);
//   const [importResult, setImportResult] = useState(null);
//   const [importLoading, setImportLoading] = useState(false);
//   const [currentStep, setCurrentStep] = useState(1);

//   const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
//   const [selectedLakehouseId, setSelectedLakehouseId] = useState("");
//   const [searchOpen, setSearchOpen] = useState(false);
//   const [searchValue, setSearchValue] = useState("");

//   const [formData, setFormData] = useState({
//     data_source_type: "",
//     kaggle_dataset: "",
//     kaggle_dataset_name: "",
//     job_name: "",
//     workspace_name: "",
//     workspace_id: "",
//     lakehouse_name: "",
//     lakehouse_id: "",
//     table_name: "",
//     prediction_columns: [],
//     pipeline_name: "",
//     start_date: "",
//     end_date: "",
//     products: "",
//     forecast_horizon: 30,
//     results_table_name: "",
//   });

//   /* ------------------------------
//      KAGGLE SEARCH API (REAL TIME)
//   -------------------------------*/
//   const {
//     data: datasets,
//     isLoading: loadingDatasets,
//     error: datasetsError
//   } = useQuery({
//     queryKey: ["kaggle-datasets", searchValue],
//     queryFn: async () => {
//       if (!searchValue || searchValue.length < 2) return { datasets: [] };
//       const response = await fetch(
//         `http://127.0.0.1:5000/search?keyword=${encodeURIComponent(searchValue)}`
//       );
//       if (!response.ok) throw new Error("Failed to search datasets");
//       return response.json();
//     },
//     enabled: searchValue.length >= 2,
//   });

//   /* ------------------------------
//      IMPORT DATASET MUTATION
//   -------------------------------*/
//   const importMutation = useMutation({
//     mutationFn: async (payload) => {
//       const response = await fetch("http://127.0.0.1:5000/import", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
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
//         queryClient.invalidateQueries({ queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId] });
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
//        FABRIC WORKSPACES (with retry)
//        <-- NOTE: these calls remain on port 8000 per your instruction -->
//   -------------------------------*/
//   const {
//     data: workspaces,
//     isLoading: loadingWorkspaces,
//     error: workspacesError,
//     refetch: refetchWorkspaces
//   } = useQuery({
//     queryKey: ["workspaces"],
//     queryFn: async () => {
//       const response = await fetch("http://127.0.0.1:5000/workspaces");
//       if (!response.ok) throw new Error("Failed to fetch workspaces");
//       return response.json().then(data => data.value || []);
//     },
//   });

//   /* ------------------------------
//        FABRIC LAKEHOUSES
//   -------------------------------*/
//   const {
//     data: lakehouses,
//     isLoading: loadingLakehouses,
//     error: lakehousesError
//   } = useQuery({
//     queryKey: ["lakehouses", selectedWorkspaceId],
//     queryFn: async () => {
//       if (!selectedWorkspaceId) return null;
//       const response = await fetch(
//         `http://127.0.0.1:5000/lakehouses?workspace_id=${selectedWorkspaceId}`
//       );
//       if (!response.ok) throw new Error("Failed to fetch lakehouses");
//       return response.json().then(data => data.value || []);
//     },
//     enabled: !!selectedWorkspaceId,
//   });

//   /* ------------------------------
//        FABRIC TABLES
//   -------------------------------*/
//   const {
//     data: tables,
//     isLoading: loadingTables,
//     error: tablesError
//   } = useQuery({
//     queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
//     queryFn: async () => {
//       if (!selectedWorkspaceId || !selectedLakehouseId) return null;
//       const response = await fetch(
//         `http://127.0.0.1:8000/workspaces/${selectedWorkspaceId}/lakehouses/${selectedLakehouseId}/tables`
//       );
//       if (!response.ok) throw new Error("Failed to fetch tables");
//       return response.json();
//     },
//     enabled: !!selectedWorkspaceId && !!selectedLakehouseId,
//   });

//   /* ------------------------------
//        FABRIC COLUMNS
//   -------------------------------*/
//   const {
//     data: columns,
//     isLoading: loadingColumns,
//     error: columnsError
//   } = useQuery({
//     queryKey: ["columns", selectedWorkspaceId, selectedLakehouseId, formData.table_name],
//     queryFn: async () => {
//       if (!selectedWorkspaceId || !selectedLakehouseId || !formData.table_name)
//         return null;
//       const response = await fetch(
//         `http://127.0.0.1:8000/workspaces/${selectedWorkspaceId}/lakehouses/${selectedLakehouseId}/tables/${formData.table_name}/columns`
//       );
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

//   const handleDatasetSelect = (ds) => {
//     // always set dataset info in UI
//     setFormData((prev) => ({
//       ...prev,
//       kaggle_dataset: ds.slug,
//       kaggle_dataset_name: ds.name,
//     }));

//     setSearchValue(ds.name);
//     setSearchOpen(false);

//     // determine workspace/lakehouse to use for import (prefers formData values)
//     const workspaceId = formData.workspace_id || selectedWorkspaceId;
//     const lakehouseId = formData.lakehouse_id || selectedLakehouseId;

//     // If workspace or lakehouse missing, do NOT import — show an error
//     if (!workspaceId || !lakehouseId) {
//       setImportResult({
//         type: "error",
//         message: "Please select both Workspace and Lakehouse before importing the dataset."
//       });
//       setError("Select workspace & lakehouse before importing.");
//       return;
//     }

//     // proceed to import
//     const payload = {
//       slug: ds.slug,
//       workspace_id: workspaceId,
//       lakehouse_id: lakehouseId,
//     };

//     importMutation.mutate(payload);
//   };

//   // NEW: Check if step is complete for Next button
//   const isStepComplete = () => {
//     switch (currentStep) {
//       case 1:
//         // require the data source be selected and a dataset chosen (import may or may not have run)
//         return formData.data_source_type === "kaggle" && !!formData.kaggle_dataset;
//       case 2:
//         return selectedWorkspaceId;
//       case 3:
//         return selectedLakehouseId;
//       case 4:
//         return formData.table_name;
//       case 5:
//         return formData.start_date && formData.end_date && formData.forecast_horizon > 0;
//       default:
//         return true;
//     }
//   };

//   const steps = [
//     { number: 1, title: "Data Source", icon: Package, completed: currentStep > 1 },
//     { number: 2, title: "Workspace", icon: Database, completed: currentStep > 2 },
//     { number: 3, title: "Lakehouse", icon: Database, completed: currentStep > 3 },
//     { number: 4, title: "Table", icon: Table2, completed: currentStep > 4 },
//     { number: 5, title: "Parameters", icon: Calendar, completed: currentStep > 5 },
//     { number: 6, title: "Review", icon: CheckCircle2, completed: false },
//   ];

//   const getDatasetDisplay = () =>
//     formData.kaggle_dataset_name ||
//     formData.kaggle_dataset ||
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

//   // NEW: Retry function for errors
//   const handleRetry = () => {
//     setError(null);
//     refetchWorkspaces();
//     queryClient.refetchQueries({ queryKey: ["lakehouses"] });
//     queryClient.refetchQueries({ queryKey: ["tables"] });
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 md:p-6 lg:p-8">
//       <div className="max-w-6xl mx-auto"> {/* Increased max-width for better spacing */}

//         {/* Header - Enhanced with subtle shadow */}
//         <div className="mb-6 md:mb-8 relative">
//           <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 rounded-2xl blur-xl"></div>
//           <Card className="relative overflow-hidden border-2 border-blue-100/50 shadow-xl bg-white/80 backdrop-blur-sm">
//             <CardContent className="p-6 md:p-8">
//               <div className="flex items-center gap-4">
//                 <Button
//                   variant="ghost"
//                   size="icon"
//                   onClick={() => navigate("/dashboard")}
//                   className="h-12 w-12 rounded-full border-2 border-blue-200/50 hover:bg-blue-50/50 hover:border-blue-400/80 transition-all shadow-md"
//                 >
//                   <ArrowLeft className="w-5 h-5 text-blue-600" />
//                 </Button>
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3">
//                     <div className="p-2 bg-blue-100 rounded-full">
//                       <Sparkles className="w-6 h-6 text-blue-600" />
//                     </div>
//                     <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
//                       New Prediction Job
//                     </h1>
//                   </div>
//                   <p className="mt-2 text-gray-600 text-sm md:text-base font-medium">
//                     Configure your intelligent forecast in 6 simple steps
//                   </p>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </div>

//         {/* Progress Bar - Enhanced with better spacing */}
//         <Card className="mb-6 md:mb-8 border-2 border-blue-100/50 shadow-xl bg-white/80 backdrop-blur-sm">
//           <CardContent className="p-4 md:p-6 lg:p-8">
//             <div className="flex items-center justify-between">
//               {steps.map((step, i) => (
//                 <React.Fragment key={step.number}>
//                   <div className="flex flex-col items-center flex-1">
//                     <div
//                       className={`relative w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center mb-2 md:mb-3 transition-all duration-500 ease-out ${
//                         step.completed
//                           ? "bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg scale-105 ring-2 ring-green-200"
//                           : currentStep === step.number
//                           ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white ring-4 ring-blue-100/50 shadow-xl scale-105"
//                           : "bg-gray-100/50 text-gray-400 border border-gray-200/50"
//                       }`}
//                     >
//                       {step.completed ? (
//                         <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
//                       ) : (
//                         <step.icon className="w-5 h-5 md:w-6 md:h-6 lg:w-7 lg:h-7" />
//                       )}
//                     </div>
//                     <p
//                       className={`text-xs md:text-sm lg:text-base font-semibold text-center transition-all ${
//                         currentStep === step.number
//                           ? "text-blue-600 scale-105 font-bold"
//                           : step.completed
//                           ? "text-green-600"
//                           : "text-gray-500"
//                       }`}
//                     >
//                       {step.title}
//                     </p>
//                   </div>
//                   {i < steps.length - 1 && (
//                     <div
//                       className={`h-1 flex-1 mx-1 md:mx-2 rounded-full transition-all duration-500 ${
//                         currentStep > step.number
//                           ? "bg-gradient-to-r from-green-400 to-green-600 scale-x-100"
//                           : "bg-gray-200 scale-x-0"
//                       } origin-left`}
//                     />
//                   )}
//                 </React.Fragment>
//               ))}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Global Error Alert - Professional with retry */}
//         {error && (
//           <Alert className="mb-6 border-2 border-red-200/50 bg-red-50/80 shadow-md animate-fadeIn">
//             <AlertCircle className="w-5 h-5 text-red-600" />
//             <AlertDescription className="flex items-center justify-between text-sm font-medium text-red-800">
//               <span>{error}</span>
//               <Button
//                 variant="ghost"
//                 size="sm"
//                 onClick={handleRetry}
//                 className="gap-1 text-red-700 hover:text-red-900"
//               >
//                 <RefreshCw className="w-4 h-4 animate-spin" />
//                 Retry
//               </Button>
//             </AlertDescription>
//           </Alert>
//         )}

//         {/* Import Result Alert - Enhanced styling */}
//         {importResult && (
//           <Alert 
//             className={`mb-6 border-2 shadow-md animate-fadeIn transition-all ${
//               importResult.type === "success" 
//                 ? "border-green-200/50 bg-green-50/80" 
//                 : "border-red-200/50 bg-red-50/80"
//             }`}
//           >
//             {importResult.type === "success" ? (
//               <Check className="w-5 h-5 text-green-600" />
//             ) : (
//               <AlertCircle className="w-5 h-5 text-red-600" />
//             )}
//             <AlertDescription className="text-sm font-medium">
//               {importResult.type === "success" ? (
//                 <>
//                   <p className={`font-semibold ${importResult.type === "success" ? "text-green-800" : "text-red-800"}`}>
//                     {importResult.message}
//                   </p>
//                   {importResult.tables_created && importResult.tables_created.length > 0 && (
//                     <div className="mt-2 p-2 bg-white/50 rounded-lg">
//                       <p className="text-xs font-medium text-gray-700 mb-1">Tables Created:</p>
//                       <ul className="text-xs text-gray-600 space-y-0.5 list-disc list-inside">
//                         {importResult.tables_created.map((table, idx) => (
//                           <li key={idx} className="ml-2">{table}</li>
//                         ))}
//                       </ul>
//                     </div>
//                   )}
//                 </>
//               ) : (
//                 <p className="font-semibold text-red-800">{importResult.message}</p>
//               )}
//             </AlertDescription>
//           </Alert>
//         )}

//         {/* Main Step Card - All steps inside for consistency */}
//         <Card className="border-2 border-blue-100/50 shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
//           <CardHeader className="border-b-2 border-blue-50/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 p-6">
//             <div className="flex items-center gap-3">
//               <div className={`p-2 rounded-full transition-colors ${
//                 currentStep === 6 ? "bg-green-100" : "bg-blue-100"
//               }`}>
//                 {currentStep === 1 && <Package className="w-6 h-6 text-blue-600" />}
//                 {currentStep === 2 && <Database className="w-6 h-6 text-blue-600" />}
//                 {currentStep === 3 && <Database className="w-6 h-6 text-blue-600" />}
//                 {currentStep === 4 && <Table2 className="w-6 h-6 text-blue-600" />}
//                 {currentStep === 5 && <Calendar className="w-6 h-6 text-blue-600" />}
//                 {currentStep === 6 && <CheckCircle2 className="w-6 h-6 text-green-600" />}
//               </div>
//               <CardTitle className="text-xl md:text-2xl lg:text-3xl font-bold text-gray-800">
//                 Step {currentStep}: {steps[currentStep - 1].title}
//               </CardTitle>
//             </div>
//           </CardHeader>

//           <CardContent className="p-6 md:p-8 lg:p-10">
//             {/* STEP 1 — DATA SOURCE */}
//             {currentStep === 1 && (
//               <div className="space-y-6 animate-fadeIn">
//                 <div className="space-y-4">
//                   <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                     <Package className="w-5 h-5 text-blue-600" />
//                     Data Source Type <span className="text-red-500">*</span>
//                   </Label>
//                   <Select
//                     value={formData.data_source_type}
//                     onValueChange={(v) => handleChange("data_source_type", v)}
//                   >
//                     <SelectTrigger className="h-14 text-base border-2 border-blue-200/50 rounded-xl shadow-sm hover:border-blue-300 transition-all">
//                       <SelectValue placeholder="Choose your data source..." />
//                     </SelectTrigger>
//                     <SelectContent className="border-blue-200/50">
//                       <SelectItem value="kaggle" className="text-base py-3">
//                         <Package className="w-4 h-4 mr-2 inline" /> Kaggle Datasets
//                       </SelectItem>
//                     </SelectContent>
//                   </Select>
//                 </div>

//                 {/* === Choose Workspace (for import) === */}
//                 <div className="space-y-4 pt-4 border-t border-gray-100">
//                   <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                     <Database className="w-5 h-5 text-blue-600" />
//                     Choose Workspace (for import) <span className="text-red-500">*</span>
//                   </Label>

//                   {loadingWorkspaces ? (
//                     <Skeleton className="h-14 w-full rounded-xl" />
//                   ) : workspacesError ? (
//                     <Alert className="border-red-200/50 bg-red-50/50">
//                       <AlertCircle className="w-5 h-5 text-red-600" />
//                       <AlertDescription className="text-sm text-red-800">
//                         Unable to load workspaces. Please check your connection.
//                       </AlertDescription>
//                     </Alert>
//                   ) : (
//                     <Select
//                       value={selectedWorkspaceId}
//                       onValueChange={handleWorkspaceSelect}
//                     >
//                       <SelectTrigger className="h-14 text-base border-2 border-blue-200/50 rounded-xl shadow-sm hover:border-blue-300 focus:border-blue-400 transition-all">
//                         <SelectValue placeholder="Choose a workspace..." />
//                       </SelectTrigger>
//                       <SelectContent className="border-blue-200/50 max-h-60">
//                         {workspaces?.map((w) => (
//                           <SelectItem key={w.id} value={w.id} className="text-base py-3 hover:bg-blue-50">
//                             <div className="flex items-center gap-2">
//                               <Database className="w-4 h-4 text-blue-600" />
//                               {w.displayName}
//                             </div>
//                           </SelectItem>
//                         )) || <SelectItem disabled>No workspaces available</SelectItem>}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 </div>

//                 {/* === Choose Lakehouse (for import) === */}
//                 <div className="space-y-4 pt-4 border-t border-gray-100">
//                   <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                     <Database className="w-5 h-5 text-indigo-600" />
//                     Choose Lakehouse (for import) <span className="text-red-500">*</span>
//                   </Label>

//                   {loadingLakehouses ? (
//                     <Skeleton className="h-14 w-full rounded-xl" />
//                   ) : !selectedWorkspaceId ? (
//                     <Alert className="border-yellow-200/50 bg-yellow-50/50">
//                       <AlertCircle className="w-5 h-5 text-yellow-600" />
//                       <AlertDescription className="text-sm text-yellow-800">
//                         Please select a workspace first.
//                       </AlertDescription>
//                     </Alert>
//                   ) : lakehousesError ? (
//                     <Alert className="border-red-200/50 bg-red-50/50">
//                       <AlertCircle className="w-5 h-5 text-red-600" />
//                       <AlertDescription className="text-sm text-red-800">
//                         Unable to load lakehouses.
//                       </AlertDescription>
//                     </Alert>
//                   ) : (
//                     <Select
//                       value={selectedLakehouseId}
//                       onValueChange={handleLakehouseSelect}
//                     >
//                       <SelectTrigger className="h-14 text-base border-2 border-indigo-200/50 rounded-xl shadow-sm hover:border-indigo-300 transition-all">
//                         <SelectValue placeholder="Choose a lakehouse..." />
//                       </SelectTrigger>
//                       <SelectContent className="border-indigo-200/50 max-h-60">
//                         {lakehouses?.map((l) => (
//                           <SelectItem key={l.id} value={l.id} className="text-base py-3 hover:bg-indigo-50">
//                             <div className="flex items-center gap-2">
//                               <Database className="w-4 h-4 text-indigo-600" />
//                               {l.displayName}
//                             </div>
//                           </SelectItem>
//                         )) || <SelectItem disabled>No lakehouses available</SelectItem>}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 </div>

//                 {/* === Search Kaggle Dataset === */}
//                 {formData.data_source_type === "kaggle" && (
//                   <div className="space-y-4 pt-4 border-t border-gray-100">
//                     <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                       <Search className="w-5 h-5 text-orange-600" />
//                       Search Kaggle Dataset <span className="text-red-500">*</span>
//                     </Label>
//                     <div className="relative">
//                       <Input
//                         autoComplete="off"
//                         placeholder="e.g., 'sales data' or 'customer reviews'..."
//                         value={searchValue}
//                         onChange={(e) => {
//                           const v = e.target.value;
//                           setSearchValue(v);
//                           setSearchOpen(v.length >= 2);
//                         }}
//                         onFocus={() => {
//                           if (searchValue.length >= 2) setSearchOpen(true);
//                         }}
//                         className="h-14 text-base border-2 border-orange-200/50 rounded-xl shadow-sm pr-12 focus:border-orange-400 transition-all"
//                         disabled={importLoading}
//                       />
//                       {importLoading && (
//                         <div className="absolute right-4 top-1/2 -translate-y-1/2">
//                           <div className="animate-spin rounded-full h-5 w-5 border-2 border-orange-600 border-t-transparent"></div>
//                         </div>
//                       )}
//                       {searchOpen && !importLoading && (
//                         <div className="absolute top-full left-0 w-full bg-white rounded-xl border border-gray-200 shadow-2xl mt-2 max-h-72 overflow-y-auto no-scrollbar z-[9999]">
//                           <Command>
//                             <CommandList className="p-2">
//                               {loadingDatasets ? (
//                                 <CommandItem className="justify-center py-8">
//                                   <div className="flex items-center gap-2 text-gray-500">
//                                     <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-400 border-t-transparent"></div>
//                                     Searching datasets...
//                                   </div>
//                                 </CommandItem>
//                               ) : !loadingDatasets && searchValue.length >= 2 && datasets?.datasets?.length > 0 ? (
//                                 datasets.datasets.map((ds) => (
//                                   <CommandItem
//                                     key={ds.slug}
//                                     onSelect={() => handleDatasetSelect(ds)}
//                                     className="cursor-pointer hover:bg-orange-50 rounded-lg p-3 transition-colors"
//                                   >
//                                     <div className="flex items-center gap-3 w-full">
//                                       <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg flex items-center justify-center flex-shrink-0">
//                                         <Package className="w-5 h-5" />
//                                       </div>
//                                       <div className="flex-1 min-w-0">
//                                         <p className="font-semibold text-gray-900 truncate">{ds.name}</p>
//                                         <p className="text-xs text-gray-500 truncate">{ds.slug}</p>
//                                       </div>
//                                     </div>
//                                   </CommandItem>
//                                 ))
//                               ) : (
//                                 <CommandItem className="justify-center py-8 text-gray-500">
//                                   No datasets found for "{searchValue}". Try a different keyword.
//                                 </CommandItem>
//                               )}
//                             </CommandList>
//                           </Command>
//                         </div>
//                       )}
//                     </div>
//                     <p className="text-sm text-gray-500 flex items-center gap-2 pt-2">
//                       <span className="w-2 h-2 rounded-full bg-orange-400"></span>
//                       Selecting a dataset will automatically import it to Fabric for analysis.
//                     </p>
//                   </div>
//                 )}
//               </div>
//             )}

//             {/* STEP 2 — WORKSPACE (Enhanced with skeleton/loading) */}
//             {currentStep === 2 && (
//               <div className="space-y-6 animate-fadeIn">
//                 <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-100">
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-orange-100 text-orange-800 font-medium">
//                     <Package className="w-3 h-3 mr-1" /> Dataset: {getDatasetDisplay()}
//                   </Badge>
//                 </div>
//                 <div className="space-y-4">
//                   <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                     <Database className="w-5 h-5 text-blue-600" />
//                     Select Workspace <span className="text-red-500">*</span>
//                   </Label>
//                   {loadingWorkspaces ? (
//                     <Skeleton className="h-14 w-full rounded-xl" />
//                   ) : workspacesError ? (
//                     <Alert className="border-red-200/50 bg-red-50/50">
//                       <AlertCircle className="w-5 h-5 text-red-600" />
//                       <AlertDescription className="text-sm text-red-800">
//                         Unable to load workspaces. Please check your connection.
//                       </AlertDescription>
//                     </Alert>
//                   ) : (
//                     <Select
//                       value={selectedWorkspaceId}
//                       onValueChange={handleWorkspaceSelect}
//                     >
//                       <SelectTrigger className="h-14 text-base border-2 border-blue-200/50 rounded-xl shadow-sm hover:border-blue-300 focus:border-blue-400 transition-all">
//                         <SelectValue placeholder="Choose a workspace..." />
//                       </SelectTrigger>
//                       <SelectContent className="border-blue-200/50 max-h-60">
//                         {workspaces?.map((w) => (
//                           <SelectItem key={w.id} value={w.id} className="text-base py-3 hover:bg-blue-50">
//                             <div className="flex items-center gap-2">
//                               <Database className="w-4 h-4 text-blue-600" />
//                               {w.displayName}
//                             </div>
//                           </SelectItem>
//                         )) || <SelectItem disabled>No workspaces available</SelectItem>}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 </div>
//               </div>
//             )}

//             {/* STEP 3 — LAKEHOUSE */}
//             {currentStep === 3 && (
//               <div className="space-y-6 animate-fadeIn">
//                 <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gradient-to-r from-orange-50 via-blue-50 to-indigo-50 rounded-xl border border-gray-100">
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-orange-100 text-orange-800">
//                     Dataset: {getDatasetDisplay()}
//                   </Badge>
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-blue-100 text-blue-800">
//                     Workspace: {formData.workspace_name || "Not selected"}
//                   </Badge>
//                 </div>
//                 <div className="space-y-4">
//                   <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                     <Database className="w-5 h-5 text-indigo-600" />
//                     Select Lakehouse <span className="text-red-500">*</span>
//                   </Label>
//                   {loadingLakehouses ? (
//                     <Skeleton className="h-14 w-full rounded-xl" />
//                   ) : !selectedWorkspaceId ? (
//                     <Alert className="border-yellow-200/50 bg-yellow-50/50">
//                       <AlertCircle className="w-5 h-5 text-yellow-600" />
//                       <AlertDescription className="text-sm text-yellow-800">
//                         Please select a workspace first.
//                       </AlertDescription>
//                     </Alert>
//                   ) : lakehousesError ? (
//                     <Alert className="border-red-200/50 bg-red-50/50">
//                       <AlertCircle className="w-5 h-5 text-red-600" />
//                       <AlertDescription className="text-sm text-red-800">
//                         Unable to load lakehouses.
//                       </AlertDescription>
//                     </Alert>
//                   ) : (
//                     <Select
//                       value={selectedLakehouseId}
//                       onValueChange={handleLakehouseSelect}
//                     >
//                       <SelectTrigger className="h-14 text-base border-2 border-indigo-200/50 rounded-xl shadow-sm hover:border-indigo-300 transition-all">
//                         <SelectValue placeholder="Choose a lakehouse..." />
//                       </SelectTrigger>
//                       <SelectContent className="border-indigo-200/50 max-h-60">
//                         {lakehouses?.map((l) => (
//                           <SelectItem key={l.id} value={l.id} className="text-base py-3 hover:bg-indigo-50">
//                             <div className="flex items-center gap-2">
//                               <Database className="w-4 h-4 text-indigo-600" />
//                               {l.displayName}
//                             </div>
//                           </SelectItem>
//                         )) || <SelectItem disabled>No lakehouses available</SelectItem>}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 </div>
//               </div>
//             )}

//             {/* STEP 4 — TABLE */}
//             {currentStep === 4 && (
//               <div className="space-y-6 animate-fadeIn">
//                 <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gradient-to-r from-orange-50 via-blue-50 to-purple-50 rounded-xl border border-gray-100">
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-orange-100 text-orange-800">
//                     Dataset: {getDatasetDisplay()}
//                   </Badge>
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-blue-100 text-blue-800">
//                     Workspace: {formData.workspace_name}
//                   </Badge>
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-indigo-100 text-indigo-800">
//                     Lakehouse: {formData.lakehouse_name}
//                   </Badge>
//                 </div>
//                 <div className="space-y-4">
//                   <Label className="text-lg font-semibold text-gray-800 flex items-center gap-2">
//                     <Table2 className="w-5 h-5 text-purple-600" />
//                     Select Table <span className="text-red-500">*</span>
//                   </Label>
//                   {loadingTables ? (
//                     <Skeleton className="h-14 w-full rounded-xl" />
//                   ) : !selectedLakehouseId ? (
//                     <Alert className="border-yellow-200/50 bg-yellow-50/50">
//                       <AlertCircle className="w-5 h-5 text-yellow-600" />
//                       <AlertDescription className="text-sm text-yellow-800">
//                         Please select a lakehouse first.
//                       </AlertDescription>
//                     </Alert>
//                   ) : tablesError ? (
//                     <Alert className="border-red-200/50 bg-red-50/50">
//                       <AlertCircle className="w-5 h-5 text-red-600" />
//                       <AlertDescription className="text-sm text-red-800">
//                         Unable to load tables.
//                       </AlertDescription>
//                     </Alert>
//                   ) : (
//                     <Select
//                       value={formData.table_name}
//                       onValueChange={handleTableSelect}
//                     >
//                       <SelectTrigger className="h-14 text-base border-2 border-purple-200/50 rounded-xl shadow-sm hover:border-purple-300 transition-all">
//                         <SelectValue placeholder="Choose a table..." />
//                       </SelectTrigger>
//                       <SelectContent className="border-purple-200/50 max-h-60">
//                         {tables?.map((t) => (
//                           <SelectItem key={t} value={t} className="text-base py-3 hover:bg-purple-50">
//                             <Table2 className="w-4 h-4 mr-2 inline text-purple-600" />
//                             {t}
//                           </SelectItem>
//                         )) || <SelectItem disabled>No tables available</SelectItem>}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 </div>
//               </div>
//             )}

//             {/* STEP 5 — PARAMETERS */}
//             {currentStep === 5 && (
//               <div className="space-y-6 animate-fadeIn">
//                 <div className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-gradient-to-r from-orange-50 via-blue-50 to-purple-50 rounded-xl border border-gray-100">
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-orange-100 text-orange-800">
//                     {getDatasetDisplay()}
//                   </Badge>
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-blue-100 text-blue-800">
//                     {formData.workspace_name}
//                   </Badge>
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-indigo-100 text-indigo-800">
//                     {formData.lakehouse_name}
//                   </Badge>
//                   <Badge variant="secondary" className="px-3 py-1.5 bg-purple-100 text-purple-800">
//                     {formData.table_name}
//                   </Badge>
//                 </div>
//                 <div className="grid md:grid-cols-3 gap-6">
//                   <div className="space-y-3">
//                     <Label className="text-base font-semibold text-gray-800 flex items-center gap-2">
//                       <Calendar className="w-4 h-4 text-green-600" />
//                       Start Date <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       type="date"
//                       value={formData.start_date}
//                       onChange={(e) => handleChange("start_date", e.target.value)}
//                       className="h-12 text-base border-2 border-green-200/50 rounded-xl shadow-sm focus:border-green-400 transition-all"
//                     />
//                   </div>
//                   <div className="space-y-3">
//                     <Label className="text-base font-semibold text-gray-800 flex items-center gap-2">
//                       <Calendar className="w-4 h-4 text-red-600" />
//                       End Date <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       type="date"
//                       value={formData.end_date}
//                       onChange={(e) => handleChange("end_date", e.target.value)}
//                       className="h-12 text-base border-2 border-red-200/50 rounded-xl shadow-sm focus:border-red-400 transition-all"
//                     />
//                   </div>
//                   <div className="space-y-3">
//                     <Label className="text-base font-semibold text-gray-800 flex items-center gap-2">
//                       <ArrowRight className="w-4 h-4 text-purple-600" />
//                       Forecast Horizon (Days) <span className="text-red-500">*</span>
//                     </Label>
//                     <Input
//                       type="number"
//                       min="1"
//                       value={formData.forecast_horizon}
//                       onChange={(e) =>
//                         handleChange("forecast_horizon", Number(e.target.value))
//                       }
//                       className="h-12 text-base border-2 border-purple-200/50 rounded-xl shadow-sm focus:border-purple-400 transition-all"
//                     />
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* STEP 6 — REVIEW */}
//             {currentStep === 6 && (
//               <div className="space-y-6 animate-fadeIn">
//                 <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
//                   <CheckCircle2 className="w-6 h-6 text-green-600" />
//                   Review & Confirm Your Prediction Job
//                 </h3>
//                 <Card className="border-2 border-gray-100/50 p-6 space-y-4">
//                   <div className="grid md:grid-cols-2 gap-4 text-sm">
//                     <div className="space-y-2">
//                       <p className="font-semibold text-gray-700">Dataset</p>
//                       <p className="text-gray-600">{getDatasetDisplay()}</p>
//                     </div>
//                     <div className="space-y-2">
//                       <p className="font-semibold text-gray-700">Workspace</p>
//                       <p className="text-gray-600">{formData.workspace_name}</p>
//                     </div>
//                     <div className="space-y-2">
//                       <p className="font-semibold text-gray-700">Lakehouse</p>
//                       <p className="text-gray-600">{formData.lakehouse_name}</p>
//                     </div>
//                     <div className="space-y-2">
//                       <p className="font-semibold text-gray-700">Table</p>
//                       <p className="text-gray-600">{formData.table_name}</p>
//                     </div>
//                     <div className="space-y-2 md:col-span-2">
//                       <p className="font-semibold text-gray-700">Date Range</p>
//                       <p className="text-gray-600">{formData.start_date} to {formData.end_date}</p>
//                     </div>
//                     <div className="space-y-2">
//                       <p className="font-semibold text-gray-700">Forecast Horizon</p>
//                       <p className="text-gray-600">{formData.forecast_horizon} days</p>
//                     </div>
//                   </div>
//                 </Card>
//                 <p className="text-sm text-gray-500 italic">
//                   Everything looks good? Press "Run Prediction" to launch your forecasting job.
//                 </p>
//               </div>
//             )}
//           </CardContent>

//           {/* Navigation Buttons - Inside Card Footer for consistency */}
//           <div className="border-t border-gray-100/50 bg-gray-50/50 p-6">
//             <div className="flex justify-between items-center">
//               <Button
//                 variant="outline"
//                 onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
//                 disabled={currentStep === 1}
//                 className="px-6 h-12 border-2 border-gray-300 rounded-xl shadow-sm hover:bg-gray-50 transition-all"
//               >
//                 <ArrowLeft className="w-5 h-5 mr-2" /> Back
//               </Button>
//               {currentStep < 6 ? (
//                 <Button
//                   onClick={() => setCurrentStep((s) => Math.min(6, s + 1))}
//                   disabled={!isStepComplete() || importLoading}
//                   className={`px-6 h-12 rounded-xl shadow-lg transition-all ${
//                     isStepComplete() && !importLoading
//                       ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:shadow-xl"
//                       : "bg-gray-300 text-gray-500 cursor-not-allowed"
//                   }`}
//                 >
//                   {importLoading ? (
//                     <>
//                       <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
//                       Importing...
//                     </>
//                   ) : (
//                     <>
//                       Next <ArrowRight className="w-5 h-5 ml-2" />
//                     </>
//                   )}
//                 </Button>
//               ) : (
//                 <Button
//                   onClick={() => alert("Job submitted successfully! (Connect to backend)")}
//                   className="px-6 h-12 rounded-xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-xl transition-all"
//                 >
//                   <PlayCircle className="w-5 h-5 mr-2" /> Run Prediction
//                 </Button>
//               )}
//             </div>
//           </div>
//         </Card>

//       </div>

//       {/* Enhanced Styles */}
//       <style jsx>{`
//         @keyframes fadeIn {
//           from { opacity: 0; transform: translateY(20px); }
//           to { opacity: 1; transform: translateY(0); }
//         }
//         .animate-fadeIn { animation: fadeIn 0.5s ease-out; }
//         @keyframes shake {
//           0%, 100% { transform: translateX(0); }
//           25% { transform: translateX(-4px); }
//           75% { transform: translateX(4px); }
//         }
//         .animate-shake { animation: shake 0.5s ease-in-out; }
//         .no-scrollbar::-webkit-scrollbar { display: none; }
//         .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
//       `}</style>
//     </div>
//   );
// }





// README
// Folder structure (place files accordingly):
// src/pages/NewPrediction.jsx
// src/components/prediction/Step1DataSource.jsx
// src/components/prediction/Step2Workspace.jsx
// src/components/prediction/Step3Lakehouse.jsx
// src/components/prediction/Step4Table.jsx
// src/components/prediction/Step5Parameters.jsx
// src/components/prediction/Step6Review.jsx
// Note: All API calls remain in parent (NewPrediction.jsx). This update adds animations (framer-motion), improved UI feedback, working buttons, better design, and multi-select Kaggle import support.
// Reference screenshot (local): /mnt/data/56a55b02-c10e-437d-b12e-764f9ffb6704.png

// // -----------------------
// // File: src/pages/NewPrediction.jsx
// // -----------------------
// import React, { useState, useEffect, useMemo } from "react";
// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { useNavigate } from "react-router-dom";
// import { motion, AnimatePresence } from "framer-motion";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Button } from "@/components/ui/button";
// import { Alert, AlertDescription } from "@/components/ui/alert";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Badge } from "@/components/ui/badge";
// import { AlertCircle, Check, RefreshCw, Package, Database, Table2, Calendar, CheckCircle2, Sparkles, Search, ArrowLeft, ArrowRight, PlayCircle } from "lucide-react";

// // Import step components
// import Step1DataSource from "@/components/prediction/Datasource";
// import Step2Workspace from "@/components/prediction/SelectPipelineAndTables.jsx";
// import Step3Lakehouse from "@/components/prediction/Tables";
// import Step4Table from "@/components/prediction/Step4Table";
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

//   const [formData, setFormData] = useState({
//     data_source_type: "",
//     kaggle_datasets: [], // array of slugs
//     kaggle_dataset_names: [],
//     job_name: "",
//     workspace_name: "",
//     workspace_id: "",
//     lakehouse_name: "",
//     lakehouse_id: "",
//     table_name: "",
//     prediction_columns: [],
//     pipeline_name: "",
//     start_date: "",
//     end_date: "",
//     products: "",
//     forecast_horizon: 30,
//     results_table_name: "",
//   });

//   /* ------------------------------
//      KAGGLE SEARCH API (REAL TIME)
//   -------------------------------*/
//   const {
//     data: datasets,
//     isLoading: loadingDatasets,
//     error: datasetsError
//   } = useQuery({
//     queryKey: ["kaggle-datasets", searchValue],
//     queryFn: async () => {
//       if (!searchValue || searchValue.length < 2) return { datasets: [] };
//       const response = await fetch(
//         `http://127.0.0.1:5000/search?keyword=${encodeURIComponent(searchValue)}`
//       );
//       if (!response.ok) throw new Error("Failed to search datasets");
//       return response.json();
//     },
//     enabled: searchValue.length >= 2,
//   });

//   /* ------------------------------
//      IMPORT DATASET MUTATION (multi-slug)
//   -------------------------------*/
//   const importMutation = useMutation({
//     mutationFn: async (payload) => {
//       const response = await fetch("http://127.0.0.1:5000/import", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
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
//         queryClient.invalidateQueries({ queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId] });
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
//     refetch: refetchWorkspaces
//   } = useQuery({
//     queryKey: ["workspaces"],
//     queryFn: async () => {
//       const response = await fetch("http://127.0.0.1:5000/workspaces");
//       if (!response.ok) throw new Error("Failed to fetch workspaces");
//       return response.json().then(data => data.value || []);
//     },
//   });

//   /* ------------------------------
//        FABRIC LAKEHOUSES
//   -------------------------------*/
//   const {
//     data: lakehouses,
//     isLoading: loadingLakehouses,
//     error: lakehousesError
//   } = useQuery({
//     queryKey: ["lakehouses", selectedWorkspaceId],
//     queryFn: async () => {
//       if (!selectedWorkspaceId) return null;
//       const response = await fetch(
//         `http://127.0.0.1:5000/lakehouses?workspace_id=${selectedWorkspaceId}`
//       );
//       if (!response.ok) throw new Error("Failed to fetch lakehouses");
//       return response.json().then(data => data.value || []);
//     },
//     enabled: !!selectedWorkspaceId,
//   });

//   /* ------------------------------
//        FABRIC TABLES
//   -------------------------------*/
//   const {
//     data: tables,
//     isLoading: loadingTables,
//     error: tablesError
//   } = useQuery({
//     queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
//     queryFn: async () => {
//       if (!selectedWorkspaceId || !selectedLakehouseId) return null;
//       const response = await fetch(
//         `http://127.0.0.1:8000/workspaces/${selectedWorkspaceId}/lakehouses/${selectedLakehouseId}/tables`
//       );
//       if (!response.ok) throw new Error("Failed to fetch tables");
//       return response.json();
//     },
//     enabled: !!selectedWorkspaceId && !!selectedLakehouseId,
//   });

//   /* ------------------------------
//        FABRIC COLUMNS
//   -------------------------------*/
//   const {
//     data: columns,
//     isLoading: loadingColumns,
//     error: columnsError
//   } = useQuery({
//     queryKey: ["columns", selectedWorkspaceId, selectedLakehouseId, formData.table_name],
//     queryFn: async () => {
//       if (!selectedWorkspaceId || !selectedLakehouseId || !formData.table_name)
//         return null;
//       const response = await fetch(
//         `http://127.0.0.1:8000/workspaces/${selectedWorkspaceId}/lakehouses/${selectedLakehouseId}/tables/${formData.table_name}/columns`
//       );
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
//     // prevent duplicates
//     setFormData((prev) => {
//       const slugs = Array.from(new Set([...(prev.kaggle_datasets || []), ds.slug]));
//       const names = slugs.map((s) => (s === ds.slug ? ds.name : prev.kaggle_dataset_names[prev.kaggle_datasets.indexOf(s)] || ds.name));

//       return {
//         ...prev,
//         kaggle_datasets: slugs,
//         kaggle_dataset_names: Array.from(new Set([...(prev.kaggle_dataset_names || []), ds.name])),
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
//       return { ...prev, kaggle_datasets: newSlugs, kaggle_dataset_names: newNames };
//     });
//   };

//   // trigger import for selected slugs
//   const importSelectedDatasets = () => {
//     const workspaceId = formData.workspace_id || selectedWorkspaceId;
//     const lakehouseId = formData.lakehouse_id || selectedLakehouseId;

//     if (!workspaceId || !lakehouseId) {
//       setImportResult({ type: "error", message: "Please select both Workspace and Lakehouse before importing the dataset(s)." });
//       setError("Select workspace & lakehouse before importing.");
//       return;
//     }

//     if (!formData.kaggle_datasets || formData.kaggle_datasets.length === 0) {
//       setImportResult({ type: "error", message: "No datasets selected to import" });
//       return;
//     }

//     importMutation.mutate({
//       slugs: formData.kaggle_datasets,
//       workspace_id: workspaceId,
//       lakehouse_id: lakehouseId,
//     });
//   };

//   // NEW: Check if step is complete for Next button
//   const isStepComplete = () => {
//     switch (currentStep) {
//       case 1:
//         // require the data source be selected and at least one dataset chosen
//         return formData.data_source_type === "kaggle" && (formData.kaggle_datasets || []).length > 0;
//       case 2:
//         return selectedWorkspaceId;
//       case 3:
//         return selectedLakehouseId;
//       case 4:
//         return formData.table_name;
//       case 5:
//         return formData.start_date && formData.end_date && formData.forecast_horizon > 0;
//       default:
//         return true;
//     }
//   };

// const steps = [
//   { number: 1, title: "Data Source", icon: Package, completed: currentStep > 1 },

//   // NEW NAME FOR YOUR CUSTOM STEP
//   { number: 2, title: "Pipeline & Tables", icon: Database, completed: currentStep > 2 },

//   { number: 3, title: "Table", icon: Table2, completed: currentStep > 3 },
//   { number: 4, title: "Parameters", icon: Calendar, completed: currentStep > 4 },
//   { number: 5, title: "Review", icon: CheckCircle2, completed: false }
// ];


//   const getDatasetDisplay = () =>
//     (formData.kaggle_dataset_names && formData.kaggle_dataset_names.join(", ")) || "Dataset";

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

//   // NEW: Retry function for errors
//   const handleRetry = () => {
//     setError(null);
//     refetchWorkspaces();
//     queryClient.refetchQueries({ queryKey: ["lakehouses"] });
//     queryClient.refetchQueries({ queryKey: ["tables"] });
//   };

//   // pretty animations
//   const cardMotion = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6">
//       <div className="max-w-6xl mx-auto">
//         {/* Header */}
//         <motion.div className="mb-6" layout>
//           <Card className="relative overflow-hidden border-2 border-transparent shadow-2xl bg-white/90">
//             <CardContent className="p-6 md:p-8">
//               <div className="flex items-center gap-4">
//                 <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}
//                   className="h-12 w-12 rounded-full border border-indigo-100 hover:bg-indigo-50">
//                   <ArrowLeft className="w-5 h-5 text-indigo-600" />
//                 </Button>
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3">
//                     <div className="p-2 bg-indigo-100 rounded-full"><Sparkles className="w-6 h-6 text-indigo-600" /></div>
//                     <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600">New Prediction Job</h1>
//                   </div>
//                   <p className="mt-2 text-gray-600">Configure forecasts in 5 animated steps — fast and visual.</p>
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
//                         animate={{ scale: currentStep === step.number ? 1.05 : 1 }}
//                         transition={{ type: 'spring', stiffness: 300, damping: 20 }}
//                         className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${step.completed ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg' : currentStep === step.number ? 'bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-xl' : 'bg-gray-100 text-gray-400 border'}`}>
//                         {step.completed ? <Check className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
//                       </motion.div>
//                       <p className={`text-xs md:text-sm font-semibold text-center ${currentStep === step.number ? 'text-indigo-600' : step.completed ? 'text-green-600' : 'text-gray-500'}`}>{step.title}</p>
//                     </div>
//                     {i < steps.length - 1 && (
//                       <div className={`h-1 flex-1 mx-2 rounded-full ${currentStep > step.number ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gray-200'}`} />
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
//             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-6">
//               <Alert className="border-2 border-red-200/50 bg-red-50/90 shadow">
//                 <AlertCircle className="w-5 h-5 text-red-600" />
//                 <AlertDescription className="flex items-center justify-between text-sm font-medium text-red-800">
//                   <span>{error}</span>
//                   <div className="flex items-center gap-2">
//                     <Button variant="ghost" size="sm" onClick={handleRetry}><RefreshCw className="w-4 h-4" /> Retry</Button>
//                   </div>
//                 </AlertDescription>
//               </Alert>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Import Result */}
//         <AnimatePresence>
//           {importResult && (
//             <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
//               <Alert className={`border-2 shadow ${importResult.type === 'success' ? 'border-green-200/50 bg-green-50/90' : 'border-red-200/50 bg-red-50/90'}`}>
//                 {importResult.type === 'success' ? <Check className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
//                 <AlertDescription className="text-sm font-medium">
//                   {importResult.type === 'success' ? (
//                     <div>
//                       <p className="font-semibold text-green-800">Import finished</p>
//                       <div className="mt-2 text-xs text-gray-700">
//                         {Object.entries(importResult.results || {}).map(([slug, res]) => (
//                           <div key={slug} className="mb-1">
//                             <strong>{slug}:</strong> {res.status} {res.error ? `- ${res.error}` : ''}
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   ) : (
//                     <p className="font-semibold text-red-800">{importResult.message}</p>
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
//               <div className={`p-2 rounded-full ${currentStep === 6 ? 'bg-green-100' : 'bg-indigo-50'}`}>
//                 {currentStep === 1 && <Package className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 2 && <Database className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 3 && <Database className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 4 && <Table2 className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 5 && <Calendar className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 6 && <CheckCircle2 className="w-6 h-6 text-green-600" />}
//               </div>
//               <CardTitle className="text-xl md:text-2xl font-bold text-gray-800">Step {currentStep}: {steps[currentStep - 1].title}</CardTitle>
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

//                     // NEW CALLBACK: receives result from Step2
//                     onPipelineRun={(pipelineResult) => {
//                       console.log("Pipeline Started → Result: ", pipelineResult);

//                       // OPTIONAL: Save inside global formData
//                       setFormData((prev) => ({
//                         ...prev,
//                         pipeline_run_info: pipelineResult,     // store backend result
//                       }));

//                       // OPTIONAL: Automatically go to next step
//                       setCurrentStep(3);
//                     }}
//                   />
//                 </motion.div>
//               )}



//               {currentStep === 3 && (
//                 <motion.div key="s3" {...cardMotion}>
//                   <Step3Lakehouse
//                     getDatasetDisplay={getDatasetDisplay}
//                     loadingLakehouses={loadingLakehouses}
//                     lakehouses={lakehouses}
//                     lakehousesError={lakehousesError}
//                     selectedWorkspaceId={selectedWorkspaceId}
//                     selectedLakehouseId={selectedLakehouseId}
//                     handleLakehouseSelect={handleLakehouseSelect}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 4 && (
//                 <motion.div key="s4" {...cardMotion}>
//                   <Step4Table
//                     getDatasetDisplay={getDatasetDisplay}
//                     loadingTables={loadingTables}
//                     tables={tables}
//                     tablesError={tablesError}
//                     selectedLakehouseId={selectedLakehouseId}
//                     formData={formData}
//                     handleTableSelect={handleTableSelect}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 5 && (
//                 <motion.div key="s5" {...cardMotion}>
//                   <Step5Parameters
//                     formData={formData}
//                     handleChange={handleChange}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 6 && (
//                 <motion.div key="s6" {...cardMotion}>
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
//                 <Button onClick={importSelectedDatasets} disabled={importLoading || !(formData.kaggle_datasets && formData.kaggle_datasets.length)} className="px-6 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
//                   {importLoading ? 'Importing...' : 'Import Selected'}
//                 </Button>
//               )}
//             </div>

//             <div className="flex items-center gap-3">
//               {currentStep < 6 ? (
//                 <Button
//                   onClick={() => setCurrentStep((s) => Math.min(6, s + 1))}
//                   disabled={!isStepComplete() || importLoading}
//                   className={`px-6 h-12 rounded-xl shadow-lg transition-all ${isStepComplete() && !importLoading ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white' : 'bg-gray-300 text-gray-500'}`}
//                 >
//                   Next <ArrowRight className="w-5 h-5 ml-2" />
//                 </Button>
//               ) : (
//                 <Button onClick={() => alert('Job submitted successfully!')} className="px-6 h-12 rounded-xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white">
//                   <PlayCircle className="w-5 h-5 mr-2" /> Run Prediction
//                 </Button>
//               )}
//             </div>
//           </div>
//         </Card>
//       </div>

//       <style jsx>{`
//         @keyframes float { 0% { transform: translateY(0) } 50% { transform: translateY(-6px) } 100% { transform: translateY(0) } }
//         .float { animation: float 3s ease-in-out infinite; }
//       `}</style>
//     </div>
//   );
// }














































// // -----------------------
// // File: src/pages/NewPrediction.jsx
// // -----------------------
// import React, { useState, useEffect, useMemo } from "react";
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
//   Search,
//   ArrowLeft,
//   ArrowRight,
//   PlayCircle,
// } from "lucide-react";

// // Import step components
// import Step1DataSource from "@/components/prediction/Datasource";
// import Step2Workspace from "@/components/prediction/SelectPipelineAndTables.jsx";
// // NOTE: your updated Step3 UI is in Tables.jsx — import it with a clear name
// import Step3AnalyticsSetup from "@/components/prediction/Tables";
// import Step4Table from "@/components/prediction/Step4Table";
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

//   // New states for Step 3
//   const [pipelines, setPipelines] = useState([]);
//   const [loadingPipelines, setLoadingPipelines] = useState(false);
//   const [selectedPipeline, setSelectedPipeline] = useState("");
//   const [selectedAnalyticsType, setSelectedAnalyticsType] = useState("");

//   const [formData, setFormData] = useState({
//     data_source_type: "",
//     kaggle_datasets: [], // array of slugs
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
//         headers: {
//           "Content-Type": "application/json",
//         },
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
//     isLoading: loadingTables,
//     error: tablesError,
//   } = useQuery({
//     queryKey: ["tables", selectedWorkspaceId, selectedLakehouseId],
//     queryFn: async () => {
//       if (!selectedWorkspaceId || !selectedLakehouseId) return null;
//       const response = await fetch(
//         `http://127.0.0.1:8000/workspaces/${selectedWorkspaceId}/lakehouses/${selectedLakehouseId}/tables`
//       );
//       if (!response.ok) throw new Error("Failed to fetch tables");
//       return response.json();
//     },
//     enabled: !!selectedWorkspaceId && !!selectedLakehouseId,
//   });

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
//         `http://127.0.0.1:8000/workspaces/${selectedWorkspaceId}/lakehouses/${selectedLakehouseId}/tables/${formData.table_name}/columns`
//       );
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
//     // prevent duplicates
//     setFormData((prev) => {
//       const slugs = Array.from(
//         new Set([...(prev.kaggle_datasets || []), ds.slug])
//       );
//       const names = slugs.map((s) =>
//         s === ds.slug
//           ? ds.name
//           : prev.kaggle_dataset_names[prev.kaggle_datasets.indexOf(s)] ||
//             ds.name
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
//       return { ...prev, kaggle_datasets: newSlugs, kaggle_dataset_names: newNames };
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
//       setImportResult({ type: "error", message: "No datasets selected to import" });
//       return;
//     }

//     importMutation.mutate({
//       slugs: formData.kaggle_datasets,
//       workspace_id: workspaceId,
//       lakehouse_id: lakehouseId,
//     });
//   };

//   // NEW: Check if step is complete for Next button
//   const isStepComplete = () => {
//     switch (currentStep) {
//       case 1:
//         // require the data source be selected and at least one dataset chosen
//         return (
//           formData.data_source_type === "kaggle" &&
//           (formData.kaggle_datasets || []).length > 0
//         );
//       case 2:
//         return selectedWorkspaceId;
//       case 3:
//         // Step 3 requires pipeline, table and analytics type
//         return selectedPipeline && formData.table_name && selectedAnalyticsType;
//       case 4:
//         return formData.table_name;
//       case 5:
//         return formData.start_date && formData.end_date && formData.forecast_horizon > 0;
//       default:
//         return true;
//     }
//   };

//   const steps = [
//     { number: 1, title: "Data Source", icon: Package, completed: currentStep > 1 },

//     // NEW NAME FOR YOUR CUSTOM STEP
//     { number: 2, title: "Pipeline & Tables", icon: Database, completed: currentStep > 2 },

//     { number: 3, title: "Analytics Setup", icon: Table2, completed: currentStep > 3 },
//     { number: 4, title: "Parameters", icon: Calendar, completed: currentStep > 4 },
//     { number: 5, title: "Review", icon: CheckCircle2, completed: false },
//   ];

//   const getDatasetDisplay = () =>
//     (formData.kaggle_dataset_names && formData.kaggle_dataset_names.join(", ")) ||
//     "Dataset";

//   useEffect(() => {
//     const apiError =
//       workspacesError ||
//       lakehousesError ||
//       tablesError ||
//       columnsError ||
//       datasetsError;

//     if (apiError) setError(`API Error: ${apiError.message}`);
//   }, [workspacesError, lakehousesError, tablesError, columnsError, datasetsError]);

//   useEffect(() => {
//     if (currentStep !== 1) {
//       setImportResult(null);
//     }
//   }, [currentStep]);

//   // NEW: Retry function for errors
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

//   // pretty animations
//   const cardMotion = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6">
//       <div className="max-w-6xl mx-auto">
//         {/* Header */}
//         <motion.div className="mb-6" layout>
//           <Card className="relative overflow-hidden border-2 border-transparent shadow-2xl bg-white/90">
//             <CardContent className="p-6 md:p-8">
//               <div className="flex items-center gap-4">
//                 <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}
//                   className="h-12 w-12 rounded-full border border-indigo-100 hover:bg-indigo-50">
//                   <ArrowLeft className="w-5 h-5 text-indigo-600" />
//                 </Button>
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3">
//                     <div className="p-2 bg-indigo-100 rounded-full"><Sparkles className="w-6 h-6 text-indigo-600" /></div>
//                     <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600">New Prediction Job</h1>
//                   </div>
//                   <p className="mt-2 text-gray-600">Configure forecasts in 5 animated steps — fast and visual.</p>
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
//                         animate={{ scale: currentStep === step.number ? 1.05 : 1 }}
//                         transition={{ type: 'spring', stiffness: 300, damping: 20 }}
//                         className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${step.completed ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg' : currentStep === step.number ? 'bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-xl' : 'bg-gray-100 text-gray-400 border'}`}>
//                         {step.completed ? <Check className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
//                       </motion.div>
//                       <p className={`text-xs md:text-sm font-semibold text-center ${currentStep === step.number ? 'text-indigo-600' : step.completed ? 'text-green-600' : 'text-gray-500'}`}>{step.title}</p>
//                     </div>
//                     {i < steps.length - 1 && (
//                       <div className={`h-1 flex-1 mx-2 rounded-full ${currentStep > step.number ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gray-200'}`} />
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
//             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-6">
//               <Alert className="border-2 border-red-200/50 bg-red-50/90 shadow">
//                 <AlertCircle className="w-5 h-5 text-red-600" />
//                 <AlertDescription className="flex items-center justify-between text-sm font-medium text-red-800">
//                   <span>{error}</span>
//                   <div className="flex items-center gap-2">
//                     <Button variant="ghost" size="sm" onClick={handleRetry}><RefreshCw className="w-4 h-4" /> Retry</Button>
//                   </div>
//                 </AlertDescription>
//               </Alert>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Import Result */}
//         <AnimatePresence>
//           {importResult && (
//             <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
//               <Alert className={`border-2 shadow ${importResult.type === 'success' ? 'border-green-200/50 bg-green-50/90' : 'border-red-200/50 bg-red-50/90'}`}>
//                 {importResult.type === 'success' ? <Check className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
//                 <AlertDescription className="text-sm font-medium">
//                   {importResult.type === 'success' ? (
//                     <div>
//                       <p className="font-semibold text-green-800">Import finished</p>
//                       <div className="mt-2 text-xs text-gray-700">
//                         {Object.entries(importResult.results || {}).map(([slug, res]) => (
//                           <div key={slug} className="mb-1">
//                             <strong>{slug}:</strong> {res.status} {res.error ? `- ${res.error}` : ''}
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   ) : (
//                     <p className="font-semibold text-red-800">{importResult.message}</p>
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
//               <div className={`p-2 rounded-full ${currentStep === 6 ? 'bg-green-100' : 'bg-indigo-50'}`}>
//                 {currentStep === 1 && <Package className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 2 && <Database className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 3 && <Database className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 4 && <Table2 className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 5 && <Calendar className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 6 && <CheckCircle2 className="w-6 h-6 text-green-600" />}
//               </div>
//               <CardTitle className="text-xl md:text-2xl font-bold text-gray-800">Step {currentStep}: {steps[currentStep - 1].title}</CardTitle>
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

//                     // NEW CALLBACK: receives result from Step2
//                     onPipelineRun={(pipelineResult) => {
//                       console.log("Pipeline Started → Result: ", pipelineResult);

//                       // OPTIONAL: Save inside global formData
//                       setFormData((prev) => ({
//                         ...prev,
//                         pipeline_run_info: pipelineResult,     // store backend result
//                       }));

//                       // OPTIONAL: Automatically go to next step
//                       setCurrentStep(3);
//                     }}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 3 && (
//                 <motion.div key="s3" {...cardMotion}>
//                   <Step3AnalyticsSetup
//                     datasetName={getDatasetDisplay()}

//                     // Pipeline props
//                     loadingPipelines={loadingPipelines}
//                     pipelines={pipelines}
//                     selectedPipelineId={selectedPipeline}
//                     handlePipelineSelect={(val) => {
//                       setSelectedPipeline(val);
//                       handleChange("pipeline_name", val);
//                     }}

//                     // Tables
//                     loadingTables={loadingTables}
//                     // be defensive: tables might be { value: [...] } or array
//                     tables={(tables && (tables.value || tables)) || []}
//                     selectedTable={formData.table_name}
//                     handleTableSelect={(val) => {
//                       handleTableSelect(val);
//                     }}

//                     // Analytics Type
//                     selectedAnalyticsType={selectedAnalyticsType}
//                     handleAnalyticsTypeSelect={(val) => {
//                       setSelectedAnalyticsType(val);
//                       handleChange("analytics_type", val);
//                     }}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 4 && (
//                 <motion.div key="s4" {...cardMotion}>
//                   <Step4Table
//                     getDatasetDisplay={getDatasetDisplay}
//                     loadingTables={loadingTables}
//                     tables={tables}
//                     tablesError={tablesError}
//                     selectedLakehouseId={selectedLakehouseId}
//                     formData={formData}
//                     handleTableSelect={handleTableSelect}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 5 && (
//                 <motion.div key="s5" {...cardMotion}>
//                   <Step5Parameters
//                     formData={formData}
//                     handleChange={handleChange}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 6 && (
//                 <motion.div key="s6" {...cardMotion}>
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
//                 <Button onClick={importSelectedDatasets} disabled={importLoading || !(formData.kaggle_datasets && formData.kaggle_datasets.length)} className="px-6 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
//                   {importLoading ? 'Importing...' : 'Import Selected'}
//                 </Button>
//               )}
//             </div>

//             <div className="flex items-center gap-3">
//               {currentStep < 6 ? (
//                 <Button
//                   onClick={() => setCurrentStep((s) => Math.min(6, s + 1))}
//                   disabled={!isStepComplete() || importLoading}
//                   className={`px-6 h-12 rounded-xl shadow-lg transition-all ${isStepComplete() && !importLoading ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white' : 'bg-gray-300 text-gray-500'}`}
//                 >
//                   Next <ArrowRight className="w-5 h-5 ml-2" />
//                 </Button>
//               ) : (
//                 <Button onClick={() => alert('Job submitted successfully!')} className="px-6 h-12 rounded-xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white">
//                   <PlayCircle className="w-5 h-5 mr-2" /> Run Prediction
//                 </Button>
//               )}
//             </div>
//           </div>
//         </Card>
//       </div>

//       <style jsx>{`
//         @keyframes float { 0% { transform: translateY(0) } 50% { transform: translateY(-6px) } 100% { transform: translateY(0) } }
//         .float { animation: float 3s ease-in-out infinite; }
//       `}</style>
//     </div>
//   );
// }
























































































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
// import Step4Table from "@/components/prediction/Step4Table";
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
//       return { ...prev, kaggle_datasets: newSlugs, kaggle_dataset_names: newNames };
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
//       setImportResult({ type: "error", message: "No datasets selected to import" });
//       return;
//     }

//     importMutation.mutate({
//       slugs: formData.kaggle_datasets,
//       workspace_id: workspaceId,
//       lakehouse_id: lakehouseId,
//     });
//   };

//   // NEW: Check if step is complete for Next button
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
//         return selectedPipeline && formData.table_name && selectedAnalyticsType;
//       case 4:
//         return formData.table_name;
//       case 5:
//         return formData.start_date && formData.end_date && formData.forecast_horizon > 0;
//       default:
//         return true;
//     }
//   };

//   const steps = [
//     { number: 1, title: "Data Source", icon: Package, completed: currentStep > 1 },
//     { number: 2, title: "Pipeline & Tables", icon: Database, completed: currentStep > 2 },
//     { number: 3, title: "Analytics Setup", icon: Table2, completed: currentStep > 3 },
//     { number: 4, title: "Parameters", icon: Calendar, completed: currentStep > 4 },
//     { number: 5, title: "Review", icon: CheckCircle2, completed: false },
//   ];

//   const getDatasetDisplay = () =>
//     (formData.kaggle_dataset_names && formData.kaggle_dataset_names.join(", ")) ||
//     "Dataset";

//   useEffect(() => {
//     const apiError =
//       workspacesError ||
//       lakehousesError ||
//       tablesError ||
//       columnsError ||
//       datasetsError;

//     if (apiError) setError(`API Error: ${apiError.message}`);
//   }, [workspacesError, lakehousesError, tablesError, columnsError, datasetsError]);

//   useEffect(() => {
//     if (currentStep !== 1) {
//       setImportResult(null);
//     }
//   }, [currentStep]);

//   // NEW: Retry function for errors
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
//   const cardMotion = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50 p-6">
//       <div className="max-w-6xl mx-auto">
//         {/* Header */}
//         <motion.div className="mb-6" layout>
//           <Card className="relative overflow-hidden border-2 border-transparent shadow-2xl bg-white/90">
//             <CardContent className="p-6 md:p-8">
//               <div className="flex items-center gap-4">
//                 <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}
//                   className="h-12 w-12 rounded-full border border-indigo-100 hover:bg-indigo-50">
//                   <ArrowLeft className="w-5 h-5 text-indigo-600" />
//                 </Button>
//                 <div className="flex-1">
//                   <div className="flex items-center gap-3">
//                     <div className="p-2 bg-indigo-100 rounded-full"><Sparkles className="w-6 h-6 text-indigo-600" /></div>
//                     <h1 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-pink-600">New Prediction Job</h1>
//                   </div>
//                   <p className="mt-2 text-gray-600">Configure forecasts in 5 animated steps — fast and visual.</p>
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
//                         animate={{ scale: currentStep === step.number ? 1.05 : 1 }}
//                         transition={{ type: 'spring', stiffness: 300, damping: 20 }}
//                         className={`relative w-14 h-14 rounded-2xl flex items-center justify-center mb-2 ${step.completed ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-lg' : currentStep === step.number ? 'bg-gradient-to-br from-indigo-500 to-pink-500 text-white shadow-xl' : 'bg-gray-100 text-gray-400 border'}`}>
//                         {step.completed ? <Check className="w-6 h-6" /> : <step.icon className="w-6 h-6" />}
//                       </motion.div>
//                       <p className={`text-xs md:text-sm font-semibold text-center ${currentStep === step.number ? 'text-indigo-600' : step.completed ? 'text-green-600' : 'text-gray-500'}`}>{step.title}</p>
//                     </div>
//                     {i < steps.length - 1 && (
//                       <div className={`h-1 flex-1 mx-2 rounded-full ${currentStep > step.number ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gray-200'}`} />
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
//             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-6">
//               <Alert className="border-2 border-red-200/50 bg-red-50/90 shadow">
//                 <AlertCircle className="w-5 h-5 text-red-600" />
//                 <AlertDescription className="flex items-center justify-between text-sm font-medium text-red-800">
//                   <span>{error}</span>
//                   <div className="flex items-center gap-2">
//                     <Button variant="ghost" size="sm" onClick={handleRetry}><RefreshCw className="w-4 h-4" /> Retry</Button>
//                   </div>
//                 </AlertDescription>
//               </Alert>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* Import Result */}
//         <AnimatePresence>
//           {importResult && (
//             <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
//               <Alert className={`border-2 shadow ${importResult.type === 'success' ? 'border-green-200/50 bg-green-50/90' : 'border-red-200/50 bg-red-50/90'}`}>
//                 {importResult.type === 'success' ? <Check className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
//                 <AlertDescription className="text-sm font-medium">
//                   {importResult.type === 'success' ? (
//                     <div>
//                       <p className="font-semibold text-green-800">Import finished</p>
//                       <div className="mt-2 text-xs text-gray-700">
//                         {Object.entries(importResult.results || {}).map(([slug, res]) => (
//                           <div key={slug} className="mb-1">
//                             <strong>{slug}:</strong> {res.status} {res.error ? `- ${res.error}` : ''}
//                           </div>
//                         ))}
//                       </div>
//                     </div>
//                   ) : (
//                     <p className="font-semibold text-red-800">{importResult.message}</p>
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
//               <div className={`p-2 rounded-full ${currentStep === 6 ? 'bg-green-100' : 'bg-indigo-50'}`}>
//                 {currentStep === 1 && <Package className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 2 && <Database className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 3 && <Database className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 4 && <Table2 className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 5 && <Calendar className="w-6 h-6 text-indigo-600" />}
//                 {currentStep === 6 && <CheckCircle2 className="w-6 h-6 text-green-600" />}
//               </div>
//               <CardTitle className="text-xl md:text-2xl font-bold text-gray-800">Step {currentStep}: {steps[currentStep - 1].title}</CardTitle>
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

//                     // Pipeline props
//                     loadingPipelines={loadingPipelines}
//                     pipelines={pipelines}
//                     selectedPipelineId={selectedPipeline}
//                     handlePipelineSelect={(val) => {
//                       setSelectedPipeline(val);
//                       handleChange("pipeline_name", val);
//                     }}

//                     // Tables (pass the query results; if the new destination hasn't shown in list yet, the earlier invalidation triggers a refetch)
//                     loadingTables={loadingTables}
//                     tables={tables || []}
//                     selectedTable={formData.table_name}
//                     handleTableSelect={(val) => {
//                       handleTableSelect(val);
//                     }}

//                     // Analytics Type
//                     selectedAnalyticsType={selectedAnalyticsType}
//                     handleAnalyticsTypeSelect={(val) => {
//                       setSelectedAnalyticsType(val);
//                       handleChange("analytics_type", val);
//                     }}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 4 && (
//                 <motion.div key="s4" {...cardMotion}>
//                   <Step4Table
//                     getDatasetDisplay={getDatasetDisplay}
//                     loadingTables={loadingTables}
//                     tables={tables}
//                     tablesError={tablesError}
//                     selectedLakehouseId={selectedLakehouseId}
//                     formData={formData}
//                     handleTableSelect={handleTableSelect}
//                   />
//                 </motion.div>
//               )}

//               {currentStep === 5 && (
//                 <motion.div key="s5" {...cardMotion}>
//                   <Step5Parameters formData={formData} handleChange={handleChange} />
//                 </motion.div>
//               )}

//               {currentStep === 6 && (
//                 <motion.div key="s6" {...cardMotion}>
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
//                 <Button onClick={importSelectedDatasets} disabled={importLoading || !(formData.kaggle_datasets && formData.kaggle_datasets.length)} className="px-6 h-12 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
//                   {importLoading ? 'Importing...' : 'Import Selected'}
//                 </Button>
//               )}
//             </div>

//             <div className="flex items-center gap-3">
//               {currentStep < 6 ? (
//                 <Button
//                   onClick={() => setCurrentStep((s) => Math.min(6, s + 1))}
//                   disabled={!isStepComplete() || importLoading}
//                   className={`px-6 h-12 rounded-xl shadow-lg transition-all ${isStepComplete() && !importLoading ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white' : 'bg-gray-300 text-gray-500'}`}
//                 >
//                   Next <ArrowRight className="w-5 h-5 ml-2" />
//                 </Button>
//               ) : (
//                 <Button onClick={() => alert('Job submitted successfully!')} className="px-6 h-12 rounded-xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white">
//                   <PlayCircle className="w-5 h-5 mr-2" /> Run Prediction
//                 </Button>
//               )}
//             </div>
//           </div>
//         </Card>
//       </div>

//       <style jsx>{`
//         @keyframes float { 0% { transform: translateY(0) } 50% { transform: translateY(-6px) } 100% { transform: translateY(0) } }
//         .float { animation: float 3s ease-in-out infinite; }
//       `}</style>
//     </div>
//   );
// }



// -----------------------
// File: src/pages/NewPrediction.jsx
// -----------------------
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
  const { data: datasets, isLoading: loadingDatasets, error: datasetsError } =
    useQuery({
      queryKey: ["kaggle-datasets", searchValue],
      queryFn: async () => {
        if (!searchValue || searchValue.length < 2) return { datasets: [] };
        const response = await fetch(
          `http://127.0.0.1:5000/search?keyword=${encodeURIComponent(
            searchValue
          )}`
        );
        if (!response.ok) throw new Error("Failed to search datasets");
        return response.json();
      },
      enabled: searchValue.length >= 2,
    });

  /* ------------------------------
     IMPORT DATASET MUTATION (multi-slug)
  -------------------------------*/
  const importMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await fetch("http://127.0.0.1:5000/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Import failed");
      }
      return response.json();
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
      setImportResult({ type: "error", message: err.message });
      setError(`Import Error: ${err.message}`);
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
      const response = await fetch("http://127.0.0.1:5000/workspaces");
      if (!response.ok) throw new Error("Failed to fetch workspaces");
      return response.json().then((data) => data.value || []);
    },
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
      const response = await fetch(
        `http://127.0.0.1:5000/lakehouses?workspace_id=${selectedWorkspaceId}`
      );
      if (!response.ok) throw new Error("Failed to fetch lakehouses");
      return response.json().then((data) => data.value || []);
    },
    enabled: !!selectedWorkspaceId,
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
      const response = await fetch(
        `http://127.0.0.1:5000/tables?workspace_id=${selectedWorkspaceId}&lakehouse_id=${selectedLakehouseId}`
      );
      if (!response.ok) throw new Error("Failed to fetch tables");
      return response.json().then((d) => d.value || d);
    },
    enabled: !!selectedWorkspaceId && !!selectedLakehouseId,
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
    ],
    queryFn: async () => {
      if (!selectedWorkspaceId || !selectedLakehouseId || !formData.table_name)
        return null;
      const response = await fetch(
        `http://127.0.0.1:5000/tables?workspace_id=${selectedWorkspaceId}&lakehouse_id=${selectedLakehouseId}`
      ); // Note: replace with actual columns endpoint if available
      if (!response.ok) throw new Error("Failed to fetch columns");
      return response.json();
    },
    enabled:
      !!selectedWorkspaceId && !!selectedLakehouseId && !!formData.table_name,
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
      workspace_name: workspace.displayName,
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
      lakehouse_name: lakehouse.displayName,
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
      const slugs = Array.from(
        new Set([...(prev.kaggle_datasets || []), ds.slug])
      );
      return {
        ...prev,
        kaggle_datasets: slugs,
        kaggle_dataset_names: Array.from(
          new Set([...(prev.kaggle_dataset_names || []), ds.name])
        ),
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
        return (
          formData.data_source_type === "kaggle" &&
          (formData.kaggle_datasets || []).length > 0
        );
      case 2:
        return selectedWorkspaceId;
      case 3:
        return (
          selectedPipeline &&
          formData.table_name &&
          selectedAnalyticsType
        );
      case 4:
        return (
          formData.start_date &&
          formData.end_date &&
          formData.forecast_horizon > 0
        );
      default:
        // For step 5 (Review) there is no "Next" button
        return true;
    }
  };

  const steps = [
    {
      number: 1,
      title: "Data Source",
      icon: Package,
      completed: currentStep > 1,
    },
    {
      number: 2,
      title: "Pipeline & Tables",
      icon: Database,
      completed: currentStep > 2,
    },
    {
      number: 3,
      title: "Analytics Setup",
      icon: Table2,
      completed: currentStep > 3,
    },
    {
      number: 4,
      title: "Parameters",
      icon: Calendar,
      completed: currentStep > 4,
    },
    {
      number: 5,
      title: "Review",
      icon: CheckCircle2,
      completed: false,
    },
  ];

  const getDatasetDisplay = () =>
    (formData.kaggle_dataset_names &&
      formData.kaggle_dataset_names.join(", ")) ||
    "Dataset";

  useEffect(() => {
    const apiError =
      workspacesError ||
      lakehousesError ||
      tablesError ||
      columnsError ||
      datasetsError;

    if (apiError) setError(`API Error: ${apiError.message}`);
  }, [
    workspacesError,
    lakehousesError,
    tablesError,
    columnsError,
    datasetsError,
  ]);

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
    fetch(`http://127.0.0.1:5000/pipelines?workspace_id=${selectedWorkspaceId}`)
      .then((res) => res.json())
      .then((data) => setPipelines(data.value || []))
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
      // analytics type left empty for user to choose
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
      // failed -> show error toast
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
                        {step.completed ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <step.icon className="w-6 h-6" />
                        )}
                      </motion.div>
                      <p
                        className={`text-xs md:text-sm font-semibold text-center ${
                          currentStep === step.number
                            ? "text-indigo-600"
                            : step.completed
                            ? "text-green-600"
                            : "text-gray-500"
                        }`}
                      >
                        {step.title}
                      </p>
                    </div>
                    {i < steps.length - 1 && (
                      <div
                        className={`h-1 flex-1 mx-2 rounded-full ${
                          currentStep > step.number
                            ? "bg-gradient-to-r from-green-400 to-green-600"
                            : "bg-gray-200"
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <Alert className="border-2 border-red-200/50 bg-red-50/90 shadow">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <AlertDescription className="flex items-center justify-between text-sm font-medium text-red-800">
                  <span>{error}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRetry}
                    >
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
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6"
            >
              <Alert
                className={`border-2 shadow ${
                  importResult.type === "success"
                    ? "border-green-200/50 bg-green-50/90"
                    : "border-red-200/50 bg-red-50/90"
                }`}
              >
                {importResult.type === "success" ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <AlertDescription className="text-sm font-medium">
                  {importResult.type === "success" ? (
                    <div>
                      <p className="font-semibold text-green-800">
                        Import finished
                      </p>
                      <div className="mt-2 text-xs text-gray-700">
                        {Object.entries(importResult.results || {}).map(
                          ([slug, res]) => (
                            <div key={slug} className="mb-1">
                              <strong>{slug}:</strong> {res.status}{" "}
                              {res.error ? `- ${res.error}` : ""}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="font-semibold text-red-800">
                      {importResult.message}
                    </p>
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
              <div
                className={`p-2 rounded-full ${
                  currentStep === 5 ? "bg-green-100" : "bg-indigo-50"
                }`}
              >
                {currentStep === 1 && (
                  <Package className="w-6 h-6 text-indigo-600" />
                )}
                {currentStep === 2 && (
                  <Database className="w-6 h-6 text-indigo-600" />
                )}
                {currentStep === 3 && (
                  <Database className="w-6 h-6 text-indigo-600" />
                )}
                {currentStep === 4 && (
                  <Calendar className="w-6 h-6 text-indigo-600" />
                )}
                {currentStep === 5 && (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                )}
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
                  <Step2Workspace
                    workspaceId={selectedWorkspaceId}
                    lakehouseId={selectedLakehouseId}
                    onPipelineRun={handlePipelineRunResult}
                  />
                </motion.div>
              )}

              {currentStep === 3 && (
                <motion.div key="s3" {...cardMotion}>
                  <Step3AnalyticsSetup
                    datasetName={getDatasetDisplay()}
                    // Pipeline props
                    loadingPipelines={loadingPipelines}
                    pipelines={pipelines}
                    selectedPipelineId={selectedPipeline}
                    handlePipelineSelect={(val) => {
                      setSelectedPipeline(val);
                      handleChange("pipeline_name", val);
                    }}
                    // Tables
                    loadingTables={loadingTables}
                    tables={tables || []}
                    selectedTable={formData.table_name}
                    handleTableSelect={(val) => {
                      handleTableSelect(val);
                    }}
                    // Analytics Type
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
                  <Step5Parameters
                    formData={formData}
                    handleChange={handleChange}
                  />
                </motion.div>
              )}

              {currentStep === 5 && (
                <motion.div key="s5" {...cardMotion}>
                  <Step6Review
                    formData={formData}
                    getDatasetDisplay={getDatasetDisplay}
                    selectedWorkspaceId={selectedWorkspaceId}
                    selectedLakehouseId={selectedLakehouseId}
                  />
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
                  disabled={
                    importLoading ||
                    !(
                      formData.kaggle_datasets &&
                      formData.kaggle_datasets.length
                    )
                  }
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
                    isStepComplete() && !importLoading
                      ? "bg-gradient-to-r from-indigo-500 to-pink-500 text-white"
                      : "bg-gray-300 text-gray-500"
                  }`}
                >
                  Next <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Button
                  onClick={() => alert("Job submitted successfully!")}
                  className="px-6 h-12 rounded-xl shadow-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                >
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

