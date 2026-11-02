import { Navigate, Outlet, Route, Routes } from "react-router";
import AuthLayout from "./components/AuthLayout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import RankingsPage from "./pages/RankingsPage";
import AnalysisPage from "./pages/AnalysisPage";
import InspirationPage from "./pages/InspirationPage";
import IncomePage from "./pages/IncomePage";

function Workspace() {
  return <AuthLayout><Outlet /></AuthLayout>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Workspace />}>
        <Route path="/" element={<Navigate to="/rankings" replace />} />
        <Route path="/rankings" element={<RankingsPage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/inspiration" element={<InspirationPage />} />
        <Route path="/income" element={<IncomePage />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
