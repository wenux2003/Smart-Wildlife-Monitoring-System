import { Navigate, Route, Routes } from "react-router-dom";
import { RangerHomePage } from "../HomePage.js";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Wildlife Guardian Ranger</h1>
      </header>
      <Routes>
        <Route path="/" element={<RangerHomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}
