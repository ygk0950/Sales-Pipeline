import { useEffect, useRef } from "react";
import RuleForm from "../RuleForm";

export default function RuleDrawer({ open, onClose, initial, targetStageId, targetStageName, stages, fieldValues, availableFields, onSave }) {
  const panelRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const title = initial
    ? `Edit Rule`
    : `New Rule for ${targetStageName || "Stage"}`;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-[480px] max-w-full h-full bg-white shadow-2xl flex flex-col drawer-slide"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
            {targetStageName && !initial && (
              <p className="text-xs text-gray-400 mt-0.5">
                Matched leads will advance to <span className="font-semibold text-blue-600">{targetStageName}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <RuleForm
            key={initial?.id || targetStageId || "new"}
            initial={initial}
            stages={stages}
            fieldValues={fieldValues}
            availableFields={availableFields}
            onSave={onSave}
            onCancel={onClose}
            lockedTargetStageId={!initial ? targetStageId : null}
          />
        </div>
      </div>
    </div>
  );
}
