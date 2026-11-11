import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  IndianRupee,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  UserRound,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getVendorRegistrationCategories,
  submitVendorRegistration,
} from "../api/vendorRegistrationApi";
import "../styles/vendorRegistration.css";

const initialForm = {
  businessName: "",
  ownerName: "",
  categoryId: "",
  serviceType: "",
  description: "",
  yearsOfExperience: "",
  minimumPrice: "",
  maximumPrice: "",
  openingTime: "09:00",
  closingTime: "18:00",
  phone: "",
  whatsapp: "",
  address: "",
  city: "",
  state: "Telangana",
  postalCode: "",
  landmark: "",
  email: "",
  password: "",
  confirmPassword: "",
  privacyAccepted: false,
  termsAccepted: false,
};

function VendorRegistrationPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await getVendorRegistrationCategories();
        setCategories(data || []);
      } catch (requestError) {
        setError(
          requestError.response?.data?.message ||
            "Unable to load service categories"
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === Number(form.categoryId)),
    [categories, form.categoryId]
  );

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    let nextValue = type === "checkbox" ? checked : value;

    if (["phone", "whatsapp", "postalCode"].includes(name)) {
      nextValue = value.replace(/\D/g, "");
    }

    setForm((current) => ({ ...current, [name]: nextValue }));
    setError("");
  };

  const validate = () => {
    if (!form.businessName.trim()) return "Business name is required";
    if (!form.ownerName.trim()) return "Owner or contact name is required";
    if (!form.categoryId) return "Select a service category";
    if (!form.serviceType.trim()) return "Primary service is required";
    if (!form.description.trim()) return "Business description is required";
    if (!/^\d{10,15}$/.test(form.phone)) return "Enter a valid phone number";
    if (!form.address.trim() || !form.city.trim() || !form.state.trim()) {
      return "Complete the business address";
    }
    if (!/^\d{4,10}$/.test(form.postalCode)) return "Enter a valid postal code";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Enter a valid email address";
    }
    if (form.password.length < 8) return "Password must contain at least 8 characters";
    if (form.password !== form.confirmPassword) return "Passwords do not match";
    if (!form.privacyAccepted || !form.termsAccepted) {
      return "Accept the Privacy Policy and Terms of Service";
    }
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await submitVendorRegistration(form);
      setResult(response.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit vendor registration"
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <main className="vendor-registration-page registration-success-page">
        <section className="registration-success-card">
          <span><CheckCircle2 size={44} /></span>
          <small>Registration submitted</small>
          <h1>Welcome to Tedo Bizz</h1>
          <p>
            The vendor profile and login account were created successfully. Save
            the application reference for future communication.
          </p>
          <div>
            <label>Application Reference</label>
            <strong>{result.applicationReference}</strong>
          </div>
          <div>
            <label>Login Email</label>
            <strong>{result.email}</strong>
          </div>
          <button type="button" onClick={() => navigate("/login", { replace: true })}>
            Continue to Vendor Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <div className="vendor-registration-page">
      <header className="registration-topbar">
        <button className="registration-brand" type="button" onClick={() => navigate("/login")}>
          <span><Building2 size={20} /></span>
          <div><strong>Tedo Bizz</strong><small>Vendor Registration</small></div>
        </button>
        <button type="button" onClick={() => navigate("/login")}>
          <ArrowLeft size={15} /> Back to Login
        </button>
      </header>

      <main className="registration-content">
        <header className="registration-heading">
          <span>Join the trusted vendor network</span>
          <h1>Register Your Business</h1>
          <p>Provide your business and account details to create a Tedo Bizz vendor profile.</p>
        </header>

        {error && <div className="registration-alert">{error}</div>}

        <form className="registration-form" onSubmit={handleSubmit}>
          <RegistrationSection icon={Building2} title="Business Information" description="Tell customers what your business offers.">
            <Field label="Business Name" icon={Building2} name="businessName" value={form.businessName} onChange={handleChange} placeholder="Registered or trading name" required />
            <Field label="Owner / Contact Name" icon={UserRound} name="ownerName" value={form.ownerName} onChange={handleChange} placeholder="Authorized contact person" required />
            <label className="registration-field">
              <span>Service Category</span>
              <select name="categoryId" value={form.categoryId} onChange={handleChange} disabled={loadingCategories} required>
                <option value="">{loadingCategories ? "Loading categories..." : "Select category"}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              {selectedCategory?.description && <small>{selectedCategory.description}</small>}
            </label>
            <Field label="Primary Service" icon={Wrench} name="serviceType" value={form.serviceType} onChange={handleChange} placeholder="Example: Electrical installations" required />
            <label className="registration-field full">
              <span>Business Description</span>
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Describe services, expertise and coverage area" rows={4} maxLength={1000} required />
            </label>
            <label className="registration-field">
              <span>Years of Experience</span>
              <select name="yearsOfExperience" value={form.yearsOfExperience} onChange={handleChange}>
                <option value="">Select experience</option>
                <option value="less_than_1">Less than 1 year</option>
                <option value="1_3">1 to 3 years</option>
                <option value="3_5">3 to 5 years</option>
                <option value="5_10">5 to 10 years</option>
                <option value="more_than_10">More than 10 years</option>
              </select>
            </label>
            <div className="registration-price-pair">
              <Field label="Minimum Price" icon={IndianRupee} name="minimumPrice" type="number" min="0" value={form.minimumPrice} onChange={handleChange} placeholder="0" />
              <Field label="Maximum Price" icon={IndianRupee} name="maximumPrice" type="number" min="0" value={form.maximumPrice} onChange={handleChange} placeholder="0" />
            </div>
            <div className="registration-price-pair">
              <Field label="Opening Time" icon={Clock3} name="openingTime" type="time" value={form.openingTime} onChange={handleChange} />
              <Field label="Closing Time" icon={Clock3} name="closingTime" type="time" value={form.closingTime} onChange={handleChange} />
            </div>
          </RegistrationSection>

          <RegistrationSection icon={Phone} title="Contact Details" description="Use active contact numbers for customer enquiries.">
            <Field label="Mobile Number" icon={Phone} name="phone" value={form.phone} onChange={handleChange} placeholder="9876543210" inputMode="numeric" maxLength={15} required />
            <Field label="WhatsApp Number" icon={Phone} name="whatsapp" value={form.whatsapp} onChange={handleChange} placeholder="Leave blank to use mobile" inputMode="numeric" maxLength={15} />
          </RegistrationSection>

          <RegistrationSection icon={MapPin} title="Business Address" description="This location may be shown in the public directory after approval.">
            <Field label="Address" icon={MapPin} name="address" value={form.address} onChange={handleChange} placeholder="Building, street and locality" required full />
            <Field label="City" name="city" value={form.city} onChange={handleChange} placeholder="Hyderabad" required />
            <Field label="State" name="state" value={form.state} onChange={handleChange} placeholder="Telangana" required />
            <Field label="Postal Code" name="postalCode" value={form.postalCode} onChange={handleChange} placeholder="500032" inputMode="numeric" maxLength={10} required />
            <Field label="Landmark" name="landmark" value={form.landmark} onChange={handleChange} placeholder="Optional landmark" />
          </RegistrationSection>

          <RegistrationSection icon={LockKeyhole} title="Vendor Login Account" description="Use these credentials to access the vendor panel after registration.">
            <Field label="Email Address" icon={Mail} name="email" type="email" value={form.email} onChange={handleChange} placeholder="business@example.com" autoComplete="email" required full />
            <PasswordField label="Password" name="password" value={form.password} onChange={handleChange} visible={showPassword} setVisible={setShowPassword} />
            <PasswordField label="Re-enter Password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} visible={showConfirmPassword} setVisible={setShowConfirmPassword} />
            <p className="password-guidance full">Use 8 to 72 characters with uppercase, lowercase, number and special character.</p>
          </RegistrationSection>

          <section className="registration-consent-card">
            <label><input type="checkbox" name="privacyAccepted" checked={form.privacyAccepted} onChange={handleChange} /><span>I agree to the Privacy Policy and consent to storage of the submitted business details.</span></label>
            <label><input type="checkbox" name="termsAccepted" checked={form.termsAccepted} onChange={handleChange} /><span>I agree to the Tedo Bizz Terms of Service and vendor onboarding review.</span></label>
          </section>

          <footer className="registration-actions">
            <button type="button" onClick={() => navigate("/login")}>Cancel</button>
            <button className="registration-submit" type="submit" disabled={submitting}>
              {submitting ? <><LoaderCircle className="registration-spinner" size={17} /> Submitting...</> : "Submit Vendor Registration"}
            </button>
          </footer>
        </form>
      </main>
    </div>
  );
}

function RegistrationSection({ icon: Icon, title, description, children }) {
  return <section className="registration-section"><header><span><Icon size={20} /></span><div><h2>{title}</h2><p>{description}</p></div></header><div className="registration-grid">{children}</div></section>;
}

function Field({ label, icon: Icon, full = false, ...inputProps }) {
  return <label className={`registration-field ${full ? "full" : ""}`}><span>{label}</span><div className="registration-input">{Icon && <Icon size={16} />}<input {...inputProps} /></div></label>;
}

function PasswordField({ label, visible, setVisible, ...inputProps }) {
  return <label className="registration-field"><span>{label}</span><div className="registration-input"><LockKeyhole size={16} /><input {...inputProps} type={visible ? "text" : "password"} autoComplete="new-password" required /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>;
}

export default VendorRegistrationPage;
