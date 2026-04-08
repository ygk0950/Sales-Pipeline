import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { useRules, useCreateRule, useUpdateRule, useDeleteRule } from "../hooks/useRules";
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

function LivePreview({ blocks, total }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const allConds = (blocks || []).flatMap((b) => b.conditions || []);
    const hasValue = allConds.length > 0 && allConds.some((c) =>
      Array.isArray(c.value) ? c.value.length > 0 : (c.value !== "" && c.value !== null && c.value !== undefined)
    );
    if (!hasValue) {
      setResult(null);
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Send full blocks array — backend _evaluate_node handles blocks format
        const res = await api.post("/api/rules/preview-conditions", { conditions: blocks, logic: "and" });
        setResult(res.data);
      } catch {
        setResult(null);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timerRef.current);
  }, [JSON.stringify(blocks)]);

  if (!result && !loading) return null;

  const pct = total > 0 && result ? ((result.matched_count / total) * 100).toFixed(1) : 0;

  return (
    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
      {loading ? (
        <p className="text-xs text-green-600 animate-pulse">Counting matches…</p>
      ) : result ? (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-green-700">
              {result.matched_count.toLocaleString()} leads match
            </span>
            <span className="text-xs text-green-600">{pct}% of all leads</span>
          </div>
          <div className="h-1.5 bg-green-200 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${Math.min(parseFloat(pct), 100)}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Rule Form ──────────────────────────────────────────────────────────────

function parseInitialBlocks(conditions) {
  if (!conditions?.length) return [{ _join: null, logic: "and", conditions: [{ ...EMPTY_CONDITION }] }];
  if (conditions[0]?.conditions) return conditions; // already block format
  return [{ _join: null, logic: "and", conditions: conditions.filter((c) => c.field) }];
}


const OP_READABLE = {
  eq: "is", neq: "is not", in: "is", not_in: "is not",
  contains: "contains", not_contains: "doesn't contain",
  gt: "greater than", gte: "at least", lt: "less than", lte: "at most",
  after: "after", before: "before",
};

function blockToText(block, fieldList) {
  const conds = (block.conditions || []).filter((c) =>
    c.field && (Array.isArray(c.value) ? c.value.length > 0 : c.value !== "" && c.value != null)
  );
  if (!conds.length) return null;
  const parts = conds.map((c) => {
    const label = fieldList?.find((f) => f.value === c.field)?.label || c.field;
    const op = OP_READABLE[c.operator] || c.operator;
    const val = Array.isArray(c.value) ? c.value.join(", ") : c.value;
    return `${label} ${op} ${val}`;
  });
  const joiner = ` ${(block.logic || "and").toLowerCase()} `;
  return parts.join(joiner);
}

function RuleSummary({ blocks, fieldList, targetStage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);

  const hasValue = blocks?.some((block) =>
    block.conditions?.some((c) => Array.isArray(c.value) ? c.value.length > 0 : !!c.value)
  );

  useEffect(() => {
    if (!hasValue) { setData(null); return; }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.post("/api/rules/summarize", { blocks, target_stage: targetStage || "" });
        setData(res.data);
      } catch { setData(null); }
      finally { setLoading(false); }
    }, 800);
    return () => clearTimeout(timerRef.current);
  }, [JSON.stringify(blocks), targetStage]);

  if (!hasValue) return null;

  // Fallback: build mechanical bullets if LLM unavailable
  const fallbackBullets = (blocks || [])
    .map((b, i) => ({ join: i > 0 ? (b._join || "and").toUpperCase() : null, text: blockToText(b, fieldList) }))
    .filter((b) => b.text);

  const phrases = data?.bullets;
  const joins = data?.joins || [];
  const bullets = phrases
    ? phrases.map((text, i) => ({ join: joins[i] ? joins[i].toUpperCase() : null, text }))
    : fallbackBullets;

  if (!bullets.length) return null;

  return (
    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-3">Rule Summary</p>
      {loading && <p className="text-sm text-amber-400 animate-pulse mb-2">Summarising…</p>}
      <ul className="space-y-2">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-center gap-3">
            {b.join ? (
              <span className={`text-xs font-bold w-6 text-center shrink-0 ${
                b.join === "OR" ? "text-orange-500" : "text-gray-400"
              }`}>{b.join}</span>
            ) : (
              <span className="w-6 shrink-0" />
            )}
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
            <span className="text-sm text-gray-800">
              {b.text.charAt(0).toUpperCase() + b.text.slice(1)}
            </span>
          </li>
        ))}
      </ul>
      {targetStage && (
        <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-amber-200">
          <span className="text-xs text-gray-500">Matched leads move to</span>
          <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{targetStage}</span>
        </div>
      )}
    </div>
  );
}

function LogicPill({ value, onChange, variant = "block" }) {
  const active = variant === "block"
    ? "bg-blue-600 text-white"
    : "bg-gray-600 text-white";
  const inactive = "bg-white text-gray-400 hover:text-gray-600";
  const border = variant === "block" ? "border-blue-200" : "border-gray-200";
  return (
    <div className={`inline-flex rounded-md border overflow-hidden text-xs font-bold ${border}`}>
      {["and", "or"].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`px-2.5 py-1 transition-colors ${(value || "and") === l ? active : inactive}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function RuleForm({ initial, stages, fieldValues, availableFields, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [targetStageId, setTargetStageId] = useState(
    initial?.target_stage_id ? String(initial.target_stage_id) : ""
  );
  const [blocks, setBlocks] = useState(() => parseInitialBlocks(initial?.conditions));

  function updateBlock(bi, updated) { setBlocks((s) => s.map((b, i) => i === bi ? updated : b)); }
  function removeBlock(bi) { setBlocks((s) => s.length > 1 ? s.filter((_, i) => i !== bi) : s); }

  function updateCondition(bi, ci, val) {
    updateBlock(bi, {
      ...blocks[bi],
      conditions: blocks[bi].conditions.map((c, i) => i === ci ? val : c),
    });
  }
  function removeCondition(bi, ci) {
    const conds = blocks[bi].conditions;
    if (conds.length === 1 && blocks.length === 1) return; // keep at least one
    if (conds.length === 1) { removeBlock(bi); return; }
    updateBlock(bi, { ...blocks[bi], conditions: conds.filter((_, i) => i !== ci) });
  }
  function addCondition(bi) {
    updateBlock(bi, {
      ...blocks[bi],
      conditions: [...blocks[bi].conditions, { ...EMPTY_CONDITION }],
    });
  }
  function addBlock() {
    setBlocks((s) => [...s, { _join: "and", logic: "and", conditions: [{ ...EMPTY_CONDITION }] }]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !targetStageId) { toast.error("Name and target stage are required"); return; }
    onSave({ name, target_stage_id: parseInt(targetStageId), conditions: blocks, logic: "and", priority: 0 });
  }

  const advanceable = (stages || []).filter((s) =>
    ["MQL", "SQL", "Opportunity", "Won", "Lost"].includes(s.name)
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border-2 border-blue-200 p-5 mb-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{initial ? "Edit Rule" : "New Rule"}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rule Name</label>
          <input
            className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paid search leads → MQL" required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">When matched, move lead to</label>
          <select
            className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            value={targetStageId} onChange={(e) => setTargetStageId(e.target.value)} required
          >
            <option value="">Select stage…</option>
            {advanceable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Blocks */}
      <div className="space-y-2">
        {blocks.map((block, bi) => (
          <div key={bi}>
            {/* Between-block separator with AND/OR pill */}
            {bi > 0 && (
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 border-t-2 border-dashed border-gray-200" />
                <LogicPill value={block._join} onChange={(v) => updateBlock(bi, { ...block, _join: v })} />
                <div className="flex-1 border-t-2 border-dashed border-gray-200" />
              </div>
            )}

            {/* Block container */}
            <div className="border border-gray-300 rounded-xl p-4 bg-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Block {bi + 1}</span>
                {blocks.length > 1 && (
                  <button type="button" onClick={() => removeBlock(bi)} className="text-xs text-gray-300 hover:text-red-500">Remove</button>
                )}
              </div>

              <div className="space-y-2">
                {block.conditions.map((cond, ci) => (
                  <div key={ci}>
                    <RuleRow
                      condition={cond}
                      onChange={(v) => updateCondition(bi, ci, v)}
                      onRemove={() => removeCondition(bi, ci)}
                      fieldValues={fieldValues}
                      fields={availableFields}
                    />
                    {ci < block.conditions.length - 1 && (
                      <div className="flex items-center gap-2 my-1">
                        <div className="flex-1 border-t border-dashed border-gray-200" />
                        <LogicPill
                          value={block.logic}
                          onChange={(v) => updateBlock(bi, { ...block, logic: v })}
                          variant="condition"
                        />
                        <div className="flex-1 border-t border-dashed border-gray-200" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button type="button" onClick={() => addCondition(bi)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                <span className="text-sm leading-none">+</span> Add condition
              </button>
            </div>
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlock}
        className="mt-3 text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50">
        <span className="text-base leading-none">+</span> Add block
      </button>

      <RuleSummary blocks={blocks} fieldList={availableFields} targetStage={advanceable.find(s => String(s.id) === targetStageId)?.name} />
      <LivePreview blocks={blocks} total={fieldValues?.total || 0} />

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-gray-100">
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Rule</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
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
  const { data: availableFields } = useQuery({
    queryKey: ["lead-fields"],
    queryFn: () => api.get("/api/leads/fields").then((r) => r.data),
  });
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

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

  const quickInitial = quickOrigin
    ? {
        name: `${quickOrigin} leads → MQL`,
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
            <RuleForm
              key={quickOrigin || "new"}
              initial={quickInitial}
              stages={stages}
              fieldValues={fieldValues}
              availableFields={availableFields}
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
              availableFields={availableFields}
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

// ── Rule Card ──────────────────────────────────────────────────────────────

function RuleCard({ rule, onEdit, onDelete, fieldValues }) {
  const total = fieldValues?.total || 0;
  const matchedCount = rule.matched_count;
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
            {rule.conditions?.map((c, i) =>
              c.type === "group" ? (
                <span key={i} className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2.5 py-1 rounded-lg font-mono">
                  group ({c.conditions?.length || 0} conditions, {c.logic?.toUpperCase()})
                </span>
              ) : (
                <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg font-mono">
                  {c.field} <span className="text-gray-400">{c.operator}</span>{" "}
                  <span className="text-blue-600 font-semibold">
                    {Array.isArray(c.value) ? `[${c.value.join(", ")}]` : c.value}
                  </span>
                </span>
              )
            )}
            {rule.logic === "or" && (
              <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-lg font-semibold">OR logic</span>
            )}
          </div>

          {matchedCount != null && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs font-medium text-green-700">{matchedCount.toLocaleString()} leads match</span>
              <span className="text-xs text-gray-400">({pct}%)</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} className="text-xs text-gray-500 hover:text-blue-600 border border-gray-200 hover:border-blue-300 rounded-lg px-2.5 py-1.5 transition-colors">Edit</button>
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-2.5 py-1.5 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}
