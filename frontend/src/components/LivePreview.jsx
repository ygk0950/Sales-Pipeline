import { useState, useEffect, useRef } from "react";
import api from "../api/client";

export default function LivePreview({ blocks, total }) {
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
        <p className="text-xs text-green-600 animate-pulse">Counting matches...</p>
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
