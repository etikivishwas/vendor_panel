import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  LoaderCircle,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestVendorPasswordReset } from "../api/vendorPasswordResetApi";
import "../styles/vendorPasswordReset.css";

function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [developmentResetUrl, setDevelopmentResetUrl] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setDevelopmentResetUrl("");
    setSubmitting(true);

    try {
      const response = await requestVendorPasswordReset(
        email.trim().toLowerCase()
      );
      setSuccess(response.message);
      setDevelopmentResetUrl(response.data?.developmentResetUrl || "");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to request a password reset"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="password-reset-page">
      <header className="password-reset-topbar">
        <button type="button" onClick={() => navigate("/")}>
          <span><Building2 size={20} /></span>
          <div><strong>Tedo Bizz</strong><small>Vendor Portal</small></div>
        </button>
      </header>

      <main className="password-reset-main">
        <section className="password-reset-card">
          <button
            className="password-reset-back"
            type="button"
            onClick={() => navigate("/login")}
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <span className="password-reset-icon"><Mail size={27} /></span>
          <h1>Forgot Your Password?</h1>
          <p>
            Enter the email connected to your vendor account. A secure reset
            link will be sent if the account exists.
          </p>

          {error && <div className="password-reset-alert error">{error}</div>}
          {success && (
            <div className="password-reset-alert success">
              <CheckCircle2 size={17} /> {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <label>
              <span>Business Email Address</span>
              <div className="password-reset-input">
                <Mail size={17} />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="provider@company.com"
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>
            </label>

            <button type="submit" disabled={submitting}>
              {submitting ? (
                <><LoaderCircle className="password-reset-spinner" size={17} /> Sending...</>
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>

          {developmentResetUrl && (
            <div className="development-reset-link">
              <strong>Development only</strong>
              <span>SMTP is not configured. Open this temporary reset link:</span>
              <button
                type="button"
                onClick={() => {
                  const url = new URL(developmentResetUrl);
                  navigate(`${url.pathname}${url.search}`);
                }}
              >
                Open Reset Password
              </button>
            </div>
          )}

          <small className="password-reset-security">
            <ShieldCheck size={13} /> For security, the link expires after 15 minutes.
          </small>
        </section>
      </main>
    </div>
  );
}

export default ForgotPasswordPage;
