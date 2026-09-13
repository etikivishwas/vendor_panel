import {
  Building2,
  ClipboardList,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getLabourApplication,
  saveLabourDraft,
  submitLabourApplication,
} from "../api/labourApplicationApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/labourApplication.css";

const emptyForm = {
  businessName: "",
  registrationNumber: "",
  industrySector: "",
  primaryContactName: "",
  emailAddress: "",
  phoneNumber: "",
  maleEmployees: 0,
  femaleEmployees: 0,
  permanentEmployees: 0,
  contractEmployees: 0,
  registeredAddress: "",
  cityDistrict: "",
  stateProvince: "",
  postalCode: "",
  operatingStatus: true,
};

function LabourApplicationPage() {
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

  const genderTotal =
    Number(form.maleEmployees || 0) + Number(form.femaleEmployees || 0);
  const contractTotal =
    Number(form.permanentEmployees || 0) +
    Number(form.contractEmployees || 0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const data = await getLabourApplication();
        if (!active) return;

        const source = data.application || data.defaults || {};
        setApplicationStatus(data.application?.status || "new");
        setForm({
          businessName: source.businessName || "",
          registrationNumber: source.registrationNumber || "",
          industrySector: source.industrySector || "",
          primaryContactName: source.primaryContactName || "",
          emailAddress: source.emailAddress || "",
          phoneNumber: source.phoneNumber || "",
          maleEmployees: source.maleEmployees ?? 0,
          femaleEmployees: source.femaleEmployees ?? 0,
          permanentEmployees: source.permanentEmployees ?? 0,
          contractEmployees: source.contractEmployees ?? 0,
          registeredAddress: source.registeredAddress || "",
          cityDistrict: source.cityDistrict || "",
          stateProvince: source.stateProvince || "",
          postalCode: source.postalCode || "",
          operatingStatus:
            source.operatingStatus === undefined
              ? true
              : Boolean(source.operatingStatus),
        });
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load the labour certificate application"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = type === "checkbox" ? checked : value;

    if (name === "registrationNumber") {
      nextValue = value.toUpperCase().slice(0, 100);
    }

    setForm((current) => ({ ...current, [name]: nextValue }));
    setError("");
    setSuccess("");
  };

  const validateForSubmit = () => {
    const required = [
      [form.businessName, "Business name"],
      [form.registrationNumber, "Registration number"],
      [form.industrySector, "Industry sector"],
      [form.primaryContactName, "Primary contact name"],
      [form.emailAddress, "Email address"],
      [form.phoneNumber, "Phone number"],
      [form.registeredAddress, "Registered address"],
      [form.cityDistrict, "City / District"],
      [form.stateProvince, "State / Province"],
      [form.postalCode, "Postal code"],
    ];

    const missing = required.find(([value]) => !String(value || "").trim());
    if (missing) return `${missing[1]} is required`;
    if (genderTotal <= 0) return "Enter at least one employee";
    if (genderTotal !== contractTotal) {
      return "Gender total must match permanent and contract employee total";
    }
    return "";
  };

  const saveDraft = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await saveLabourDraft(form);
      setSuccess(response.message);
      setApplicationStatus("draft");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to save the labour application draft"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    const validationError = validateForSubmit();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await submitLabourApplication(form);
      setSuccess(response.message);
      setApplicationStatus("submitted");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit the labour application"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndContinue = async () => {
    await saveDraft();
  };

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar />
        <div className="dashboard-main labour-loading">
          <LoaderCircle className="labour-spinner" size={30} />
          Loading labour application...
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar vendor={vendor} />

        <main className="labour-content">
          <header className="labour-page-header">
            <button
              className="labour-back-link"
              type="button"
              onClick={() => navigate("/document-verification/get-documents")}
            >
              Certificates / New Application
            </button>

            <div className="labour-heading-row">
              <div>
                <h1>Labour Certificate Application</h1>
                <p>
                  Complete the form below to apply for or renew your business
                  labour certificate. Ensure all workforce details are accurate.
                </p>
              </div>

              {applicationStatus !== "new" && (
                <span className={`labour-status ${applicationStatus}`}>
                  {applicationStatus.replace("_", " ")}
                </span>
              )}
            </div>
          </header>

          {error && <div className="labour-alert error">{error}</div>}
          {success && <div className="labour-alert success">{success}</div>}

          <div className="labour-top-grid">
            <div className="labour-left-column">
              <section className="labour-card">
                <header className="labour-card-header">
                  <Building2 size={20} />
                  <h2>Business Information</h2>
                </header>

                <div className="labour-card-body">
                  <label className="labour-field full">
                    <span>Business Name</span>
                    <input
                      name="businessName"
                      value={form.businessName}
                      onChange={handleChange}
                      placeholder="Enter registered business name"
                      maxLength={200}
                    />
                  </label>

                  <div className="labour-two-columns">
                    <label className="labour-field">
                      <span>Registration Number</span>
                      <input
                        name="registrationNumber"
                        value={form.registrationNumber}
                        onChange={handleChange}
                        placeholder="e.g. REG-12345"
                        maxLength={100}
                      />
                    </label>

                    <label className="labour-field">
                      <span>Industry Sector</span>
                      <select
                        name="industrySector"
                        value={form.industrySector}
                        onChange={handleChange}
                      >
                        <option value="">Select sector</option>
                        <option value="manufacturing">Manufacturing</option>
                        <option value="construction">Construction</option>
                        <option value="retail">Retail</option>
                        <option value="hospitality">Hospitality</option>
                        <option value="healthcare">Healthcare</option>
                        <option value="education">Education</option>
                        <option value="information_technology">
                          Information Technology
                        </option>
                        <option value="professional_services">
                          Professional Services
                        </option>
                        <option value="transport_logistics">
                          Transport &amp; Logistics
                        </option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>
                </div>
              </section>

              <section className="labour-card">
                <header className="labour-card-header">
                  <UserRound size={20} />
                  <h2>Employer Details</h2>
                </header>

                <div className="labour-card-body">
                  <label className="labour-field full">
                    <span>Primary Contact Name</span>
                    <input
                      name="primaryContactName"
                      value={form.primaryContactName}
                      onChange={handleChange}
                      placeholder="Full name of authorized person"
                      maxLength={150}
                    />
                  </label>

                  <div className="labour-two-columns">
                    <label className="labour-field">
                      <span>Email Address</span>
                      <div className="labour-input-icon">
                        <Mail size={16} />
                        <input
                          name="emailAddress"
                          type="email"
                          value={form.emailAddress}
                          onChange={handleChange}
                          placeholder="contact@business.com"
                          maxLength={190}
                        />
                      </div>
                    </label>

                    <label className="labour-field">
                      <span>Phone Number</span>
                      <div className="labour-input-icon">
                        <Phone size={16} />
                        <input
                          name="phoneNumber"
                          value={form.phoneNumber}
                          onChange={handleChange}
                          placeholder="+91 9876543210"
                          maxLength={20}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              </section>
            </div>

            <section className="labour-card workforce-card">
              <header className="labour-card-header">
                <UsersRound size={20} />
                <h2>Workforce Demographics</h2>
              </header>

              <div className="labour-card-body">
                <div className="workforce-group">
                  <h3>By Gender</h3>
                  <div className="labour-two-columns">
                    <label className="labour-field">
                      <span>Male</span>
                      <input
                        name="maleEmployees"
                        type="number"
                        min="0"
                        step="1"
                        value={form.maleEmployees}
                        onChange={handleChange}
                      />
                    </label>
                    <label className="labour-field">
                      <span>Female</span>
                      <input
                        name="femaleEmployees"
                        type="number"
                        min="0"
                        step="1"
                        value={form.femaleEmployees}
                        onChange={handleChange}
                      />
                    </label>
                  </div>
                  <small>Total by gender: {genderTotal}</small>
                </div>

                <div className="workforce-divider" />

                <div className="workforce-group">
                  <h3>By Contract Type</h3>
                  <div className="labour-two-columns">
                    <label className="labour-field">
                      <span>Permanent</span>
                      <input
                        name="permanentEmployees"
                        type="number"
                        min="0"
                        step="1"
                        value={form.permanentEmployees}
                        onChange={handleChange}
                      />
                    </label>
                    <label className="labour-field">
                      <span>Contract</span>
                      <input
                        name="contractEmployees"
                        type="number"
                        min="0"
                        step="1"
                        value={form.contractEmployees}
                        onChange={handleChange}
                      />
                    </label>
                  </div>
                  <small>Total by contract: {contractTotal}</small>
                </div>

                <div className="workforce-illustration">
                  <ClipboardList size={62} />
                </div>
              </div>
            </section>
          </div>

          <section className="labour-card establishment-card">
            <header className="labour-card-header">
              <MapPin size={20} />
              <h2>Establishment Details</h2>
            </header>

            <div className="labour-card-body establishment-grid">
              <label className="labour-field address-field">
                <span>Registered Address</span>
                <input
                  name="registeredAddress"
                  value={form.registeredAddress}
                  onChange={handleChange}
                  placeholder="Street address, building name, floor"
                  maxLength={500}
                />
              </label>

              <label className="labour-field">
                <span>City / District</span>
                <input
                  name="cityDistrict"
                  value={form.cityDistrict}
                  onChange={handleChange}
                  placeholder="City"
                  maxLength={120}
                />
              </label>

              <label className="labour-field">
                <span>State / Province</span>
                <input
                  name="stateProvince"
                  value={form.stateProvince}
                  onChange={handleChange}
                  placeholder="State"
                  maxLength={120}
                />
              </label>

              <label className="labour-field">
                <span>Postal Code</span>
                <input
                  name="postalCode"
                  value={form.postalCode}
                  onChange={handleChange}
                  placeholder="ZIP / Postal"
                  maxLength={20}
                />
              </label>

              <label className="labour-operating-status">
                <span>
                  <strong>Operating Status</strong>
                  <small>
                    {form.operatingStatus ? "Active Facility" : "Inactive Facility"}
                  </small>
                </span>
                <input
                  name="operatingStatus"
                  type="checkbox"
                  checked={form.operatingStatus}
                  onChange={handleChange}
                />
              </label>
            </div>
          </section>

          <footer className="labour-actions">
            <button
              className="labour-cancel-button"
              type="button"
              onClick={() => navigate("/document-verification/get-documents")}
              disabled={saving || submitting}
            >
              Cancel
            </button>

            <button
              className="labour-draft-button"
              type="button"
              onClick={saveDraft}
              disabled={saving || submitting}
            >
              {saving ? (
                <>
                  <LoaderCircle className="labour-spinner" size={16} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} /> Save Draft
                </>
              )}
            </button>

            <button
              className="labour-continue-button"
              type="button"
              onClick={handleSaveAndContinue}
              disabled={saving || submitting}
            >
              Save &amp; Continue
            </button>

            <button
              className="labour-submit-button"
              type="button"
              onClick={handleSubmit}
              disabled={saving || submitting}
            >
              {submitting ? (
                <>
                  <LoaderCircle className="labour-spinner" size={16} />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} /> Submit Application
                </>
              )}
            </button>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default LabourApplicationPage;
