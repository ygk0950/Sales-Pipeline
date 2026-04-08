import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import toast from "react-hot-toast";
import { useLead, useUpdateLeadStage } from "../hooks/useLeads";
import { useStages } from "../hooks/usePipeline";

const STAGE_COLORS = {
  New: "bg-gray-100 text-gray-700",
  MQL: "bg-blue-100 text-blue-700",
  SQL: "bg-indigo-100 text-indigo-700",
  Opportunity: "bg-amber-100 text-amber-700",
  Won: "bg-green-100 text-green-700",
  Lost: "bg-red-100 text-red-700",
};

function StageBadge({ name }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STAGE_COLORS[name] || "bg-gray-100 text-gray-700"}`}>
      {name}
    </span>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const { data: lead, isLoading, refetch } = useLead(id);
  const { data: stages } = useStages();
  const updateStage = useUpdateLeadStage();
  const [newStageId, setNewStageId] = useState("");
  const [moving, setMoving] = useState(false);

  async function handleMove() {
    if (!newStageId) return;
    setMoving(true);
    try {
      await updateStage.mutateAsync({ id: parseInt(id), stage_id: parseInt(newStageId) });
      await refetch();
      toast.success("Stage updated");
      setNewStageId("");
    } catch {
      toast.error("Failed to update stage");
    } finally {
      setMoving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Lead not found.</p>
        <Link to="/pipeline" className="text-blue-600 text-sm mt-2 inline-block">← Back to Pipeline</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link to="/pipeline" className="text-sm text-gray-400 hover:text-blue-600 mb-4 inline-block">
        ← Back to Pipeline
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-gray-400 font-mono mb-1">Lead ID</p>
            <p className="text-lg font-bold text-gray-900 font-mono">{lead.mql_id}</p>
          </div>
          <StageBadge name={lead.stage?.name} />
        </div>

        {/* Properties */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Channel</p>
            <p className="text-sm text-gray-800 mt-0.5">{lead.origin || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">First Contact</p>
            <p className="text-sm text-gray-800 mt-0.5">{lead.first_contact_date || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Landing Page</p>
            <p className="text-sm text-gray-800 mt-0.5 font-mono truncate">{lead.landing_page_id?.slice(0, 12) || "—"}…</p>
          </div>
          {lead.extra_data && Object.entries(lead.extra_data).map(([key, val]) => (
            <div key={key}>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{key.replace(/_/g, " ")}</p>
              <p className="text-sm text-gray-800 mt-0.5 truncate">{val || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Manual stage move */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">Move Stage Manually</h2>
        <div className="flex gap-3">
          <select
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2"
            value={newStageId}
            onChange={(e) => setNewStageId(e.target.value)}
          >
            <option value="">Select new stage…</option>
            {(stages || []).map((s) => (
              <option key={s.id} value={s.id} disabled={s.id === lead.stage_id}>
                {s.name}{s.id === lead.stage_id ? " (current)" : ""}
              </option>
            ))}
          </select>
          <button
            onClick={handleMove}
            disabled={!newStageId || moving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60"
          >
            {moving ? "Moving…" : "Move"}
          </button>
        </div>
      </div>

      {/* Stage history timeline */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-800 mb-4">Stage History</h2>
        {lead.history?.length === 0 ? (
          <p className="text-sm text-gray-400">No stage changes yet.</p>
        ) : (
          <div className="space-y-4">
            {[...lead.history].reverse().map((h) => (
              <div key={h.id} className="flex gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.from_stage ? (
                      <>
                        <StageBadge name={h.from_stage.name} />
                        <span className="text-gray-400 text-xs">→</span>
                      </>
                    ) : null}
                    <StageBadge name={h.to_stage.name} />
                    <span className="text-xs text-gray-400 ml-auto">
                      {new Date(h.changed_at).toLocaleString()}
                    </span>
                  </div>
                  {h.rule_name ? (
                    <div className="mt-1.5 bg-blue-50 rounded-lg px-3 py-2">
                      <p className="text-xs font-medium text-blue-700">Rule: {h.rule_name}</p>
                      {h.rule_conditions?.map((c, i) => (
                        <p key={i} className="text-xs text-blue-600 mt-0.5 font-mono">
                          {c.field} {c.operator} {Array.isArray(c.value) ? `[${c.value.join(", ")}]` : c.value}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Manual move</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
