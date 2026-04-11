import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const location = useLocation();
  const isLeadDetail = location.pathname.startsWith("/leads/");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4 shrink-0">
        <div>
          <span className="text-xl font-bold text-blue-600">FlowCRM</span>
          <p className="text-xs text-gray-400 mt-0.5">Sales Pipeline</p>
        </div>

        {isLeadDetail ? (
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Back to workspace
          </Link>
        ) : null}
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
