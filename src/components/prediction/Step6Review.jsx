
// -----------------------
// File: src/components/prediction/Step6Review.jsx
// -----------------------
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function Step6Review({ formData, getDatasetDisplay }) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2"><CheckCircle2 className="w-6 h-6 text-green-600" /> Review & Confirm</h3>
      <Card className="p-6">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-semibold">Datasets</p>
            {formData.kaggle_dataset_names && formData.kaggle_dataset_names.length > 0 ? (
              <ul className="text-gray-600 list-disc ml-5">
                {formData.kaggle_dataset_names.map((n, i) => <li key={i}>{n} ({formData.kaggle_datasets[i]})</li>)}
              </ul>
            ) : <p className="text-gray-600">No datasets selected</p>}
          </div>
          <div>
            <p className="font-semibold">Workspace</p>
            <p className="text-gray-600">{formData.workspace_name}</p>
          </div>
          <div>
            <p className="font-semibold">Lakehouse</p>
            <p className="text-gray-600">{formData.lakehouse_name}</p>
          </div>
          <div>
            <p className="font-semibold">Table</p>
            <p className="text-gray-600">{formData.table_name}</p>
          </div>
          <div className="md:col-span-2">
            <p className="font-semibold">Date Range</p>
            <p className="text-gray-600">{formData.start_date} to {formData.end_date}</p>
          </div>
          <div>
            <p className="font-semibold">Forecast Horizon</p>
            <p className="text-gray-600">{formData.forecast_horizon} days</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
