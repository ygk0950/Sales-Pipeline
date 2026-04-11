import { NavLink, Outlet } from "react-router-dom";

function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}
function IconPipeline() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="3" /><circle cx="19" cy="12" r="3" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

const nav = [
  { to: "/", label: "Dashboard", Icon: IconDashboard },
  { to: "/pipeline", label: "Pipeline", Icon: IconPipeline },
];

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="px-5 py-4 border-b border-gray-200">
          <span className="text-xl font-bold text-blue-600">FlowCRM</span>
          <p className="text-xs text-gray-400 mt-0.5">Sales Pipeline</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-400">MVP v1.0</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
