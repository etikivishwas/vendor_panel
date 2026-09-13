import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import DashboardPage from "./pages/DashboardPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import DocumentVerificationPage from "./pages/DocumentVerificationPage.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import GetDocumentsPage from "./pages/GetDocumentsPage.jsx";
import MsmeApplicationPage from "./pages/MsmeApplicationPage.jsx";
import LabourApplicationPage from "./pages/LabourApplicationPage.jsx";
import GstApplicationPage from "./pages/GstApplicationPage.jsx";
import SubscriptionsPage from "./pages/SubscriptionsPage.jsx";
import SubscriptionCheckoutPage from "./pages/SubscriptionCheckoutPage.jsx"
import ApplicationReviewPage from "./pages/ApplicationReviewPage.jsx";
import VerificationPaymentPage from "./pages/VerificationPaymentPage.jsx";

function ProtectedRoute({
  children,
}) {
  const token =
    localStorage.getItem(
      "vendorToken"
    );

  if (!token) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return children;
}

function PlaceholderPage({
  title,
}) {
  return (
    <main
      style={{
        padding: "40px",
      }}
    >
      <h1>{title}</h1>

      <p>
        This page will be implemented
        in the next screen.
      </p>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={<LoginPage />}
      />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/document-verification"
        element={
          <ProtectedRoute>
            <DocumentVerificationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/document-verification/get-documents"
        element={
          <ProtectedRoute>
            <GetDocumentsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/document-verification/get-documents/apply/msme-udyam"
        element={
          <ProtectedRoute>
            <MsmeApplicationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/document-verification/get-documents/apply/labour-registration"
        element={
          <ProtectedRoute>
            <LabourApplicationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/document-verification/get-documents/apply/gst-registration"
        element={
          <ProtectedRoute>
            <GstApplicationPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/document-verification/application-review"
        element={
          <ProtectedRoute>
            <ApplicationReviewPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/document-verification/payment/:token"
        element={
          <ProtectedRoute>
            <VerificationPaymentPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServicesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subscriptions"
        element={
          <ProtectedRoute>
            <SubscriptionsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/subscriptions/checkout/:token"
        element={
          <ProtectedRoute>
            <SubscriptionCheckoutPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <PlaceholderPage title="Settings" />
          </ProtectedRoute>
        }
      />

      <Route
        path="/"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />

      <Route
        path="*"
        element={
          <Navigate
            to="/dashboard"
            replace
          />
        }
      />
    </Routes>
  );
}

export default App;