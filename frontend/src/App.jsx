import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Workspace from "./pages/Workspace";
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
            <Route index element={<Workspace initialSection="dashboard" />} />
            <Route path="pipeline" element={<Workspace initialSection="pipeline" />} />
            <Route path="upload" element={<Workspace initialSection="upload" />} />
            <Route path="rules" element={<Workspace initialSection="rules" />} />
            <Route path="leads/:id" element={<LeadDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
