import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

const toMonthValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const createLastSixMonths = () => {
  const today = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - index,
      1
    );

    return {
      value: toMonthValue(date),
      label: new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
      }).format(date),
    };
  });
};

function DashboardPage() {
  const navigate = useNavigate();

  const periodOptions = useMemo(
    () => [
      { value: "total", label: "Total" },
      ...createLastSixMonths(),
    ],
    []
  );

  const [selectedPeriod, setSelectedPeriod] = useState(() =>
    toMonthValue(new Date())
  );
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(
    async (period, { initial = false } = {}) => {
      const validPeriod = periodOptions.some(
        (option) => option.value === period
      );

      if (!validPeriod) {
        setError(
          "Please select Total or a month from the last six months."
        );
        return;
      }

      try {
        if (initial) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const response = await apiClient.get("/vendor/dashboard", {
          params: { period },
        });

        if (!response?.data?.success) {
          throw new Error(
            response?.data?.message || "Unable to load dashboard"
          );
        }

        setDashboard(response.data.data);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load dashboard"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [periodOptions]
  );

  useEffect(() => {
    loadDashboard(selectedPeriod, {
      initial: !dashboard,
    });
  }, [selectedPeriod, loadDashboard]);

  const handlePeriodChange = (event) => {
    const nextPeriod = event.target.value;
    const validPeriod = periodOptions.some(
      (option) => option.value === nextPeriod
    );

    if (!validPeriod || nextPeriod === selectedPeriod) {
      return;
    }

    setSelectedPeriod(nextPeriod);
  };

  if (loading && !dashboard) {
    return <div className="page-state">Loading dashboard...</div>;
  }

  if (error && !dashboard) {
    return (
      <div className="page-state error-state">
        <p>{error}</p>
        <button
          type="button"
          onClick={() =>
            loadDashboard(selectedPeriod, { initial: true })
          }
        >
          <RefreshCcw size={16} />
          Try again
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const {
    vendor,
    summary,
    subscription,
    verification,
    leadActivity,
    recentLeads,
    selectedPeriod: dashboardPeriod,
  } = dashboard;

  const selectedPeriodLabel =
    dashboardPeriod?.label ||
    periodOptions.find(
      (option) => option.value === selectedPeriod
    )?.label ||
    "Selected period";

  const isTotalPeriod =
    dashboardPeriod?.type === "total" || selectedPeriod === "total";

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar vendor={vendor} />

        <main
          className={`dashboard-content ${
            refreshing ? "dashboard-refreshing" : ""
          }`}
          aria-busy={refreshing}
        >
          <div className="dashboard-title-row">
            <div>
              <h1>Dashboard Overview</h1>
              <p>
                Welcome back, {vendor.businessName}. Showing{" "}
                <strong>
                  {isTotalPeriod
                    ? "all-time activity"
                    : `activity for ${selectedPeriodLabel}`}
                </strong>
                .
              </p>
            </div>

            <label className="period-selector">
              <CalendarDays size={17} />
              <span className="sr-only">Select dashboard period</span>
              <select
                value={selectedPeriod}
                onChange={handlePeriodChange}
                disabled={refreshing}
                aria-label="Select dashboard period"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {refreshing && (
                <RefreshCcw
                  className="period-spinner"
                  size={15}
                  aria-hidden="true"
                />
              )}
            </label>
          </div>

          {error && (
            <div className="dashboard-inline-error" role="alert">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => loadDashboard(selectedPeriod)}
                disabled={refreshing}
              >
                Try again
              </button>
            </div>
          )}

          <section className="dashboard-grid">
            <div className="main-column">
              <div className="summary-grid">
                <SummaryCard
                  title={isTotalPeriod ? "Total Leads" : "Leads"}
                  value={summary.totalLeads}
                  icon={Users}
                  helper={
                    isTotalPeriod
                      ? `${summary.totalLeads} leads overall`
                      : `${summary.selectedMonthLeads} in ${selectedPeriodLabel}`
                  }
                />

                <SummaryCard
                  title={
                    isTotalPeriod ? "Total Profile Views" : "Profile Views"
                  }
                  value={summary.profileViews}
                  icon={Eye}
                  helper={
                    isTotalPeriod
                      ? `${summary.profileViews} profile views overall`
                      : `${summary.selectedMonthViews} in ${selectedPeriodLabel}`
                  }
                />

                <SummaryCard
                  title="Average Rating"
                  value={Number(summary.averageRating || 0).toFixed(1)}
                  suffix="/5"
                  icon={Star}
                  helper={
                    isTotalPeriod
                      ? `Based on ${summary.reviewCount} reviews overall`
                      : `Based on ${summary.reviewCount} reviews in ${selectedPeriodLabel}`
                  }
                  onClick={() => navigate("/reviews")}
                  ariaLabel="Open all customer reviews"
                />
              </div>

              <LeadActivityChart
                data={leadActivity}
                title={
                  isTotalPeriod
                    ? "Lead Activity — All Time"
                    : `Lead Activity — ${selectedPeriodLabel}`
                }
              />

              <RecentLeads
                leads={recentLeads}
                title={
                  isTotalPeriod
                    ? "All Leads"
                    : `Recent Leads — ${selectedPeriodLabel}`
                }
                selectedMonthLabel={selectedPeriodLabel}
                emptyMessage={
                  isTotalPeriod
                    ? "There are no leads available for this vendor."
                    : `There are no recent leads in ${selectedPeriodLabel}.`
                }
              />
            </div>

            <aside className="right-column">
              <article className="subscription-card">
                <div className="subscription-heading">
                  <span>Active Plan</span>
                  <strong>Featured</strong>
                </div>

                <h2>{subscription?.planName || "No Active Plan"}</h2>
                <p>
                  {subscription
                    ? `Expires in ${subscription.daysRemaining} days`
                    : "Choose a subscription plan"}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/subscriptions")}
                >
                  {subscription ? "Renew Now" : "View Plans"}
                </button>
              </article>

              <article className="panel quick-actions">
                <h2>Quick Actions</h2>
                <button type="button" onClick={() => navigate("/services")}>
                  <span className="quick-icon"><Wrench size={18} /></span>
                  <span>
                    <strong>Update Services</strong>
                    <small>Manage offerings &amp; pricing</small>
                  </span>
                  <b>›</b>
                </button>

                <button type="button" onClick={() => navigate("/profile")}>
                  <span className="quick-icon"><Eye size={18} /></span>
                  <span>
                    <strong>View Public Profile</strong>
                    <small>See what customers see</small>
                  </span>
                  <b>›</b>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/subscriptions")}
                >
                  <span className="quick-icon"><RefreshCcw size={18} /></span>
                  <span>
                    <strong>Renew Subscription</strong>
                    <small>Maintain premium status</small>
                  </span>
                  <b>›</b>
                </button>
              </article>

              <article className="verification-card">
                <span className="verification-icon"><Star size={18} /></span>
                <h2>
                  {verification.status === "verified"
                    ? "Tedo Verified"
                    : "Verification Pending"}
                </h2>
                <p>
                  Your background check and license verification status
                  increase trust in your public profile.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    verification.status === "verified"
                      ? navigate("/document-verification/application-review")
                      : navigate("/document-verification")
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
