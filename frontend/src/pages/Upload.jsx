import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/client";
import FileDropzone from "../components/FileDropzone";

const STANDARD_FIELDS = new Set(["mql_id", "first_contact_date", "landing_page_id", "origin"]);

const STEP_LABELS = ["Upload CSV", "Map Columns", "Data Quality", "Done"];

const DATA_TYPES = [
  { value: "text",    label: "Text",    color: "bg-gray-100 text-gray-600" },
  { value: "number",  label: "Number",  color: "bg-blue-100 text-blue-600" },
  { value: "date",    label: "Date",    color: "bg-purple-100 text-purple-600" },
  { value: "boolean", label: "Boolean", color: "bg-orange-100 text-orange-600" },
];

function TypeBadge({ type, editable, onChange }) {
  const def = DATA_TYPES.find((d) => d.value === type) || DATA_TYPES[0];
  if (!editable) {
    return (
      <span className={`px-2 py-0.5 text-xs rounded font-medium whitespace-nowrap ${def.color}`}>
        {def.label}
      </span>
    );
  }
  return (
    <select
      className={`text-xs rounded font-medium border-0 outline-none cursor-pointer px-1.5 py-0.5 ${def.color}`}
      value={type}
      onChange={(e) => onChange(e.target.value)}
    >
      {DATA_TYPES.map((d) => (
        <option key={d.value} value={d.value}>{d.label}</option>
      ))}
    </select>
  );
}

function ConfidenceBadge({ confidence }) {
  if (confidence >= 0.8)
    return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">{Math.round(confidence * 100)}%</span>;
  if (confidence >= 0.5)
    return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700 font-medium whitespace-nowrap">{Math.round(confidence * 100)}%</span>;
  if (confidence > 0)
    return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-600 font-medium whitespace-nowrap">{Math.round(confidence * 100)}%</span>;
  return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500 font-medium whitespace-nowrap">--</span>;
}

function SeverityIcon({ severity }) {
  if (severity === "error") return <span className="text-red-500 font-bold mr-2">!</span>;
  if (severity === "warning") return <span className="text-yellow-500 font-bold mr-2">!</span>;
  return <span className="text-blue-400 font-bold mr-2">i</span>;
}

export default function Upload({ onDone }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dqReport, setDqReport] = useState(null);
  const [result, setResult] = useState(null);

  async function handleFile(f) {
    setFile(f);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await api.post("/api/leads/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data;
      setPreview({ columns: data.columns, rows: data.rows });
      setColumns(
        data.mapping_suggestions.map((s, i) => ({
          id: i,
          targetField: s.target_field,
          targetLabel: s.target_label,
          csvColumn: s.csv_column,
          confidence: s.confidence,
          needsReview: s.needs_review,
          isStandard: s.is_standard,
          dataType: s.data_type || "text",
          dateFormat: s.date_format || null,
          excluded: false,
        }))
      );
      setStep(2);
    } catch {
      toast.error("Failed to read CSV");
    } finally {
      setLoading(false);
    }
  }

  function updateColumn(id, patch) {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function handleColumnChange(id, csvColumn) {
    updateColumn(id, {
      csvColumn: csvColumn || null,
      confidence: csvColumn ? 1.0 : 0,
      needsReview: !csvColumn,
    });
  }

  function handleLabelChange(id, newLabel) {
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const newField = c.isStandard
          ? c.targetField
          : newLabel.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        return { ...c, targetLabel: newLabel, targetField: newField };
      })
    );
  }

  function buildFormData() {
    const fd = new FormData();
    fd.append("file", file);

    const active = columns.filter((c) => !c.excluded && c.csvColumn);
    const extraColumns = {};
    const columnTypes = {};
    const dateFormats = {};

    for (const col of active) {
      if (col.dataType) columnTypes[col.csvColumn] = col.dataType;
      if (col.dataType === "date" && col.dateFormat) dateFormats[col.csvColumn] = col.dateFormat;
      if (col.isStandard && STANDARD_FIELDS.has(col.targetField)) {
        fd.append(col.targetField, col.csvColumn);
      } else {
        extraColumns[col.csvColumn] = col.targetField;
      }
    }

    if (Object.keys(extraColumns).length > 0)
      fd.append("extra_columns", JSON.stringify(extraColumns));
    if (Object.keys(columnTypes).length > 0)
      fd.append("column_types", JSON.stringify(columnTypes));
    if (Object.keys(dateFormats).length > 0)
      fd.append("date_formats", JSON.stringify(dateFormats));

    return fd;
  }

  async function handleAnalyze() {
    const hasMqlId = columns.some((c) => c.targetField === "mql_id" && !c.excluded && c.csvColumn);
    if (!hasMqlId) { toast.error("You must map the Lead ID column"); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/leads/analyze", buildFormData(), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDqReport(res.data);
      setStep(3);
    } catch {
      toast.error("Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    setLoading(true);
    try {
      const res = await api.post("/api/leads/import", buildFormData(), {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setStep(4);
      toast.success(`Imported ${res.data.imported} leads!`);
    } catch {
      toast.error("Import failed");
    } finally {
      setLoading(false);
    }
  }

  function resetAll() {
    setStep(1); setFile(null); setPreview(null);
    setColumns([]); setDqReport(null); setResult(null);
  }

  const hasMqlId = columns.some((c) => c.targetField === "mql_id" && !c.excluded && c.csvColumn);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Leads</h1>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step > i + 1 ? "bg-green-500 text-white" :
              step === i + 1 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
            }`}>
              {step > i + 1 ? "\u2713" : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? "text-gray-900 font-medium" : "text-gray-400"}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && <span className="text-gray-300 mx-1">&rarr;</span>}
          </div>
        ))}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div>
          <FileDropzone onFile={handleFile} />
          {loading && <p className="text-center text-sm text-blue-600 mt-4 animate-pulse">Reading CSV&hellip;</p>}
        </div>
      )}

      {/* Step 2: Column Mapping */}
      {step === 2 && preview && (
        <div>
          {/* Preview */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">Preview (first 5 rows)</h2>
            <div className="overflow-x-auto">
              <table className="text-xs w-full">
                <thead>
                  <tr className="border-b">
                    {preview.columns.map((c) => (
                      <th key={c} className="text-left pb-2 pr-4 text-gray-500 font-medium">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {preview.columns.map((c) => (
                        <td key={c} className="py-1.5 pr-4 text-gray-700 max-w-[120px] truncate">{row[c]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mapping table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Column Mapping</h2>
              <p className="text-xs text-gray-400">{columns.filter((c) => !c.excluded).length} of {columns.length} active</p>
            </div>

            {/* Header */}
            <div className="grid grid-cols-[1fr_1fr_90px_70px_40px] gap-3 px-2 pb-2 mb-1 border-b border-gray-100 text-xs text-gray-400 font-medium uppercase tracking-wide">
              <span>Field Name</span>
              <span>CSV Column</span>
              <span>Type</span>
              <span className="text-center">Match</span>
              <span></span>
            </div>

            <div className="space-y-1">
              {columns.map((col) => (
                <div
                  key={col.id}
                  className={`grid grid-cols-[1fr_1fr_90px_70px_40px] gap-3 items-center px-2 py-2 rounded-lg transition-all ${
                    col.excluded ? "opacity-35 bg-gray-50" :
                    col.needsReview && col.csvColumn ? "bg-yellow-50" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Field name — editable for all */}
                  <div className="flex items-center min-w-0">
                    <input
                      type="text"
                      className="text-sm text-gray-800 border border-transparent hover:border-gray-300 focus:border-blue-400 rounded px-1.5 py-0.5 bg-transparent focus:bg-white outline-none w-full"
                      value={col.targetLabel}
                      onChange={(e) => handleLabelChange(col.id, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                      disabled={col.excluded}
                      title="Click to rename"
                    />
                    {col.targetField === "mql_id" && <span className="text-red-500 ml-1 shrink-0">*</span>}
                  </div>

                  {/* CSV column dropdown */}
                  <select
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white w-full"
                    value={col.csvColumn || ""}
                    onChange={(e) => handleColumnChange(col.id, e.target.value)}
                    disabled={col.excluded}
                  >
                    <option value="">(not mapped)</option>
                    {preview.columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>

                  {/* Data type selector */}
                  <div>
                    <TypeBadge
                      type={col.dataType}
                      editable={!col.excluded}
                      onChange={(t) => updateColumn(col.id, { dataType: t })}
                    />
                  </div>

                  {/* Confidence */}
                  <div className="flex justify-center">
                    <ConfidenceBadge confidence={col.excluded ? 0 : col.confidence} />
                  </div>

                  {/* Exclude */}
                  {col.targetField === "mql_id" ? (
                    <span />
                  ) : (
                    <button
                      onClick={() => updateColumn(col.id, { excluded: !col.excluded })}
                      className={`h-8 w-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                        col.excluded
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600"
                      }`}
                    >
                      {col.excluded ? "\u21A9" : "\u2715"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={resetAll} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Back</button>
            <button
              onClick={handleAnalyze}
              disabled={loading || !hasMqlId}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Analyzing\u2026" : "Review Data Quality"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Data Quality */}
      {step === 3 && dqReport && (
        <div>
          <div className={`rounded-xl border p-4 mb-5 ${dqReport.can_proceed ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <p className={`text-sm font-medium ${dqReport.can_proceed ? "text-green-800" : "text-red-800"}`}>
              {dqReport.summary}
            </p>
          </div>

          {dqReport.issues.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
              <h2 className="text-base font-semibold text-gray-800 mb-3">Issues</h2>
              <div className="space-y-2">
                {dqReport.issues.map((issue, i) => (
                  <div key={i} className={`p-3 rounded-lg border-l-4 ${
                    issue.severity === "error" ? "border-red-500 bg-red-50" :
                    issue.severity === "warning" ? "border-yellow-400 bg-yellow-50" : "border-blue-300 bg-blue-50"
                  }`}>
                    <div className="flex items-start">
                      <SeverityIcon severity={issue.severity} />
                      <div>
                        <p className="text-sm text-gray-800">{issue.message}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Column: {issue.column}{issue.target_field && ` \u2192 ${issue.target_field}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="text-base font-semibold text-gray-800 mb-3">Column Stats</h2>
            <div className="space-y-3">
              {(() => {
                const labelMap = Object.fromEntries(
                  columns.map((c) => [c.csvColumn, c.targetLabel])
                );
                return Object.entries(dqReport.column_stats).map(([col, stats]) => (
                <div key={col} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-normal">{col} &rarr;</span>
                      {labelMap[col] || col}
                      <TypeBadge type={stats.data_type} editable={false} />
                    </span>
                    <span className="text-xs text-gray-500">{stats.unique_count} unique &middot; {stats.filled}/{stats.total} filled</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${stats.fill_rate >= 0.9 ? "bg-green-500" : stats.fill_rate >= 0.5 ? "bg-yellow-400" : "bg-red-400"}`}
                      style={{ width: `${Math.round(stats.fill_rate * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round(stats.fill_rate * 100)}% fill rate
                    {stats.sample_values.length > 0 && <> &middot; e.g. {stats.sample_values.slice(0, 3).join(", ")}</>}
                  </p>
                </div>
              ));
              })()}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Back</button>
            <button
              onClick={handleImport}
              disabled={loading || !dqReport.can_proceed}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
              title={!dqReport.can_proceed ? "Fix errors before importing" : ""}
            >
              {loading ? "Importing\u2026" : "Import Leads"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {step === 4 && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-5xl mb-4">{"\uD83C\uDF89"}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h2>
          <div className="grid grid-cols-3 gap-4 my-6">
            <div className="bg-green-50 rounded-lg p-4">
              <p className="text-3xl font-bold text-green-700">{result.imported}</p>
              <p className="text-sm text-green-600 mt-1">Imported</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-3xl font-bold text-gray-600">{result.skipped}</p>
              <p className="text-sm text-gray-500 mt-1">Skipped / Dupes</p>
            </div>
            <div className="bg-red-50 rounded-lg p-4">
              <p className="text-3xl font-bold text-red-600">{result.errors.length}</p>
              <p className="text-sm text-red-500 mt-1">Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="text-left bg-red-50 rounded-lg p-3 mb-4">
              {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <button onClick={resetAll} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Upload Another</button>
            {onDone ? (
              <button onClick={onDone} className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">View Pipeline &rarr;</button>
            ) : (
              <Link to="/pipeline" className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">View Pipeline &rarr;</Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
