import { useState, useEffect, useRef } from "react";
import api from "../api/client";

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

export default function RuleSummary({ blocks, fieldList, targetStage }) {
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
      {loading && <p className="text-sm text-amber-400 animate-pulse mb-2">Summarising...</p>}
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
