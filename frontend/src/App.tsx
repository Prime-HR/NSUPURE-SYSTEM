import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.tsx";
import { OfflineProvider } from "./context/OfflineContext.tsx";
import { AppShell } from "./components/layout/AppShell.tsx";

import { LoginPage } from "./pages/auth/LoginPage.tsx";
import { DashboardPage } from "./pages/dashboard/DashboardPage.tsx";
import { FastSalesPage } from "./pages/sales/FastSalesPage.tsx";
import { CustomersPage } from "./pages/customers/CustomersPage.tsx";
import { ProductionPage } from "./pages/production/ProductionPage.tsx";
import { DeliveriesPage } from "./pages/deliveries/DeliveriesPage.tsx";
import { FinancePage } from "./pages/finance/FinancePage.tsx";
import { InventoryPage } from "./pages/inventory/InventoryPage.tsx";
import { FleetPage } from "./pages/fleet/FleetPage.tsx";
import { StaffPage } from "./pages/staff/StaffPage.tsx";
import { AssetsPage } from "./pages/assets/AssetsPage.tsx";
import { QualityPage } from "./pages/quality/QualityPage.tsx";
import { DocumentsPage } from "./pages/documents/DocumentsPage.tsx";
import { OrdersPage } from "./pages/orders/OrdersPage.tsx";
import { ReportsPage } from "./pages/reports/ReportsPage.tsx";
import { SetupWizardPage } from "./pages/wizard/SetupWizardPage.tsx";
import { SearchPage } from "./pages/search/SearchPage.tsx";

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }

  return <AppShell>{children}</AppShell>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <OfflineProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "SALES", "FINANCE"]}>
                  <FastSalesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "SALES", "FINANCE"]}>
                  <CustomersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR", "INVENTORY"]}>
                  <ProductionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/deliveries"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "DRIVER", "SALES"]}>
                  <DeliveriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE"]}>
                  <FinancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/inventory"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR", "INVENTORY", "FINANCE"]}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fleet"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "DRIVER"]}>
                  <FleetPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE"]}>
                  <StaffPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assets"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "FINANCE"]}>
                  <AssetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quality"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "PRODUCTION_SUPERVISOR"]}>
                  <QualityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/documents"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER"]}>
                  <DocumentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "SALES", "FINANCE"]}>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR", "MANAGER", "FINANCE", "VIEWER"]}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wizard"
              element={
                <ProtectedRoute roles={["OWNER", "ADMINISTRATOR"]}>
                  <SetupWizardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </OfflineProvider>
    </AuthProvider>
  );
};
