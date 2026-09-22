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

import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  createVerificationPaymentSession,
  getApplicationReview,
} from "../api/applicationReviewApi";

import {
  createVerificationRazorpayOrder,
  verifyVerificationRazorpayPayment,
} from "../api/razorpayPaymentApi";

import {
  loadRazorpayCheckout,
} from "../utils/loadRazorpay";

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

  const [review, setReview] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [
    creatingPayment,
    setCreatingPayment,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const loadReview = async ({
    showLoading = false,
  } = {}) => {
    if (showLoading) {
      setLoading(true);
    }

    setError("");

    try {
      const data =
        await getApplicationReview();

      setReview(data);
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          requestError.message ||
          "Unable to load application review"
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadReview({
      showLoading: true,
    });

    const timer =
      window.setInterval(() => {
        loadReview();
      }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const proceedToPayment =
    async () => {
      if (
        !review?.submission
          ?.paymentEnabled
      ) {
        setError(
          "Payment is not enabled yet. Payment will unlock after all documents are approved."
        );

        return;
      }

      setCreatingPayment(true);
      setError("");
      setSuccess("");

      try {
        /*
          Step 1:
          Create the internal verification
          payment session.
        */
        const sessionResponse =
          await createVerificationPaymentSession();

        /*
          Support the common API response
          structures:

          response.data.paymentToken
          response.paymentToken
          response.data.data.paymentToken
        */
        const paymentToken =
          sessionResponse?.data
            ?.paymentToken ||
          sessionResponse
            ?.paymentToken ||
          sessionResponse?.data?.data
            ?.paymentToken;

        if (!paymentToken) {
          throw new Error(
            "The server did not return a verification payment token."
          );
        }

        /*
          Step 2:
          Load the Razorpay Checkout script.
        */
        await loadRazorpayCheckout();

        if (!window.Razorpay) {
          throw new Error(
            "Razorpay Checkout could not be loaded."
          );
        }

        /*
          Step 3:
          Ask the backend to create the
          Razorpay order.

          The backend calculates the amount
          from the database.
        */
        const order =
          await createVerificationRazorpayOrder(
            paymentToken
          );

        if (
          !order?.keyId ||
          !order?.orderId ||
          !order?.amount
        ) {
          throw new Error(
            "The Razorpay order response is incomplete."
          );
        }

        /*
          Step 4:
          Configure and open Razorpay.
        */
        const options = {
          key: order.keyId,

          amount: order.amount,

          currency:
            order.currency || "INR",

          name:
            order.name ||
            "Vendor Verification",

          description:
            order.description ||
            "Vendor verification payment",

          order_id:
            order.orderId,

          prefill:
            order.prefill || {
              name:
                review?.applicant
                  ?.fullName || "",

              email:
                review?.applicant
                  ?.emailAddress || "",

              contact:
                review?.applicant
                  ?.phoneNumber || "",
            },

          notes: {
            paymentPurpose:
              "vendor_verification",
          },

          theme: {
            color: "#0b2f45",
          },

          modal: {
            escape: true,

            confirm_close: true,

            ondismiss: () => {
              setCreatingPayment(
                false
              );
            },
          },

          handler: async (
            razorpayResponse
          ) => {
            try {
              /*
                Step 5:
                Verify the Razorpay signature,
                order, payment, amount and
                currency on the backend.
              */
              await verifyVerificationRazorpayPayment(
                paymentToken,
                razorpayResponse
              );

              setSuccess(
                "Payment completed successfully. Your verification application is now pending final review."
              );

              setError("");

              /*
                Reload the application so the
                latest payment and verification
                status is displayed.
              */
              await loadReview();

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            } catch (
              verificationError
            ) {
              setError(
                verificationError
                  .response?.data
                  ?.message ||
                  verificationError
                    .message ||
                  "Payment was completed, but server verification failed. Please contact support before trying again."
              );
            } finally {
              setCreatingPayment(
                false
              );
            }
          },
        };

        const razorpayCheckout =
          new window.Razorpay(
            options
          );

        razorpayCheckout.on(
          "payment.failed",
          (failureResponse) => {
            const failure =
              failureResponse?.error;

            setError(
              failure?.description ||
                failure?.reason ||
                "The payment failed. Please try again."
            );

            setCreatingPayment(
              false
            );
          }
        );

        razorpayCheckout.open();
      } catch (requestError) {
        console.error(
          "Open verification Razorpay checkout error:",
          requestError
        );

        setError(
          requestError.response?.data
            ?.message ||
            requestError.message ||
            "Unable to open Razorpay Checkout"
        );

        setCreatingPayment(false);
      }
    };

  if (loading) {
    return (
      <div className="review-fullscreen review-loading">
        <LoaderCircle
          className="review-spinner"
          size={34}
        />

        Loading application review...
      </div>
    );
  }

  const verified = Boolean(
    review?.submission
      ?.documentsApproved
  );

  const rejected =
    review?.submission?.status ===
    "rejected";

  const paymentCompleted =
    review?.payment?.status ===
      "paid" ||
    review?.submission
      ?.paymentStatus === "paid";

  return (
    <div className="review-fullscreen">
      <main className="review-page">
        <header className="review-header">
          <button
            type="button"
            onClick={() =>
              navigate("/dashboard")
            }
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>

          <h1>Application Review</h1>

          <p>
            Review your application
            details while the submitted
            documents are verified before
            payment.
          </p>
        </header>

        {error && (
          <div
            className="review-alert error"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            className="review-alert success"
            role="status"
          >
            <CheckCircle2 size={18} />

            <span>{success}</span>
          </div>
        )}

        {review && (
          <div className="review-layout">
            <div className="review-main-column">
              <section className="review-card certificate-card">
                <header>
                  <FileCheck2
                    size={20}
                  />

                  <h2>
                    Certificate Type
                  </h2>
                </header>

                <div className="review-detail-grid two-columns">
                  <Detail
                    label="Certificate"
                    value={
                      review.certificate
                        .type
                    }
                  />

                  <Detail
                    label="Validity Period"
                    value={
                      review.certificate
                        .validityPeriod
                    }
                  />

                  <Detail
                    label="Service Level"
                    value={
                      review.certificate
                        .serviceLevel
                    }
                  />

                  <Detail
                    label="Documents Submitted"
                    value={`${review.documents.length} documents`}
                  />
                </div>
              </section>

              <section className="review-card">
                <header>
                  <UserRound
                    size={20}
                  />

                  <h2>
                    Applicant Details
                  </h2>
                </header>

                <div className="review-detail-grid two-columns">
                  <Detail
                    label="Full Name"
                    value={
                      review.applicant
                        .fullName
                    }
                  />

                  <Detail
                    label="Email Address"
                    value={
                      review.applicant
                        .emailAddress
                    }
                  />

                  <Detail
                    label="Phone Number"
                    value={
                      review.applicant
                        .phoneNumber
                    }
                  />

                  <Detail
                    label="Role"
                    value={
                      review.applicant
                        .role
                    }
                  />
                </div>
              </section>

              <section className="review-card">
                <header>
                  <BriefcaseBusiness
                    size={20}
                  />

                  <h2>
                    Business Details
                  </h2>
                </header>

                <div className="review-detail-grid two-columns">
                  <Detail
                    label="Company Name"
                    value={
                      review.business
                        .companyName
                    }
                  />

                  <Detail
                    label="Registration Number"
                    value={
                      review.business
                        .registrationNumber
                    }
                  />

                  <Detail
                    label="Industry"
                    value={
                      review.business
                        .industry
                    }
                  />

                  <Detail
                    label="Registered Address"
                    value={
                      review.business
                        .registeredAddress
                    }
                    full
                  />
                </div>
              </section>

              <section className="review-card documents-card">
                <header>
                  <FileCheck2
                    size={20}
                  />

                  <h2>
                    Submitted Documents
                  </h2>
                </header>

                <div className="submitted-document-list">
                  {review.documents.map(
                    (document) => (
                      <div
                        className="submitted-document-row"
                        key={
                          document.documentType
                        }
                      >
                        <span
                          className={`document-state ${document.reviewStatus}`}
                        >
                          {document.reviewStatus ===
                          "approved" ? (
                            <CheckCircle2
                              size={17}
                            />
                          ) : (
                            <Clock3
                              size={17}
                            />
                          )}
                        </span>

                        <div>
                          <strong>
                            {documentLabels[
                              document
                                .documentType
                            ] ||
                              document.documentType}
                          </strong>

                          <small>
                            {
                              document.originalFileName
                            }
                          </small>
                        </div>

                        <em>
                          {document.reviewStatus.replace(
                            "_",
                            " "
                          )}
                        </em>
                      </div>
                    )
                  )}
                </div>
              </section>

              <section className="review-card verification-card">
                <header>
                  <ShieldCheck
                    size={20}
                  />

                  <h2>
                    Verification Status
                  </h2>
                </header>

                <div
                  className={`verification-result ${
                    verified
                      ? "verified"
                      : rejected
                        ? "rejected"
                        : "pending"
                  }`}
                >
                  {verified ? (
                    <CheckCircle2
                      size={24}
                    />
                  ) : (
                    <Clock3
                      size={24}
                    />
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
                          ? review
                              .submission
                              .reviewerRemarks ||
                            "One or more documents require correction."
                          : "Your documents have been submitted and are awaiting administrator review."}
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="review-sidebar-column">
              <section className="application-summary-card">
                <h2>
                  Application Summary
                </h2>

                <div>
                  <span>
                    Registration Fee
                  </span>

                  <strong>
                    {formatMoney(
                      review.fees
                        .registrationFee
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Verification
                    Processing
                  </span>

                  <strong>
                    {formatMoney(
                      review.fees
                        .processingFee
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Taxes (
                    {
                      review.fees
                        .taxRate
                    }
                    %)
                  </span>

                  <strong>
                    {formatMoney(
                      review.fees
                        .taxAmount
                    )}
                  </strong>
                </div>

                <div className="summary-total">
                  <span>
                    Total Due
                  </span>

                  <strong>
                    {formatMoney(
                      review.fees
                        .totalAmount
                    )}
                  </strong>
                </div>

                <button
                  type="button"
                  onClick={
                    proceedToPayment
                  }
                  disabled={
                    !review.submission
                      .paymentEnabled ||
                    creatingPayment ||
                    paymentCompleted
                  }
                >
                  {creatingPayment ? (
                    <>
                      <LoaderCircle
                        className="review-spinner"
                        size={17}
                      />

                      Opening
                      Razorpay...
                    </>
                  ) : paymentCompleted ? (
                    <>
                      <CheckCircle2
                        size={17}
                      />

                      Payment
                      Completed
                    </>
                  ) : (
                    <>
                      <LockKeyhole
                        size={17}
                      />

                      Pay with
                      Razorpay
                    </>
                  )}
                </button>

                {!review.submission
                  .paymentEnabled &&
                  !paymentCompleted && (
                    <small className="payment-locked-note">
                      <LockKeyhole
                        size={12}
                      />

                      Payment unlocks
                      after document
                      verification.
                    </small>
                  )}

                {paymentCompleted && (
                  <small className="payment-completed-note">
                    <CheckCircle2
                      size={12}
                    />

                    Payment has been
                    received
                    successfully.
                  </small>
                )}

                <small className="secure-payment-note">
                  <ShieldCheck
                    size={12}
                  />

                  Payment processed
                  securely by
                  Razorpay
                </small>
              </section>

              <section className="review-terms-card">
                <Info size={18} />

                <p>
                  By proceeding to payment,
                  you confirm that all
                  submitted details are
                  accurate and agree to the
                  Terms of Service.
                </p>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function Detail({
  label,
  value,
  full = false,
}) {
  return (
    <div
      className={
        full
          ? "review-detail full"
          : "review-detail"
      }
    >
      <small>{label}</small>

      <strong>
        {value || "Not provided"}
      </strong>
    </div>
  );
}

export default ApplicationReviewPage;