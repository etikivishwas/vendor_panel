import {
  Archive,
  ImagePlus,
  LoaderCircle,
  MoreVertical,
  Pencil,
  PlusCircle,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  changeVendorServiceStatus,
  createVendorService,
  getServiceOptions,
  getVendorServices,
  updateVendorService,
} from "../api/vendorServicesApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/services.css";

const emptyForm = {
  serviceId: "",
  categoryId: "",
  name: "",
  description: "",
  pricingType: "fixed",
  priceMin: "",
  priceMax: "",
  status: "draft",
};

const tabs = [
  { key: "active", label: "Active Services" },
  { key: "draft", label: "Drafts" },
  { key: "archived", label: "Archived" },
];

const formatPrice = (service) => {
  const format = (value) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  if (service.pricingType === "quote") return "Contact for quote";
  if (service.pricingType === "range") return `₹${format(service.priceMin)} - ₹${format(service.priceMax)}`;
  if (service.pricingType === "starting_from") return `₹${format(service.priceMin)}`;
  return `₹${format(service.priceMin)}`;
};

function ServicesPage() {
  const imageInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("active");
  const [search, setSearch] = useState("");
  const [services, setServices] = useState([]);
  const [counts, setCounts] = useState({ active: 0, draft: 0, archived: 0 });
  const [categories, setCategories] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const vendor = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("vendor") || "{}"); }
    catch { return {}; }
  }, []);

  const filteredCatalogServices = useMemo(
    () => catalogServices.filter((item) => !form.categoryId || String(item.categoryId) === String(form.categoryId)),
    [catalogServices, form.categoryId]
  );

  const loadServices = async (tab = activeTab, term = search) => {
    setLoading(true);
    setError("");
    try {
      const data = await getVendorServices({ status: tab, search: term });
      setServices(data.services || []);
      setCounts(data.counts || { active: 0, draft: 0, archived: 0 });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load services");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        const options = await getServiceOptions();
        setCategories(options.categories || []);
        setCatalogServices(options.catalogServices || []);
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Unable to load service options");
      }
      await loadServices("active", "");
    };
    initialize();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadServices(activeTab, search), 300);
    return () => window.clearTimeout(timer);
  }, [activeTab, search]);

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const openCreateModal = () => {
    setEditingService(null);
    setForm({ ...emptyForm, status: activeTab === "archived" ? "draft" : activeTab });
    setImage(null);
    setImagePreview("");
    setError("");
    setModalOpen(true);
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setForm({
      serviceId: service.serviceId ? String(service.serviceId) : "",
      categoryId: String(service.categoryId),
      name: service.name,
      description: service.description,
      pricingType: service.pricingType,
      priceMin: service.priceMin ?? "",
      priceMax: service.priceMax ?? "",
      status: service.status,
    });
    setImage(null);
    setImagePreview(service.imageUrl ? `${backendUrl}${service.imageUrl}` : "");
    setOpenMenuId(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setModalOpen(false);
    setEditingService(null);
    setImage(null);
    setImagePreview("");
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === "categoryId") next.serviceId = "";
      return next;
    });
  };

  const handleCatalogService = (event) => {
    const serviceId = event.target.value;
    const selected = catalogServices.find((item) => String(item.id) === serviceId);
    setForm((current) => ({
      ...current,
      serviceId,
      name: selected?.name || current.name,
      description: selected?.description || current.description,
    }));
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Only JPG, PNG, and WebP images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Service image must be smaller than 5 MB");
      return;
    }
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
    setError("");
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = editingService
        ? await updateVendorService({ id: editingService.id, form, image })
        : await createVendorService({ form, image });
      setSuccess(response.message);
      closeModal();
      await loadServices(activeTab, search);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save service");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const response = await changeVendorServiceStatus(id, status);
      setSuccess(response.message);
      setOpenMenuId(null);
      await loadServices(activeTab, search);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update service status");
    }
  };

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="dashboard-main">
        <Topbar vendor={vendor} />
        <main className="services-content">
          <header className="services-header">
            <div>
              <h1>Services Management</h1>
              <p>Customize, manage, and scale your professional service offerings.</p>
            </div>
            <button className="add-service-button" type="button" onClick={openCreateModal}>
              <PlusCircle size={19} /> Add New Service
            </button>
          </header>

          {error && <div className="services-alert error">{error}</div>}
          {success && <div className="services-alert success">{success}</div>}

          <div className="services-toolbar">
            <div className="services-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={activeTab === tab.key ? "active" : ""}
                  onClick={() => setActiveTab(tab.key)}
                  type="button"
                >
                  {tab.label}{tab.key !== "active" ? ` (${counts[tab.key]})` : ""}
                </button>
              ))}
            </div>
            <label className="services-search">
              <Search size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search services..." />
            </label>
          </div>

          {loading ? (
            <div className="services-state"><LoaderCircle className="services-spinner" /> Loading services...</div>
          ) : services.length === 0 ? (
            <div className="services-empty">
              <h2>No {activeTab} services</h2>
              <p>Create a new service or select another tab.</p>
              <button type="button" onClick={openCreateModal}><PlusCircle size={18} /> Add New Service</button>
            </div>
          ) : (
            <section className="services-grid">
              {services.map((service) => (
                <article className="service-card" key={service.id}>
                  <div className="service-card-image">
                    {service.imageUrl ? (
                      <img src={`${backendUrl}${service.imageUrl}`} alt="" />
                    ) : (
                      <div className="service-image-placeholder"><ImagePlus size={30} /></div>
                    )}
                    <span className={`service-status ${service.status}`}>{service.status}</span>
                    <span className="service-category">{service.categoryName}</span>
                  </div>

                  <div className="service-card-body">
                    <div className="service-card-title">
                      <h2>{service.name}</h2>
                      <div className="service-menu-wrap">
                        <button type="button" onClick={() => setOpenMenuId(openMenuId === service.id ? null : service.id)}>
                          <MoreVertical size={18} />
                        </button>
                        {openMenuId === service.id && (
                          <div className="service-menu">
                            <button type="button" onClick={() => openEditModal(service)}><Pencil size={14} /> Edit</button>
                            {service.status !== "active" && <button type="button" onClick={() => updateStatus(service.id, "active")}>Set Active</button>}
                            {service.status !== "draft" && <button type="button" onClick={() => updateStatus(service.id, "draft")}>Move to Draft</button>}
                            {service.status !== "archived" && <button type="button" onClick={() => updateStatus(service.id, "archived")}><Archive size={14} /> Archive</button>}
                          </div>
                        )}
                      </div>
                    </div>
                    <p>{service.description || "No description has been added."}</p>
                    <div className="service-price-row">
                      <div>
                        <small>{service.pricingType === "starting_from" ? "Starting From" : service.pricingType === "quote" ? "Pricing" : "Price Range"}</small>
                        <strong>{formatPrice(service)}</strong>
                      </div>
                      <button type="button" onClick={() => openEditModal(service)}><Pencil size={14} /> Edit</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </main>
      </div>

      {modalOpen && (
        <div className="service-modal-backdrop" role="presentation">
          <div className="service-modal" role="dialog" aria-modal="true" aria-label={editingService ? "Edit service" : "Add service"}>
            <header>
              <div><h2>{editingService ? "Edit Service" : "Add New Service"}</h2><p>Configure the service shown on your public profile.</p></div>
              <button type="button" onClick={closeModal}><X size={20} /></button>
            </header>

            <form onSubmit={handleSave}>
              <div className="service-modal-grid">
                <label><span>Category</span><select name="categoryId" value={form.categoryId} onChange={handleFormChange} required><option value="">Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label><span>Catalog Service (optional)</span><select name="serviceId" value={form.serviceId} onChange={handleCatalogService}><option value="">Custom service</option>{filteredCatalogServices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className="full"><span>Service Name</span><input name="name" value={form.name} onChange={handleFormChange} maxLength={150} required /></label>
                <label className="full"><span>Description</span><textarea name="description" value={form.description} onChange={handleFormChange} maxLength={1000} rows={4} /></label>
                <label><span>Pricing Type</span><select name="pricingType" value={form.pricingType} onChange={handleFormChange}><option value="fixed">Fixed price</option><option value="starting_from">Starting from</option><option value="range">Price range</option><option value="quote">Contact for quote</option></select></label>
                <label><span>Status</span><select name="status" value={form.status} onChange={handleFormChange}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
                {form.pricingType !== "quote" && <label><span>{form.pricingType === "range" ? "Minimum Price" : "Price"}</span><input name="priceMin" type="number" min="0" step="0.01" value={form.priceMin} onChange={handleFormChange} required /></label>}
                {form.pricingType === "range" && <label><span>Maximum Price</span><input name="priceMax" type="number" min="0" step="0.01" value={form.priceMax} onChange={handleFormChange} required /></label>}
                <label className="full service-image-field"><span>Service Image</span><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} />{imagePreview && <img src={imagePreview} alt="Service preview" />}</label>
              </div>
              <footer><button type="button" className="modal-cancel" onClick={closeModal}>Cancel</button><button type="submit" className="modal-save" disabled={saving}>{saving ? <><LoaderCircle className="services-spinner" size={16} /> Saving...</> : "Save Service"}</button></footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServicesPage;
