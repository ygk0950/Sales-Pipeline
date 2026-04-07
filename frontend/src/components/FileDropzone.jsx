import { useRef, useState } from "react";

export default function FileDropzone({ onFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file) {
    if (file && file.name.endsWith(".csv")) {
      onFile(file);
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        dragging
          ? "border-blue-400 bg-blue-50"
          : "border-gray-300 hover:border-blue-300 hover:bg-gray-50"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files[0]);
      }}
    >
      <div className="text-4xl mb-3">📂</div>
      <p className="text-sm font-medium text-gray-700">Drop your CSV here or click to browse</p>
      <p className="text-xs text-gray-400 mt-1">Only .csv files supported</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
