import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RequireCompany() {
  const { needsOnboarding } = useAuth();

  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
