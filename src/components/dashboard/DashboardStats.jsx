import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function DashboardStats({ stats }) {
  const statCards = [
    {
      title: "Total Jobs",
      value: stats.total,
      icon: Activity,
      color: "var(--retail-blue)",
      bgColor: "rgba(91, 155, 213, 0.1)",
    },
    {
      title: "In Progress",
      value: stats.inProgress,
      icon: Loader2,
      color: "var(--retail-accent)",
      bgColor: "rgba(0, 180, 216, 0.1)",
      spin: true,
    },
    {
      title: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      color: "var(--retail-success)",
      bgColor: "rgba(6, 214, 160, 0.1)",
    },
    {
      title: "Failed",
      value: stats.failed,
      icon: AlertCircle,
      color: "var(--retail-error)",
      bgColor: "rgba(239, 71, 111, 0.1)",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.spin ? 'animate-spin-slow' : ''}`}
                style={{ background: stat.bgColor }}
              >
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: stat.color }}>
                  {stat.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}