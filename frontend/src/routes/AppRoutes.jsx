import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../pages/LoginPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import OnboardingPage from "../pages/OnboardingPage";
import DashboardPage from "../pages/DashboardPage";
import StockPage from "../pages/StockPage";
import ProfilePage from "../pages/ProfilePage";
import NotFoundPage from "../pages/NotFoundPage";
import AppShell from "../components/layout/AppShell";
import PrivateRoute from "./PrivateRoute";
import RequireCompany from "./RequireCompany";
import FullScreenLoader from "../components/ui/FullScreenLoader";
import { useAuth } from "../context/AuthContext";

export default function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loading ? (
            <FullScreenLoader />
          ) : isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Fica fora do PrivateRoute de propósito: o link do e-mail cria uma
         sessão de recuperação temporária, diferente do login normal — não
         faz sentido essa rota exigir "já estar logado" antes. */}
      <Route path="/redefinir-senha" element={<ResetPasswordPage />} />

      <Route element={<PrivateRoute />}>
        {/* /onboarding fica fora do RequireCompany de propósito — é
           justamente a rota que resolve "não ter empresa ainda". */}
        <Route path="/onboarding" element={<OnboardingPage />} />

        <Route element={<RequireCompany />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/estoque" element={<StockPage />} />
            <Route path="/perfil" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
