import React, { createContext, useContext, useEffect, useState } from "react";
import * as companyService from "../services/companyService";
import { useAuth } from "./AuthContext";

const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { companyId, isAuthenticated } = useAuth();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !companyId) {
      setCompany(null);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    companyService.fetchCompany(companyId).then((data) => {
      if (mounted) {
        setCompany(data);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [companyId, isAuthenticated]);

  const saveCompany = async (changes) => {
    const updated = await companyService.updateCompany(companyId, changes);
    setCompany(updated);
    return updated;
  };

  return (
    <CompanyContext.Provider value={{ company, loading, saveCompany }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany deve ser usado dentro de <CompanyProvider>");
  return ctx;
}
