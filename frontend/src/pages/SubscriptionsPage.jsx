import { Check, Crown, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createSubscriptionCheckout,
  getSubscriptions,
} from "../api/subscriptionApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/subscriptions.css";

const normalize = (value) => String(value || "").trim().toLowerCase();
const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

function SubscriptionsPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingPlanId, setCreatingPlanId] = useState(null);
  const [error, setError] = useState("");

  const vendor = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("vendor") || "{}"); }
    catch { return {}; }
  }, []);

  const featureRows = useMemo(() => {
    const rows = new Map();
    plans.forEach((plan) =>
      (plan.features || []).forEach((feature) => {
        if (!rows.has(feature.key)) rows.set(feature.key, feature);
      })
    );
    return Array.from(rows.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [plans]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSubscriptions();
        const uniquePlans = Array.from(
          new Map((data.plans || []).map((plan) => [normalize(plan.name), plan])).values()
        ).sort((a, b) => a.sortOrder - b.sortOrder);
        setPlans(uniquePlans);
        setCurrentSubscription(data.currentSubscription || null);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load subscription plans");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const isCurrent = (plan) =>
    normalize(currentSubscription?.planName) === normalize(plan.name);

  const getFeatureValue = (plan, key) =>
    (plan.features || []).find((feature) => feature.key === key)?.value || "-";

  const choosePlan = async (plan) => {
    setCreatingPlanId(plan.id);
    setError("");
    try {
      const response = await createSubscriptionCheckout(plan.id);
      navigate(`/subscriptions/checkout/${response.data.checkoutToken}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to start checkout");
    } finally {
      setCreatingPlanId(null);
    }
  };

  if (loading) {
    return <div className="dashboard-shell"><Sidebar /><div className="dashboard-main subscriptions-loading"><LoaderCircle className="subscriptions-spinner" size={30} /> Loading subscription plans...</div></div>;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <Topbar vendor={vendor} />
        <main className="subscriptions-content">
          <header className="subscriptions-heading">
            <span><Crown size={18} /> Plans and pricing</span>
            <h1>Compare Plan Benefits</h1>
            <p>Choose the right plan to expand your reach and grow your service business with Tedo Bizz.</p>
          </header>

          {currentSubscription && (
            <section className="current-plan-banner">
              <div className="current-plan-icon"><ShieldCheck size={24} /></div>
              <div>
                <small>Your active subscription</small>
                <strong>{currentSubscription.planName} Plan</strong>
                <span>Active until {new Date(currentSubscription.expiryDate).toLocaleDateString("en-IN")}</span>
              </div>
            </section>
          )}

          {error && <div className="subscriptions-alert error">{error}</div>}

          <section className="plans-table-shell">
            <div
              className="plans-comparison-grid"
              style={{ gridTemplateColumns: `minmax(190px, 1.15fr) repeat(${plans.length}, minmax(165px, 1fr))` }}
            >
              <div className="feature-heading sticky-cell">Features</div>

              {plans.map((plan) => {
                const current = isCurrent(plan);
                return (
                  <div className={`plan-heading ${plan.featured ? "featured" : ""} ${current ? "current-plan-column" : ""}`} key={normalize(plan.name)}>
                    {plan.featured && <span className="recommended-label">Recommended</span>}
                    {current && <span className="current-label"><Check size={12} /> Your Plan</span>}
                    <strong>{plan.name}</strong>
                    <div><b>{formatPrice(plan.price)}</b><small>/month</small></div>
                    {current && <em>Currently active</em>}
                  </div>
                );
              })}

              {featureRows.map((feature) => (
                <FeatureRow key={feature.key} feature={feature} plans={plans} currentSubscription={currentSubscription} getFeatureValue={getFeatureValue} />
              ))}

              <div className="select-row-label sticky-cell" />
              {plans.map((plan) => {
                const current = isCurrent(plan);
                return (
                  <div className={`plan-select-cell ${plan.featured ? "featured" : ""} ${current ? "current-plan-column" : ""}`} key={`select-${normalize(plan.name)}`}>
                    <button
                      type="button"
                      className={`${plan.featured ? "featured-button" : ""} ${current ? "current-plan-button" : ""}`}
                      disabled={current || creatingPlanId === plan.id}
                      onClick={() => choosePlan(plan)}
                    >
                      {creatingPlanId === plan.id ? <><LoaderCircle className="subscriptions-spinner" size={16} /> Preparing...</> : current ? <><Check size={16} /> Your Current Plan</> : plan.featured ? "Choose Professional" : "Choose Plan"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

function FeatureRow({ feature, plans, currentSubscription, getFeatureValue }) {
  return (
    <>
      <div className="feature-label sticky-cell">{feature.label}</div>
      {plans.map((plan) => {
        const value = String(getFeatureValue(plan, feature.key));
        const normalizedValue = value.toLowerCase();
        const current = normalize(currentSubscription?.planName) === normalize(plan.name);
        return (
          <div className={`feature-value ${plan.featured ? "featured" : ""} ${current ? "current-plan-column" : ""}`} key={`${normalize(plan.name)}-${feature.key}`}>
            {normalizedValue === "yes" ? <span className="feature-check"><Check size={15} /></span> : normalizedValue === "no" ? <span className="feature-empty">Not included</span> : value}
          </div>
        );
      })}
    </>
  );
}

export default SubscriptionsPage;
