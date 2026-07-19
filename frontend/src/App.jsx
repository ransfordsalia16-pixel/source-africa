import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import DashboardLayout from "./layouts/DashboardLayout.jsx";
import Welcome from "./pages/Welcome.jsx";
import SignIn from "./pages/SignIn.jsx";
import CreateAccount from "./pages/CreateAccount.jsx";
import AdminSignIn from "./pages/AdminSignIn.jsx";

import BuyerOverview from "./pages/buyer/Overview.jsx";
import BuyerRequests from "./pages/buyer/Requests.jsx";
import BuyerOrders from "./pages/buyer/Orders.jsx";
import BuyerMarketplace from "./pages/buyer/Marketplace.jsx";
import BuyerMessages from "./pages/buyer/Messages.jsx";
import BuyerDisputes from "./pages/buyer/Disputes.jsx";
import BuyerPayments from "./pages/buyer/Payments.jsx";
import BecomeSupplier from "./pages/buyer/BecomeSupplier.jsx";
import BuyerCompanyVerification from "./pages/buyer/CompanyVerification.jsx";

import SupplierOverview from "./pages/supplier/Overview.jsx";
import SupplierProducts from "./pages/supplier/Products.jsx";
import SupplierRequests from "./pages/supplier/Requests.jsx";
import SupplierOrders from "./pages/supplier/Orders.jsx";
import SupplierMessages from "./pages/supplier/Messages.jsx";
import SupplierDisputes from "./pages/supplier/Disputes.jsx";
import SupplierAnalytics from "./pages/supplier/Analytics.jsx";
import SupplierProfile from "./pages/supplier/Profile.jsx";

import AdminOverview from "./pages/admin/Overview.jsx";
import AdminSupplierVerification from "./pages/admin/SupplierVerification.jsx";
import AdminSupplierApplications from "./pages/admin/SupplierApplications.jsx";
import AdminBuyerVerification from "./pages/admin/BuyerVerification.jsx";
import AdminBuyerProfiles from "./pages/admin/BuyerProfiles.jsx";
import AdminPayments from "./pages/admin/Payments.jsx";
import AdminDisputes from "./pages/admin/Disputes.jsx";
import AdminCases from "./pages/admin/Cases.jsx";
import AdminLogistics from "./pages/admin/Logistics.jsx";
import AdminConversations from "./pages/admin/Conversations.jsx";
import AdminSecurity from "./pages/admin/Security.jsx";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/create-account" element={<CreateAccount />} />
            <Route path="/admin-login" element={<AdminSignIn />} />

            <Route
              path="/buyer"
              element={
                <ProtectedRoute role="buyer">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<BuyerOverview />} />
              <Route path="requests" element={<BuyerRequests />} />
              <Route path="orders" element={<BuyerOrders />} />
              <Route path="marketplace" element={<BuyerMarketplace />} />
              <Route path="messages" element={<BuyerMessages />} />
              <Route path="disputes" element={<BuyerDisputes />} />
              <Route path="payments" element={<BuyerPayments />} />
              <Route path="become-supplier" element={<BecomeSupplier />} />
              <Route path="verify-company" element={<BuyerCompanyVerification />} />
            </Route>

            <Route
              path="/supplier"
              element={
                <ProtectedRoute role="supplier">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<SupplierOverview />} />
              <Route path="products" element={<SupplierProducts />} />
              <Route path="requests" element={<SupplierRequests />} />
              <Route path="orders" element={<SupplierOrders />} />
              <Route path="messages" element={<SupplierMessages />} />
              <Route path="disputes" element={<SupplierDisputes />} />
              <Route path="analytics" element={<SupplierAnalytics />} />
              <Route path="profile" element={<SupplierProfile />} />
            </Route>

            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="suppliers" element={<AdminSupplierVerification />} />
              <Route path="supplier-applications" element={<AdminSupplierApplications />} />
              <Route path="buyers" element={<AdminBuyerVerification />} />
              <Route path="buyer-profiles" element={<AdminBuyerProfiles />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="disputes" element={<AdminDisputes />} />
              <Route path="cases" element={<AdminCases />} />
              <Route path="logistics" element={<AdminLogistics />} />
              <Route path="conversations" element={<AdminConversations />} />
              <Route path="security" element={<AdminSecurity />} />
            </Route>

            <Route path="*" element={<Welcome />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
