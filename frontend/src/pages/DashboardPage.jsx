import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Eye,
  RefreshCcw,
  Star,
  Users,
  Wrench,
} from "lucide-react";

import apiClient from "../api/apiClient";
import LeadActivityChart from "../components/LeadActivityChart";
import RecentLeads from "../components/RecentLeads";
import Sidebar from "../components/Sidebar";
import SummaryCard from "../components/SummaryCard";
import Topbar from "../components/Topbar";

import "../styles/dashboard.css";

function DashboardPage() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await apiClient.get(
          "/vendor/dashboard"
        );

        setDashboard(response.data.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load dashboard"
        );
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="page-state">
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-state error-state">
        {error}
      </div>
    );
  }

  const {
    vendor,
    summary,
    subscription,
    verification,
    leadActivity,
    recentLeads,
  } = dashboard;

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar vendor={vendor} />

        <main className="dashboard-content">
          <div className="dashboard-title-row">
            <div>
              <h1>Dashboard Overview</h1>

              <p>
                Welcome back, {vendor.businessName}.
                Here&apos;s what&apos;s happening today.
              </p>
            </div>

            <button
              className="period-button"
              type="button"
            >
              <CalendarDays size={17} />
              This Month
            </button>
          </div>

          <section className="dashboard-grid">
            <div className="main-column">
              <div className="summary-grid">
                <SummaryCard
                  title="Total Leads"
                  value={summary.totalLeads}
                  icon={Users}
                  helper={`↗ ${summary.currentMonthLeads} this month`}
                />

                <SummaryCard
                  title="Profile Views"
                  value={summary.profileViews}
                  icon={Eye}
                  helper={`↗ ${summary.currentMonthViews} this month`}
                />

                <SummaryCard
                  title="Average Rating"
                  value={summary.averageRating.toFixed(1)}
                  suffix="/5"
                  icon={Star}
                  helper={`Based on ${summary.reviewCount} reviews`}
                />
              </div>

              <LeadActivityChart data={leadActivity} />

              <RecentLeads leads={recentLeads} />
            </div>

            <aside className="right-column">
              <article className="subscription-card">
                <div className="subscription-heading">
                  <span>Active Plan</span>
                  <strong>Featured</strong>
                </div>

                <h2>
                  {subscription?.planName ||
                    "No Active Plan"}
                </h2>

                <p>
                  {subscription
                    ? `Expires in ${subscription.daysRemaining} days`
                    : "Choose a subscription plan"}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/subscriptions")
                  }
                >
                  {subscription
                    ? "Renew Now"
                    : "View Plans"}
                </button>
              </article>

              <article className="panel quick-actions">
                <h2>Quick Actions</h2>

                <button
                  type="button"
                  onClick={() => navigate("/services")}
                >
                  <span className="quick-icon">
                    <Wrench size={18} />
                  </span>

                  <span>
                    <strong>Update Services</strong>

                    <small>
                      Manage offerings &amp; pricing
                    </small>
                  </span>

                  <b>›</b>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                >
                  <span className="quick-icon">
                    <Eye size={18} />
                  </span>

                  <span>
                    <strong>
                      View Public Profile
                    </strong>

                    <small>
                      See what customers see
                    </small>
                  </span>

                  <b>›</b>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/subscriptions")
                  }
                >
                  <span className="quick-icon">
                    <RefreshCcw size={18} />
                  </span>

                  <span>
                    <strong>
                      Renew Subscription
                    </strong>

                    <small>
                      Maintain premium status
                    </small>
                  </span>

                  <b>›</b>
                </button>
              </article>

              <article className="verification-card">
                <span className="verification-icon">
                  <Star size={18} />
                </span>

                <h2>
                  {verification.status === "verified"
                    ? "Tedo Verified"
                    : "Verification Pending"}
                </h2>

                <p>
                  Your background check and license
                  verification status increase trust in
                  your public profile.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    verification.status === "verified"
                      ? navigate(
                          "/document-verification/application-review"
                        )
                      : navigate(
                          "/document-verification"
                        )
                  }
                >
                  {verification.status === "verified"
                    ? "View Certificate"
                    : "Complete Verification"}
                </button>
              </article>
            </aside>
          </section>
        </main>
      </div>
    </div>
  );
}

export default DashboardPage;