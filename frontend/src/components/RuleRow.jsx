const FIELDS = [
  { value: "origin", label: "Origin / Source", type: "enum" },
  { value: "first_contact_date", label: "First Contact Date", type: "date" },
  { value: "landing_page_id", label: "Landing Page ID", type: "string" },
];

const OPERATORS_ENUM = [
  { value: "in", label: "is one of" },
  { value: "not_in", label: "is not one of" },
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
];

const OPERATORS_DATE = [
  { value: "after", label: "after" },
  { value: "before", label: "before" },
  { value: "eq", label: "on" },
];

const OPERATORS_STRING = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "in", label: "contains one of" },
];

function getOperators(type) {
  if (type === "enum") return OPERATORS_ENUM;
  if (type === "date") return OPERATORS_DATE;
  return OPERATORS_STRING;
}

// Mini bar showing proportion
function CountBar({ count, max, selected }) {
  const pct = max > 0 ? Math.max((count / max) * 100, 4) : 0;
  return (
    <div className="h-1 mt-1 rounded-full bg-gray-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${selected ? "bg-blue-500" : "bg-gray-400"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function RuleRow({ condition, onChange, onRemove, fieldValues }) {
  const fieldDef = FIELDS.find((f) => f.value === condition.field) || FIELDS[0];
  const operators = getOperators(fieldDef.type);
  const isMulti = condition.operator === "in" || condition.operator === "not_in";

  // Real origin options from DB, or fallback
  const originOptions = fieldValues?.origins || [];
  const maxOriginCount = Math.max(...originOptions.map((o) => o.count), 1);

  function setField(val) {
    const def = FIELDS.find((f) => f.value === val) || FIELDS[0];
    const ops = getOperators(def.type);
    onChange({ field: val, operator: ops[0].value, value: def.type === "enum" ? [] : "" });
  }

  function setOperator(op) {
    const wasMulti = isMulti;
    const willBeMulti = op === "in" || op === "not_in";
    onChange({
      ...condition,
      operator: op,
      value: willBeMulti ? (wasMulti ? condition.value : []) : "",
    });
  }

  function toggleValue(opt) {
    const current = Array.isArray(condition.value) ? condition.value : [];
    const next = current.includes(opt)
      ? current.filter((v) => v !== opt)
      : [...current, opt];
    onChange({ ...condition, value: next });
  }

  const selectedValues = Array.isArray(condition.value) ? condition.value : [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Field + Operator row */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        <select
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white font-medium"
          value={condition.field}
          onChange={(e) => setField(e.target.value)}
        >
          {FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <select
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
          value={condition.operator}
          onChange={(e) => setOperator(e.target.value)}
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-gray-300 hover:text-red-500 text-lg leading-none"
          title="Remove condition"
        >
          ✕
        </button>
      </div>

      {/* Value picker */}
      {fieldDef.type === "enum" && isMulti ? (
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Click to select values — showing counts from your leads
            {selectedValues.length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">{selectedValues.length} selected</span>
            )}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {originOptions.length > 0 ? originOptions.map((opt) => {
              const selected = selectedValues.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleValue(opt.value)}
                  className={`text-left rounded-lg border px-3 py-2 transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-medium truncate ${selected ? "text-blue-700" : "text-gray-700"}`}>
                      {opt.value}
                    </span>
                    <span className={`text-xs ml-1 shrink-0 ${selected ? "text-blue-500" : "text-gray-400"}`}>
                      {opt.count.toLocaleString()}
                    </span>
                  </div>
                  <CountBar count={opt.count} max={maxOriginCount} selected={selected} />
                </button>
              );
            }) : (
              <p className="text-xs text-gray-400 col-span-3">No leads imported yet</p>
            )}
          </div>
        </div>
      ) : fieldDef.type === "date" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            min={fieldValues?.date_range?.min || undefined}
            max={fieldValues?.date_range?.max || undefined}
          />
          {fieldValues?.date_range?.min && (
            <span className="text-xs text-gray-400">
              Data: {fieldValues.date_range.min} → {fieldValues.date_range.max}
            </span>
          )}
        </div>
      ) : (
        <input
          type="text"
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white w-full"
          value={typeof condition.value === "string" ? condition.value : ""}
          onChange={(e) => onChange({ ...condition, value: e.target.value })}
          placeholder="Enter value…"
        />
      )}
    </div>
  );
}
