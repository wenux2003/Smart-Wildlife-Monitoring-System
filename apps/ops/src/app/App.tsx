import { Navigate, Route, Routes } from "react-router-dom";
import { OpsDashboardPage } from "../DashboardPage.js";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Wildlife Guardian Operations</h1>
      </header>
      <Routes>
        <Route path="/" element={<OpsDashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
