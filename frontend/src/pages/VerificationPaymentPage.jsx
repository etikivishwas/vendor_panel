import {
  Building2,
  CheckCircle2,
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
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/verificationPayment.css";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value || 0);

const methods = [
  {
    key: "upi",
    title: "UPI",
    description: "Pay directly via Google Pay, PhonePe, Paytm, etc.",
    icon: QrCode,
  },
  {
    key: "card",
    title: "Credit / Debit Card",
    description: "Visa, Mastercard and RuPay accepted.",
    icon: CreditCard,
  },
  {
    key: "net_banking",
    title: "Net Banking",
    description: "All major Indian banks supported.",
    icon: Landmark,
  },
];

function VerificationPaymentPage() {
  const { token } = useParams();
  const [payment, setPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [upiId, setUpiId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const vendor = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("vendor") || "{}");
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    const loadPayment = async () => {
      try {
        const data = await getVerificationPayment(token);
        setPayment(data);
        setPaymentMethod(data.paymentMethod || "upi");
        setUpiId(data.upiId || "");
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load payment details"
        );
      } finally {
        setLoading(false);
      }
    };

    loadPayment();
  }, [token]);

  const savePreference = async () => {
    if (paymentMethod === "upi" && !upiId.trim()) {
      setError("Enter your UPI ID before verification");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await saveVerificationPaymentPreference(
        token,
        paymentMethod,
        upiId
      );
      setSuccess(
        `${response.message}. Razorpay checkout will be connected later.`
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to save payment preference"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar />
        <div className="dashboard-main verification-payment-loading">
          <LoaderCircle className="verification-payment-spinner" size={30} />
          Loading payment details...
        </div>
      </div>
    );
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

          {error && (
            <div className="verification-payment-alert error">{error}</div>
          )}
          {success && (
            <div className="verification-payment-alert success">{success}</div>
          )}

          {payment && (
            <div className="verification-payment-layout">
              <section className="payment-method-area">
                <article className="verification-payment-card method-card">
                  <header>
                    <CreditCard size={20} />
                    <h2>Select Payment Method</h2>
                  </header>

                  <div className="payment-method-list">
                    {methods.map((method) => {
                      const Icon = method.icon;
                      const selected = paymentMethod === method.key;

                      return (
                        <button
                          className={selected ? "selected" : ""}
                          type="button"
                          onClick={() => {
                            setPaymentMethod(method.key);
                            setError("");
                            setSuccess("");
                          }}
                          key={method.key}
                        >
                          <span className="payment-radio">
                            {selected && <span />}
                          </span>
                          <span className="payment-method-copy">
                            <strong>{method.title}</strong>
                            <small>{method.description}</small>
                          </span>
                          <Icon size={20} />
                        </button>
                      );
                    })}
                  </div>
                </article>

                {paymentMethod === "upi" && (
                  <article className="verification-payment-card upi-card">
                    <header>
                      <QrCode size={20} />
                      <h2>Enter UPI ID</h2>
                    </header>
                    <div className="upi-entry-row">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(event) => {
                          setUpiId(event.target.value.toLowerCase());
                          setError("");
                          setSuccess("");
                        }}
                        placeholder="example@okhdfcbank"
                        maxLength={120}
                      />
                      <button
                        type="button"
                        onClick={savePreference}
                        disabled={saving}
                      >
                        {saving ? (
                          <LoaderCircle
                            className="verification-payment-spinner"
                            size={16}
                          />
                        ) : (
                          "Verify"
                        )}
                      </button>
                    </div>
                  </article>
                )}

                {paymentMethod !== "upi" && (
                  <article className="verification-payment-card gateway-card">
                    <Building2 size={25} />
                    <div>
                      <h2>
                        {paymentMethod === "card"
                          ? "Card Payment"
                          : "Net Banking"}
                      </h2>
                      <p>
                        The secure Razorpay payment form will open after gateway
                        integration is enabled.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={savePreference}
                      disabled={saving}
                    >
                      Save Method
                    </button>
                  </article>
                )}
              </section>

              <aside className="verification-order-card">
                <h2>Order Summary</h2>

                <div className="order-certificate">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>{payment.serviceLevel}</strong>
                    <small>{payment.validityPeriod}</small>
                  </div>
                </div>

                <div className="order-line">
                  <span>Registration Fee</span>
                  <strong>{formatMoney(payment.registrationFee)}</strong>
                </div>

                <div className="order-line">
                  <span>Verification Processing</span>
                  <strong>{formatMoney(payment.processingFee)}</strong>
                </div>

                <div className="order-subtotal">
                  <span>Subtotal</span>
                  <strong>{formatMoney(payment.taxableAmount)}</strong>
                </div>

                <div className="order-line">
                  <span>GST ({payment.taxRate}%)</span>
                  <strong>{formatMoney(payment.taxAmount)}</strong>
                </div>

                <div className="order-total">
                  <span>Total</span>
                  <strong>{formatMoney(payment.totalAmount)}</strong>
                </div>

                <button
                  className="pay-now-button"
                  type="button"
                  onClick={savePreference}
                  disabled={saving || payment.status !== "pending"}
                >
                  {saving ? (
                    <LoaderCircle
                      className="verification-payment-spinner"
                      size={17}
                    />
                  ) : (
                    <LockKeyhole size={17} />
                  )}
                  Pay {formatMoney(payment.totalAmount)}
                </button>

                <small className="encrypted-note">
                  <ShieldCheck size={12} /> Your payment is encrypted and 100%
                  secure.
                </small>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default VerificationPaymentPage;
