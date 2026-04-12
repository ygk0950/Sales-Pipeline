export default function UploadNode({ onClick, leadCount, uploadCompleted, onReset }) {
  const hasLeads = leadCount > 0;

  return (
    <div className="flex flex-col items-center w-36 shrink-0">

      {/* Circle */}
      <div className="relative">
        <button
          type="button"
          onClick={onClick}
          className={`group w-24 h-24 rounded-full border-2 shadow-sm transition-all duration-200 flex flex-col items-center justify-center gap-0.5 ${
            uploadCompleted
              ? "border-emerald-400 bg-emerald-50 hover:bg-emerald-100"
              : "border-dashed border-blue-300 bg-blue-50 hover:border-blue-500 hover:bg-blue-100"
          }`}
        >
          {uploadCompleted ? (
            <>
              <svg
                width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
                className="text-emerald-500"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {hasLeads && (
                <span className="text-lg font-bold text-emerald-700 leading-none tabular-nums">
                  {leadCount.toLocaleString()}
                </span>
              )}
            </>
          ) : (
            <>
              <svg
                width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"
                className="text-blue-400 group-hover:text-blue-600 transition-colors"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {hasLeads ? (
                <span className="text-lg font-bold text-blue-700 leading-none tabular-nums">
                  {leadCount.toLocaleString()}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-blue-400 group-hover:text-blue-600 transition-colors tracking-wide uppercase">
                  CSV
                </span>
              )}
            </>
          )}
        </button>

        {/* Ping on completion */}
        {uploadCompleted && (
          <div
            className="absolute rounded-full border-2 border-emerald-400 animate-ping opacity-25 pointer-events-none"
            style={{ inset: -5 }}
          />
        )}
      </div>

      {/* Label */}
      <span className={`mt-1.5 text-xs font-semibold ${uploadCompleted ? "text-emerald-700" : "text-blue-600"}`}>
        Upload CSV
      </span>
      <span className="text-[10px] text-slate-400 mt-0.5">Start here</span>

      {/* Reset button */}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          disabled={!hasLeads}
          className="mt-2 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-all border-slate-200 text-slate-400 bg-white hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:pointer-events-none"
          title="Delete all leads"
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
          </svg>
          Reset
        </button>
      )}
    </div>
  );
}
