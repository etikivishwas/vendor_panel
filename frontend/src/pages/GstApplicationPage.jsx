import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  CreditCard,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Save,
  Send,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getGstApplication,
  saveGstDraft,
  saveGstStep,
  submitGstApplication,
} from "../api/gstApplicationApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/gstApplication.css";

const steps = [
  { number: 1, label: "Business Info" },
  { number: 2, label: "Applicant Info" },
  { number: 3, label: "Contact & Address" },
  { number: 4, label: "Review" },
];

const emptyForm = {
  tradeName: "",
  legalBusinessName: "",
  businessPan: "",
  constitutionType: "",
  stateJurisdiction: "",
  businessActivity: "",
  commencementDate: "",
  applicantName: "",
  applicantDesignation: "",
  applicantPan: "",
  aadhaarNumber: "",
  mobileNumber: "",
  emailAddress: "",
  addressLine1: "",
  addressLine2: "",
  cityDistrict: "",
  stateProvince: "",
  postalCode: "",
  premisesType: "",
  declarationAccepted: false,
};

const stateOptions = [
  "Andhra Pradesh", "Assam", "Bihar", "Delhi", "Goa", "Gujarat",
  "Haryana", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra",
  "Odisha", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

function GstApplicationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState("new");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const vendor = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("vendor") || "{}"); }
    catch { return {}; }
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getGstApplication();
        if (!active) return;
        const source = data.application || data.defaults || {};
        setForm({ ...emptyForm, ...source, commencementDate: source.commencementDate ? String(source.commencementDate).slice(0, 10) : "" });
        setStep(Math.min(Math.max(data.application?.currentStep || 1, 1), 4));
        setStatus(data.application?.status || "new");
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || "Unable to load GST application");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = type === "checkbox" ? checked : value;
    if (["businessPan", "applicantPan"].includes(name)) {
      nextValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    }
    if (name === "aadhaarNumber") nextValue = value.replace(/\D/g, "").slice(0, 12);
    setForm((current) => ({ ...current, [name]: nextValue }));
    setError(""); setSuccess("");
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!form.tradeName.trim()) return "Trade name is required";
      if (!form.legalBusinessName.trim()) return "Legal business name is required";
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.businessPan)) return "Enter a valid business PAN";
      if (!form.constitutionType) return "Select constitution of business";
      if (!form.stateJurisdiction) return "Select state / jurisdiction";
      if (!form.businessActivity.trim()) return "Business activity is required";
      if (!form.commencementDate) return "Commencement date is required";
    }
    if (currentStep === 2) {
      if (!form.applicantName.trim()) return "Applicant name is required";
      if (!form.applicantDesignation.trim()) return "Applicant designation is required";
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.applicantPan)) return "Enter a valid applicant PAN";
      if (!/^\d{12}$/.test(form.aadhaarNumber)) return "Aadhaar number must contain 12 digits";
    }
    if (currentStep === 3) {
      if (!form.mobileNumber.trim()) return "Mobile number is required";
      if (!form.emailAddress.trim()) return "Email address is required";
      if (!form.addressLine1.trim()) return "Address line 1 is required";
      if (!form.cityDistrict.trim()) return "City / District is required";
      if (!form.stateProvince) return "State / Province is required";
      if (!form.postalCode.trim()) return "Postal code is required";
      if (!form.premisesType) return "Select nature of premises";
    }
    return "";
  };

  const continueStep = async () => {
    const validationError = validateStep(step);
    if (validationError) { setError(validationError); return; }
    setSaving(true); setError("");
    try {
      const response = await saveGstStep(step, form);
      setSuccess(response.message);
      setStatus("draft");
      setStep(Math.min(step + 1, 4));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save this step");
    } finally { setSaving(false); }
  };

  const saveDraft = async () => {
    setSaving(true); setError("");
    try {
      const response = await saveGstDraft(form, step);
      setSuccess(response.message); setStatus("draft");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save draft");
    } finally { setSaving(false); }
  };

  const submitApplication = async () => {
    for (let index = 1; index <= 3; index += 1) {
      const validationError = validateStep(index);
      if (validationError) { setStep(index); setError(validationError); return; }
    }
    if (!form.declarationAccepted) { setError("Accept the declaration before submitting"); return; }
    setSubmitting(true); setError("");
    try {
      const response = await submitGstApplication(form);
      setSuccess(response.message); setStatus("submitted");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to submit GST application");
    } finally { setSubmitting(false); }
  };

  const editStep = (targetStep) => { setStep(targetStep); setError(""); setSuccess(""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (loading) return <div className="dashboard-shell"><Sidebar /><div className="dashboard-main gst-loading"><LoaderCircle className="gst-spinner" size={30} /> Loading GST application...</div></div>;

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <Topbar vendor={vendor} />
        <main className="gst-content">
          <header className="gst-page-header">
            <div>
              <button type="button" onClick={() => navigate("/document-verification/get-documents")}>Back to certificates</button>
              <h1>Apply for GST Certificate</h1>
              <p>Complete all four steps and review the details before submitting.</p>
            </div>
            {status !== "new" && <span className={`gst-status ${status}`}>{status.replace("_", " ")}</span>}
          </header>

          <section className="gst-stepper">
            {steps.map((item) => (
              <button key={item.number} type="button" className={`${step === item.number ? "active" : ""} ${step > item.number ? "complete" : ""}`} onClick={() => item.number < step && editStep(item.number)}>
                <span>{step > item.number ? <Check size={14} /> : item.number}</span>
                <small>{item.label}</small>
              </button>
            ))}
          </section>

          {error && <div className="gst-alert error">{error}</div>}
          {success && <div className="gst-alert success">{success}</div>}

          {step === 1 && (
            <section className="gst-form-card">
              <header><Building2 size={19} /><h2>Business Information</h2></header>
              <div className="gst-form-grid">
                <label><span>Trade Name (Business Name)</span><input name="tradeName" value={form.tradeName} onChange={handleChange} placeholder="Enter trade name as per PAN" /></label>
                <label><span>Legal Business Name</span><input name="legalBusinessName" value={form.legalBusinessName} onChange={handleChange} placeholder="Registered legal name" /></label>
                <label><span>Business PAN</span><div className="gst-input-icon"><CreditCard size={16} /><input name="businessPan" value={form.businessPan} onChange={handleChange} placeholder="ABCDE1234F" /></div></label>
                <label><span>Constitution of Business</span><select name="constitutionType" value={form.constitutionType} onChange={handleChange}><option value="">Select Business Type</option><option value="proprietorship">Proprietorship</option><option value="partnership">Partnership</option><option value="llp">LLP</option><option value="private_limited">Private Limited</option><option value="public_limited">Public Limited</option><option value="huf">HUF</option><option value="trust">Trust</option><option value="society">Society</option><option value="government">Government</option><option value="other">Other</option></select></label>
                <label><span>State / Jurisdiction</span><select name="stateJurisdiction" value={form.stateJurisdiction} onChange={handleChange}><option value="">Select State</option>{stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
                <label><span>Principal Business Activity</span><input name="businessActivity" value={form.businessActivity} onChange={handleChange} placeholder="e.g. Electrical services" /></label>
                <label><span>Date of Commencement</span><input name="commencementDate" type="date" value={form.commencementDate} onChange={handleChange} /></label>
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="gst-form-card">
              <header><UserRound size={19} /><h2>Applicant Information</h2></header>
              <div className="gst-form-grid">
                <label><span>Authorized Applicant Name</span><input name="applicantName" value={form.applicantName} onChange={handleChange} placeholder="Full name as per Aadhaar" /></label>
                <label><span>Designation</span><input name="applicantDesignation" value={form.applicantDesignation} onChange={handleChange} placeholder="Proprietor / Partner / Director" /></label>
                <label><span>Applicant PAN</span><input name="applicantPan" value={form.applicantPan} onChange={handleChange} placeholder="ABCDE1234F" /></label>
                <label><span>Aadhaar Number</span><input name="aadhaarNumber" value={form.aadhaarNumber} onChange={handleChange} placeholder="123456789012" inputMode="numeric" /></label>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="gst-form-card">
              <header><MapPin size={19} /><h2>Contact &amp; Principal Place of Business</h2></header>
              <div className="gst-form-grid">
                <label><span>Mobile Number</span><div className="gst-input-icon"><Phone size={16} /><input name="mobileNumber" value={form.mobileNumber} onChange={handleChange} placeholder="+91 9876543210" /></div></label>
                <label><span>Email Address</span><div className="gst-input-icon"><Mail size={16} /><input name="emailAddress" type="email" value={form.emailAddress} onChange={handleChange} placeholder="contact@business.com" /></div></label>
                <label className="full"><span>Address Line 1</span><input name="addressLine1" value={form.addressLine1} onChange={handleChange} placeholder="Building, street, locality" /></label>
                <label className="full"><span>Address Line 2 (Optional)</span><input name="addressLine2" value={form.addressLine2} onChange={handleChange} placeholder="Landmark or additional address" /></label>
                <label><span>City / District</span><input name="cityDistrict" value={form.cityDistrict} onChange={handleChange} /></label>
                <label><span>State / Province</span><select name="stateProvince" value={form.stateProvince} onChange={handleChange}><option value="">Select State</option>{stateOptions.map((state) => <option key={state} value={state}>{state}</option>)}</select></label>
                <label><span>Postal Code</span><input name="postalCode" value={form.postalCode} onChange={handleChange} /></label>
                <label><span>Nature of Premises</span><select name="premisesType" value={form.premisesType} onChange={handleChange}><option value="">Select premises type</option><option value="owned">Owned</option><option value="rented">Rented</option><option value="leased">Leased</option><option value="consent">Consent</option><option value="shared">Shared</option><option value="other">Other</option></select></label>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="gst-review-card">
              <header><ClipboardCheck size={20} /><div><h2>Review Application</h2><p>Review all details before final submission.</p></div></header>
              <div className="gst-review-sections">
                <ReviewSection title="Business Information" onEdit={() => editStep(1)} items={[["Trade Name", form.tradeName], ["Legal Name", form.legalBusinessName], ["Business PAN", form.businessPan], ["Constitution", form.constitutionType], ["Jurisdiction", form.stateJurisdiction], ["Business Activity", form.businessActivity], ["Commencement Date", form.commencementDate]]} />
                <ReviewSection title="Applicant Information" onEdit={() => editStep(2)} items={[["Applicant Name", form.applicantName], ["Designation", form.applicantDesignation], ["Applicant PAN", form.applicantPan], ["Aadhaar", form.aadhaarNumber ? `XXXX XXXX ${form.aadhaarNumber.slice(-4)}` : ""]]} />
                <ReviewSection title="Contact & Address" onEdit={() => editStep(3)} items={[["Mobile", form.mobileNumber], ["Email", form.emailAddress], ["Address", [form.addressLine1, form.addressLine2, form.cityDistrict, form.stateProvince, form.postalCode].filter(Boolean).join(", ")], ["Premises", form.premisesType]]} />
              </div>
              <label className="gst-declaration"><input type="checkbox" name="declarationAccepted" checked={form.declarationAccepted} onChange={handleChange} /><span>I declare that the information provided is true and matches the official business documents.</span></label>
            </section>
          )}

          <footer className="gst-actions">
            <button className="gst-secondary" type="button" onClick={() => step === 1 ? navigate("/document-verification/get-documents") : setStep(step - 1)}><ArrowLeft size={16} /> Back</button>
            <button className="gst-secondary" type="button" onClick={saveDraft} disabled={saving || submitting}><Save size={16} /> Save Draft</button>
            {step < 4 ? <button className="gst-primary" type="button" onClick={continueStep} disabled={saving}>{saving ? <LoaderCircle className="gst-spinner" size={16} /> : null} Save &amp; Continue <ArrowRight size={16} /></button> : <button className="gst-primary" type="button" onClick={submitApplication} disabled={submitting}>{submitting ? <LoaderCircle className="gst-spinner" size={16} /> : <Send size={16} />} Submit Application</button>}
          </footer>
        </main>
      </div>
    </div>
  );
}

function ReviewSection({ title, items, onEdit }) {
  return <section className="gst-review-section"><div className="gst-review-heading"><h3>{title}</h3><button type="button" onClick={onEdit}>Edit</button></div><dl>{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Not provided"}</dd></div>)}</dl></section>;
}

export default GstApplicationPage;
