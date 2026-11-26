const { pool } = require("../config/db");

const MAX_REPLY_LENGTH = 1000;

const getVendorReviews = async (
    req,
    res,
    next
) => {
    try {
        const vendorId = Number(req.vendor.id);

        if (
            !Number.isInteger(vendorId) ||
            vendorId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid vendor account",
            });
        }

        const [vendorRows] = await pool.execute(
            `
        SELECT
          id,
          name,
          image_url
        FROM vendors
        WHERE id = ?
          AND is_active = 1
        LIMIT 1
      `,
            [vendorId]
        );

        if (!vendorRows.length) {
            return res.status(404).json({
                success: false,
                message: "Active vendor profile not found",
            });
        }

        const [summaryRows] = await pool.execute(
            `
        SELECT
          COUNT(*) AS review_count,
          COALESCE(
            ROUND(AVG(rating), 1),
            0
          ) AS average_rating,

          SUM(
            CASE WHEN rating >= 4.5
            THEN 1 ELSE 0 END
          ) AS five_star_count,

          SUM(
            CASE
              WHEN rating >= 3.5
                AND rating < 4.5
              THEN 1 ELSE 0
            END
          ) AS four_star_count,

          SUM(
            CASE
              WHEN rating >= 2.5
                AND rating < 3.5
              THEN 1 ELSE 0
            END
          ) AS three_star_count,

          SUM(
            CASE
              WHEN rating >= 1.5
                AND rating < 2.5
              THEN 1 ELSE 0
            END
          ) AS two_star_count,

          SUM(
            CASE WHEN rating < 1.5
            THEN 1 ELSE 0 END
          ) AS one_star_count
        FROM vendor_panel_reviews
        WHERE vendor_id = ?
          AND status = 'published'
      `,
            [vendorId]
        );

        const [reviewRows] = await pool.execute(
            `
        SELECT
          id,
          user_id,
          customer_name,
          rating,
          review_text,
          review_image_url,
          vendor_reply,
          replied_at,
          created_at,
          updated_at
        FROM vendor_panel_reviews
        WHERE vendor_id = ?
          AND status = 'published'
        ORDER BY created_at DESC
      `,
            [vendorId]
        );

        const summary = summaryRows[0] || {};

        return res.status(200).json({
            success: true,

            data: {
                vendor: {
                    id: Number(vendorRows[0].id),

                    businessName:
                        vendorRows[0].name || "Vendor",

                    avatarUrl:
                        vendorRows[0].image_url || "",
                },

                summary: {
                    averageRating: Number(
                        summary.average_rating || 0
                    ),

                    reviewCount: Number(
                        summary.review_count || 0
                    ),

                    distribution: {
                        5: Number(
                            summary.five_star_count || 0
                        ),

                        4: Number(
                            summary.four_star_count || 0
                        ),

                        3: Number(
                            summary.three_star_count || 0
                        ),

                        2: Number(
                            summary.two_star_count || 0
                        ),

                        1: Number(
                            summary.one_star_count || 0
                        ),
                    },
                },

                reviews: reviewRows.map((review) => ({
                    id: Number(review.id),

                    userId:
                        review.user_id !== null
                            ? Number(review.user_id)
                            : null,

                    customerName:
                        review.customer_name ||
                        "Customer",

                    rating: Number(review.rating || 0),

                    reviewText:
                        review.review_text || "",

                    reviewImageUrl:
                        review.review_image_url || "",

                    vendorReply:
                        review.vendor_reply || "",

                    repliedAt:
                        review.replied_at || null,

                    createdAt:
                        review.created_at,

                    updatedAt:
                        review.updated_at,
                })),
            },
        });
    } catch (error) {
        next(error);
    }
};

const replyToVendorReview = async (
    req,
    res,
    next
) => {
    try {
        const vendorId = Number(req.vendor.id);
        const reviewId = Number(req.params.reviewId);

        const reply = String(
            req.body.reply || ""
        ).trim();

        if (
            !Number.isInteger(reviewId) ||
            reviewId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid review ID",
            });
        }

        if (!reply) {
            return res.status(400).json({
                success: false,
                message: "Reply cannot be empty",
            });
        }

        if (reply.length > MAX_REPLY_LENGTH) {
            return res.status(400).json({
                success: false,
                message:
                    `Reply cannot exceed ${MAX_REPLY_LENGTH} characters`,
            });
        }

        const [reviewRows] = await pool.execute(
            `
        SELECT
          id
        FROM vendor_panel_reviews
        WHERE id = ?
          AND vendor_id = ?
          AND status = 'published'
        LIMIT 1
      `,
            [reviewId, vendorId]
        );

        if (!reviewRows.length) {
            return res.status(404).json({
                success: false,
                message:
                    "Published review not found for this vendor",
            });
        }

        await pool.execute(
            `
        UPDATE vendor_panel_reviews
        SET
          vendor_reply = ?,
          replied_at = NOW()
        WHERE id = ?
          AND vendor_id = ?
          AND status = 'published'
      `,
            [
                reply,
                reviewId,
                vendorId,
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Reply saved successfully",

            data: {
                reviewId,
                vendorReply: reply,
                repliedAt:
                    new Date().toISOString(),
            },
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getVendorReviews,
    replyToVendorReview,
};