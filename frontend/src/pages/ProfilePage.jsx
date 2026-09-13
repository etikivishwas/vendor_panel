import {
  Building2,
  ImagePlus,
  LoaderCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getVendorProfile,
  updateVendorProfile,
} from "../api/profileApi";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

import "../styles/profile.css";

const emptyForm = {
  businessName: "",
  categoryId: "",
  phone: "",
  email: "",
  whatsapp: "",
  address: "",
  city: "",
  postalCode: "",
  description: "",
};

function ProfilePage() {
  const logoInputRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [originalForm, setOriginalForm] = useState(emptyForm);
  const [vendor, setVendor] = useState(null);
  const [categories, setCategories] = useState([]);
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [sameAsPhone, setSameAsPhone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    "http://localhost:5000";

  const displayImageUrl = useMemo(() => {
    if (logoPreview) {
      return logoPreview;
    }

    if (!existingImageUrl) {
      return "";
    }

    if (
      existingImageUrl.startsWith("http://") ||
      existingImageUrl.startsWith("https://")
    ) {
      return existingImageUrl;
    }

    return `${backendUrl}${existingImageUrl}`;
  }, [backendUrl, existingImageUrl, logoPreview]);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const data = await getVendorProfile();

        if (!active) {
          return;
        }

        const profile = data.profile;

        const loadedForm = {
          businessName: profile.businessName || "",
          categoryId:
            profile.categoryId !== null &&
            profile.categoryId !== undefined
              ? String(profile.categoryId)
              : "",
          phone: profile.phone || "",
          email: profile.email || "",
          whatsapp: profile.whatsapp || "",
          address: profile.address || "",
          city: profile.city || "",
          postalCode: profile.postalCode || "",
          description: profile.description || "",
        };

        setForm(loadedForm);
        setOriginalForm(loadedForm);
        setCategories(data.categories || []);
        setExistingImageUrl(profile.imageUrl || "");

        setVendor({
          businessName: profile.businessName || "Vendor",
          avatarUrl: profile.imageUrl || "",
        });

        setSameAsPhone(
          Boolean(profile.phone) &&
            profile.phone === profile.whatsapp
        );
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load the vendor profile"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }
    };
  }, [logoPreview]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setError("");
    setSuccess("");

    setForm((currentForm) => {
      const nextForm = {
        ...currentForm,
        [name]: value,
      };

      if (name === "phone" && sameAsPhone) {
        nextForm.whatsapp = value;
      }

      return nextForm;
    });
  };

  const handleSameAsPhone = (event) => {
    const checked = event.target.checked;

    setSameAsPhone(checked);
    setError("");
    setSuccess("");

    setForm((currentForm) => ({
      ...currentForm,
      whatsapp: checked
        ? currentForm.phone
        : currentForm.whatsapp,
    }));
  };

  const handleLogoSelection = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please select a JPG, PNG, or WebP image");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The selected image must be smaller than 5 MB");
      event.target.value = "";
      return;
    }

    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }

    setError("");
    setSuccess("");
    setSelectedLogo(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleImageError = () => {
    setExistingImageUrl("");

    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
      setLogoPreview("");
    }
  };

  const handleCancel = () => {
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }

    setForm(originalForm);
    setSelectedLogo(null);
    setLogoPreview("");
    setError("");
    setSuccess("");

    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }

    setSameAsPhone(
      Boolean(originalForm.phone) &&
        originalForm.phone === originalForm.whatsapp
    );
  };

  const validateForm = () => {
    if (!form.businessName.trim()) {
      return "Business name is required";
    }

    if (!form.categoryId) {
      return "Please select a business category";
    }

    if (!form.phone.trim()) {
      return "Phone number is required";
    }

    if (!form.address.trim()) {
      return "Street address is required";
    }

    if (!form.city.trim()) {
      return "City is required";
    }

    if (!form.postalCode.trim()) {
      return "Postal code is required";
    }

    if (form.description.length > 255) {
      return "Business description cannot exceed 255 characters";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      setSuccess("");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const normalizedForm = {
        ...form,
        whatsapp:
          sameAsPhone || !form.whatsapp.trim()
            ? form.phone
            : form.whatsapp,
      };

      const response = await updateVendorProfile({
        form: normalizedForm,
        logo: selectedLogo,
      });

      const savedProfile = response.data?.profile;

      const savedForm = {
        ...normalizedForm,
        businessName:
          savedProfile?.businessName ||
          normalizedForm.businessName,
        categoryId:
          savedProfile?.categoryId !== undefined &&
          savedProfile?.categoryId !== null
            ? String(savedProfile.categoryId)
            : normalizedForm.categoryId,
        phone:
          savedProfile?.phone || normalizedForm.phone,
        whatsapp:
          savedProfile?.whatsapp || normalizedForm.whatsapp,
        address:
          savedProfile?.address || normalizedForm.address,
        city:
          savedProfile?.city || normalizedForm.city,
        postalCode:
          savedProfile?.postalCode || normalizedForm.postalCode,
        description:
          savedProfile?.description ??
          normalizedForm.description,
      };

      if (savedProfile?.imageUrl) {
        setExistingImageUrl(savedProfile.imageUrl);
      }

      if (logoPreview) {
        URL.revokeObjectURL(logoPreview);
      }

      setLogoPreview("");
      setSelectedLogo(null);

      if (logoInputRef.current) {
        logoInputRef.current.value = "";
      }

      setForm(savedForm);
      setOriginalForm(savedForm);

      setSameAsPhone(
        Boolean(savedForm.phone) &&
          savedForm.phone === savedForm.whatsapp
      );

      setVendor((currentVendor) => ({
        ...currentVendor,
        businessName: savedForm.businessName,
        avatarUrl:
          savedProfile?.imageUrl ||
          currentVendor?.avatarUrl ||
          "",
      }));

      let existingStoredVendor = {};

      try {
        existingStoredVendor = JSON.parse(
          localStorage.getItem("vendor") || "{}"
        );
      } catch {
        existingStoredVendor = {};
      }

      localStorage.setItem(
        "vendor",
        JSON.stringify({
          ...existingStoredVendor,
          businessName: savedForm.businessName,
          avatarUrl:
            savedProfile?.imageUrl ||
            existingStoredVendor.avatarUrl ||
            "",
        })
      );

      setSuccess(
        response.message || "Profile updated successfully"
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update the profile"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar />

        <div className="dashboard-main">
          <div className="profile-page-state">
            <LoaderCircle
              className="profile-spinner"
              size={28}
            />
            <span>Loading profile...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar vendor={vendor} />

        <main className="profile-content">
          <header className="profile-title">
            <h1>My Profile</h1>
            <p>
              Manage your business information and public presence.
            </p>
          </header>

          {error && (
            <div
              className="profile-alert profile-alert-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {success && (
            <div
              className="profile-alert profile-alert-success"
              role="status"
            >
              {success}
            </div>
          )}

          <form
            className="profile-form"
            onSubmit={handleSubmit}
          >
            <section className="profile-section">
              <h2>Business Overview</h2>
              <div className="profile-section-divider" />

              <div className="business-overview-grid">
                <div className="logo-upload-group">
                  <button
                    className="logo-preview-button"
                    type="button"
                    onClick={() =>
                      logoInputRef.current?.click()
                    }
                    aria-label="Upload business logo"
                  >
                    {displayImageUrl ? (
                      <img
                        src={displayImageUrl}
                        alt="Business logo"
                        onError={handleImageError}
                      />
                    ) : (
                      <span className="logo-placeholder">
                        <Building2 size={29} />
                        <small>No logo</small>
                      </span>
                    )}

                    <span className="logo-edit-icon">
                      <ImagePlus size={14} />
                    </span>
                  </button>

                  <input
                    ref={logoInputRef}
                    className="visually-hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleLogoSelection}
                  />

                  <button
                    className="upload-logo-link"
                    type="button"
                    onClick={() =>
                      logoInputRef.current?.click()
                    }
                  >
                    Upload Logo
                  </button>

                  <small>JPG, PNG or WebP. Max 5 MB.</small>
                </div>

                <div className="overview-fields">
                  <label className="profile-field">
                    <span>Business Name</span>
                    <input
                      name="businessName"
                      value={form.businessName}
                      onChange={handleChange}
                      placeholder="e.g. Acme Services"
                      maxLength={150}
                      required
                    />
                  </label>

                  <label className="profile-field">
                    <span>Category</span>
                    <select
                      name="categoryId"
                      value={form.categoryId}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Select a category</option>
                      {categories.map((category) => (
                        <option
                          key={category.id}
                          value={category.id}
                        >
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </section>

            <section className="profile-section">
              <h2>Contact Information</h2>
              <div className="profile-section-divider" />

              <div className="two-column-fields">
                <label className="profile-field">
                  <span>Phone Number</span>
                  <input
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="+91 98765 43210"
                    maxLength={20}
                    required
                  />
                </label>

                <label className="profile-field">
                  <span>Email Address</span>
                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    readOnly
                    title="The login email cannot be changed here"
                  />
                </label>
              </div>

              <label className="profile-field">
                <span>WhatsApp Number</span>
                <input
                  name="whatsapp"
                  type="tel"
                  value={form.whatsapp}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  maxLength={20}
                  disabled={sameAsPhone}
                />
              </label>

              <label className="same-phone-checkbox">
                <input
                  type="checkbox"
                  checked={sameAsPhone}
                  onChange={handleSameAsPhone}
                />
                <span>Same as phone number</span>
              </label>
            </section>

            <section className="profile-section">
              <h2>Business Location</h2>
              <div className="profile-section-divider" />

              <label className="profile-field">
                <span>Street Address</span>
                <input
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="123 Main Street"
                  maxLength={255}
                  required
                />
              </label>

              <div className="two-column-fields profile-location-row">
                <label className="profile-field">
                  <span>City</span>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Hyderabad"
                    maxLength={100}
                    required
                  />
                </label>

                <label className="profile-field">
                  <span>Pin Code / Zip</span>
                  <input
                    name="postalCode"
                    value={form.postalCode}
                    onChange={handleChange}
                    placeholder="500019"
                    maxLength={20}
                    required
                  />
                </label>
              </div>
            </section>

            <section className="profile-section">
              <h2>Business Description</h2>
              <div className="profile-section-divider" />

              <label className="profile-field">
                <span>About the Business</span>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Describe your services, experience, and what makes your business unique..."
                  maxLength={255}
                  rows={5}
                />
                <small className="character-count">
                  {form.description.length}/255
                </small>
              </label>
            </section>

            <footer className="profile-actions">
              <button
                className="profile-cancel-button"
                type="button"
                onClick={handleCancel}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="profile-save-button"
                type="submit"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <LoaderCircle
                      className="profile-spinner"
                      size={16}
                    />
                    <span>Saving...</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </footer>
          </form>
        </main>
      </div>
    </div>
  );
}

export default ProfilePage;
