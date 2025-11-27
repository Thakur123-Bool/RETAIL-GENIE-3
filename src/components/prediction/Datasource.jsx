// import React from "react";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import {
//   Command,
//   CommandList,
//   CommandItem,
// } from "@/components/ui/command";
// import {
//   Package,
//   Database,
//   Search,
//   XCircle,
// } from "lucide-react";
// import { Skeleton } from "@/components/ui/skeleton";
// import { Alert, AlertDescription } from "@/components/ui/alert";

// export default function Step1DataSource(props) {
//   const {
//     formData,
//     setFormData,
//     searchValue,
//     setSearchValue,
//     searchOpen,
//     setSearchOpen,
//     datasets,
//     loadingDatasets,
//     handleDatasetSelect,
//     loadingWorkspaces,
//     workspaces,
//     workspacesError,
//     selectedWorkspaceId,
//     handleWorkspaceSelect,
//     loadingLakehouses,
//     lakehouses,
//     lakehousesError,
//     selectedLakehouseId,
//     handleLakehouseSelect,
//     importLoading,
//   } = props;

//   // ----------------------------
//   // Remove dataset from selected
//   // ----------------------------
//   const removeDataset = (slug) => {
//     setFormData((prev) => ({
//       ...prev,
//       kaggle_datasets: prev.kaggle_datasets.filter((s) => s !== slug),
//       kaggle_dataset_names: prev.kaggle_dataset_names.filter(
//         (name, index) => prev.kaggle_datasets[index] !== slug
//       ),
//     }));
//   };

//   return (
//     <div className="space-y-6">
//       {/* ------------------------------------
//           DATA SOURCE TYPE
//       ------------------------------------- */}
//       <div>
//         <Label className="text-lg font-semibold flex items-center gap-2">
//           <Package className="w-5 h-5" />
//           Data Source Type <span className="text-red-500">*</span>
//         </Label>

//         <Select
//           value={formData.data_source_type}
//           onValueChange={(v) =>
//             setFormData((prev) => ({ ...prev, data_source_type: v }))
//           }
//         >
//           <SelectTrigger className="h-14 rounded-xl border-2">
//             <SelectValue placeholder="Choose your data source..." />
//           </SelectTrigger>

//           <SelectContent>
//             <SelectItem value="kaggle">Kaggle Datasets</SelectItem>
//           </SelectContent>
//         </Select>
//       </div>

//       {/* ------------------------------------
//           WORKSPACE SELECTION
//       ------------------------------------- */}
//       <div className="pt-4 border-t">
//         <Label className="text-lg font-semibold flex items-center gap-2">
//           <Database className="w-5 h-5" />
//           Choose Workspace (for import){" "}
//           <span className="text-red-500">*</span>
//         </Label>

//         {loadingWorkspaces ? (
//           <Skeleton className="h-14 w-full rounded-xl" />
//         ) : workspacesError ? (
//           <Alert>
//             <AlertDescription>Unable to load workspaces.</AlertDescription>
//           </Alert>
//         ) : (
//           <Select
//             value={selectedWorkspaceId}
//             onValueChange={handleWorkspaceSelect}
//           >
//             <SelectTrigger className="h-14 rounded-xl border-2">
//               <SelectValue placeholder="Choose a workspace..." />
//             </SelectTrigger>

//             <SelectContent>
//               {workspaces?.map((w) => (
//                 <SelectItem key={w.id} value={w.id}>
//                   {w.displayName}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         )}
//       </div>

//       {/* ------------------------------------
//           LAKEHOUSE SELECTION
//       ------------------------------------- */}
//       <div className="pt-4 border-t">
//         <Label className="text-lg font-semibold flex items-center gap-2">
//           <Database className="w-5 h-5" />
//           Choose Lakehouse (for import)
//           <span className="text-red-500">*</span>
//         </Label>

//         {loadingLakehouses ? (
//           <Skeleton className="h-14 w-full rounded-xl" />
//         ) : !selectedWorkspaceId ? (
//           <Alert>
//             <AlertDescription>
//               Please select a workspace first.
//             </AlertDescription>
//           </Alert>
//         ) : lakehousesError ? (
//           <Alert>
//             <AlertDescription>Unable to load lakehouses.</AlertDescription>
//           </Alert>
//         ) : (
//           <Select
//             value={selectedLakehouseId}
//             onValueChange={handleLakehouseSelect}
//           >
//             <SelectTrigger className="h-14 rounded-xl border-2">
//               <SelectValue placeholder="Choose a lakehouse..." />
//             </SelectTrigger>

//             <SelectContent>
//               {lakehouses?.map((l) => (
//                 <SelectItem key={l.id} value={l.id}>
//                   {l.displayName}
//                 </SelectItem>
//               ))}
//             </SelectContent>
//           </Select>
//         )}
//       </div>

//       {/* ------------------------------------
//           MULTI SELECT KAGGLE DATASET SEARCH
//       ------------------------------------- */}
//       {formData.data_source_type === "kaggle" && (
//         <div className="pt-4 border-t">
//           <Label className="text-lg font-semibold flex items-center gap-2">
//             <Search className="w-5 h-5" />
//             Search Kaggle Datasets <span className="text-red-500">*</span>
//           </Label>

//           <div className="relative">
//             <Input
//               placeholder="Search datasets..."
//               value={searchValue}
//               onChange={(e) => {
//                 const v = e.target.value;
//                 setSearchValue(v);
//                 setSearchOpen(v.length >= 2);
//               }}
//               disabled={importLoading}
//               className="h-14 rounded-xl border-2"
//             />

//             {/* SEARCH RESULTS DROPDOWN */}
//             {searchOpen && (
//               <div className="absolute top-full left-0 w-full bg-white rounded-xl border shadow-lg mt-2 max-h-72 overflow-y-auto z-50">
//                 <Command>
//                   <CommandList>
//                     {loadingDatasets ? (
//                       <CommandItem>Searching datasets...</CommandItem>
//                     ) : datasets?.datasets &&
//                       datasets.datasets.length > 0 ? (
//                       datasets.datasets.map((ds) => (
//                         <CommandItem
//                           key={ds.slug}
//                           onSelect={() => handleDatasetSelect(ds)}
//                           className="p-3 cursor-pointer hover:bg-gray-50"
//                         >
//                           <div className="flex flex-col">
//                             <span className="font-semibold">{ds.name}</span>
//                             <span className="text-xs text-gray-500">
//                               {ds.slug}
//                             </span>
//                           </div>
//                         </CommandItem>
//                       ))
//                     ) : (
//                       <CommandItem>
//                         No datasets found for "{searchValue}"
//                       </CommandItem>
//                     )}
//                   </CommandList>
//                 </Command>
//               </div>
//             )}
//           </div>

//           {/* SELECTED ITEMS DISPLAY */}
//           {formData.kaggle_dataset_names?.length > 0 && (
//             <div className="mt-3 flex flex-wrap gap-2">
//               {formData.kaggle_dataset_names.map((name, i) => (
//                 <div
//                   key={i}
//                   className="flex items-center bg-blue-100 text-blue-700 px-3 py-1 rounded-full gap-2"
//                 >
//                   {name}
//                   <XCircle
//                     className="w-4 h-4 cursor-pointer hover:text-red-600"
//                     onClick={() => removeDataset(formData.kaggle_datasets[i])}
//                   />
//                 </div>
//               ))}
//             </div>
//           )}

//           <p className="text-sm text-gray-500 pt-2">
//             You may select multiple datasets. All selected datasets will be
//             imported into Fabric.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// }



























// -----------------------
// File: src/components/prediction/Step1DataSource.jsx (FIXED)
// -----------------------
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandList, CommandItem } from '@/components/ui/command';
import { Package, Database, Search, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export default function Step1DataSource(props) {
  const {
    formData, setFormData, searchValue, setSearchValue, searchOpen, setSearchOpen,
    datasets, loadingDatasets, datasetsError, handleDatasetSelect,
    loadingWorkspaces, workspaces, workspacesError, selectedWorkspaceId, handleWorkspaceSelect,
    loadingLakehouses, lakehouses, lakehousesError, selectedLakehouseId, handleLakehouseSelect, importLoading,
    removeDataset, importSelectedDatasets
  } = props;

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold flex items-center gap-2"><Package className="w-5 h-5" /> Data Source Type <span className="text-red-500">*</span></Label>
        <Select value={formData.data_source_type} onValueChange={v => setFormData(prev => ({...prev, data_source_type: v}))}>
          <SelectTrigger className="h-14 rounded-xl border-2">
            <SelectValue placeholder="Choose your data source..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kaggle">Kaggle Datasets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pt-4 border-t">
        <Label className="text-lg font-semibold flex items-center gap-2"><Database className="w-5 h-5" /> Choose Workspace (for import) <span className="text-red-500">*</span></Label>
        {loadingWorkspaces ? <Skeleton className="h-14 w-full rounded-xl" /> : workspacesError ? (
          <Alert><AlertDescription>Unable to load workspaces.</AlertDescription></Alert>
        ) : (
          <Select value={selectedWorkspaceId} onValueChange={handleWorkspaceSelect}>
            <SelectTrigger className="h-14 rounded-xl border-2">
              <SelectValue placeholder="Choose a workspace..." />
            </SelectTrigger>
            <SelectContent>
              {workspaces?.map(w => <SelectItem key={w.id} value={w.id}>{w.displayName}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="pt-4 border-t">
        <Label className="text-lg font-semibold flex items-center gap-2"><Database className="w-5 h-5" /> Choose Lakehouse (for import) <span className="text-red-500">*</span></Label>
        {loadingLakehouses ? <Skeleton className="h-14 w-full rounded-xl" /> : !selectedWorkspaceId ? (
          <Alert><AlertDescription>Please select a workspace first.</AlertDescription></Alert>
        ) : lakehousesError ? (
          <Alert><AlertDescription>Unable to load lakehouses.</AlertDescription></Alert>
        ) : (
          <Select value={selectedLakehouseId} onValueChange={handleLakehouseSelect}>
            <SelectTrigger className="h-14 rounded-xl border-2"><SelectValue placeholder="Choose a lakehouse..." /></SelectTrigger>
            <SelectContent>
              {lakehouses?.map(l => <SelectItem key={l.id} value={l.id}>{l.displayName}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {formData.data_source_type === 'kaggle' && (
        <div className="pt-4 border-t">
          <Label className="text-lg font-semibold flex items-center gap-2"><Search className="w-5 h-5" /> Search Kaggle Dataset <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Input
              placeholder="e.g., 'sales data' or 'customer reviews'..."
              value={searchValue}
              onChange={(e) => { const v = e.target.value; setSearchValue(v); setSearchOpen(v.length >= 2); }}
              onFocus={() => { if (searchValue.length >= 2) setSearchOpen(true); }}
              className="h-14 rounded-xl border-2"
              disabled={importLoading}
            />

            {searchOpen && !importLoading && (
              <div className="absolute top-full left-0 w-full bg-white rounded-xl border shadow-2xl mt-2 max-h-72 overflow-y-auto z-50">
                <Command>
                  <CommandList>
                    {loadingDatasets ? (
                      <CommandItem className="justify-center py-6">Searching datasets...</CommandItem>
                    ) : datasets?.datasets && datasets.datasets.length > 0 ? (
                      datasets.datasets.map(ds => (
                        <CommandItem
                          key={ds.slug}
                          onSelect={() => handleDatasetSelect(ds)}
                          className="cursor-pointer hover:bg-gray-50 p-3"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{ds.title || ds.name}</div>
                              <div className="text-xs text-gray-500 truncate">{ds.slug}</div>
                            </div>
                            <div className="ml-3 text-xs text-gray-400">Select</div>
                          </div>
                        </CommandItem>
                      ))
                    ) : (
                      <CommandItem className="justify-center py-6">No datasets found for "{searchValue}"</CommandItem>
                    )}
                  </CommandList>
                </Command>
              </div>
            )}
          </div>

          {/* Selected dataset chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {formData.kaggle_dataset_names && formData.kaggle_dataset_names.length > 0 ? (
              formData.kaggle_dataset_names.map((name, i) => (
                <div key={i} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full shadow-sm">
                  <div className="text-sm font-medium truncate max-w-[200px]">{name}</div>
                  <XCircle className="w-4 h-4 cursor-pointer hover:text-red-600" onClick={() => removeDataset(formData.kaggle_datasets[i])} />
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500">No datasets selected yet.</div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2">
            {/* <Button onClick={importSelectedDatasets} disabled={importLoading || !(formData.kaggle_datasets && formData.kaggle_datasets.length)} className="bg-gradient-to-r from-indigo-500 to-pink-500 text-white px-4 py-2 rounded-lg shadow">{importLoading ? 'Importing...' : 'Import Selected'}</Button> */}
            <Button variant="ghost" onClick={() => { setFormData(prev => ({...prev, kaggle_datasets: [], kaggle_dataset_names: []})); }} className="px-4 py-2 rounded-lg">Clear</Button>
          </div>

          <p className="text-sm text-gray-500 pt-2">Selecting a dataset will queue it for import to Fabric. You can select multiple datasets and then import them in one go.</p>
        </div>
      )}
    </div>
  );
}