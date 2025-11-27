import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, AlertCircle, Loader2, Activity } from "lucide-react";
import { format } from "date-fns";

import JobCard from "../components/monitor/JobCard";
import JobDetails from "../components/monitor/JobDetails";

export default function JobMonitor() {
  const [selectedJob, setSelectedJob] = useState(null);
  const [activeTab, setActiveTab] = useState("all");

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['prediction-jobs'],
    queryFn: () => base44.entities.PredictionJob.list('-created_date'),
    initialData: [],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const filteredJobs = jobs.filter(job => {
    if (activeTab === "all") return true;
    return job.status === activeTab;
  });

  const stats = {
    all: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    in_progress: jobs.filter(j => j.status === 'in_progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--retail-blue-dark)" }}>
            Job Monitor
          </h1>
          <p className="text-lg" style={{ color: "var(--retail-blue)" }}>
            Track your prediction pipeline executions in real-time
          </p>
        </div>

        {/* Status Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-5 h-auto p-1">
            <TabsTrigger value="all" className="flex items-center gap-2 py-3">
              <Activity className="w-4 h-4" />
              All ({stats.all})
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2 py-3">
              <Clock className="w-4 h-4" />
              Pending ({stats.pending})
            </TabsTrigger>
            <TabsTrigger value="in_progress" className="flex items-center gap-2 py-3">
              <Loader2 className="w-4 h-4" />
              Running ({stats.in_progress})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2 py-3">
              <CheckCircle2 className="w-4 h-4" />
              Completed ({stats.completed})
            </TabsTrigger>
            <TabsTrigger value="failed" className="flex items-center gap-2 py-3">
              <AlertCircle className="w-4 h-4" />
              Failed ({stats.failed})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Jobs List */}
          <div className="lg:col-span-2 space-y-4">
            {isLoading ? (
              <Card className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: "var(--retail-blue)" }} />
                <p style={{ color: "var(--retail-blue)" }}>Loading jobs...</p>
              </Card>
            ) : filteredJobs.length === 0 ? (
              <Card className="p-12 text-center">
                <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "var(--retail-blue)" }} />
                <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--retail-blue-dark)" }}>
                  No Jobs Found
                </h3>
                <p style={{ color: "var(--retail-blue)" }}>
                  {activeTab === "all" ? "Create your first prediction job to get started" : `No ${activeTab} jobs`}
                </p>
              </Card>
            ) : (
              filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onClick={() => setSelectedJob(job)}
                />
              ))
            )}
          </div>

          {/* Job Details */}
          <div>
            <JobDetails job={selectedJob} />
          </div>
        </div>
      </div>
    </div>
  );
}