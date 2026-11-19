import { Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { CompanyBrandingSync } from "@/components/layout/CompanyBrandingSync";
import { AuthBootstrap } from "@/features/auth/AuthBootstrap";
import { LoginPage } from "@/features/auth/LoginPage";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { InvoicingPage } from "@/features/invoicing/InvoicingPage";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { PosPage } from "@/features/pos/PosPage";
import { SecurityPage } from "@/features/security/SecurityPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { NotFoundPage } from "@/features/system/NotFoundPage";

export default function App() {
  return (
    <AuthBootstrap>
      <CompanyBrandingSync />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<OverviewPage />} />
            <Route
              path="pos"
              element={
                <ProtectedRoute requiredPermissions={["pos.operate"]}>
                  <PosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="inventario"
              element={
                <ProtectedRoute requiredPermissions={["inventory.view"]}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="facturacion"
              element={
                <ProtectedRoute requiredPermissions={["invoicing.view"]}>
                  <InvoicingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="configuracion"
              element={
                <ProtectedRoute requiredPermissions={["settings.manage"]}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="seguridad"
              element={
                <ProtectedRoute requiredPermissions={["users.view"]}>
                  <SecurityPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthBootstrap>
  );
}
