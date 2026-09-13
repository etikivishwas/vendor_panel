import {
  BookOpenCheck,
  FileCheck2,
  FileUp,
  LoaderCircle,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDocumentVerification,
  submitDocumentVerification,
} from "../api/documentVerificationApi";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import "../styles/documentVerification.css";

const definitions = [
  {
    key: "gstCertificate",
    type: "gst_certificate",
    label: "GST Certificate",
    remarksKey: "gstRemarks",
    placeholder: "Add any notes regarding your GST certificate...",
  },
  {
    key: "msmeCertificate",
    type: "msme_certificate",
    label: "MSME Certificate",
    remarksKey: "msmeRemarks",
    placeholder: "Add any notes regarding your MSME certificate...",
  },
  {
    key: "identityProof",
    type: "identity_proof",
    label: "Other Identity Proof",
    remarksKey: "identityRemarks",
    placeholder: "Add any notes regarding this document...",
  },
];

const statusContent = {
  not_submitted: {
    label: "Not Submitted",
    description: "Upload all required documents and submit them for verification.",
    className: "not-submitted",
  },
  pending_review: {
    label: "Pending Review",
    description: "Your documents are currently being reviewed by our team.",
    className: "pending",
  },
  approved: {
    label: "Verified",
    description: "Your business documents have been approved.",
    className: "approved",
  },
  rejected: {
    label: "Changes Required",
    description:
      "One or more documents require changes. Review the remarks and resubmit.",
    className: "rejected",
  },
};

function DocumentVerificationPage() {
  const navigate = useNavigate();
  const inputRefs = useRef({});

  const [status, setStatus] = useState("not_submitted");
  const [existingDocuments, setExistingDocuments] = useState([]);
  const [files, setFiles] = useState({});
  const [remarks, setRemarks] = useState({
    gstRemarks: "",
    msmeRemarks: "",
    identityRemarks: "",
  });
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const [loading, setLoading] = useState(true);
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

  const loadPage = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await getDocumentVerification();
      setStatus(data.status || "not_submitted");
      setExistingDocuments(data.documents || []);
      setReviewerRemarks(data.reviewerRemarks || "");

      const nextRemarks = {
        gstRemarks: "",
        msmeRemarks: "",
        identityRemarks: "",
      };

      definitions.forEach((definition) => {
        const document = (data.documents || []).find(
          (item) => item.documentType === definition.type
        );
        nextRemarks[definition.remarksKey] = document?.remarks || "";
      });

      setRemarks(nextRemarks);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        "Unable to load document verification"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  const getExistingDocument = (type) =>
    existingDocuments.find((item) => item.documentType === type);

  const handleFileChange = (key, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Only PDF, JPG, PNG, and WebP documents are allowed");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Each document must be smaller than 10 MB");
      event.target.value = "";
      return;
    }

    setError("");
    setSuccess("");
    setFiles((current) => ({ ...current, [key]: file }));
  };

  const removeSelectedFile = (key) => {
    setFiles((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });

    if (inputRefs.current[key]) inputRefs.current[key].value = "";
  };

  const handleRemarksChange = (event) => {
    const { name, value } = event.target;
    setRemarks((current) => ({ ...current, [name]: value }));
    setError("");
    setSuccess("");
  };

  const handleCancel = () => {
    setFiles({});
    Object.values(inputRefs.current).forEach((input) => {
      if (input) input.value = "";
    });
    loadPage();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const missingDefinition = definitions.find(
      (definition) =>
        !files[definition.key] && !getExistingDocument(definition.type)
    );

    if (missingDefinition) {
      setError(`${missingDefinition.label} is required`);
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const response = await submitDocumentVerification({
        files,
        remarks,
      });

      setFiles({});

      Object.values(
        inputRefs.current
      ).forEach((input) => {
        if (input) {
          input.value = "";
        }
      });

      navigate(
        "/document-verification/application-review",
        {
          replace: true,
          state: {
            message:
              response.message ||
              "Documents submitted successfully",
          },
        }
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to submit documents"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const currentStatus = statusContent[status] || statusContent.not_submitted;

  if (loading) {
    return (
      <div className="dashboard-shell">
        <Sidebar />
        <div className="dashboard-main verification-loading">
          <LoaderCircle className="verification-spinner" size={30} />
          <span>Loading document verification...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />

      <div className="dashboard-main">
        <Topbar vendor={vendor} />

        <main className="verification-content">
          <header className="verification-title">
            <h1>Document Verification</h1>
            <p>Upload and manage your business documents for verification.</p>
          </header>

          {error && <div className="verification-alert error">{error}</div>}
          {success && (
            <div className="verification-alert success">{success}</div>
          )}

          <section className="verification-status-card">
            <div>
              <h2>Verification Status</h2>
              <p>{currentStatus.description}</p>
              {reviewerRemarks && (
                <p className="reviewer-remarks">
                  Review note: {reviewerRemarks}
                </p>
              )}
            </div>
            <span
              className={`verification-status-pill ${currentStatus.className}`}
            >
              {currentStatus.label}
            </span>
          </section>

          <form onSubmit={handleSubmit}>
            <section className="document-upload-card">
              <h2>Document Upload</h2>
              <div className="document-card-divider" />

              {definitions.map((definition) => {
                const selectedFile = files[definition.key];
                const existingDocument = getExistingDocument(definition.type);

                return (
                  <div className="document-row" key={definition.key}>
                    <div className="document-file-column">
                      <label>{definition.label}</label>

                      <input
                        ref={(element) => {
                          inputRefs.current[definition.key] = element;
                        }}
                        className="document-file-input"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(event) =>
                          handleFileChange(definition.key, event)
                        }
                      />

                      <button
                        type="button"
                        className="browse-document-button"
                        onClick={() =>
                          inputRefs.current[definition.key]?.click()
                        }
                      >
                        <FileUp size={16} /> Browse File
                      </button>

                      <div className="document-file-name">
                        {selectedFile ? (
                          <>
                            <FileCheck2 size={15} />
                            <span>{selectedFile.name}</span>
                            <button
                              type="button"
                              onClick={() =>
                                removeSelectedFile(definition.key)
                              }
                              aria-label={`Remove ${definition.label}`}
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : existingDocument ? (
                          <>
                            <FileCheck2 size={15} />
                            <span>{existingDocument.originalFileName}</span>
                            <em>{existingDocument.reviewStatus}</em>
                          </>
                        ) : (
                          <span>No file chosen</span>
                        )}
                      </div>

                      <small>PDF, JPG, PNG or WebP. Maximum 10 MB.</small>
                    </div>

                    <label className="document-remarks-column">
                      <span>Remarks</span>
                      <textarea
                        name={definition.remarksKey}
                        value={remarks[definition.remarksKey]}
                        onChange={handleRemarksChange}
                        placeholder={definition.placeholder}
                        maxLength={500}
                        rows={3}
                      />
                    </label>
                  </div>
                );
              })}
            </section>

            <footer className="verification-actions">
              <button
                className="verification-cancel-button"
                type="button"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                className="verification-get-documents-button"
                type="button"
                onClick={() =>
                  navigate("/document-verification/get-documents")
                }
                disabled={submitting}
              >
                <BookOpenCheck size={16} /> Get Documents
              </button>

              <button
                className="verification-submit-button"
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <LoaderCircle
                      className="verification-spinner"
                      size={16}
                    />
                    Submitting...
                  </>
                ) : (
                  "Submit for Review"
                )}
              </button>
            </footer>
          </form>
        </main>
      </div>
    </div>
  );
}

export default DocumentVerificationPage;
