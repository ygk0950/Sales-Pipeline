import { useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import Pipeline from "./Pipeline";
import Rules from "./Rules";

const SECTIONS = [
  { key: "dashboard", label: "Dashboard", description: "Pipeline health at a glance" },
  { key: "pipeline", label: "Pipeline", description: "Move leads and manage automation" },
  { key: "rules", label: "Rules", description: "Build conditions that advance leads" },
];

function SectionTab({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white shadow-sm"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

export default function Workspace({ initialSection = "dashboard" }) {
  const [activeSection, setActiveSection] = useState(initialSection);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-start">
        <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {SECTIONS.map((section) => (
            <SectionTab
              key={section.key}
              active={activeSection === section.key}
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </SectionTab>
          ))}
        </div>
      </div>

      <section className={activeSection === "dashboard" ? "block" : "hidden"}>
        <Dashboard />
      </section>

      <section className={activeSection === "pipeline" ? "block" : "hidden"}>
        <Pipeline />
      </section>

      <section className={activeSection === "rules" ? "block" : "hidden"}>
        <Rules />
      </section>
    </div>
  );
}
