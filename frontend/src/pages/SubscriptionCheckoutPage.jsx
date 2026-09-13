import { CreditCard, LoaderCircle, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getSubscriptionCheckout,
  updateCheckoutPaymentMethod,
} from "../api/subscriptionApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/subscriptionCheckout.css";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value);

function SubscriptionCheckoutPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [checkout, setCheckout] = useState(null);
  const [method, setMethod] = useState("upi");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  const vendor = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("vendor") || "{}"); }
    catch { return {}; }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getSubscriptionCheckout(token);
        setCheckout(data);
        setMethod(data.paymentMethod || "upi");
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load checkout");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const selectMethod = async (nextMethod) => {
    setMethod(nextMethod);
    setUpdating(true);
    setError("");
    try {
      await updateCheckoutPaymentMethod(token, nextMethod);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update payment method");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="dashboard-shell"><Sidebar /><div className="dashboard-main checkout-loading"><LoaderCircle className="checkout-spinner" size={30} /> Loading checkout...</div></div>;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <Topbar vendor={vendor} />
        <main className="checkout-content">
          <header className="checkout-header">
            <button type="button" onClick={() => navigate("/subscriptions")}>Back to plans</button>
            <h1>Complete Payment</h1>
            <p>Securely complete your subscription upgrade.</p>
          </header>

          {error && <div className="checkout-alert">{error}</div>}

          {checkout && (
            <div className="checkout-layout">
              <div className="checkout-left-column">
                <section className="checkout-card selected-plan-card">
                  <span className="selected-plan-label"><ShieldCheck size={14} /> Selected Plan</span>
                  <div className="selected-plan-title">
                    <div><h2>{checkout.plan.name}</h2><p>{checkout.plan.description}</p></div>
                    <strong>{formatMoney(checkout.subtotal)}<small> per month</small></strong>
                  </div>
                  <div className="price-line"><span>Subtotal</span><b>{formatMoney(checkout.subtotal)}</b></div>
                  <div className="price-line"><span>GST ({checkout.taxRate}%)</span><b>{formatMoney(checkout.taxAmount)}</b></div>
                  <div className="price-total"><span>Total Amount</span><strong>{formatMoney(checkout.totalAmount)}</strong></div>
                </section>

                <section className="checkout-card payment-method-card">
                  <h2>Select Payment Method</h2>
                  <button className={method === "card" ? "selected" : ""} type="button" onClick={() => selectMethod("card")}>
                    <span className="method-icon card"><CreditCard size={20} /></span>
                    <span><strong>Pay via Card</strong><small>Credit and debit cards accepted</small></span>
                    <i />
                  </button>
                  <button className={method === "upi" ? "selected" : ""} type="button" onClick={() => selectMethod("upi")}>
                    <span className="method-icon upi"><QrCode size={20} /></span>
                    <span><strong>UPI / QR Code</strong><small>GPay, PhonePe, Paytm and more</small></span>
                    <i />
                  </button>
                </section>
              </div>

              <section className="checkout-card scan-card">
                <h2>{method === "upi" ? "Scan to Pay" : "Pay Securely by Card"}</h2>
                <p>{method === "upi" ? `Use any UPI app to scan and complete your payment of ${formatMoney(checkout.totalAmount)}.` : "Card payment will open in the Razorpay secure checkout window."}</p>
                <div className="qr-placeholder">
                  {method === "upi" ? <><QrCode size={92} /><span>Razorpay QR will appear here</span></> : <><CreditCard size={82} /><span>Razorpay card form will open here</span></>}
                </div>
                {method === "upi" && <><div className="open-with"><span />OR OPEN WITH<span /></div><div className="upi-apps"><button type="button">GPay</button><button type="button">PhonePe</button><button type="button">Paytm</button></div></>}
                <button className="verify-payment-button" type="button" disabled title="Razorpay integration will be added next">
                  {updating ? <LoaderCircle className="checkout-spinner" size={17} /> : <ShieldCheck size={17} />}
                  Proceed to Razorpay
                </button>
                <small className="secure-note"><LockKeyhole size={12} /> 100% Secure &amp; Encrypted</small>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default SubscriptionCheckoutPage;
