// ── Clean stroke icons (Feather-style) ─────────────────────────────────────
function StageIcon({ name, className = "" }) {
  const base = {
    width: 18, height: 18, fill: "none", stroke: "currentColor",
    strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round",
    className,
  };
  switch (name) {
    case "New":
      return (
        <svg {...base} viewBox="0 0 24 24">
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "MQL":
      return (
        <svg {...base} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" />
          <line x1="21.17" y1="8" x2="12" y2="8" />
          <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
          <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
        </svg>
      );
    case "SQL":
      return (
        <svg {...base} viewBox="0 0 24 24">
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      );
    case "Opportunity":
      return (
        <svg {...base} viewBox="0 0 24 24">
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
          <polyline points="17 6 23 6 23 12" />
        </svg>
      );
    case "Won":
      return (
        <svg {...base} viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case "Lost":
      return (
        <svg {...base} viewBox="0 0 24 24">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    default: return null;
  }
}

// ── Component ──────────────────────────────────────────────────────────────
export default function StageNode({
  stage, leadCount, rules, isEntry, isTerminal,
  onAddRule, onEditRule, onDeleteRule,
  running, completed,
  onRun, onFlush, stageRunning, stageCompleted,
}) {
  const isAdvanceable = !isEntry && !isTerminal;

  const isNodeRunning   = stageRunning   || (running   && isAdvanceable);
  const isNodeCompleted = stageCompleted || (completed && isAdvanceable);

  return (
    <div className="flex flex-col items-center w-36 shrink-0">

      {/* ── Circle ───────────────────────────────────────────────────────── */}
      <div className="relative">
        <div
          className={`
            w-24 h-24 rounded-full border-2 shadow-sm
            flex flex-col items-center justify-center gap-0.5
            transition-colors duration-500 bg-white
            ${isNodeCompleted ? "border-emerald-400" : "border-slate-300"}
          `}
        >
          <StageIcon
            name={stage.name}
            className={isNodeCompleted ? "text-emerald-500" : "text-slate-400"}
          />
          <span className={`text-xl font-bold leading-none tabular-nums ${isNodeCompleted ? "text-emerald-700" : "text-slate-800"}`}>
            {leadCount.toLocaleString()}
          </span>
        </div>

        {/* Spinning ring while running */}
        {isNodeRunning && (
          <div
            className="absolute rounded-full border-2 border-blue-400 border-t-transparent animate-spin pointer-events-none"
            style={{ inset: -5 }}
          />
        )}

        {/* Ping on completion */}
        {isNodeCompleted && !isNodeRunning && (
          <div
            className="absolute rounded-full border-2 border-emerald-400 animate-ping opacity-25 pointer-events-none"
            style={{ inset: -5 }}
          />
        )}
      </div>

      {/* ── Stage name ───────────────────────────────────────────────────── */}
      <span className={`mt-1.5 text-xs font-semibold tracking-tight text-center ${isNodeCompleted ? "text-emerald-700" : "text-slate-700"}`}>
        {isEntry ? "Imported" : stage.name}
      </span>

      {isEntry    && <span className="text-[10px] text-slate-400 mt-0.5">Total leads</span>}
      {isTerminal && <span className="text-[10px] text-slate-400 mt-0.5">Manual only</span>}

      {/* ── Run + Flush button pair ──────────────────────────────────────── */}
      {isAdvanceable && (onRun || onFlush) && (
        <div className="mt-2 flex items-center gap-1">
          {onRun && (
            <button
              type="button"
              onClick={() => onRun(stage.id)}
              disabled={isNodeRunning}
              className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-l-full border-y border-l transition-all disabled:opacity-50 ${
                isNodeCompleted
                  ? "border-emerald-300 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                  : "border-slate-200 text-slate-500 bg-white hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50"
              }`}
            >
              {isNodeRunning ? (
                <>
                  <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Running
                </>
              ) : isNodeCompleted ? (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Done
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Run
                </>
              )}
            </button>
          )}

          {onFlush && (
            <button
              type="button"
              onClick={() => onFlush(stage.id)}
              disabled={isNodeRunning || leadCount === 0}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-r-full border transition-all border-slate-200 text-slate-400 bg-white hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none"
              title="Move all leads back to previous stage"
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
              </svg>
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── Rules section ─────────────────────────────────────────────────── */}
      {isAdvanceable && (
        <div className="w-full mt-2 space-y-1">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="group flex items-center gap-1 bg-white border border-slate-200 rounded px-2 py-1 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <button
                type="button"
                onClick={() => onEditRule(rule)}
                className="text-[10px] text-slate-600 truncate hover:text-blue-600 flex-1 text-left font-medium"
                title={rule.name}
              >
                {rule.name}
              </button>
              {rule.matched_count != null && (
                <span className="text-[9px] text-slate-400 font-semibold shrink-0 tabular-nums">
                  {rule.matched_count.toLocaleString()}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDeleteRule(rule.id); }}
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 shrink-0 transition-colors"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => onAddRule(stage.id)}
            className="w-full text-[10px] text-blue-600 font-semibold flex items-center justify-center gap-1 border border-dashed border-blue-200 bg-blue-50 rounded py-1.5 hover:bg-blue-100 transition-colors"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Rule
          </button>
        </div>
      )}
    </div>
  );
}
