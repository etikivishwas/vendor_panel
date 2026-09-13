import {
  Building2,
  CalendarDays,
  CreditCard,
  Fingerprint,
  IndianRupee,
  LoaderCircle,
  Mail,
  Phone,
  Send,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMsmeApplication,
  saveMsmeDraft,
  submitMsmeApplication,
} from "../api/msmeApplicationApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/msmeApplication.css";

const emptyForm = {
  enterpriseName: "",
  businessPan: "",
  organizationType: "",
  majorActivity: "",
  aadhaarNumber: "",
  applicantName: "",
  mobileNumber: "",
  emailAddress: "",
  commencementDate: "",
  employeeCount: "",
  plantMachineryInvestment: "",
  annualTurnover: "",
  declarationAccepted: false,
};

const normalizeDate = (value) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

function MsmeApplicationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [applicationStatus, setApplicationStatus] = useState("new");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    let active = true;

    const loadApplication = async () => {
      try {
        const data = await getMsmeApplication();
        if (!active) return;

        const source = data.application || data.defaults || {};
        setApplicationStatus(data.application?.status || "new");
        setForm({
          enterpriseName: source.enterpriseName || "",
          businessPan: source.businessPan || "",
          organizationType: source.organizationType || "",
          majorActivity: source.majorActivity || "",
          aadhaarNumber: source.aadhaarNumber || "",
          applicantName: source.applicantName || "",
          mobileNumber: source.mobileNumber || "",
          emailAddress: source.emailAddress || "",
          commencementDate: normalizeDate(source.commencementDate),
          employeeCount:
            source.employeeCount !== undefined ? source.employeeCount : "",
          plantMachineryInvestment:
            source.plantMachineryInvestment !== undefined
              ? source.plantMachineryInvestment
              : "",
          annualTurnover:
            source.annualTurnover !== undefined ? source.annualTurnover : "",
          declarationAccepted: Boolean(source.declarationAccepted),
        });
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load the MSME application"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadApplication();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = type === "checkbox" ? checked : value;

    if (name === "businessPan") {
      nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    }

    if (name === "aadhaarNumber") {
      nextValue = value.replace(/\D/g, "").slice(0, 12);
    }

    setForm((current) => ({ ...current, [name]: nextValue }));
    setError("");
    setSuccess("");
  };

  const validate = (finalSubmission) => {
    if (!form.enterpriseName.trim()) return "Enterprise name is required";
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.businessPan)) {
      return "Enter a valid business PAN, for example ABCDE1234F";
    }
    if (!form.organizationType) return "Select the organization type";
    if (!form.majorActivity) return "Select the major activity";
    if (!/^\d{12}$/.test(form.aadhaarNumber)) {
      return "Aadhaar number must contain 12 digits";
    }
    if (!form.applicantName.trim()) return "Applicant name is required";
    if (!form.mobileNumber.trim()) return "Mobile number is required";
    if (!form.emailAddress.trim()) return "Email address is required";
    if (!form.commencementDate) return "Date of commencement is required";
    if (form.employeeCount === "") return "Employee count is required";
    if (form.plantMachineryInvestment === "") {
      return "Investment in plant and machinery is required";
    }
    if (form.annualTurnover === "") return "Annual turnover is required";
    if (finalSubmission && !form.declarationAccepted) {
      return "Accept the declaration before submitting";
    }
    return "";
  };

  const saveDraft = async () => {
    const validationError = validate(false);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await saveMsmeDraft(form);
      setSuccess(response.message);
      setApplicationStatus("draft");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to save the draft"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate(true);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await submitMsmeApplication(form);
      setSuccess(response.message);
      setApplicationStatus("submitted");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit the MSME application"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar />
        <div className="dashboard-main msme-loading">
          <LoaderCircle className="msme-spinner" size={30} />
          Loading MSME application...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar vendor={vendor} />

        <main className="msme-content">
          <header className="msme-page-header">
            <button
              className="msme-back-link"
              type="button"
              onClick={() => navigate("/document-verification/get-documents")}
            >
              Back to certificates
            </button>
            <div className="msme-heading-row">
              <div>
                <h1>MSME / Udyam Certificate Application</h1>
                <p>
                  Complete the form below to apply for your Udyam Registration
                  Certificate. Ensure all details match official documents.
                </p>
              </div>
              {applicationStatus !== "new" && (
                <span className={`msme-status ${applicationStatus}`}>
                  {applicationStatus.replace("_", " ")}
                </span>
              )}
            </div>
          </header>

          {error && <div className="msme-alert error">{error}</div>}
          {success && <div className="msme-alert success">{success}</div>}

          <form className="msme-layout" onSubmit={handleSubmit}>
            <div className="msme-main-column">
              <section className="msme-card">
                <header className="msme-card-header">
                  <Store size={20} />
                  <div>
                    <h2>Business Information</h2>
                    <p>Provide details about the enterprise and its main activities.</p>
                  </div>
                </header>

                <div className="msme-card-body">
                  <label className="msme-field full">
                    <span>Name of Enterprise / Business</span>
                    <div className="msme-input-wrap">
                      <Building2 size={17} />
                      <input
                        name="enterpriseName"
                        value={form.enterpriseName}
                        onChange={handleChange}
                        placeholder="e.g. Acme Corporation"
                        maxLength={200}
                        required
                      />
                    </div>
                  </label>

                  <div className="msme-two-columns">
                    <label className="msme-field">
                      <span>Business PAN Number</span>
                      <div className="msme-input-wrap">
                        <CreditCard size={17} />
                        <input
                          name="businessPan"
                          value={form.businessPan}
                          onChange={handleChange}
                          placeholder="ABCDE1234F"
                          maxLength={10}
                          required
                        />
                      </div>
                    </label>

                    <label className="msme-field">
                      <span>Type of Organization</span>
                      <select
                        name="organizationType"
                        value={form.organizationType}
                        onChange={handleChange}
                        required
                      >
                        <option value="">Select type</option>
                        <option value="proprietorship">Proprietorship</option>
                        <option value="partnership">Partnership</option>
                        <option value="llp">Limited Liability Partnership</option>
                        <option value="private_limited">Private Limited</option>
                        <option value="public_limited">Public Limited</option>
                        <option value="trust">Trust</option>
                        <option value="society">Society</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>

                  <fieldset className="msme-activity-fieldset">
                    <legend>Major Activity</legend>
                    <div>
                      {[
                        ["manufacturing", "Manufacturing"],
                        ["services", "Services"],
                        ["trading", "Trading"],
                      ].map(([value, label]) => (
                        <label key={value}>
                          <input
                            type="radio"
                            name="majorActivity"
                            value={value}
                            checked={form.majorActivity === value}
                            onChange={handleChange}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </section>

              <section className="msme-card">
                <header className="msme-card-header">
                  <UserRound size={20} />
                  <div>
                    <h2>Owner / Applicant Details</h2>
                    <p>Enter the authorized applicant details exactly as recorded.</p>
                  </div>
                </header>

                <div className="msme-card-body msme-two-columns">
                  <label className="msme-field">
                    <span>Aadhaar Number</span>
                    <div className="msme-input-wrap">
                      <Fingerprint size={17} />
                      <input
                        name="aadhaarNumber"
                        value={form.aadhaarNumber}
                        onChange={handleChange}
                        placeholder="123456789012"
                        inputMode="numeric"
                        maxLength={12}
                        required
                      />
                    </div>
                  </label>

                  <label className="msme-field">
                    <span>Name (As per Aadhaar)</span>
                    <div className="msme-input-wrap">
                      <UserRound size={17} />
                      <input
                        name="applicantName"
                        value={form.applicantName}
                        onChange={handleChange}
                        placeholder="Full Name"
                        maxLength={150}
                        required
                      />
                    </div>
                  </label>

                  <label className="msme-field">
                    <span>Mobile Number</span>
                    <div className="msme-input-wrap">
                      <Phone size={17} />
                      <input
                        name="mobileNumber"
                        value={form.mobileNumber}
                        onChange={handleChange}
                        placeholder="+91 9876543210"
                        maxLength={20}
                        required
                      />
                    </div>
                  </label>

                  <label className="msme-field">
                    <span>Email Address</span>
                    <div className="msme-input-wrap">
                      <Mail size={17} />
                      <input
                        name="emailAddress"
                        type="email"
                        value={form.emailAddress}
                        onChange={handleChange}
                        placeholder="contact@business.com"
                        maxLength={190}
                        required
                      />
                    </div>
                  </label>
                </div>
              </section>
            </div>

            <aside className="msme-side-column">
              <section className="msme-card operations-card">
                <header className="msme-card-header compact">
                  <h2>Operations Data</h2>
                </header>

                <div className="msme-card-body">
                  <label className="msme-field">
                    <span>Date of Commencement</span>
                    <div className="msme-input-wrap">
                      <CalendarDays size={17} />
                      <input
                        name="commencementDate"
                        type="date"
                        value={form.commencementDate}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </label>

                  <label className="msme-field">
                    <span>No. of Employees</span>
                    <div className="msme-input-wrap">
                      <UsersRound size={17} />
                      <input
                        name="employeeCount"
                        type="number"
                        min="0"
                        step="1"
                        value={form.employeeCount}
                        onChange={handleChange}
                        placeholder="e.g. 15"
                        required
                      />
                    </div>
                  </label>

                  <label className="msme-field">
                    <span>Investment in Plant &amp; Machinery</span>
                    <div className="msme-input-wrap">
                      <IndianRupee size={17} />
                      <input
                        name="plantMachineryInvestment"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.plantMachineryInvestment}
                        onChange={handleChange}
                        placeholder="In Lakhs"
                        required
                      />
                    </div>
                  </label>

                  <label className="msme-field">
                    <span>Annual Turnover</span>
                    <div className="msme-input-wrap">
                      <IndianRupee size={17} />
                      <input
                        name="annualTurnover"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.annualTurnover}
                        onChange={handleChange}
                        placeholder="In Lakhs"
                        required
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section className="msme-card action-card">
                <label className="msme-declaration">
                  <input
                    name="declarationAccepted"
                    type="checkbox"
                    checked={form.declarationAccepted}
                    onChange={handleChange}
                  />
                  <span>
                    I declare that all information provided is true and correct
                    to the best of my knowledge.
                  </span>
                </label>

                <button
                  className="msme-submit-button"
                  type="submit"
                  disabled={submitting || saving}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="msme-spinner" size={16} />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Submit Application
                    </>
                  )}
                </button>

                <button
                  className="msme-draft-button"
                  type="button"
                  onClick={saveDraft}
                  disabled={submitting || saving}
                >
                  {saving ? (
                    <>
                      <LoaderCircle className="msme-spinner" size={16} />
                      Saving...
                    </>
                  ) : (
                    "Save Draft"
                  )}
                </button>
              </section>
            </aside>
          </form>
        </main>
      </div>
    </div>
  );
}

export default MsmeApplicationPage;
