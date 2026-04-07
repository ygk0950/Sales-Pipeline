import { Droppable } from "@hello-pangea/dnd";
import KanbanCard from "./KanbanCard";

const STAGE_COLORS = {
  New: "bg-gray-100",
  MQL: "bg-blue-50",
  SQL: "bg-indigo-50",
  Opportunity: "bg-amber-50",
  Won: "bg-green-50",
  Lost: "bg-red-50",
};

const STAGE_HEADER = {
  New: "text-gray-600",
  MQL: "text-blue-700",
  SQL: "text-indigo-700",
  Opportunity: "text-amber-700",
  Won: "text-green-700",
  Lost: "text-red-700",
};

export default function KanbanColumn({ stage, leads, total }) {
  const bg = STAGE_COLORS[stage.name] || "bg-gray-50";
  const headerColor = STAGE_HEADER[stage.name] || "text-gray-700";

  return (
    <div className={`flex flex-col rounded-xl ${bg} p-3 min-w-[220px] max-w-[240px] shrink-0`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${headerColor}`}>{stage.name}</h3>
        <span className="text-xs bg-white border border-gray-200 text-gray-500 rounded-full px-2 py-0.5 font-medium">
          {total}
        </span>
      </div>

      <Droppable droppableId={String(stage.id)}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 min-h-[60px] rounded-lg transition-colors ${
              snapshot.isDraggingOver ? "bg-white/60" : ""
            }`}
          >
            {leads.map((lead, index) => (
              <KanbanCard key={lead.id} lead={lead} index={index} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>

      {total > leads.length && (
        <p className="text-xs text-center text-gray-400 mt-2">
          +{total - leads.length} more
        </p>
      )}
    </div>
  );
}
