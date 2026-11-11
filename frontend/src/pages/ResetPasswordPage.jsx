import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  resetVendorPassword,
  validateVendorPasswordResetToken,
} from "../api/vendorPasswordResetApi";
import "../styles/vendorPasswordReset.css";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const validate = async () => {
      if (!token) {
        setError("Password reset link is missing a token");
        setChecking(false);
        return;
      }

      try {
        const response = await validateVendorPasswordResetToken(token);
        setValidToken(Boolean(response.data?.valid));
        if (!response.data?.valid) setError(response.message);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Password reset link is invalid or expired"
        );
      } finally {
        setChecking(false);
      }
    };

    validate();
  }, [token]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Password and confirmation do not match");
      return;
    }

    setSubmitting(true);
    try {
      const response = await resetVendorPassword(
        token,
        form.password,
        form.confirmPassword
      );
      setSuccess(response.message);
      setValidToken(false);
      window.setTimeout(() => navigate("/login", { replace: true }), 1800);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to reset password"
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
        <section className="password-reset-card reset-password-card">
          <button
            className="password-reset-back"
            type="button"
            onClick={() => navigate("/login")}
          >
            <ArrowLeft size={16} /> Back to Login
          </button>

          <span className="password-reset-icon"><LockKeyhole size={27} /></span>
          <h1>Create New Password</h1>
          <p>Choose a strong password for the vendor portal account.</p>

          {checking ? (
            <div className="password-reset-checking">
              <LoaderCircle className="password-reset-spinner" size={24} />
              Validating reset link...
            </div>
          ) : success ? (
            <div className="password-reset-complete">
              <CheckCircle2 size={35} />
              <strong>Password Updated</strong>
              <p>{success}</p>
            </div>
          ) : !validToken ? (
            <div className="password-reset-invalid">
              <XCircle size={34} />
              <strong>Reset Link Unavailable</strong>
              <p>{error}</p>
              <button type="button" onClick={() => navigate("/forgot-password")}>
                Request Another Link
              </button>
            </div>
          ) : (
            <>
              {error && <div className="password-reset-alert error">{error}</div>}

              <form onSubmit={handleSubmit}>
                <label>
                  <span>New Password</span>
                  <div className="password-reset-input">
                    <LockKeyhole size={17} />
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      placeholder="Enter a new password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      className="reset-visibility-button"
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <label>
                  <span>Confirm New Password</span>
                  <div className="password-reset-input">
                    <LockKeyhole size={17} />
                    <input
                      name="confirmPassword"
                      type={showConfirmation ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={handleChange}
                      placeholder="Re-enter the new password"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      className="reset-visibility-button"
                      type="button"
                      onClick={() => setShowConfirmation((current) => !current)}
                      aria-label={showConfirmation ? "Hide password" : "Show password"}
                    >
                      {showConfirmation ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>

                <div className="password-rules">
                  Use 8 to 72 characters with uppercase, lowercase, number, and
                  special character.
                </div>

                <button type="submit" disabled={submitting}>
                  {submitting ? (
                    <><LoaderCircle className="password-reset-spinner" size={17} /> Updating...</>
                  ) : (
                    "Update Password"
                  )}
                </button>
              </form>
            </>
          )}

          <small className="password-reset-security">
            <ShieldCheck size={13} /> The reset token is single-use and securely hashed.
          </small>
        </section>
      </main>
    </div>
  );
}

export default ResetPasswordPage;
