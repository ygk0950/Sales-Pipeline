import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, usePreviewRule } from "../hooks/useRules";
import { useStages } from "../hooks/usePipeline";
import RuleRow from "../components/RuleRow";
import api from "../api/client";

const EMPTY_CONDITION = { field: "origin", operator: "in", value: [] };

// ── Data Overview Panel ────────────────────────────────────────────────────

function DataOverview({ fieldValues, onQuickRule }) {
  if (!fieldValues) return null;
  const { origins, date_range, total, stages } = fieldValues;
  const maxCount = Math.max(...(origins || []).map((o) => o.count), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Your Lead Data</h2>
        <span className="text-xs text-gray-400 font-medium">{total?.toLocaleString()} total</span>
      </div>

      {total === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          No leads yet. <a href="/upload" className="text-blue-600 underline">Upload leads first →</a>
        </p>
      ) : (
        <>
          {/* Origin breakdown */}
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

          {/* Date range */}
          {date_range?.min && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Date Range
              </p>
              <p className="text-xs text-gray-600">
                {date_range.min} → {date_range.max}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Live Match Counter ─────────────────────────────────────────────────────

function LivePreview({ conditions, total }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const hasValue = conditions.every((c) => {
      if (Array.isArray(c.value)) return c.value.length > 0;
      return c.value !== "" && c.value !== null && c.value !== undefined;
    });
    if (!hasValue || conditions.length === 0) {
      setResult(null);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.post("/api/rules/preview-conditions", { conditions });
        setResult(res.data);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [JSON.stringify(conditions)]);

  if (!result && !loading) return null;

  const pct = total > 0 && result ? ((result.matched_count / total) * 100).toFixed(1) : 0;

  return (
    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
      {loading ? (
        <p className="text-xs text-green-600 animate-pulse">Counting matches…</p>
      ) : result ? (
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-green-700">
              {result.matched_count.toLocaleString()} leads match
            </span>
            <span className="text-xs text-green-600">{pct}% of all leads</span>
          </div>
          <div className="h-1.5 bg-green-200 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
            />
          </div>
          {result.sample_leads?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {result.sample_leads.slice(0, 5).map((l) => (
                <span key={l.id} className="text-xs font-mono bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                  {l.mql_id?.slice(0, 8)}…
                </span>
              ))}
              {result.matched_count > 5 && (
                <span className="text-xs text-green-500">+{result.matched_count - 5} more</span>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ── Rule Form ──────────────────────────────────────────────────────────────

function RuleForm({ initial, stages, fieldValues, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [targetStageId, setTargetStageId] = useState(
    initial?.target_stage_id ? String(initial.target_stage_id) : ""
  );
  const [conditions, setConditions] = useState(
    initial?.conditions?.length ? initial.conditions : [{ ...EMPTY_CONDITION }]
  );

  function updateCondition(index, val) {
    setConditions((c) => c.map((x, i) => (i === index ? val : x)));
  }
  function removeCondition(index) {
    if (conditions.length === 1) return;
    setConditions((c) => c.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !targetStageId) {
      toast.error("Name and target stage are required");
      return;
    }
    onSave({ name, target_stage_id: parseInt(targetStageId), conditions, priority: 0 });
  }

  const advanceable = (stages || []).filter((s) =>
    ["MQL", "SQL", "Opportunity", "Won", "Lost"].includes(s.name)
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border-2 border-blue-200 p-5 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">
        {initial ? "Edit Rule" : "New Rule"}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rule Name</label>
          <input
            className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paid search leads → MQL"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            When matched, move lead to
          </label>
          <select
            className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            value={targetStageId}
            onChange={(e) => setTargetStageId(e.target.value)}
            required
          >
            <option value="">Select stage…</option>
            {advanceable.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Conditions
          </label>
          <span className="text-xs text-gray-400">All conditions must match (AND logic)</span>
        </div>

        <div className="space-y-3">
          {conditions.map((cond, i) => (
            <div key={i}>
              {i > 0 && (
                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                  <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">AND</span>
                  <div className="flex-1 border-t border-dashed border-gray-200" />
                </div>
              )}
              <RuleRow
                condition={cond}
                onChange={(val) => updateCondition(i, val)}
                onRemove={() => removeCondition(i)}
                fieldValues={fieldValues}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setConditions((c) => [...c, { ...EMPTY_CONDITION }])}
          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
        >
          <span className="text-lg leading-none">+</span> Add another condition
        </button>
      </div>

      {/* Live preview */}
      <LivePreview conditions={conditions} total={fieldValues?.total || 0} />

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
        <button
          type="submit"
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          Save Rule
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
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
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();
  const previewRule = usePreviewRule();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewResult, setPreviewResult] = useState({});

  // Quick rule from clicking "+ Rule" on an origin in the data panel
  function handleQuickRule(originValue) {
    setShowForm(true);
    setEditingId(null);
    // The form will open; we'd need to pass initial values — handled via key trick below
    setQuickOrigin(originValue);
  }
  const [quickOrigin, setQuickOrigin] = useState(null);

  // Reset quick origin once form is shown
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

  async function handlePreview(id) {
    try {
      const result = await previewRule.mutateAsync(id);
      setPreviewResult((p) => ({ ...p, [id]: result }));
    } catch {
      toast.error("Preview failed");
    }
  }

  const quickInitial = quickOrigin
    ? {
        name: `${quickOrigin} leads → MQL`,
        target_stage_id: stages?.find((s) => s.name === "MQL")?.id || "",
        conditions: [{ field: "origin", operator: "in", value: [quickOrigin] }],
      }
    : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Data overview */}
        <div className="lg:col-span-1">
          <DataOverview fieldValues={fieldValues} onQuickRule={handleQuickRule} />
        </div>

        {/* Right: Rules list + form */}
        <div className="lg:col-span-2">
          {(showForm || quickOrigin) && (
            <RuleForm
              key={quickOrigin || "new"}
              initial={quickInitial}
              stages={stages}
              fieldValues={fieldValues}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setQuickOrigin(null); }}
            />
          )}

          {editingId && rules?.find((r) => r.id === editingId) && (
            <RuleForm
              key={`edit-${editingId}`}
              initial={rules.find((r) => r.id === editingId)}
              stages={stages}
              fieldValues={fieldValues}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !showForm && !editingId && rules?.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
              <p className="text-4xl mb-3">⚙️</p>
              <p className="text-sm font-medium">No rules yet</p>
              <p className="text-xs mt-1">
                Hover an origin in the data panel and click <strong>+ Rule</strong>,<br />
                or click <strong>+ New Rule</strong> to get started.
              </p>
            </div>
          ) : (
            !editingId && (
              <div className="space-y-3">
                {rules?.map((rule) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    previewResult={previewResult[rule.id]}
                    onEdit={() => { setEditingId(rule.id); setShowForm(false); }}
                    onDelete={() => handleDelete(rule.id)}
                    onPreview={() => handlePreview(rule.id)}
                    fieldValues={fieldValues}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rule Card ──────────────────────────────────────────────────────────────

function RuleCard({ rule, previewResult, onEdit, onDelete, onPreview, fieldValues }) {
  const total = fieldValues?.total || 0;
  const matchedCount = previewResult?.matched_count;
  const pct = total > 0 && matchedCount != null
    ? ((matchedCount / total) * 100).toFixed(1)
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-200 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-semibold text-gray-900 text-sm">{rule.name}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">
              → {rule.target_stage?.name}
            </span>
            {!rule.is_active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
          </div>

          {/* Conditions as readable chips */}
          <div className="flex flex-wrap gap-1.5">
            {rule.conditions?.map((c, i) => (
              <span
                key={i}
                className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-mono"
              >
                {c.field}{" "}
                <span className="text-gray-400">{c.operator}</span>{" "}
                <span className="text-blue-600 font-semibold">
                  {Array.isArray(c.value) ? `[${c.value.join(", ")}]` : c.value}
                </span>
              </span>
            ))}
          </div>

          {/* Preview result */}
          {matchedCount != null && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-green-700">
                  {matchedCount.toLocaleString()} leads match
                </span>
                <span className="text-xs text-gray-400">({pct}%)</span>
              </div>
              <div className="h-1 bg-gray-100 rounded-full mt-1 w-48 overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full"
                  style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onPreview}
            className="text-xs text-gray-500 hover:text-green-600 border border-gray-200 hover:border-green-300 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            Preview
          </button>
          <button
            onClick={onEdit}
            className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
