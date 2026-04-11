export default function UploadNode({ onClick }) {
  return (
    <div className="flex flex-col items-center w-36 shrink-0">
      <button
        type="button"
        onClick={onClick}
        className="group w-24 h-24 rounded-full border-2 border-dashed border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50 shadow-sm transition-all duration-200 flex flex-col items-center justify-center gap-1"
      >
        <svg
          width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          className="text-slate-400 group-hover:text-blue-500 transition-colors"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span className="text-[10px] font-semibold text-slate-400 group-hover:text-blue-500 transition-colors">
          CSV
        </span>
      </button>

      <span className="mt-1.5 text-xs font-semibold text-slate-700">Import</span>
      <span className="text-[10px] text-slate-400 mt-0.5">Click to upload</span>
    </div>
  );
}
