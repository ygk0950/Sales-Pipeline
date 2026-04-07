import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import api from "../api/client";
import StatsCard from "../components/StatsCard";

const STAGE_COLORS = {
  New: "#94a3b8",
  MQL: "#3b82f6",
  SQL: "#6366f1",
  Opportunity: "#f59e0b",
  Won: "#22c55e",
  Lost: "#ef4444",
};

export default function Dashboard() {
  const summary = useQuery({
    queryKey: ["dashboard", "summary"],
    queryFn: () => api.get("/api/dashboard/summary").then((r) => r.data),
  });
  const conversions = useQuery({
    queryKey: ["dashboard", "conversions"],
    queryFn: () => api.get("/api/dashboard/conversions").then((r) => r.data),
  });
  const origins = useQuery({
    queryKey: ["dashboard", "origins"],
    queryFn: () => api.get("/api/dashboard/origins").then((r) => r.data),
  });

  const s = summary.data;
  const stageMap = s
    ? Object.fromEntries(s.by_stage.map((x) => [x.stage_name, x.count]))
    : {};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats row */}
      {summary.isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatsCard label="Total Leads" value={s?.total_leads?.toLocaleString()} color="blue" />
          <StatsCard label="MQL" value={stageMap["MQL"]?.toLocaleString()} color="purple" />
          <StatsCard label="SQL" value={stageMap["SQL"]?.toLocaleString()} color="amber" />
          <StatsCard label="Win Rate" value={`${s?.win_rate ?? 0}%`} color="green" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Pipeline Distribution</h2>
          {summary.isLoading ? (
            <div className="h-48 bg-gray-50 animate-pulse rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={s?.by_stage || []} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="stage_name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v) => [v.toLocaleString(), "Leads"]} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {(s?.by_stage || []).map((entry) => (
                    <Cell
                      key={entry.stage_name}
                      fill={STAGE_COLORS[entry.stage_name] || "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Conversion rates */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Conversion Rates</h2>
          {conversions.isLoading ? (
            <div className="h-48 bg-gray-50 animate-pulse rounded" />
          ) : (
            <div className="space-y-3">
              {(conversions.data || []).map((c) => (
                <div key={`${c.from_stage}-${c.to_stage}`}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">
                      {c.from_stage} → {c.to_stage}
                    </span>
                    <span className="font-semibold text-gray-800">{c.rate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.min(c.rate, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.to_count.toLocaleString()} of {c.from_count.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Origin breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Leads by Origin</h2>
          {origins.isLoading ? (
            <div className="h-48 bg-gray-50 animate-pulse rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={origins.data || []}>
                <XAxis dataKey="origin" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v.toLocaleString(), "Leads"]} />
                <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
