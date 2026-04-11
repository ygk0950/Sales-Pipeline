import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import Upload from "./pages/Upload";
import LeadDetail from "./pages/LeadDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="pipeline" element={<Pipeline />} />
            <Route path="upload" element={<Navigate to="/pipeline" replace />} />
            <Route path="rules" element={<Navigate to="/pipeline" replace />} />
            <Route path="leads/:id" element={<LeadDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
