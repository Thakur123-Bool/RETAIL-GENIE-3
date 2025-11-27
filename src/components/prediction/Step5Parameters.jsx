
// // -----------------------
// // File: src/components/prediction/Step5Parameters.jsx
// // -----------------------
// import React from 'react';
// import { Calendar, ArrowRight } from 'lucide-react';
// import { Input } from '@/components/ui/input';
// import { Label } from '@/components/ui/label';

// export default function Step5Parameters({ formData, handleChange }) {
//   return (
//     <div className="space-y-6">
//       <div className="p-3 bg-gradient-to-r from-indigo-50 via-white to-purple-50 rounded-xl border border-gray-100">
//         <div className="grid md:grid-cols-3 gap-6">
//           <div>
//             <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Start Date <span className="text-red-500">*</span></Label>
//             <Input type="date" value={formData.start_date} onChange={e => handleChange('start_date', e.target.value)} className="h-12 rounded-xl border-2" />
//           </div>
//           <div>
//             <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> End Date <span className="text-red-500">*</span></Label>
//             <Input type="date" value={formData.end_date} onChange={e => handleChange('end_date', e.target.value)} className="h-12 rounded-xl border-2" />
//           </div>
//           <div>
//             <Label className="flex items-center gap-2"><ArrowRight className="w-4 h-4" /> Forecast Horizon (Days) <span className="text-red-500">*</span></Label>
//             <Input type="number" min="1" value={formData.forecast_horizon} onChange={e => handleChange('forecast_horizon', Number(e.target.value))} className="h-12 rounded-xl border-2" />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }




import React from "react";
import { Calendar, ArrowRight, Filter, Columns, Target, Table2, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function Step5Parameters({ formData, handleChange }) {
  const isPredictive = formData.analytics_type === "predictive";

  return (
    <div className="space-y-8">

      {/* Title Card */}
      <div className="p-4 bg-gradient-to-r from-indigo-50 via-white to-purple-50 rounded-xl border border-gray-200">
        <h2 className="text-lg md:text-xl font-bold text-indigo-700 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Prediction Parameters
        </h2>
        <p className="text-gray-600 text-sm mt-1">
          Configure all required fields for Predictive Analysis.
        </p>
      </div>

      {/* If Analytics = Predictive → Show predictive parameters */}
      {isPredictive ? (
        <div className="space-y-10">

          {/* DATA MAPPING SECTION */}
          <div className="p-4 rounded-xl border bg-white shadow-sm">
            <h3 className="font-semibold text-indigo-700 mb-4 flex items-center gap-2">
              <Table2 className="w-5 h-5 text-indigo-600" /> Table Mapping
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Source Table */}
              <div>
                <Label className="font-medium">Source Table <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  value={formData.table_name}
                  readOnly
                  className="h-12 rounded-xl border-2 bg-gray-100"
                />
              </div>

              {/* Destination Table */}
              <div>
                <Label className="font-medium">Destination Table <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  placeholder="Pred_OutputTable"
                  value={formData.results_table_name}
                  onChange={(e) => handleChange("results_table_name", e.target.value)}
                  className="h-12 rounded-xl border-2"
                />
              </div>

              {/* Date Column */}
              <div>
                <Label className="font-medium">Date Column <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  placeholder="order_date"
                  value={formData.date_column || ""}
                  onChange={(e) => handleChange("date_column", e.target.value)}
                  className="h-12 rounded-xl border-2"
                />
              </div>

              {/* Target Column */}
              <div>
                <Label className="font-medium">Target Column <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  placeholder="sales"
                  value={formData.target_column || ""}
                  onChange={(e) => handleChange("target_column", e.target.value)}
                  className="h-12 rounded-xl border-2"
                />
              </div>
            </div>
          </div>

          {/* DATE RANGE & FORECAST SECTION */}
          <div className="p-4 rounded-xl border bg-white shadow-sm">
            <h3 className="font-semibold text-indigo-700 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" /> Date & Forecast Settings
            </h3>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <Label className="flex items-center gap-2 font-medium">
                  Start Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange("start_date", e.target.value)}
                  className="h-12 rounded-xl border-2"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2 font-medium">
                  End Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleChange("end_date", e.target.value)}
                  className="h-12 rounded-xl border-2"
                />
              </div>

              <div>
                <Label className="flex items-center gap-2 font-medium">
                  Forecast Horizon (Days) <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.forecast_horizon}
                  onChange={(e) =>
                    handleChange("forecast_horizon", Number(e.target.value))
                  }
                  className="h-12 rounded-xl border-2"
                />
              </div>
            </div>
          </div>

          {/* FILTERS & EXTRA SETTINGS */}
          <div className="p-4 rounded-xl border bg-white shadow-sm">
            <h3 className="font-semibold text-indigo-700 mb-4 flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" /> Filters & Segmentation
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Filter Column */}
              <div>
                <Label className="font-medium flex items-center gap-2">
                  Filter Column
                </Label>
                <Input
                  type="text"
                  placeholder="product_category"
                  value={formData.filter_column || ""}
                  onChange={(e) =>
                    handleChange("filter_column", e.target.value)
                  }
                  className="h-12 rounded-xl border-2"
                />
              </div>

              {/* Product Filters */}
              <div>
                <Label className="font-medium flex items-center gap-2">
                  Product Filters
                </Label>
                <Input
                  type="text"
                  placeholder="fruits, vegetables"
                  value={formData.product_filters || ""}
                  onChange={(e) =>
                    handleChange("product_filters", e.target.value)
                  }
                  className="h-12 rounded-xl border-2"
                />
              </div>

              {/* Selected Columns */}
              <div className="md:col-span-2">
                <Label className="flex items-center gap-2 font-medium">
                  <Columns className="w-5 h-5 text-indigo-600" />
                  Selected Columns (comma separated)
                </Label>
                <Input
                  type="text"
                  placeholder="customer_id, area, pincode"
                  value={formData.selected_columns || ""}
                  onChange={(e) =>
                    handleChange("selected_columns", e.target.value)
                  }
                  className="h-12 rounded-xl border-2"
                />
              </div>
            </div>
          </div>

          {/* MODEL TYPE SECTION */}
          <div className="p-4 rounded-xl border bg-white shadow-sm">
            <h3 className="font-semibold text-indigo-700 mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-600" /> Model Type
            </h3>

            <Select
              value={formData.model_type}
              onValueChange={(val) => handleChange("model_type", val)}
            >
              <SelectTrigger className="h-12 rounded-xl border-2">
                <SelectValue placeholder="Select model type..." />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="forecasting">Forecasting</SelectItem>
                <SelectItem value="clustering">Clustering</SelectItem>
                <SelectItem value="regression">Regression</SelectItem>
                <SelectItem value="classification">Classification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-center text-sm">
          Select <strong>Predictive Analytics</strong> in Step 3 to configure prediction parameters.
        </p>
      )}
    </div>
  );
}
