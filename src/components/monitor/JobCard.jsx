import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, CheckCircle2, AlertCircle, Loader2, Calendar, Database } from "lucide-react";
import { format } from "date-fns";

const statusConfig = {
  pending: {
    icon: Clock,
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    label: "Pending",
    dotColor: "bg-yellow-500"
  },
  in_progress: {
    icon: Loader2,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    label: "In Progress",
    dotColor: "bg-blue-500"
  },
  completed: {
    icon: CheckCircle2,
    color: "bg-green-100 text-green-700 border-green-200",
    label: "Completed",
    dotColor: "bg-green-500"
  },
  failed: {
    icon: AlertCircle,
    color: "bg-red-100 text-red-700 border-red-200",
    label: "Failed",
    dotColor: "bg-red-500"
  }
};

export default function JobCard({ job, isSelected, onClick }) {
  const config = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 shadow-lg' : ''
      }`}
      style={isSelected ? { ringColor: "var(--retail-blue)" } : {}}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${config.dotColor} animate-pulse`} />
            <div>
              <h3 className="font-bold text-lg mb-1" style={{ color: "var(--retail-blue-dark)" }}>
                {job.job_name}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Database className="w-4 h-4" />
                {job.workspace_name}
              </div>
            </div>
          </div>
          <Badge className={`border ${config.color} shrink-0`}>
            <StatusIcon className={`w-3 h-3 mr-1 ${job.status === 'in_progress' ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        </div>

        {job.status === 'in_progress' && job.progress_percentage !== undefined && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Progress</span>
              <span className="font-semibold" style={{ color: "var(--retail-blue)" }}>
                {job.progress_percentage}%
              </span>
            </div>
            <Progress value={job.progress_percentage} className="h-2" />
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(job.created_date), "MMM d, yyyy")}
          </div>
          {job.forecast_horizon && (
            <span>• {job.forecast_horizon} days</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}