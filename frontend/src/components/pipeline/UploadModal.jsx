import { useEffect } from "react";
import Upload from "../../pages/Upload";

export default function UploadModal({ open, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-gray-50 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-200 text-xl leading-none transition-colors"
        >
          &#x2715;
        </button>
        <Upload onDone={onClose} />
      </div>
    </div>
  );
}
