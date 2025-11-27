import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";

const statusConfig = {
  pending: {
    icon: Clock,
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    label: "Pending"
  },
  in_progress: {
    icon: Loader2,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    label: "In Progress"
  },
  completed: {
    icon: CheckCircle2,
    color: "bg-green-100 text-green-700 border-green-200",
    label: "Completed"
  },
  failed: {
    icon: AlertCircle,
    color: "bg-red-100 text-red-700 border-red-200",
    label: "Failed"
  }
};

export default function RecentJobs({ jobs, isLoading }) {
  return (
    <Card className="shadow-md">
      <CardHeader className="border-b" style={{ borderColor: "var(--retail-blue-light)" }}>
        <CardTitle className="flex items-center gap-2" style={{ color: "var(--retail-blue-dark)" }}>
          <Clock className="w-5 h-5" />
          Recent Prediction Jobs
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {jobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">No prediction jobs yet. Create your first one!</p>
          </div>
        ) : (
          <div className="divide-y">
            {jobs.map((job) => {
              const config = statusConfig[job.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              
              return (
                <div key={job.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-lg mb-1" style={{ color: "var(--retail-blue-dark)" }}>
                        {job.job_name}
                      </h4>
                      <p className="text-sm text-gray-600">{job.workspace_name}</p>
                    </div>
                    <Badge className={`border ${config.color}`}>
                      <StatusIcon className={`w-3 h-3 mr-1 ${job.status === 'in_progress' ? 'animate-spin' : ''}`} />
                      {config.label}
                    </Badge>
                  </div>
                  
                  {job.status === 'in_progress' && job.progress_percentage !== undefined && (
                    <div className="mb-3">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-semibold" style={{ color: "var(--retail-blue)" }}>
                          {job.progress_percentage}%
                        </span>
                      </div>
                      <Progress value={job.progress_percentage} className="h-2" />
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>Created {format(new Date(job.created_date), "MMM d, yyyy")}</span>
                    {job.forecast_horizon && (
                      <span>• Forecast: {job.forecast_horizon} days</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}