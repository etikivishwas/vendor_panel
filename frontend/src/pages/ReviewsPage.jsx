import {
    ArrowLeft,
    Check,
    Clipboard,
    Download,
    LoaderCircle,
    Mail,
    MessageCircle,
    Send,
    Star,
} from "lucide-react";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";

import {
    getVendorReviews,
    saveVendorReviewReply,
} from "../api/reviewApi";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

import "../styles/reviews.css";

const MAX_REPLY_LENGTH = 1000;

const getInitials = (name) => {
    const safeName = String(
        name || "Customer"
    ).trim();

    return (
        safeName
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => word[0])
            .slice(0, 2)
            .join("")
            .toUpperCase() || "CU"
    );
};

const formatReviewDate = (value) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date unavailable";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
        }
    );
};

const getImageUrl = (value) => {
    if (!value) {
        return "";
    }

    if (
        value.startsWith("http://") ||
        value.startsWith("https://") ||
        value.startsWith("data:") ||
        value.startsWith("blob:")
    ) {
        return value;
    }

    const backendUrl =
        import.meta.env.VITE_BACKEND_URL || "";

    return `${backendUrl}${value}`;
};

function ReviewsPage() {
    const navigate = useNavigate();
    const qrRef = useRef(null);

    const [reviews, setReviews] =
        useState([]);

    const [summary, setSummary] =
        useState({
            averageRating: 0,
            reviewCount: 0,
            distribution: {
                5: 0,
                4: 0,
                3: 0,
                2: 0,
                1: 0,
            },
        });

    const [vendor, setVendor] =
        useState(null);

    const [replyDrafts, setReplyDrafts] =
        useState({});

    const [editingReviewId, setEditingReviewId] =
        useState(null);

    const [savingReplyId, setSavingReplyId] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");

    const [message, setMessage] =
        useState("");

    const reviewLink = useMemo(() => {
        if (!vendor?.id) {
            return "";
        }

        return `${window.location.origin}/review/vendor/${vendor.id}`;
    }, [vendor?.id]);

    useEffect(() => {
        let active = true;

        const loadReviews = async () => {
            try {
                setLoading(true);
                setError("");

                const response =
                    await getVendorReviews();

                if (!active) {
                    return;
                }

                const responseData =
                    response?.data || {};

                const loadedReviews =
                    Array.isArray(
                        responseData.reviews
                    )
                        ? responseData.reviews
                        : [];

                setReviews(loadedReviews);

                setSummary(
                    responseData.summary || {
                        averageRating: 0,
                        reviewCount: 0,
                        distribution: {},
                    }
                );

                setVendor(
                    responseData.vendor || null
                );

                const initialDrafts = {};

                loadedReviews.forEach(
                    (review) => {
                        initialDrafts[review.id] =
                            review.vendorReply || "";
                    }
                );

                setReplyDrafts(initialDrafts);
            } catch (requestError) {
                if (active) {
                    setError(
                        requestError.response?.data
                            ?.message ||
                        "Unable to load customer reviews"
                    );
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadReviews();

        return () => {
            active = false;
        };
    }, []);

    const copyReviewLink = async () => {
        if (!reviewLink) {
            setError(
                "The vendor review link is unavailable"
            );

            return;
        }

        try {
            await navigator.clipboard.writeText(
                reviewLink
            );

            setMessage(
                "Review link copied"
            );

            window.setTimeout(() => {
                setMessage("");
            }, 2500);
        } catch {
            setError(
                "The review link could not be copied"
            );
        }
    };

    const openWhatsAppShare = () => {
        if (!reviewLink) {
            return;
        }

        const text =
            `Please review our business on Tedo Bizz: ${reviewLink}`;

        window.open(
            `https://wa.me/?text=${encodeURIComponent(
                text
            )}`,
            "_blank",
            "noopener,noreferrer"
        );
    };

    const openEmailShare = () => {
        if (!reviewLink) {
            return;
        }

        const subject =
            "Please review our business";

        const body =
            `Thank you for choosing our business. Please leave a review using this link:\n\n${reviewLink}`;

        window.location.href =
            `mailto:?subject=${encodeURIComponent(
                subject
            )}&body=${encodeURIComponent(body)}`;
    };

    const downloadQrCode = () => {
        const canvas =
            qrRef.current?.querySelector(
                "canvas"
            );

        if (!canvas) {
            setError(
                "The QR code is not ready"
            );

            return;
        }

        const downloadLink =
            document.createElement("a");

        downloadLink.download =
            `vendor-review-qr-${vendor?.id || "code"}.png`;

        downloadLink.href =
            canvas.toDataURL("image/png");

        downloadLink.click();
    };

    const handleReplyChange = (
        reviewId,
        value
    ) => {
        if (
            value.length >
            MAX_REPLY_LENGTH
        ) {
            return;
        }

        setReplyDrafts((current) => ({
            ...current,
            value,
        }));

        setError("");
        setMessage("");
    };

    const saveReply = async (
        reviewId
    ) => {
        const reply = String(
            replyDrafts[reviewId] || ""
        ).trim();

        if (!reply) {
            setError(
                "Enter a reply before saving"
            );

            return;
        }

        if (
            reply.length >
            MAX_REPLY_LENGTH
        ) {
            setError(
                `Reply cannot exceed ${MAX_REPLY_LENGTH} characters`
            );

            return;
        }

        try {
            setSavingReplyId(reviewId);
            setError("");
            setMessage("");

            const response =
                await saveVendorReviewReply(
                    reviewId,
                    reply
                );

            const savedReply =
                response?.data?.vendorReply ||
                reply;

            const repliedAt =
                response?.data?.repliedAt ||
                new Date().toISOString();

            setReviews((current) =>
                current.map((review) =>
                    review.id === reviewId
                        ? {
                            ...review,
                            vendorReply: savedReply,
                            repliedAt,
                        }
                        : review
                )
            );

            setReplyDrafts((current) => ({
                ...current,
                savedReply,
            }));

            setEditingReviewId(null);

            setMessage(
                "Reply saved successfully"
            );
        } catch (requestError) {
            setError(
                requestError.response?.data
                    ?.message ||
                "Unable to save the reply"
            );
        } finally {
            setSavingReplyId(null);
        }
    };

    if (loading) {
        return (
            <div className="dashboard-shell">
                <Sidebar />

                <div className="dashboard-main">
                    <div className="reviews-state">
                        <LoaderCircle
                            className="reviews-spinner"
                            size={28}
                        />

                        <span>
                            Loading customer reviews...
                        </span>
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

                <main className="reviews-content">
                    <header className="reviews-page-header">
                        <button
                            type="button"
                            className="reviews-back-button"
                            onClick={() =>
                                navigate("/dashboard")
                            }
                            aria-label="Return to dashboard"
                        >
                            <ArrowLeft size={19} />
                        </button>

                        <div>
                            <h1>Customer Reviews</h1>

                            <p>
                                Read customer feedback,
                                respond to reviews, and share
                                your review link.
                            </p>
                        </div>
                    </header>

                    {error && (
                        <div
                            className="reviews-alert error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    {message && (
                        <div
                            className="reviews-alert success"
                            role="status"
                        >
                            <Check size={16} />
                            {message}
                        </div>
                    )}

                    <section className="reviews-layout">
                        <div className="reviews-main-column">
                            <article className="reviews-summary-card">
                                <div className="reviews-rating-total">
                                    <strong>
                                        {Number(
                                            summary.averageRating || 0
                                        ).toFixed(1)}
                                    </strong>

                                    <div className="reviews-stars">
                                        {[
                                            1,
                                            2,
                                            3,
                                            4,
                                            5,
                                        ].map((star) => (
                                            <Star
                                                key={star}
                                                size={18}
                                                fill={
                                                    star <=
                                                        Math.round(
                                                            summary.averageRating ||
                                                            0
                                                        )
                                                        ? "currentColor"
                                                        : "none"
                                                }
                                            />
                                        ))}
                                    </div>

                                    <span>
                                        Based on{" "}
                                        {summary.reviewCount || 0}{" "}
                                        review
                                        {summary.reviewCount === 1
                                            ? ""
                                            : "s"}
                                    </span>
                                </div>

                                <div className="reviews-distribution">
                                    {[5, 4, 3, 2, 1].map(
                                        (rating) => {
                                            const count =
                                                Number(
                                                    summary.distribution?.[
                                                    rating
                                                    ] || 0
                                                );

                                            const percentage =
                                                summary.reviewCount
                                                    ? Math.round(
                                                        (count /
                                                            summary.reviewCount) *
                                                        100
                                                    )
                                                    : 0;

                                            return (
                                                <div
                                                    className="rating-distribution-row"
                                                    key={rating}
                                                >
                                                    <span>
                                                        {rating}
                                                        <Star
                                                            size={11}
                                                            fill="currentColor"
                                                        />
                                                    </span>

                                                    <span className="rating-progress">
                                                        <i
                                                            style={{
                                                                width: `${percentage}%`,
                                                            }}
                                                        />
                                                    </span>

                                                    <small>{count}</small>
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </article>

                            <section className="reviews-list-section">
                                <div className="reviews-list-header">
                                    <div>
                                        <small>
                                            CUSTOMER FEEDBACK
                                        </small>

                                        <h2>
                                            All Reviews
                                        </h2>
                                    </div>

                                    <span>
                                        {summary.reviewCount || 0}
                                    </span>
                                </div>

                                {!reviews.length ? (
                                    <div className="reviews-empty">
                                        <Star size={25} />

                                        <strong>
                                            No reviews yet
                                        </strong>

                                        <p>
                                            Share your review link or
                                            QR code with customers to
                                            start collecting feedback.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="reviews-list">
                                        {reviews.map((review) => {
                                            const editing =
                                                editingReviewId ===
                                                review.id;

                                            const draft =
                                                replyDrafts[
                                                review.id
                                                ] || "";

                                            return (
                                                <article
                                                    className="review-card"
                                                    key={review.id}
                                                >
                                                    <div className="review-card-heading">
                                                        <span className="review-avatar">
                                                            {getInitials(
                                                                review.customerName
                                                            )}
                                                        </span>

                                                        <div>
                                                            <strong>
                                                                {
                                                                    review.customerName
                                                                }
                                                            </strong>

                                                            <span className="review-card-stars">
                                                                {[
                                                                    1,
                                                                    2,
                                                                    3,
                                                                    4,
                                                                    5,
                                                                ].map((star) => (
                                                                    <Star
                                                                        key={star}
                                                                        size={13}
                                                                        fill={
                                                                            star <=
                                                                                Math.round(
                                                                                    review.rating
                                                                                )
                                                                                ? "currentColor"
                                                                                : "none"
                                                                        }
                                                                    />
                                                                ))}
                                                            </span>
                                                        </div>

                                                        <time>
                                                            {formatReviewDate(
                                                                review.createdAt
                                                            )}
                                                        </time>
                                                    </div>

                                                    {review.reviewText ? (
                                                        <p className="review-text">
                                                            {review.reviewText}
                                                        </p>
                                                    ) : (
                                                        <p className="review-text muted">
                                                            No written comment was
                                                            provided.
                                                        </p>
                                                    )}

                                                    {review.reviewImageUrl && (
                                                        <img
                                                            className="review-image"
                                                            src={getImageUrl(
                                                                review.reviewImageUrl
                                                            )}
                                                            alt="Customer review attachment"
                                                        />
                                                    )}

                                                    {review.vendorReply &&
                                                        !editing && (
                                                            <div className="vendor-review-reply">
                                                                <small>
                                                                    YOUR REPLY
                                                                </small>

                                                                <p>
                                                                    {
                                                                        review.vendorReply
                                                                    }
                                                                </p>

                                                                <div>
                                                                    <span>
                                                                        {review.repliedAt
                                                                            ? formatReviewDate(
                                                                                review.repliedAt
                                                                            )
                                                                            : ""}
                                                                    </span>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            setEditingReviewId(
                                                                                review.id
                                                                            )
                                                                        }
                                                                    >
                                                                        Edit reply
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                    {(!review.vendorReply ||
                                                        editing) && (
                                                            <div className="review-reply-form">
                                                                <label
                                                                    htmlFor={`reply-${review.id}`}
                                                                >
                                                                    {review.vendorReply
                                                                        ? "Update your reply"
                                                                        : "Reply to this review"}
                                                                </label>

                                                                <textarea
                                                                    id={`reply-${review.id}`}
                                                                    value={draft}
                                                                    onChange={(event) =>
                                                                        handleReplyChange(
                                                                            review.id,
                                                                            event.target
                                                                                .value
                                                                        )
                                                                    }
                                                                    maxLength={
                                                                        MAX_REPLY_LENGTH
                                                                    }
                                                                    rows={3}
                                                                    placeholder="Write a helpful and professional response..."
                                                                    disabled={
                                                                        savingReplyId ===
                                                                        review.id
                                                                    }
                                                                />

                                                                <div className="review-reply-actions">
                                                                    <small>
                                                                        {draft.length}/
                                                                        {
                                                                            MAX_REPLY_LENGTH
                                                                        }
                                                                    </small>

                                                                    {editing && (
                                                                        <button
                                                                            type="button"
                                                                            className="cancel-reply-button"
                                                                            onClick={() => {
                                                                                setReplyDrafts(
                                                                                    (
                                                                                        current
                                                                                    ) => ({
                                                                                        ...current,

                                                                                        [review.id]:
                                                                                            review.vendorReply ||
                                                                                            "",
                                                                                    })
                                                                                );

                                                                                setEditingReviewId(
                                                                                    null
                                                                                );
                                                                            }}
                                                                            disabled={
                                                                                savingReplyId ===
                                                                                review.id
                                                                            }
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        type="button"
                                                                        className="save-reply-button"
                                                                        onClick={() =>
                                                                            saveReply(
                                                                                review.id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            savingReplyId ===
                                                                            review.id ||
                                                                            !draft.trim()
                                                                        }
                                                                    >
                                                                        {savingReplyId ===
                                                                            review.id ? (
                                                                            <LoaderCircle
                                                                                className="reviews-spinner"
                                                                                size={15}
                                                                            />
                                                                        ) : (
                                                                            <Send
                                                                                size={14}
                                                                            />
                                                                        )}

                                                                        {review.vendorReply
                                                                            ? "Update reply"
                                                                            : "Post reply"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </div>

                        <aside className="review-share-card">
                            <span className="review-share-icon">
                                <Star size={20} />
                            </span>

                            <small>GET MORE REVIEWS</small>

                            <h2>
                                Ask customers for a review
                            </h2>

                            <p>
                                Share this link or QR code with
                                customers after completing a
                                service.
                            </p>

                            <div className="review-share-buttons">
                                <button
                                    type="button"
                                    onClick={openWhatsAppShare}
                                    disabled={!reviewLink}
                                >
                                    <MessageCircle size={16} />
                                    WhatsApp
                                </button>

                                <button
                                    type="button"
                                    onClick={openEmailShare}
                                    disabled={!reviewLink}
                                >
                                    <Mail size={16} />
                                    Email
                                </button>
                            </div>

                            <label className="review-link-field">
                                <span>Review link</span>

                                <span>
                                    <input
                                        value={reviewLink}
                                        readOnly
                                        aria-label="Public review link"
                                    />

                                    <button
                                        type="button"
                                        onClick={copyReviewLink}
                                        disabled={!reviewLink}
                                        aria-label="Copy review link"
                                    >
                                        <Clipboard
                                            size={17}
                                        />
                                    </button>
                                </span>
                            </label>

                            <div
                                className="review-qr-section"
                                ref={qrRef}
                            >
                                <strong>
                                    Review QR code
                                </strong>

                                <p>
                                    Customers can scan this code
                                    to open the review form.
                                </p>

                                {reviewLink ? (
                                    <QRCodeCanvas
                                        value={reviewLink}
                                        size={180}
                                        level="H"
                                        includeMargin
                                    />
                                ) : (
                                    <div className="qr-unavailable">
                                        QR code unavailable
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="download-qr-button"
                                    onClick={downloadQrCode}
                                    disabled={!reviewLink}
                                >
                                    <Download size={15} />
                                    Download QR code
                                </button>
                            </div>
                        </aside>
                    </section>
                </main>
            </div>
        </div>
    );
}

export default ReviewsPage;