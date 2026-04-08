import { useState, useEffect, useRef } from "react";

const DEFAULT_FIELDS = [
  { value: "origin", label: "Channel", type: "enum", options: [] },
  { value: "first_contact_date", label: "First Contact Date", type: "date", options: null },
  { value: "landing_page_id", label: "Landing Page", type: "text", options: null },
];

const OPERATORS_CATEGORICAL = [
  { value: "in", label: "equals" },
  { value: "not_in", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
];
const OPERATORS_TEXT = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "not contains" },
];
const OPERATORS_DATE = [
  { value: "after", label: "after" },
  { value: "before", label: "before" },
  { value: "eq", label: "on" },
];
const OPERATORS_NUMBER = [
  { value: "eq", label: "=" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
  { value: "neq", label: "≠" },
];

function getOperators(type, hasOptions) {
  if (type === "date") return OPERATORS_DATE;
  if (type === "number") return OPERATORS_NUMBER;
  if (hasOptions) return OPERATORS_CATEGORICAL;
  return OPERATORS_TEXT;
}

// Power BI-style multi-select slicer — stays open, search + checkboxes
function MultiSelectSlicer({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);

  const selected = Array.isArray(value) ? value : [];
  const filtered = query
    ? options.filter((o) => o.value.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(val) {
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val]
    );
  }

  return (
    <div className="relative flex-1 min-w-0" ref={ref}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white flex items-center gap-1.5 text-left min-h-[34px]"
      >
        {selected.length === 0 ? (
          <span className="text-gray-400 flex-1 text-sm">Select values…</span>
        ) : (
          <div className="flex flex-wrap gap-1 flex-1">
            {selected.map((v) => (
              <span
                key={v}
                className="inline-flex items-center gap-0.5 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium"
              >
                {v}
                <button
                  type="button"
                  onMouseDown={(e) => { e.stopPropagation(); toggle(v); }}
                  className="hover:text-blue-900 leading-none"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <span className="text-gray-400 text-xs shrink-0">{open ? "▴" : "▾"}</span>
      </button>

      {/* Dropdown — stays open */}
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 w-64 bg-white border border-gray-200 rounded-xl shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full text-sm px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Options list with checkboxes */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-3 text-center">No matches</p>
            ) : (
              filtered.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(opt.value)}
                      className="accent-blue-600 shrink-0"
                    />
                    <span
                      className={`text-sm flex-1 truncate ${
                        isSelected ? "font-medium text-blue-700" : "text-gray-700"
                      }`}
                    >
                      {opt.value}
                    </span>
                    {opt.count != null && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {opt.count.toLocaleString()}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {selected.length > 0 ? `${selected.length} selected` : "None selected"}
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RuleRow({ condition, onChange, onRemove, fieldValues, fields }) {
  const fieldList = fields?.length ? fields : DEFAULT_FIELDS;
  const fieldDef = fieldList.find((f) => f.value === condition.field) || fieldList[0];

  const options =
    fieldDef.value === "origin" && fieldValues?.origins
      ? fieldValues.origins
      : (fieldDef.options || []);

  const hasOptions = options.length > 0;
  const operators = getOperators(fieldDef.type, hasOptions);

  function setField(val) {
    const def = fieldList.find((f) => f.value === val) || fieldList[0];
    const opts = def.value === "origin" && fieldValues?.origins
      ? fieldValues.origins
      : (def.options || []);
    const ops = getOperators(def.type, opts.length > 0);
    const defaultOp = ops[0].value;
    onChange({ field: val, operator: defaultOp, value: defaultOp === "in" ? [] : "" });
  }

  function setOperator(op) {
    const wasMulti = condition.operator === "in" || condition.operator === "not_in";
    const willBeMulti = op === "in" || op === "not_in";
    onChange({
      ...condition,
      operator: op,
      value: willBeMulti ? (wasMulti ? condition.value : []) : "",
    });
  }

  const isMulti = condition.operator === "in" || condition.operator === "not_in";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="flex items-start gap-2">
        {/* Field */}
        <select
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white font-medium shrink-0"
          value={condition.field}
          onChange={(e) => setField(e.target.value)}
        >
          {fieldList.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Operator */}
        <select
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white shrink-0"
          value={condition.operator}
          onChange={(e) => setOperator(e.target.value)}
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>

        {/* Value */}
        {fieldDef.type === "date" ? (
          <input
            type="date"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          />
        ) : fieldDef.type === "number" ? (
          <input
            type="number"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Enter number…"
          />
        ) : isMulti && hasOptions ? (
          <MultiSelectSlicer
            options={options}
            value={condition.value}
            onChange={(val) => onChange({ ...condition, value: val })}
          />
        ) : (
          <input
            type="text"
            className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
            value={typeof condition.value === "string" ? condition.value : ""}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Type to search…"
          />
        )}

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 text-gray-300 hover:text-red-500 text-lg leading-none pt-1"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
