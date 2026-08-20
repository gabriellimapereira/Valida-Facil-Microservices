import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Já passou pelo PrivateRoute (está logado), mas ainda falta checar se
// tem empresa vinculada. Sem isso, manda pro onboarding em vez de deixar
// cair nas telas internas (Dashboard/Estoque/Perfil) sem dado nenhum.
export default function RequireCompany() {
  const { needsOnboarding } = useAuth();

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
