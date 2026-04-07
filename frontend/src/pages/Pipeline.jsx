import { useState } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import toast from "react-hot-toast";
import { usePipeline } from "../hooks/usePipeline";
import { useUpdateLeadStage } from "../hooks/useLeads";
import { useEvaluateRules } from "../hooks/useRules";
import KanbanColumn from "../components/KanbanColumn";
import { useQueryClient } from "@tanstack/react-query";

export default function Pipeline() {
  const { data, isLoading } = usePipeline();
  const updateStage = useUpdateLeadStage();
  const evaluate = useEvaluateRules();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);

  async function onDragEnd(result) {
    if (!result.destination) return;
    const sourceStageId = parseInt(result.source.droppableId);
    const destStageId = parseInt(result.destination.droppableId);
    if (sourceStageId === destStageId) return;

    const leadId = parseInt(result.draggableId);

    // Optimistic update
    qc.setQueryData(["pipeline"], (old) => {
      if (!old) return old;
      const columns = old.columns.map((col) => {
        if (col.stage.id === sourceStageId) {
          return {
            ...col,
            leads: col.leads.filter((l) => l.id !== leadId),
            total: col.total - 1,
          };
        }
        if (col.stage.id === destStageId) {
          const movedLead = old.columns
            .find((c) => c.stage.id === sourceStageId)
            ?.leads.find((l) => l.id === leadId);
          return movedLead
            ? { ...col, leads: [movedLead, ...col.leads], total: col.total + 1 }
            : col;
        }
        return col;
      });
      return { ...old, columns };
    });

    try {
      await updateStage.mutateAsync({ id: leadId, stage_id: destStageId });
      toast.success("Lead moved");
    } catch {
      toast.error("Failed to move lead");
      qc.invalidateQueries({ queryKey: ["pipeline"] });
    }
  }

  async function handleRunRules() {
    setRunning(true);
    try {
      const result = await evaluate.mutateAsync();
      toast.success(`Rules evaluated — ${result.leads_moved} leads moved`);
    } catch {
      toast.error("Failed to run rules");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>
        <button
          onClick={handleRunRules}
          disabled={running}
          className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          {running ? (
            <>
              <span className="animate-spin">⟳</span> Running…
            </>
          ) : (
            <>⚡ Run Rules</>
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-52 h-64 bg-gray-100 rounded-xl animate-pulse shrink-0" />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto kanban-scroll pb-4 flex-1">
            {data?.columns?.map((col) => (
              <KanbanColumn
                key={col.stage.id}
                stage={col.stage}
                leads={col.leads}
                total={col.total}
              />
            ))}
          </div>
        </DragDropContext>
      )}
    </div>
  );
}
