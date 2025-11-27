import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlayCircle, TrendingUp, Clock, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import { format } from "date-fns";

import DashboardStats from "../components/dashboard/DashboardStats";
import RecentJobs from "../components/dashboard/RecentJobs";
import QuickActions from "../components/dashboard/QuickActions";

export default function Dashboard() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['prediction-jobs'],
    queryFn: () => base44.entities.PredictionJob.list('-created_date', 10),
    initialData: [],
  });

  const stats = {
    total: jobs.length,
    inProgress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: "var(--retail-blue-dark)" }}>
              Welcome to Retail Genie
            </h1>
            <p className="text-lg" style={{ color: "var(--retail-blue)" }}>
              No-code retail forecasting powered by Microsoft Fabric
            </p>
          </div>
          <Link to={createPageUrl("NewPrediction")}>
            <Button size="lg" className="text-white shadow-lg hover:shadow-xl transition-all" style={{ background: "linear-gradient(135deg, var(--retail-blue-light) 0%, var(--retail-blue) 100%)" }}>
              <PlayCircle className="w-5 h-5 mr-2" />
              New Prediction Job
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <DashboardStats stats={stats} />

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentJobs jobs={jobs} isLoading={isLoading} />
          </div>
          <div>
            <QuickActions />
          </div>
        </div>
      </div>
    </div>
  );
}

// import React from "react";
// import { base44 } from "@/api/base44Client";
// import { useQuery } from "@tanstack/react-query";
// import { Link } from "react-router-dom";
// import { createPageUrl } from "@/utils";

// export default function Dashboard() {
//   const { data: jobs = [] } = useQuery({
//     queryKey: ['prediction-jobs'],
//     queryFn: () => base44.entities.PredictionJob.list(),
//     initialData: [],
//   });

//   return (
//     <div className="p-8">
//       <h1 className="text-3xl font-bold" style={{ color: "#1e5b8f" }}>
//         Welcome to Retail Genie
//       </h1>
//       <p className="text-lg mt-2" style={{ color: "#5b9bd5" }}>
//         No-code retail forecasting powered by Microsoft Fabric
//       </p>
//       <Link to={createPageUrl("NewPrediction")}>
//         <button className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
//           New Prediction Job
//         </button>
//       </Link>
//     </div>
//   );
// }