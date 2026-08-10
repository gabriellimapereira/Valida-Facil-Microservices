import React, { createContext, useContext, useEffect, useState } from "react";
import * as companyService from "../services/companyService";

const CompanyContext = createContext(null);

const DEMO_COMPANY_ID = "company-demo-1";

export function CompanyProvider({ children }) {
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companyService.fetchCompany(DEMO_COMPANY_ID).then((data) => {
      setCompany(data);
      setLoading(false);
    });
  }, []);

  const saveCompany = async (changes) => {
    const updated = await companyService.updateCompany(DEMO_COMPANY_ID, changes);
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
