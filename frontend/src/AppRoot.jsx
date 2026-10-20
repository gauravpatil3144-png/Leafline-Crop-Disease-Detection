import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import WorkspaceLayout from "./layouts/WorkspaceLayout.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import HistoryPage from "./pages/HistoryPage.jsx";
import LandingPage from "./pages/LandingPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import ScannerPage from "./pages/ScannerPage.jsx";

export default function AppRoot() {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("leafline_user") || "null"),
  );
  const onAuth = (result) => {
    localStorage.setItem("leafline_token", result.token);
    localStorage.setItem("leafline_user", JSON.stringify(result.user));
    setUser(result.user);
  };
  const logout = () => {
    localStorage.removeItem("leafline_token");
    localStorage.removeItem("leafline_user");
    setUser(null);
  };
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage mode="login" onAuth={onAuth} />
            )
          }
        />
        <Route
          path="/register"
          element={
            user ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <AuthPage mode="register" onAuth={onAuth} />
            )
          }
        />
        <Route
          element={
            user ? (
              <WorkspaceLayout user={user} logout={logout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="/dashboard" element={<DashboardPage user={user} />} />
          <Route path="/scanner" element={<ScannerPage />} />
          <Route path="/result/:id" element={<ResultPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route
            path="/profile"
            element={<ProfilePage user={user} onUpdateUser={setUser} />}
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
