import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Info,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createVerificationPaymentSession,
  getApplicationReview,
} from "../api/applicationReviewApi";
import "../styles/applicationReview.css";

const formatMoney = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(value || 0);

const documentLabels = {
  gst_certificate: "GST Certificate",
  msme_certificate: "MSME Certificate",
  identity_proof: "Other Identity Proof",
};

function ApplicationReviewPage() {
  const navigate = useNavigate();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [error, setError] = useState("");

  const loadReview = async () => {
    setError("");
    try {
      const data = await getApplicationReview();
      setReview(data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to load application review"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReview();
    const timer = window.setInterval(loadReview, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const proceedToPayment = async () => {
    if (!review?.submission.paymentEnabled) return;

    setCreatingPayment(true);
    setError("");
    try {
      const response = await createVerificationPaymentSession();
      navigate(
        `/document-verification/payment/${response.data.paymentToken}`
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to create payment session"
      );
    } finally {
      setCreatingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="review-fullscreen review-loading">
        <LoaderCircle className="review-spinner" size={34} />
        Loading application review...
      </div>
    );
  }

  const verified = Boolean(review?.submission.documentsApproved);
  const rejected = review?.submission.status === "rejected";

  return (
    <div className="review-fullscreen">
      <main className="review-page">
        <header className="review-header">
          <button type="button" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          <h1>Application Review</h1>
          <p>
            Review your application details while the submitted documents are
            verified before payment.
          </p>
        </header>

        {error && <div className="review-alert error">{error}</div>}

        {review && (
          <div className="review-layout">
            <div className="review-main-column">
              <section className="review-card certificate-card">
                <header>
                  <FileCheck2 size={20} />
                  <h2>Certificate Type</h2>
                </header>
                <div className="review-detail-grid two-columns">
                  <Detail
                    label="Certificate"
                    value={review.certificate.type}
                  />
                  <Detail
                    label="Validity Period"
                    value={review.certificate.validityPeriod}
                  />
                  <Detail
                    label="Service Level"
                    value={review.certificate.serviceLevel}
                  />
                  <Detail
                    label="Documents Submitted"
                    value={`${review.documents.length} documents`}
                  />
                </div>
              </section>

              <section className="review-card">
                <header>
                  <UserRound size={20} />
                  <h2>Applicant Details</h2>
                </header>
                <div className="review-detail-grid two-columns">
                  <Detail
                    label="Full Name"
                    value={review.applicant.fullName}
                  />
                  <Detail
                    label="Email Address"
                    value={review.applicant.emailAddress}
                  />
                  <Detail
                    label="Phone Number"
                    value={review.applicant.phoneNumber}
                  />
                  <Detail label="Role" value={review.applicant.role} />
                </div>
              </section>

              <section className="review-card">
                <header>
                  <BriefcaseBusiness size={20} />
                  <h2>Business Details</h2>
                </header>
                <div className="review-detail-grid two-columns">
                  <Detail
                    label="Company Name"
                    value={review.business.companyName}
                  />
                  <Detail
                    label="Registration Number"
                    value={review.business.registrationNumber}
                  />
                  <Detail label="Industry" value={review.business.industry} />
                  <Detail
                    label="Registered Address"
                    value={review.business.registeredAddress}
                    full
                  />
                </div>
              </section>

              <section className="review-card documents-card">
                <header>
                  <FileCheck2 size={20} />
                  <h2>Submitted Documents</h2>
                </header>
                <div className="submitted-document-list">
                  {review.documents.map((document) => (
                    <div
                      className="submitted-document-row"
                      key={document.documentType}
                    >
                      <span className={`document-state ${document.reviewStatus}`}>
                        {document.reviewStatus === "approved" ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <Clock3 size={17} />
                        )}
                      </span>
                      <div>
                        <strong>
                          {documentLabels[document.documentType] ||
                            document.documentType}
                        </strong>
                        <small>{document.originalFileName}</small>
                      </div>
                      <em>{document.reviewStatus.replace("_", " ")}</em>
                    </div>
                  ))}
                </div>
              </section>

              <section className="review-card verification-card">
                <header>
                  <ShieldCheck size={20} />
                  <h2>Verification Status</h2>
                </header>

                <div
                  className={`verification-result ${
                    verified ? "verified" : rejected ? "rejected" : "pending"
                  }`}
                >
                  {verified ? (
                    <CheckCircle2 size={24} />
                  ) : (
                    <Clock3 size={24} />
                  )}
                  <div>
                    <strong>
                      {verified
                        ? "Documents Verified"
                        : rejected
                          ? "Changes Required"
                          : "Verification Pending"}
                    </strong>
                    <p>
                      {verified
                        ? "All required documents have been approved. Payment is now enabled."
                        : rejected
                          ? review.submission.reviewerRemarks ||
                            "One or more documents require correction."
                          : "Your documents have been submitted and are awaiting administrator review."}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="review-sidebar-column">
              <section className="application-summary-card">
                <h2>Application Summary</h2>
                <div>
                  <span>Registration Fee</span>
                  <strong>{formatMoney(review.fees.registrationFee)}</strong>
                </div>
                <div>
                  <span>Verification Processing</span>
                  <strong>{formatMoney(review.fees.processingFee)}</strong>
                </div>
                <div>
                  <span>Taxes ({review.fees.taxRate}%)</span>
                  <strong>{formatMoney(review.fees.taxAmount)}</strong>
                </div>
                <div className="summary-total">
                  <span>Total Due</span>
                  <strong>{formatMoney(review.fees.totalAmount)}</strong>
                </div>

                <button
                  type="button"
                  onClick={proceedToPayment}
                  disabled={
                    !review.submission.paymentEnabled || creatingPayment
                  }
                >
                  {creatingPayment ? (
                    <>
                      <LoaderCircle className="review-spinner" size={17} />
                      Preparing Payment...
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={17} />
                      Proceed to Payment
                    </>
                  )}
                </button>

                {!review.submission.paymentEnabled && (
                  <small className="payment-locked-note">
                    <LockKeyhole size={12} /> Payment unlocks after document
                    verification.
                  </small>
                )}

                <small className="secure-payment-note">
                  <ShieldCheck size={12} /> Secure SSL Encrypted Payment
                </small>
              </section>

              <section className="review-terms-card">
                <Info size={18} />
                <p>
                  By proceeding to payment, you confirm that all submitted
                  details are accurate and agree to the Terms of Service.
                </p>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Detail({ label, value, full = false }) {
  return (
    <div className={full ? "review-detail full" : "review-detail"}>
      <small>{label}</small>
      <strong>{value || "Not provided"}</strong>
    </div>
  );
}

export default ApplicationReviewPage;
