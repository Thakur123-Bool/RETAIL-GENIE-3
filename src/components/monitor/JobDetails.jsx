import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Clock, Calendar, Package, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function JobDetails({ job }) {
  if (!job) {
    return (
      <Card className="shadow-md">
        <CardContent className="p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "var(--retail-blue)" }} />
          <p className="text-gray-500">Select a job to view details</p>
        </CardContent>
      </Card>
    );
  }

  const detailItems = [
    {
      icon: Calendar,
      label: "Date Range",
      value: job.start_date && job.end_date
        ? `${format(new Date(job.start_date), "MMM d, yyyy")} - ${format(new Date(job.end_date), "MMM d, yyyy")}`
        : "N/A"
    },
    {
      icon: TrendingUp,
      label: "Forecast Horizon",
      value: job.forecast_horizon ? `${job.forecast_horizon} days` : "N/A"
    },
    {
      icon: Package,
      label: "Products",
      value: job.products || "All products"
    },
  ];

  if (job.pipeline_name) {
    detailItems.push({
      icon: FileText,
      label: "Pipeline",
      value: job.pipeline_name
    });
  }

  if (job.lakehouse_name) {
    detailItems.push({
      icon: FileText,
      label: "Lakehouse",
      value: job.lakehouse_name
    });
  }

  return (
    <Card className="shadow-md sticky top-6">
      <CardHeader className="border-b" style={{ borderColor: "var(--retail-blue-light)" }}>
        <CardTitle style={{ color: "var(--retail-blue-dark)" }}>Job Details</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div>
          <h3 className="font-bold text-lg mb-2" style={{ color: "var(--retail-blue-dark)" }}>
            {job.job_name}
          </h3>
          <p className="text-sm text-gray-600">{job.workspace_name}</p>
        </div>

        <div className="space-y-4">
          {detailItems.map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(91, 155, 213, 0.1)" }}>
                <item.icon className="w-4 h-4" style={{ color: "var(--retail-blue)" }} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{item.label}</p>
                <p className="font-semibold mt-1" style={{ color: "var(--retail-blue-dark)" }}>
                  {item.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {job.execution_started && (
          <div className="pt-4 border-t" style={{ borderColor: "rgba(91, 155, 213, 0.2)" }}>
            <p className="text-sm text-gray-600 mb-1">Started</p>
            <p className="font-semibold" style={{ color: "var(--retail-blue-dark)" }}>
              {format(new Date(job.execution_started), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        )}

        {job.execution_completed && (
          <div className="pt-4 border-t" style={{ borderColor: "rgba(91, 155, 213, 0.2)" }}>
            <p className="text-sm text-gray-600 mb-1">Completed</p>
            <p className="font-semibold" style={{ color: "var(--retail-blue-dark)" }}>
              {format(new Date(job.execution_completed), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
        )}

        {job.error_message && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm font-medium text-red-700 mb-1">Error Details</p>
            <p className="text-sm text-red-600">{job.error_message}</p>
          </div>
        )}

        {job.report_url && job.status === 'completed' && (
          <Button
            className="w-full text-white shadow-md"
            style={{ background: "linear-gradient(135deg, var(--retail-blue-light) 0%, var(--retail-blue) 100%)" }}
            onClick={() => window.open(job.report_url, '_blank')}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Report
          </Button>
        )}
      </CardContent>
    </Card>
  );
}