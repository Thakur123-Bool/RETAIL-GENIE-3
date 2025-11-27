import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, ExternalLink, Search, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function Reports() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: jobs, isLoading } = useQuery({
    queryKey: ['completed-jobs'],
    queryFn: () => base44.entities.PredictionJob.filter({ status: 'completed' }, '-execution_completed'),
    initialData: [],
  });

  const filteredJobs = jobs.filter(job =>
    job.job_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.workspace_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--retail-blue-dark)" }}>
            Prediction Reports
          </h1>
          <p className="text-lg" style={{ color: "var(--retail-blue)" }}>
            View and analyze your forecasting results
          </p>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search reports by job name or workspace..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Reports Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <Card key={job.id} className="hover:shadow-lg transition-shadow group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg, var(--retail-blue-light) 0%, var(--retail-blue) 100%)" }}>
                    <FileBarChart className="w-6 h-6 text-white" />
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-green-200">
                    Completed
                  </Badge>
                </div>
                <CardTitle className="text-lg" style={{ color: "var(--retail-blue-dark)" }}>
                  {job.job_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4" style={{ color: "var(--retail-blue)" }} />
                    <span className="text-gray-600">{job.workspace_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4" style={{ color: "var(--retail-blue)" }} />
                    <span className="text-gray-600">
                      {job.execution_completed ? format(new Date(job.execution_completed), "MMM d, yyyy 'at' h:mm a") : "N/A"}
                    </span>
                  </div>
                  {job.forecast_horizon && (
                    <div className="text-sm text-gray-600">
                      Forecast: <span className="font-semibold">{job.forecast_horizon} days</span>
                    </div>
                  )}
                </div>
                {job.report_url ? (
                  <Button
                    className="w-full text-white group-hover:shadow-md transition-all"
                    style={{ background: "linear-gradient(135deg, var(--retail-blue-light) 0%, var(--retail-blue) 100%)" }}
                    onClick={() => window.open(job.report_url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View Report
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Report Not Available
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredJobs.length === 0 && !isLoading && (
          <Card className="p-12 text-center">
            <FileBarChart className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: "var(--retail-blue)" }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: "var(--retail-blue-dark)" }}>
              No Reports Available
            </h3>
            <p style={{ color: "var(--retail-blue)" }}>
              Complete a prediction job to generate reports
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}