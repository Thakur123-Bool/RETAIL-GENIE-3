// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Checkbox } from "@/components/ui/checkbox";
// import { Input } from "@/components/ui/input";
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { useToast } from "@/components/ui/use-toast";
// import { AnimatePresence, motion } from "framer-motion";
// import {
//   ChevronDown,
//   ChevronUp,
//   Loader2,
//   PlayCircle,
//   Table2,
//   Workflow,
// } from "lucide-react";
// import { useEffect, useRef, useState } from "react";

// /**
//  * Props:
//  *  - workspaceId
//  *  - lakehouseId
//  *  - onPipelineRun(result)  <- callback invoked when pipeline finished and table_saved === true
//  */
// export default function Step2Workspace({
//   workspaceId,
//   lakehouseId,
//   onPipelineRun,
// }) {
//   const { toast } = useToast();
//   const pollRef = useRef(null);

//   // ---------------- STATE ----------------
//   const [pipelines, setPipelines] = useState([]);
//   const [tables, setTables] = useState([]);
//   const [loadingPipelines, setLoadingPipelines] = useState(false);
//   const [loadingTables, setLoadingTables] = useState(false);
//   const [selectedPipeline, setSelectedPipeline] = useState("");
//   const [selectedTables, setSelectedTables] = useState([]);
//   const [destinationName, setDestinationName] = useState("");
//   const [runLoading, setRunLoading] = useState(false);
//   const [tablesOpen, setTablesOpen] = useState(true);

//   // ---------------- FETCH PIPELINES ----------------
//   useEffect(() => {
//     if (!workspaceId) return;
//     setLoadingPipelines(true);
//     fetch(`http://127.0.0.1:5000/pipelines?workspace_id=${workspaceId}`)
//       .then((res) => res.json())
//       .then((data) => setPipelines(data.value || []))
//       .catch(() =>
//         toast({
//           title: "Failed",
//           description: "Unable to fetch pipelines",
//           variant: "destructive",
//         })
//       )
//       .finally(() => setLoadingPipelines(false));
//   }, [workspaceId]);

//   // ---------------- FETCH TABLES ----------------
//   useEffect(() => {
//     if (!workspaceId || !lakehouseId) return;
//     setLoadingTables(true);
//     fetch(
//       `http://127.0.0.1:5000/tables?workspace_id=${workspaceId}&lakehouse_id=${lakehouseId}`
//     )
//       .then((res) => res.json())
//       .then((data) => setTables(data.value || []))
//       .catch(() =>
//         toast({
//           title: "Failed",
//           description: "Unable to fetch tables",
//           variant: "destructive",
//         })
//       )
//       .finally(() => setLoadingTables(false));
//   }, [workspaceId, lakehouseId]);

//   // ---------------- TOGGLE TABLE ----------------
//   const toggleTable = (tbl) => {
//     setSelectedTables((prev) =>
//       prev.includes(tbl) ? prev.filter((x) => x !== tbl) : [...prev, tbl]
//     );
//   };

//   // ---------------- RUN PIPELINE ----------------
//   const runPipeline = async () => {
//     if (!selectedPipeline || selectedTables.length === 0 || !destinationName) {
//       toast({
//         title: "Missing fields",
//         description: "Select pipeline, table(s) and destination name.",
//         variant: "destructive",
//       });
//       return;
//     }

//     setRunLoading(true);

//     const payload = {
//       workspace_id: workspaceId,
//       lakehouse_id: lakehouseId,
//       pipeline_id: selectedPipeline,
//       sourceTable: selectedTables[0],
//       destinationTable: destinationName,
//     };

//     try {
//       const res = await fetch("http://127.0.0.1:5000/run-pipeline", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       const data = await res.json();
//       if (!res.ok) throw new Error(data.error || "Pipeline start failed");

//       toast({
//         title: "Pipeline Started",
//         description: "Polling for status...",
//       });

//       // Start polling for completion (the backend returns a location header)
//       pollJobStatus(data.location, destinationName, selectedPipeline);
//     } catch (err) {
//       setRunLoading(false);
//       toast({
//         title: "Pipeline Failed",
//         description: err.message,
//         variant: "destructive",
//       });
//     }
//   };

//   // ---------------- POLLING ----------------
//   const pollJobStatus = (location, destTableName, pipelineId) => {
//     if (pollRef.current) clearInterval(pollRef.current);

//     pollRef.current = setInterval(async () => {
//       try {
//         const url =
//           `http://127.0.0.1:5000/poll-job?location=${encodeURIComponent(
//             location
//           )}` +
//           `&workspace_id=${workspaceId}` +
//           `&lakehouse_id=${lakehouseId}` +
//           `&destination_table=${destTableName}`;

//         const res = await fetch(url);
//         const data = await res.json();

//         console.log("POLL RESPONSE:", data);

//         // SUCCESS → Table is saved
//         if (data.status === "success" && data.table_saved) {
//           clearInterval(pollRef.current);
//           pollRef.current = null;
//           setRunLoading(false);

//           toast({
//             title: "Pipeline Success 🎉",
//             description: "Your table is saved in Lakehouse.",
//           });

//           // call parent callback with useful info
//           if (typeof onPipelineRun === "function") {
//             onPipelineRun({
//               status: "success",
//               pipeline_id: pipelineId,
//               destination_table: destTableName,
//               pipeline_status: data.pipeline_status || data.status,
//               raw: data,
//             });
//           }
//           return;
//         }

//         // Pipeline completed → Wait for table
//         if (data.pipeline_status === "Completed" && !data.table_saved) {
//           // still waiting for file/table to appear; keep polling
//           console.log("Pipeline completed — waiting for table creation...");
//           return;
//         }

//         // FAILED (job failure)
//         if (
//           data.status === "Failed" ||
//           (data.pipeline_status &&
//             data.pipeline_status.toLowerCase() === "failed")
//         ) {
//           clearInterval(pollRef.current);
//           pollRef.current = null;
//           setRunLoading(false);

//           toast({
//             title: "Pipeline Failed",
//             description: data.error || "Something went wrong.",
//             variant: "destructive",
//           });

//           if (typeof onPipelineRun === "function") {
//             onPipelineRun({
//               status: "failed",
//               pipeline_id: pipelineId,
//               destination_table: destTableName,
//               pipeline_status: data.pipeline_status || data.status,
//               raw: data,
//             });
//           }
//         }
//       } catch (e) {
//         console.error("pollJobStatus error", e);
//         // don't kill the poll on transient errors — but we could escalate after X attempts
//       }
//     }, 3000);
//   };

//   // Cleanup
//   useEffect(() => {
//     return () => pollRef.current && clearInterval(pollRef.current);
//   }, []);

//   // ---------------- UI ----------------
//   return (
//     <div className="space-y-8">
//       {/* HEADER */}
//       <div className="flex items-center gap-3">
//         <Workflow className="w-7 h-7 text-indigo-600" />
//         <h2 className="text-2xl font-bold">Select Pipeline & Tables</h2>
//       </div>
//       {/* PIPELINE DROPDOWN */}
//       <Card className="shadow-xl rounded-2xl">
//         <CardHeader>
//           <CardTitle className="flex items-center gap-2 text-indigo-700">
//             <Workflow className="w-5 h-5" />
//             Choose a Pipeline
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           {loadingPipelines ? (
//             <div className="flex items-center gap-2 text-indigo-500">
//               <Loader2 className="animate-spin w-5 h-5" />
//               Loading pipelines...
//             </div>
//           ) : (
//             <Select
//               onValueChange={setSelectedPipeline}
//               value={selectedPipeline}
//               disabled={runLoading}
//             >
//               <SelectTrigger className="h-14 rounded-xl border-2">
//                 <SelectValue placeholder="Select a pipeline..." />
//               </SelectTrigger>
//               <SelectContent>
//                 {pipelines.map((p) => (
//                   <SelectItem key={p.id} value={p.id}>
//                     {p.displayName}
//                   </SelectItem>
//                 ))}
//               </SelectContent>
//             </Select>
//           )}
//         </CardContent>
//       </Card>
//       {/* TABLES */}
//       <Card className="shadow-xl rounded-2xl">
//         <CardHeader
//           className="flex items-left justify-between cursor-pointer"
//           onClick={() => setTablesOpen((prev) => !prev)}
//         >
//           <CardTitle className="flex items-center gap-2 text-purple-700">
//             <Table2 className="w-5 h-5" />
//             Select Tables
//           </CardTitle>

//           <div className="ml-auto text-slate-500">
//             {tablesOpen ? <ChevronUp /> : <ChevronDown />}
//           </div>
//         </CardHeader>

//         <AnimatePresence>
//           {tablesOpen && (
//             <motion.div
//               initial={{ opacity: 0, height: 0 }}
//               animate={{ opacity: 1, height: "auto" }}
//               exit={{ opacity: 0, height: 0 }}
//               transition={{ duration: 0.22 }}
//               style={{ overflow: "hidden" }}
//             >
//               <CardContent className="max-h-80 overflow-y-auto pr-2 space-y-2">
//                 {loadingTables ? (
//                   <div className="flex items-center gap-2 text-purple-500">
//                     <Loader2 className="animate-spin w-5 h-5" />
//                     Loading tables...
//                   </div>
//                 ) : (
//                   tables.map((tbl) => (
//                     <div
//                       key={tbl.name}
//                       className="flex items-center gap-3 px-2 py-1 cursor-pointer hover:bg-purple-50 rounded"
//                       onClick={() => !runLoading && toggleTable(tbl.name)}
//                     >
//                       <Checkbox
//                         checked={selectedTables.includes(tbl.name)}
//                         disabled={runLoading}
//                       />
//                       <span className="text-sm">{tbl.name}</span>
//                     </div>
//                   ))
//                 )}
//               </CardContent>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </Card>
//       {/* DESTINATION NAME */}
//       <Card className="shadow-xl rounded-2xl">
//         <CardHeader>
//           <CardTitle className="text-green-700">
//             Destination Table Name
//           </CardTitle>
//         </CardHeader>
//         <CardContent>
//           <Input
//             disabled={runLoading}
//             placeholder="final_output_table"
//             value={destinationName}
//             onChange={(e) => setDestinationName(e.target.value)}
//             className="h-14 rounded-xl border-2"
//           />
//         </CardContent>
//       </Card>
//       {/* RUN BUTTON */}
//       <div className="flex justify-end">
//         <Button
//           disabled={runLoading}
//           onClick={runPipeline}
//           className="px-8 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
//         >
//           {runLoading ? (
//             <>
//               <Loader2 className="w-5 h-5 animate-spin mr-2" />
//               Running...
//             </>
//           ) : (
//             <>
//               <PlayCircle className="w-5 h-5 mr-2" />
//               Run Pipeline
//             </>
//           )}
//         </Button>
//       </div>
//     </div>
//   );
// }



import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimatePresence, motion } from "framer-motion";

import {
  ChevronDown,
  ChevronUp,
  Loader2,
  PlayCircle,
  Table2,
  Workflow,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

import { useEffect, useRef, useState } from "react";

/**
 * Props:
 *  - workspaceId
 *  - lakehouseId
 *  - onPipelineRun(result)
 */
export default function Step2Workspace({
  workspaceId,
  lakehouseId,
  onPipelineRun,
}) {
  const pollRef = useRef(null);

  // ---------------- STATE ----------------
  const [pipelines, setPipelines] = useState([]);
  const [tables, setTables] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  const [selectedPipeline, setSelectedPipeline] = useState("");
  const [selectedTables, setSelectedTables] = useState([]);
  const [destinationName, setDestinationName] = useState("");

  const [runLoading, setRunLoading] = useState(false);
  const [tablesOpen, setTablesOpen] = useState(true);

  // NEW MESSAGE BOX
  const [message, setMessage] = useState(null); // { type: "success" | "error", text: "" }

  // ---------------- FETCH PIPELINES ----------------
  useEffect(() => {
    if (!workspaceId) return;
    setLoadingPipelines(true);

    fetch(`http://127.0.0.1:5000/pipelines?workspace_id=${workspaceId}`)
      .then((res) => res.json())
      .then((data) => setPipelines(data.value || []))
      .catch(() =>
        setMessage({
          type: "error",
          text: "Failed to fetch pipelines",
        })
      )
      .finally(() => setLoadingPipelines(false));
  }, [workspaceId]);

  // ---------------- FETCH TABLES ----------------
  useEffect(() => {
    if (!workspaceId || !lakehouseId) return;
    setLoadingTables(true);

    fetch(
      `http://127.0.0.1:5000/tables?workspace_id=${workspaceId}&lakehouse_id=${lakehouseId}`
    )
      .then((res) => res.json())
      .then((data) => setTables(data.value || []))
      .catch(() =>
        setMessage({
          type: "error",
          text: "Failed to fetch tables",
        })
      )
      .finally(() => setLoadingTables(false));
  }, [workspaceId, lakehouseId]);

  // ---------------- TOGGLE TABLE ----------------
  const toggleTable = (tbl) => {
    setSelectedTables((prev) =>
      prev.includes(tbl)
        ? prev.filter((x) => x !== tbl)
        : [...prev, tbl]
    );
  };

  // ---------------- RUN PIPELINE ----------------
  const runPipeline = async () => {
    setMessage(null);

    if (!selectedPipeline || selectedTables.length === 0 || !destinationName) {
      setMessage({
        type: "error",
        text: "Select pipeline, table(s) and destination table name.",
      });
      return;
    }

    setRunLoading(true);

    const payload = {
      workspace_id: workspaceId,
      lakehouse_id: lakehouseId,
      pipeline_id: selectedPipeline,
      sourceTable: selectedTables[0],
      destinationTable: destinationName,
    };

    try {
      const res = await fetch("http://127.0.0.1:5000/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pipeline start failed");

      // Start polling
      pollJobStatus(data.location, destinationName, selectedPipeline);
      setMessage({
        type: "info",
        text: "Pipeline started — polling for status...",
      });

    } catch (err) {
      setRunLoading(false);
      setMessage({
        type: "error",
        text: err.message,
      });
    }
  };

  // ---------------- POLLING ----------------
  const pollJobStatus = (location, destTableName, pipelineId) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const url =
          `http://127.0.0.1:5000/poll-job?location=${encodeURIComponent(
            location
          )}` +
          `&workspace_id=${workspaceId}` +
          `&lakehouse_id=${lakehouseId}` +
          `&destination_table=${destTableName}`;

        const res = await fetch(url);
        const data = await res.json();

        // SUCCESS — ONLY ONCE
        if (data.status === "success" && data.table_saved) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunLoading(false);

          setMessage({
            type: "success",
            text: `Pipeline finished successfully. Table "${destTableName}" is saved.`,
          });

          if (typeof onPipelineRun === "function") {
            onPipelineRun({
              status: "success",
              pipeline_id: pipelineId,
              destination_table: destTableName,
              pipeline_status: data.pipeline_status || data.status,
              raw: data,
            });
          }

          return;
        }

        // FAILURE
        if (
          data.status === "Failed" ||
          (data.pipeline_status &&
            data.pipeline_status.toLowerCase() === "failed")
        ) {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setRunLoading(false);

          setMessage({
            type: "error",
            text: data.error || "Pipeline failed.",
          });

          if (typeof onPipelineRun === "function") {
            onPipelineRun({
              status: "failed",
              pipeline_id: pipelineId,
              destination_table: destTableName,
              pipeline_status: data.pipeline_status || data.status,
              raw: data,
            });
          }
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 3000);
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => pollRef.current && clearInterval(pollRef.current);
  }, []);

  const selectedList = selectedTables.join(", ");

  // ---------------- UI ----------------
  return (
    <div className="space-y-8">

      {/* INLINE MESSAGE BOX */}
      {message && (
        <div
          className={`p-4 rounded-xl border-2 ${
            message.type === "success"
              ? "bg-green-50 border-green-300 text-green-700"
              : message.type === "error"
              ? "bg-red-50 border-red-300 text-red-700"
              : "bg-blue-50 border-blue-300 text-blue-700"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" && (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {message.type === "error" && (
              <AlertTriangle className="w-5 h-5" />
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      {/* <div className="flex items-center gap-3">
        <Workflow className="w-7 h-7 text-indigo-600" />
        <h2 className="text-2xl font-bold">Select Pipeline & Tables</h2>
      </div> */}

      {/* PIPELINE */}
      <Card className="shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-700">
            <Workflow className="w-5 h-5" />
            Choose a Pipeline
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loadingPipelines ? (
            <div className="flex items-center gap-2 text-indigo-500">
              <Loader2 className="animate-spin w-5 h-5" />
              Loading pipelines...
            </div>
          ) : (
            <Select
              onValueChange={setSelectedPipeline}
              value={selectedPipeline}
              disabled={runLoading}
            >
              <SelectTrigger className="h-14 rounded-xl border-2">
                <SelectValue placeholder="Select a pipeline..." />
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
        </CardContent>
      </Card>

      {/* TABLES */}
      <Card className="shadow-xl rounded-2xl">
        {/* <CardHeader
          className="flex items-left justify-between cursor-pointer"
          onClick={() => setTablesOpen((prev) => !prev)}
        >
          <div>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <Table2 className="w-5 h-5" />
              Select Tables
            </CardTitle>

            {selectedTables.length > 0 && (
              <p className="text-xs text-slate-600 mt-1">
                {selectedTables.length} selected — {selectedList}
              </p>
            )}
          </div>

          <div className="ml-auto text-slate-500">
            {tablesOpen ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader> */}
        <CardHeader
          className="flex items-left justify-between cursor-pointer"
          onClick={() => setTablesOpen((prev) => !prev)}
        >
          <div>
            <CardTitle className="flex items-center gap-2 text-purple-700 text-lg">
              <Table2 className="w-5 h-5" />
              Select Tables
            </CardTitle>

            {/* BIGGER SELECTED TEXT */}
            {selectedTables.length > 0 && (
              <p className="text-base font-medium text-gray-700 mt-1">
                {selectedTables.length} selected — {selectedTables.join(", ")}
              </p>
            )}
          </div>

          <div className="ml-auto text-slate-500">
            {tablesOpen ? <ChevronUp /> : <ChevronDown />}
          </div>
        </CardHeader>


        <AnimatePresence>
          {tablesOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: "hidden" }}
            >
              <CardContent className="max-h-80 overflow-y-auto pr-2 space-y-2">
                {loadingTables ? (
                  <div className="flex items-center gap-2 text-purple-500">
                    <Loader2 className="animate-spin w-5 h-5" />
                    Loading tables...
                  </div>
                ) : (
                  tables.map((tbl) => (
                    <div
                      key={tbl.name}
                      className="flex items-center gap-3 px-2 py-1 cursor-pointer hover:bg-purple-50 rounded"
                      onClick={() => !runLoading && toggleTable(tbl.name)}
                    >
                      <Checkbox
                        checked={selectedTables.includes(tbl.name)}
                        disabled={runLoading}
                      />
                      <span className="text-sm">{tbl.name}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* DESTINATION */}
      <Card className="shadow-xl rounded-2xl">
        <CardHeader>
          <CardTitle className="text-green-700">
            Destination Table Name
          </CardTitle>
        </CardHeader>

        <CardContent>
          <Input
            disabled={runLoading}
            placeholder="final_output_table"
            value={destinationName}
            onChange={(e) => setDestinationName(e.target.value)}
            className="h-14 rounded-xl border-2"
          />
        </CardContent>
      </Card>

      {/* RUN BUTTON */}
      <div className="flex justify-end">
        <Button
          disabled={runLoading}
          onClick={runPipeline}
          className="px-8 h-12 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white"
        >
          {runLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Running...
            </>
          ) : (
            <>
              <PlayCircle className="w-5 h-5 mr-2" />
              Run Pipeline
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
