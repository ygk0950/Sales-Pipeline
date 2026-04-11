export default function LogicPill({ value, onChange, variant = "block" }) {
  const active = variant === "block"
    ? "bg-blue-600 text-white"
    : "bg-gray-600 text-white";
  const inactive = "bg-white text-gray-400 hover:text-gray-600";
  const border = variant === "block" ? "border-blue-200" : "border-gray-200";
  return (
    <div className={`inline-flex rounded-md border overflow-hidden text-xs font-bold ${border}`}>
      {["and", "or"].map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onChange(l)}
          className={`px-2.5 py-1 transition-colors ${(value || "and") === l ? active : inactive}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
