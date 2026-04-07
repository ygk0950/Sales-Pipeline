import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/client";
import FileDropzone from "../components/FileDropzone";

const TARGET_FIELDS = [
  { value: "mql_id", label: "Lead ID (mql_id)", required: true },
  { value: "first_contact_date", label: "First Contact Date" },
  { value: "landing_page_id", label: "Landing Page ID" },
  { value: "origin", label: "Origin / Source" },
];

function autoMap(columns) {
  const mapping = {};
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "_");
  for (const target of TARGET_FIELDS) {
    const match = columns.find(
      (c) => normalize(c) === target.value || normalize(c).includes(normalize(target.value))
    );
    if (match) mapping[target.value] = match;
  }
  return mapping;
}

export default function Upload() {
  const [step, setStep] = useState(1); // 1: drop, 2: mapping, 3: result
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
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
      setPreview(res.data);
      setMapping(autoMap(res.data.columns));
      setStep(2);
    } catch {
      toast.error("Failed to read CSV");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!mapping.mql_id) {
      toast.error("You must map the Lead ID column");
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mql_id", mapping.mql_id);
      if (mapping.first_contact_date) fd.append("first_contact_date", mapping.first_contact_date);
      if (mapping.landing_page_id) fd.append("landing_page_id", mapping.landing_page_id);
      if (mapping.origin) fd.append("origin", mapping.origin);

      const res = await api.post("/api/leads/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
      setStep(3);
      toast.success(`Imported ${res.data.imported} leads!`);
    } catch {
      toast.error("Import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Upload Leads</h1>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {["Upload CSV", "Map Columns", "Done"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step > i + 1 ? "bg-green-500 text-white" :
              step === i + 1 ? "bg-blue-600 text-white" :
              "bg-gray-200 text-gray-500"
            }`}>
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span className={`text-sm ${step === i + 1 ? "text-gray-900 font-medium" : "text-gray-400"}`}>
              {label}
            </span>
            {i < 2 && <span className="text-gray-300 mx-1">→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: Drop */}
      {step === 1 && (
        <div>
          <FileDropzone onFile={handleFile} />
          {loading && (
            <p className="text-center text-sm text-blue-600 mt-4 animate-pulse">
              Reading CSV…
            </p>
          )}
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 2 && preview && (
        <div>
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
                        <td key={c} className="py-1.5 pr-4 text-gray-700 max-w-[120px] truncate">
                          {row[c]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Map Columns</h2>
            <div className="space-y-3">
              {TARGET_FIELDS.map((tf) => (
                <div key={tf.value} className="flex items-center gap-4">
                  <label className="text-sm text-gray-700 w-44 shrink-0">
                    {tf.label}
                    {tf.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <select
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white"
                    value={mapping[tf.value] || ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [tf.value]: e.target.value || undefined }))
                    }
                  >
                    <option value="">(not mapped)</option>
                    {preview.columns.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep(1); setFile(null); setPreview(null); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={loading || !mapping.mql_id}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? "Importing…" : "Import Leads"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import Complete</h2>
          <div className="grid grid-cols-3 gap-4 my-6 text-center">
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
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">{e}</p>
              ))}
            </div>
          )}
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { setStep(1); setFile(null); setPreview(null); setResult(null); }}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Upload Another
            </button>
            <Link
              to="/pipeline"
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              View Pipeline →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
