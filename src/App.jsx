// import { Routes, Route } from "react-router-dom";
// import Dashboard from "./pages/Dashboard";

// function App() {
//   return (
//     <Routes>
//       <Route path="/" element={<Dashboard />} />
//     </Routes>
//   );
// }

// // export default App;

// import { Routes, Route } from "react-router-dom";
// import Layout from "./Layout";
// import Dashboard from "./pages/Dashboard";
// import NewPrediction from "./pages/NewPrediction";
// import JobMonitor from "./pages/JobMonitor";
// import Reports from "./pages/Reports";

// export default function App() {
//   return (
//     <Layout>
//       <Routes>
//         <Route path="/" element={<Dashboard />} />
//         <Route path="/newprediction" element={<NewPrediction />} />
//         <Route path="/jobmonitor" element={<JobMonitor />} />
//         <Route path="/reports" element={<Reports />} />
//       </Routes>
//     </Layout>
//   );
// }


import { ToastProvider } from "@/components/ui/use-toast";
import { Routes, Route } from "react-router-dom";

import Layout from "./Layout";
import Dashboard from "./pages/Dashboard";
import NewPrediction from "./pages/NewPrediction";
import JobMonitor from "./pages/JobMonitor";
import Reports from "./pages/Reports";

import ApiConsole from "./pages/ApiConsole";

export default function App() {
  return (
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<ApiConsole />} />     {/* ⭐ API Console is home */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/newprediction" element={<NewPrediction />} />
          <Route path="/jobmonitor" element={<JobMonitor />} />
          <Route path="/reports" element={<Reports />} />
        </Routes>
      </Layout>
    </ToastProvider>
  );
}

