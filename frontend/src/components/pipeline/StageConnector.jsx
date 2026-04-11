export default function StageConnector({ animated }) {
  return (
    <div className="flex items-center shrink-0 mx-1">
      <div
        className={`h-px w-16 transition-colors duration-300 ${
          animated ? "bg-blue-400 flow-pulse" : "bg-slate-300"
        }`}
      />
      <div className={`connector-arrow-sm transition-colors duration-300 ${animated ? "active-sm" : "neutral-sm"}`} />
    </div>
  );
}
