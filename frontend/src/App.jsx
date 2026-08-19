import React from "react";
import { ToastProvider } from "./context/ToastContext";
import { AuthProvider } from "./context/AuthContext";
import { CompanyProvider } from "./context/CompanyContext";
import { ProductProvider } from "./context/ProductContext";
import AppRoutes from "./routes/AppRoutes";
import ToastStack from "./components/ui/Toast";

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CompanyProvider>
          <ProductProvider>
            <AppRoutes />
            <ToastStack />
          </ProductProvider>
        </CompanyProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
