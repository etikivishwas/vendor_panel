import {
  Building2,
  CreditCard,
  Landmark,
  LoaderCircle,
  LockKeyhole,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getVerificationPayment,
  saveVerificationPaymentPreference,
} from "../api/verificationPaymentApi";
import {
  createVerificationRazorpayOrder,
  verifyVerificationRazorpayPayment,
} from "../api/razorpayPaymentApi";
import { loadRazorpayCheckout } from "../utils/loadRazorpay";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/verificationPayment.css";
import "../styles/razorpayPaymentAdditions.css";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value || 0);

const methods = [
  { key: "upi", title: "UPI", description: "Pay using available UPI options in Razorpay.", icon: QrCode },
  { key: "card", title: "Credit / Debit Card", description: "Visa, Mastercard and RuPay accepted.", icon: CreditCard },
  { key: "net_banking", title: "Net Banking", description: "Supported Indian banks are shown by Razorpay.", icon: Landmark },
];

function VerificationPaymentPage() {
  const { token } = useParams();
  const [payment, setPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const vendor = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("vendor") || "{}"); }
    catch { return {}; }
  }, []);

  useEffect(() => {
    const loadPayment = async () => {
      try {
        const data = await getVerificationPayment(token);
        setPayment(data);
        setPaymentMethod(data.paymentMethod || "upi");
        setUpiId(data.upiId || "");
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load payment details");
      } finally {
        setLoading(false);
      }
    };
    loadPayment();
  }, [token]);

  const selectMethod = async (nextMethod) => {
    setPaymentMethod(nextMethod);
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await saveVerificationPaymentPreference(token, nextMethod, nextMethod === "upi" ? upiId : "");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save payment method");
    } finally {
      setSaving(false);
    }
  };

  const startRazorpayPayment = async () => {
    setPaying(true);
    setError("");
    setSuccess("");
    try {
      await saveVerificationPaymentPreference(token, paymentMethod, paymentMethod === "upi" ? upiId : "");
      await loadRazorpayCheckout();
      const order = await createVerificationRazorpayOrder(token);

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#071f32" },
        modal: { ondismiss: () => setPaying(false) },
        handler: async (response) => {
          try {
            await verifyVerificationRazorpayPayment(token, response);
            setSuccess("Payment completed. Your verification is now pending review.");
            setPayment((previous) => previous ? { ...previous, status: "paid" } : previous);
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
    return <div className="dashboard-shell"><Sidebar /><div className="dashboard-main verification-payment-loading"><LoaderCircle className="verification-payment-spinner" size={30} /> Loading payment details...</div></div>;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar forceActivePath="/subscriptions" />
      <div className="dashboard-main">
        <Topbar vendor={vendor} />
        <main className="verification-payment-content">
          <header className="verification-payment-header">
            <h1>Complete Payment</h1>
            <p>Securely process your vendor verification payment.</p>
          </header>

          {error && <div className="verification-payment-alert error">{error}</div>}
          {success && <div className="verification-payment-alert success">{success}</div>}

          {payment && (
            <div className="verification-payment-layout">
              <section className="payment-method-area">
                <article className="verification-payment-card method-card">
                  <header><CreditCard size={20} /><h2>Select Payment Method</h2></header>
                  <div className="payment-method-list">
                    {methods.map((method) => {
                      const Icon = method.icon;
                      const selected = paymentMethod === method.key;
                      return (
                        <button className={selected ? "selected" : ""} type="button" onClick={() => selectMethod(method.key)} key={method.key} disabled={saving || paying}>
                          <span className="payment-radio">{selected && <span />}</span>
                          <span className="payment-method-copy"><strong>{method.title}</strong><small>{method.description}</small></span>
                          <Icon size={20} />
                        </button>
                      );
                    })}
                  </div>
                </article>

                {paymentMethod === "upi" && (
                  <article className="verification-payment-card upi-card">
                    <header><QrCode size={20} /><h2>UPI Details</h2></header>
                    <div className="upi-entry-row">
                      <input type="text" value={upiId} onChange={(event) => { setUpiId(event.target.value.toLowerCase()); setError(""); setSuccess(""); }} placeholder="Optional: example@okhdfcbank" maxLength={120} />
                      <button type="button" onClick={() => selectMethod("upi")} disabled={saving || paying}>
                        {saving ? <LoaderCircle className="verification-payment-spinner" size={16} /> : "Save"}
                      </button>
                    </div>
                    <small className="razorpay-method-note">Razorpay Checkout displays the available UPI flow. A typed UPI ID is stored only as your preference.</small>
                  </article>
                )}

                {paymentMethod !== "upi" && (
                  <article className="verification-payment-card gateway-card">
                    <Building2 size={25} />
                    <div><h2>{paymentMethod === "card" ? "Card Payment" : "Net Banking"}</h2><p>The secure payment form opens in Razorpay Checkout.</p></div>
                    <button type="button" onClick={() => selectMethod(paymentMethod)} disabled={saving || paying}>Save Method</button>
                  </article>
                )}
              </section>

              <aside className="verification-order-card">
                <h2>Order Summary</h2>
                <div className="order-certificate"><ShieldCheck size={20} /><div><strong>{payment.serviceLevel}</strong><small>{payment.validityPeriod}</small></div></div>
                <div className="order-line"><span>Registration Fee</span><strong>{formatMoney(payment.registrationFee)}</strong></div>
                <div className="order-line"><span>Verification Processing</span><strong>{formatMoney(payment.processingFee)}</strong></div>
                <div className="order-subtotal"><span>Subtotal</span><strong>{formatMoney(payment.taxableAmount)}</strong></div>
                <div className="order-line"><span>GST ({payment.taxRate}%)</span><strong>{formatMoney(payment.taxAmount)}</strong></div>
                <div className="order-total"><span>Total</span><strong>{formatMoney(payment.totalAmount)}</strong></div>
                <button className="pay-now-button" type="button" onClick={startRazorpayPayment} disabled={saving || paying || payment.status === "paid"}>
                  {paying || saving ? <LoaderCircle className="verification-payment-spinner" size={17} /> : <LockKeyhole size={17} />}
                  {payment.status === "paid" ? "Payment Completed" : paying ? "Opening Razorpay..." : `Pay ${formatMoney(payment.totalAmount)}`}
                </button>
                <small className="encrypted-note"><ShieldCheck size={12} /> Payment processed securely by Razorpay.</small>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default VerificationPaymentPage;
