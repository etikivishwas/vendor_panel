import { CreditCard, LoaderCircle, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getSubscriptionCheckout,
  updateCheckoutPaymentMethod,
} from "../api/subscriptionApi";
import {
  createSubscriptionRazorpayOrder,
  verifySubscriptionRazorpayPayment,
} from "../api/razorpayPaymentApi";
import { loadRazorpayCheckout } from "../utils/loadRazorpay";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/subscriptionCheckout.css";
import "../styles/razorpayPaymentAdditions.css";

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
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  const startRazorpayPayment = async () => {
    setPaying(true);
    setError("");
    setSuccess("");

    try {
      await loadRazorpayCheckout();
      const order = await createSubscriptionRazorpayOrder(token);

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#071f32" },
        modal: {
          ondismiss: () => setPaying(false),
        },
        handler: async (response) => {
          try {
            await verifySubscriptionRazorpayPayment(token, response);
            setSuccess("Payment completed and subscription activated successfully.");
            setCheckout((previous) => previous ? { ...previous, status: "paid" } : previous);
          } catch (requestError) {
            setError(requestError.response?.data?.message || "Payment verification failed");
          } finally {
            setPaying(false);
          }
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", (response) => {
        setError(response.error?.description || "Payment failed. Please try again.");
        setPaying(false);
      });
      razorpay.open();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || "Unable to start payment");
      setPaying(false);
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
          {success && <div className="razorpay-success-alert">{success}</div>}

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
                  <button className={method === "card" ? "selected" : ""} type="button" onClick={() => selectMethod("card")} disabled={updating || paying}>
                    <span className="method-icon card"><CreditCard size={20} /></span>
                    <span><strong>Pay via Card</strong><small>Credit and debit cards accepted</small></span>
                    <i />
                  </button>
                  <button className={method === "upi" ? "selected" : ""} type="button" onClick={() => selectMethod("upi")} disabled={updating || paying}>
                    <span className="method-icon upi"><QrCode size={20} /></span>
                    <span><strong>UPI / QR Code</strong><small>GPay, PhonePe, Paytm and more</small></span>
                    <i />
                  </button>
                </section>
              </div>

              <section className="checkout-card scan-card">
                <h2>{method === "upi" ? "Pay with UPI" : "Pay Securely by Card"}</h2>
                <p>{method === "upi" ? `Razorpay Checkout will show available UPI options for ${formatMoney(checkout.totalAmount)}.` : "Card payment opens in the Razorpay secure checkout window."}</p>
                <div className="qr-placeholder">
                  {method === "upi" ? <><QrCode size={92} /><span>UPI options open in Razorpay Checkout</span></> : <><CreditCard size={82} /><span>Card form opens in Razorpay Checkout</span></>}
                </div>
                <button className="verify-payment-button" type="button" onClick={startRazorpayPayment} disabled={updating || paying || checkout.status === "paid"}>
                  {paying || updating ? <LoaderCircle className="checkout-spinner" size={17} /> : <ShieldCheck size={17} />}
                  {checkout.status === "paid" ? "Payment Completed" : paying ? "Opening Razorpay..." : "Proceed to Razorpay"}
                </button>
                <small className="secure-note"><LockKeyhole size={12} /> Payment processed securely by Razorpay</small>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default SubscriptionCheckoutPage;
