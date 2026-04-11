import { useState } from "react";
import toast from "react-hot-toast";
import RuleRow from "./RuleRow";
import LogicPill from "./LogicPill";
import RuleSummary from "./RuleSummary";
import LivePreview from "./LivePreview";

const EMPTY_CONDITION = { field: "origin", operator: "in", value: [] };

function parseInitialBlocks(conditions) {
  if (!conditions?.length) return [{ _join: null, logic: "and", conditions: [{ ...EMPTY_CONDITION }] }];
  if (conditions[0]?.conditions) return conditions;
  return [{ _join: null, logic: "and", conditions: conditions.filter((c) => c.field) }];
}

export default function RuleForm({ initial, stages, fieldValues, availableFields, onSave, onCancel, lockedTargetStageId }) {
  const [name, setName] = useState(initial?.name || "");
  const [targetStageId, setTargetStageId] = useState(
    lockedTargetStageId ? String(lockedTargetStageId) : (initial?.target_stage_id ? String(initial.target_stage_id) : "")
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
    if (conds.length === 1 && blocks.length === 1) return;
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rule Name</label>
          <input
            className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Paid search leads" required
          />
        </div>
        {!lockedTargetStageId && (
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">When matched, move lead to</label>
            <select
              className="mt-1 w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
              value={targetStageId} onChange={(e) => setTargetStageId(e.target.value)} required
            >
              <option value="">Select stage...</option>
              {advanceable.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Blocks */}
      <div className="space-y-2">
        {blocks.map((block, bi) => (
          <div key={bi}>
            {bi > 0 && (
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 border-t-2 border-dashed border-gray-200" />
                <LogicPill value={block._join} onChange={(v) => updateBlock(bi, { ...block, _join: v })} />
                <div className="flex-1 border-t-2 border-dashed border-gray-200" />
              </div>
            )}

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
        className="text-sm text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1.5 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50">
        <span className="text-base leading-none">+</span> Add block
      </button>

      <RuleSummary blocks={blocks} fieldList={availableFields} targetStage={advanceable.find(s => String(s.id) === targetStageId)?.name} />
      <LivePreview blocks={blocks} total={fieldValues?.total || 0} />

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button type="submit" className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">Save Rule</button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
    </form>
  );
}
