export default function RuleCard({ rule, onEdit, onDelete, fieldValues }) {
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
              &rarr; {rule.target_stage?.name}
            </span>
            {!rule.is_active && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                Inactive
              </span>
            )}
          </div>

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
