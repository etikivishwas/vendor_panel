import {
  ArrowRight,
  Clock3,
  Headphones,
  IndianRupee,
  LockKeyhole,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import gstImage from "../assets/gst-registration.png";
import msmeImage from "../assets/msme-udyam.png";
import labourImage from "../assets/labour-registration.png";
import verificationImage from "../assets/why-register-tedo-bizz.png";
import "../styles/getDocuments.css";

const registrations = [
  {
    key: "gst-registration",
    title: "GST Registration",
    badge: "Mandatory",
    badgeClass: "mandatory",
    image: gstImage,
    description:
      "Essential for businesses with turnover exceeding threshold limits or engaged in inter-state supply of goods and services.",
    timeline: "3-5 Working Days",
    price: "₹1,499",
    priceNote: "All-inclusive",
  },
  {
    key: "msme-udyam",
    title: "MSME / Udyam",
    badge: "Benefits",
    badgeClass: "benefits",
    image: msmeImage,
    description:
      "Avail government subsidies, collateral-free loans, and protection against delayed payments for your micro, small or medium enterprise.",
    timeline: "1-2 Working Days",
    price: "₹999",
    priceNote: "One-time fee",
  },
  {
    key: "labour-registration",
    title: "Labour Registration",
    badge: "Regulatory",
    badgeClass: "regulatory",
    image: labourImage,
    description:
      "Ensure legal compliance for your workforce. Mandatory for shops, commercial establishments, and construction projects.",
    timeline: "5-7 Working Days",
    price: "₹1,999",
    priceNote: "State dependent",
  },
];

const benefits = [
  {
    icon: ShieldCheck,
    title: "Expert Vetted",
    text: "Every application is reviewed by legal experts before submission.",
    className: "green",
  },
  {
    icon: Zap,
    title: "Speedy Process",
    text: "Proprietary automation helps deliver applications faster.",
    className: "blue",
  },
  {
    icon: LockKeyhole,
    title: "Secure Data",
    text: "Enterprise-grade protection for your business documents.",
    className: "amber",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    text: "Status updates and dedicated assistance through the process.",
    className: "slate",
  },
];

function GetDocumentsPage() {
  const navigate = useNavigate();

  const vendor = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("vendor") || "{}");
    } catch {
      return {};
    }
  }, []);

  const handleApply = (registrationKey) => {
    navigate(`/document-verification/get-documents/apply/${registrationKey}`);
  };

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar vendor={vendor} />

        <main className="certificate-content">
          <header className="certificate-header">
            <h1>Get Business Certificate</h1>
            <p>
              Select the registration that fits your business stage. Our expert
              team handles the paperwork while you focus on growth.
            </p>
          </header>

          <section className="registration-grid">
            {registrations.map((registration) => (
              <article className="registration-card" key={registration.key}>
                <div className="registration-image">
                  <img src={registration.image} alt="" />
                </div>

                <div className="registration-body">
                  <div className="registration-title-row">
                    <h2>{registration.title}</h2>
                    <span
                      className={`registration-badge ${registration.badgeClass}`}
                    >
                      {registration.badge}
                    </span>
                  </div>

                  <p className="registration-description">
                    {registration.description}
                  </p>

                  <div className="registration-details">
                    <span>
                      <Clock3 size={14} /> {registration.timeline}
                    </span>
                    <span className="registration-price-row">
                      <IndianRupee size={14} />
                      <strong>{registration.price}</strong>
                      <small>{registration.priceNote}</small>
                    </span>
                  </div>

                  <button
                    className="registration-apply-button"
                    type="button"
                    onClick={() => handleApply(registration.key)}
                  >
                    Apply Now <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section className="why-tedo-panel">
            <div className="why-tedo-copy">
              <h2>Why Register with Tedo Bizz?</h2>

              <div className="why-tedo-benefits">
                {benefits.map((benefit) => {
                  const Icon = benefit.icon;

                  return (
                    <div className="why-tedo-benefit" key={benefit.title}>
                      <span className={benefit.className}>
                        <Icon size={16} />
                      </span>
                      <div>
                        <h3>{benefit.title}</h3>
                        <p>{benefit.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="why-tedo-image">
              <img
                src={verificationImage}
                alt="Business registration and document verification workspace"
              />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default GetDocumentsPage;
