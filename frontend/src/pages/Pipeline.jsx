import { useState } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { usePipeline, useStages } from "../hooks/usePipeline";
import { useRules, useCreateRule, useUpdateRule, useDeleteRule, useEvaluateRules, useEvaluateStageRules } from "../hooks/useRules";
import PipelineFlow from "../components/pipeline/PipelineFlow";
import RuleDrawer from "../components/pipeline/RuleDrawer";
import UploadModal from "../components/pipeline/UploadModal";
import api from "../api/client";

export default function Pipeline() {
  const { data: pipelineData, isLoading } = usePipeline();
  const { data: rules }          = useRules();
  const { data: stages }         = useStages();
  const { data: fieldValues }    = useQuery({
    queryKey: ["field-values"],
    queryFn: () => api.get("/api/dashboard/field-values").then((r) => r.data),
  });
  const { data: availableFields } = useQuery({
    queryKey: ["lead-fields"],
    queryFn: () => api.get("/api/leads/fields").then((r) => r.data),
  });

  const createRule      = useCreateRule();
  const updateRule      = useUpdateRule();
  const deleteRule      = useDeleteRule();
  const evaluate        = useEvaluateRules();
  const evaluateStage   = useEvaluateStageRules();
  const totalLeads      = fieldValues?.total ?? 0;
  const activeRules     = rules?.filter((rule) => rule.is_active).length ?? 0;
  const stagesWithRules  = new Set((rules || []).map((rule) => rule.target_stage_id)).size;
  const totalStages     = pipelineData?.columns?.length ?? stages?.length ?? 0;

  // UI state
  const [running,           setRunning]           = useState(false);
  const [completed,         setCompleted]         = useState(false);
  const [runningStageId,    setRunningStageId]    = useState(null);
  const [completedStageIds, setCompletedStageIds] = useState(new Set());
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editingRule,  setEditingRule]  = useState(null);
  const [targetStageId, setTargetStageId] = useState(null);
  const [uploadOpen,   setUploadOpen]   = useState(false);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleAddRule(stageId) {
    setEditingRule(null);
    setTargetStageId(stageId);
    setDrawerOpen(true);
  }

  function handleEditRule(rule) {
    setEditingRule(rule);
    setTargetStageId(rule.target_stage_id);
    setDrawerOpen(true);
  }

  async function handleDeleteRule(ruleId) {
    if (!confirm("Delete this rule?")) return;
    try {
      await deleteRule.mutateAsync(ruleId);
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  }

  async function handleSaveRule(data) {
    try {
      if (editingRule) {
        await updateRule.mutateAsync({ id: editingRule.id, ...data });
        toast.success("Rule updated");
      } else {
        await createRule.mutateAsync(data);
        toast.success("Rule created");
      }
      setDrawerOpen(false);
      setEditingRule(null);
    } catch {
      toast.error("Failed to save rule");
    }
  }

  async function handleRunStage(stageId) {
    setRunningStageId(stageId);
    setCompletedStageIds((s) => { const n = new Set(s); n.delete(stageId); return n; });
    try {
      const result = await evaluateStage.mutateAsync(stageId);
      toast.success(`${result.leads_moved} lead${result.leads_moved !== 1 ? "s" : ""} moved`);
      setCompletedStageIds((s) => new Set([...s, stageId]));
      setTimeout(() => setCompletedStageIds((s) => { const n = new Set(s); n.delete(stageId); return n; }), 3000);
    } catch {
      toast.error("Failed to run stage");
    } finally {
      setRunningStageId(null);
    }
  }

  async function handleRunRules() {
    setRunning(true);
    setCompleted(false);
    try {
      const result = await evaluate.mutateAsync();
      toast.success(`Pipeline run \u2014 ${result.leads_moved} leads moved`);
      setCompleted(true);
      setTimeout(() => setCompleted(false), 3000);
    } catch {
      toast.error("Failed to run pipeline");
    } finally {
      setRunning(false);
    }
  }

  const targetStageName = stages?.find((s) => s.id === targetStageId)?.name || "";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 h-full flex flex-col">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          </div>

          <button
            onClick={handleRunRules}
            disabled={running}
            className={`flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg transition-all shadow-sm disabled:opacity-60 ${
              completed
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {running ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Running&hellip;
              </>
            ) : completed ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Done
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Run Pipeline
              </>
            )}
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <StatChip label="Total leads" value={totalLeads.toLocaleString()} tone="blue" />
          <StatChip label="Active rules" value={activeRules.toString()} tone="violet" />
          <StatChip label="Stages with rules" value={stagesWithRules.toString()} tone="amber" />
          <StatChip label="Pipeline stages" value={totalStages.toString()} tone="gray" />
        </div>
      </div>

      {/* Flow */}
      {isLoading ? (
        <div className="flex gap-10 items-start">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-36 h-36 bg-slate-100 rounded-full animate-pulse shrink-0" />
          ))}
        </div>
      ) : (
        <PipelineFlow
          columns={pipelineData?.columns}
          rules={rules}
          running={running}
          completed={completed}
          totalLeads={fieldValues?.total ?? null}
          runningStageId={runningStageId}
          completedStageIds={completedStageIds}
          onAddRule={handleAddRule}
          onEditRule={handleEditRule}
          onDeleteRule={handleDeleteRule}
          onUpload={() => setUploadOpen(true)}
          onRunStage={handleRunStage}
        />
      )}

      {/* Rule drawer */}
      <RuleDrawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditingRule(null); }}
        initial={editingRule}
        targetStageId={targetStageId}
        targetStageName={targetStageName}
        stages={stages}
        fieldValues={fieldValues}
        availableFields={availableFields}
        onSave={handleSaveRule}
      />

      {/* Upload modal */}
      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

function StatChip({ label, value, tone = "gray" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div className={`min-w-40 rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-lg font-bold leading-none">{value}</p>
    </div>
  );
}
