import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useRules, useCreateRule, useUpdateRule, useDeleteRule } from "../hooks/useRules";
import { useStages } from "../hooks/usePipeline";
import RuleForm from "../components/RuleForm";
import RuleCard from "../components/RuleCard";
import api from "../api/client";

// ── Data Overview Panel ────────────────────────────────────────────────────

function DataOverview({ fieldValues, onQuickRule }) {
  if (!fieldValues) return null;
  const { origins, date_range, total } = fieldValues;
  const maxCount = Math.max(...(origins || []).map((o) => o.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Your Lead Data</h2>
        <span className="text-xs text-gray-400 font-medium">{total?.toLocaleString()} total</span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          No leads yet. <Link to="/upload" className="text-blue-600 underline">Upload leads first &rarr;</Link>
        </p>
      ) : (
        <>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Origin / Source
          </p>
          <div className="space-y-1.5 mb-4">
            {(origins || []).map((o) => {
              const pct = ((o.count / total) * 100).toFixed(1);
              const barPct = Math.max((o.count / maxCount) * 100, 3);
              return (
                <div key={o.value} className="group">
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-gray-700 font-medium truncate">{o.value}</span>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-gray-400">{pct}%</span>
                      <span className="text-gray-600 font-semibold w-14 text-right">
                        {o.count.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuickRule(o.value)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-blue-500 hover:text-blue-700 font-medium transition-opacity"
                        title="Create rule for this origin"
                      >
                        + Rule
                      </button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {date_range?.min && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Date Range
              </p>
              <p className="text-xs text-gray-600">
                {date_range.min} &rarr; {date_range.max}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Rules Page ────────────────────────────────────────────────────────

export default function Rules() {
  const { data: rules, isLoading } = useRules();
  const { data: stages } = useStages();
  const { data: fieldValues } = useQuery({
    queryKey: ["field-values"],
    queryFn: () => api.get("/api/dashboard/field-values").then((r) => r.data),
  });
  const { data: availableFields } = useQuery({
    queryKey: ["lead-fields"],
    queryFn: () => api.get("/api/leads/fields").then((r) => r.data),
  });
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [quickOrigin, setQuickOrigin] = useState(null);

  function handleQuickRule(originValue) {
    setShowForm(true);
    setEditingId(null);
    setQuickOrigin(originValue);
  }

  useEffect(() => {
    if (showForm) {
      // slight delay to let form mount
    }
  }, [showForm]);

  async function handleSave(data) {
    try {
      if (editingId) {
        await updateRule.mutateAsync({ id: editingId, ...data });
        toast.success("Rule updated");
        setEditingId(null);
      } else {
        await createRule.mutateAsync(data);
        toast.success("Rule created");
        setShowForm(false);
        setQuickOrigin(null);
      }
    } catch {
      toast.error("Failed to save rule");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this rule?")) return;
    try {
      await deleteRule.mutateAsync(id);
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  }

  const quickInitial = quickOrigin
    ? {
        name: `${quickOrigin} leads \u2192 MQL`,
        target_stage_id: stages?.find((s) => s.name === "MQL")?.id || "",
        conditions: [{ field: "origin", operator: "in", value: [quickOrigin] }],
      }
    : null;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rules</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Define conditions to auto-qualify leads through your pipeline
          </p>
        </div>
        {!showForm && !editingId && (
          <button
            onClick={() => { setShowForm(true); setQuickOrigin(null); }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            + New Rule
          </button>
        )}
      </div>

      <div>
          {(showForm || quickOrigin) && (
            <div className="bg-white rounded-xl border-2 border-blue-200 p-5 mb-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">New Rule</h3>
              <RuleForm
                key={quickOrigin || "new"}
                initial={quickInitial}
                stages={stages}
                fieldValues={fieldValues}
                availableFields={availableFields}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setQuickOrigin(null); }}
              />
            </div>
          )}

          {editingId && rules?.find((r) => r.id === editingId) && (
            <div className="bg-white rounded-xl border-2 border-blue-200 p-5 mb-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Edit Rule</h3>
              <RuleForm
                key={`edit-${editingId}`}
                initial={rules.find((r) => r.id === editingId)}
                stages={stages}
                fieldValues={fieldValues}
                availableFields={availableFields}
                onSave={handleSave}
                onCancel={() => setEditingId(null)}
              />
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !showForm && !editingId && rules?.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-4xl mb-3">&#x2699;&#xFE0F;</p>
              <p className="text-sm font-medium">No rules yet</p>
              <p className="text-xs mt-1">Click <strong>+ New Rule</strong> to get started.</p>
            </div>
          ) : (
            !editingId && (
              <div className="space-y-3">
                {rules?.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    onEdit={() => { setEditingId(rule.id); setShowForm(false); }}
                    onDelete={() => handleDelete(rule.id)}
                    fieldValues={fieldValues}
                  />
                ))}
              </div>
            )
          )}
      </div>
    </div>
  );
}
