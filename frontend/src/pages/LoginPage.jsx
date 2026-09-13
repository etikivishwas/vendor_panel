import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
} from "lucide-react";
import apiClient from "../api/apiClient";
import officeImage from "../assets/vendor-login-office.png";
import "../styles/login.css";

function LoginPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedVendorEmail") || "";

    if (rememberedEmail) {
      setForm((current) => ({
        ...current,
        email: rememberedEmail,
      }));
      setRememberMe(true);
    }
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await apiClient.post("/vendor/auth/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      localStorage.setItem("vendorToken", response.data.data.token);
      localStorage.setItem(
        "vendor",
        JSON.stringify(response.data.data.vendor)
      );

      if (rememberMe) {
        localStorage.setItem("rememberedVendorEmail", form.email.trim());
      } else {
        localStorage.removeItem("rememberedVendorEmail");
      }

      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to sign in. Please check your credentials and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="vendor-login-page">
      <header className="vendor-login-topbar">
        <button
          className="vendor-login-brand"
          type="button"
          onClick={() => navigate("/")}
          aria-label="Tedo Bizz home"
        >
          <span className="vendor-login-brand-icon">
            <Building2 size={19} />
          </span>

          <span className="vendor-login-brand-copy">
            <strong>Tedo Bizz</strong>
            <small>Vendor Portal</small>
          </span>
        </button>

        <button
          className="return-directory-button"
          type="button"
          onClick={() => navigate("/")}
        >
          Return to Directory
          <ArrowRight size={15} />
        </button>
      </header>

      <main className="vendor-login-main">
        <section
          className="vendor-login-visual"
          style={{ backgroundImage: `url(${officeImage})` }}
        >
          <div className="vendor-login-visual-overlay" />

          <div className="vendor-login-visual-copy">
            <span>Trusted vendor network</span>
            <h1>Partner with Excellence.</h1>
            <p>
              Join a curated network of quality service providers and connect
              with customers seeking reliability, expertise, and trusted results.
            </p>
          </div>
        </section>

        <section className="vendor-login-form-panel">
          <article className="vendor-login-card">
            <div className="vendor-login-lock">
              <LockKeyhole size={24} />
            </div>

            <h2>Vendor Portal Login</h2>
            <p>Secure access to your provider dashboard</p>

            {error && <div className="vendor-login-error">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label className="vendor-login-field">
                <span>Business Email / Username</span>
                <div className="vendor-login-input">
                  <Mail size={16} />
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="provider@company.com"
                    autoComplete="email"
                    autoFocus
                    required
                  />
                </div>
              </label>

              <label className="vendor-login-field">
                <span>Password</span>
                <div className="vendor-login-input">
                  <LockKeyhole size={16} />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    className="password-visibility-button"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>

              <div className="vendor-login-options">
                <label className="remember-me-option">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                className="vendor-login-submit"
                disabled={submitting}
                type="submit"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="login-spinner" size={17} />
                    Signing in...
                  </>
                ) : (
                  "Login to Portal"
                )}
              </button>
            </form>

            <div className="vendor-login-register">
              <span>New Vendor?</span>
              <button
                type="button"
                onClick={() => navigate("/register-interest")}
              >
                Register Interest
              </button>
            </div>
          </article>
        </section>
      </main>

      <footer className="vendor-login-footer">
        <div>
          <strong>Tedo Bizz</strong>
          <small>© 2026 Tedo Bizz. All rights reserved.</small>
        </div>

        <nav aria-label="Legal links">
          <button type="button">Privacy Policy</button>
          <button type="button">Terms of Service</button>
          <button type="button">Security</button>
          <button type="button">Contact Support</button>
        </nav>
      </footer>
    </div>
  );
}

export default LoginPage;
