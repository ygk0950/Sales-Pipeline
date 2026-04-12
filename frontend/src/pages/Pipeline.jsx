import { useState } from "react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { usePipeline, useStages, useFlushStage, useResetAllLeads } from "../hooks/usePipeline";
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
  const flushStage      = useFlushStage();
  const resetAllLeads   = useResetAllLeads();

  // UI state
  const [running,           setRunning]           = useState(false);
  const [uploadCompleted,   setUploadCompleted]   = useState(false);
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

  async function handleResetAllLeads() {
    if (!confirm("Delete all leads? This cannot be undone.")) return;
    try {
      const result = await resetAllLeads.mutateAsync();
      toast.success(`${result.deleted} lead${result.deleted !== 1 ? "s" : ""} deleted`);
      setUploadCompleted(false);
      setCompleted(false);
      setCompletedStageIds(new Set());
    } catch {
      toast.error("Failed to reset leads");
    }
  }

  async function handleFlushStage(stageId) {
    const stageName = stages?.find((s) => s.id === stageId)?.name ?? "stage";
    if (!confirm(`Move all leads in ${stageName} back to the previous stage?`)) return;
    try {
      const result = await flushStage.mutateAsync(stageId);
      toast.success(`${result.flushed} lead${result.flushed !== 1 ? "s" : ""} moved back`);
      setCompletedStageIds((s) => { const n = new Set(s); n.delete(stageId); return n; });
    } catch {
      toast.error("Failed to flush stage");
    }
  }

  async function handleRunStage(stageId) {
    setRunningStageId(stageId);
    setCompletedStageIds((s) => { const n = new Set(s); n.delete(stageId); return n; });
    try {
      const result = await evaluateStage.mutateAsync(stageId);
      toast.success(`${result.leads_moved} lead${result.leads_moved !== 1 ? "s" : ""} moved`);
      setCompletedStageIds((s) => new Set([...s, stageId]));
    } catch {
      toast.error("Failed to run stage");
    } finally {
      setRunningStageId(null);
    }
  }

  async function handleRunRules() {
    setRunning(true);
    setCompleted(false);
    setCompletedStageIds(new Set());
    try {
      const result = await evaluate.mutateAsync();
      toast.success(`Pipeline run \u2014 ${result.leads_moved} leads moved`);
      setCompleted(true);
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Click a stage to manage its rules &mdash; run the pipeline to advance leads
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Run Pipeline */}
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
          uploadCompleted={uploadCompleted}
          onUpload={() => setUploadOpen(true)}
          onResetUpload={handleResetAllLeads}
          onRunStage={handleRunStage}
          onFlushStage={handleFlushStage}
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
      <UploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => setUploadCompleted(true)}
      />
    </div>
  );
}
