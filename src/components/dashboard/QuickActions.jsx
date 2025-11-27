import React from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlayCircle, Activity, FileBarChart, Database } from "lucide-react";

const actions = [
  {
    title: "New Prediction",
    description: "Configure and run a new forecasting job",
    icon: PlayCircle,
    link: "NewPrediction",
    color: "var(--retail-blue)",
  },
  {
    title: "Monitor Jobs",
    description: "Track active pipeline executions",
    icon: Activity,
    link: "JobMonitor",
    color: "var(--retail-accent)",
  },
  {
    title: "View Reports",
    description: "Access completed forecast reports",
    icon: FileBarChart,
    link: "Reports",
    color: "var(--retail-success)",
  },
];

export default function QuickActions() {
  return (
    <Card className="shadow-md">
      <CardHeader className="border-b" style={{ borderColor: "var(--retail-blue-light)" }}>
        <CardTitle style={{ color: "var(--retail-blue-dark)" }}>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-3">
        {actions.map((action) => (
          <Link key={action.title} to={createPageUrl(action.link)}>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 hover:shadow-md transition-all border-2"
              style={{ borderColor: "rgba(91, 155, 213, 0.2)" }}
            >
              <div className="flex items-center gap-3 w-full">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${action.color}15` }}
                >
                  <action.icon className="w-5 h-5" style={{ color: action.color }} />
                </div>
                <div className="text-left">
                  <p className="font-semibold" style={{ color: "var(--retail-blue-dark)" }}>
                    {action.title}
                  </p>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </div>
            </Button>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}