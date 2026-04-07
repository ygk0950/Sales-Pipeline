import { Draggable } from "@hello-pangea/dnd";
import { Link } from "react-router-dom";

const ORIGIN_COLORS = {
  social: "bg-pink-100 text-pink-700",
  paid_search: "bg-blue-100 text-blue-700",
  organic_search: "bg-green-100 text-green-700",
  email: "bg-yellow-100 text-yellow-700",
  direct_traffic: "bg-purple-100 text-purple-700",
  referral: "bg-orange-100 text-orange-700",
  display: "bg-teal-100 text-teal-700",
};

function originColor(origin) {
  return ORIGIN_COLORS[origin] || "bg-gray-100 text-gray-600";
}

export default function KanbanCard({ lead, index }) {
  return (
    <Draggable draggableId={String(lead.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-white rounded-lg border border-gray-200 p-3 mb-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${
            snapshot.isDragging ? "shadow-lg rotate-1 opacity-90" : ""
          }`}
        >
          <Link
            to={`/leads/${lead.id}`}
            className="block text-xs font-mono text-gray-500 hover:text-blue-600 truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.mql_id?.slice(0, 12)}…
          </Link>
          <div className="flex items-center justify-between mt-2 gap-1 flex-wrap">
            {lead.origin && (
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${originColor(lead.origin)}`}>
                {lead.origin}
              </span>
            )}
            {lead.first_contact_date && (
              <span className="text-xs text-gray-400">{lead.first_contact_date}</span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
