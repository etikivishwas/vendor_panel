const { pool } = require("../config/db");

const getDashboard = async (req, res, next) => {
  try {
    const vendorId = req.vendor.id;

    const [
      vendorResult,
      leadsResult,
      viewsResult,
      ratingResult,
      subscriptionResult,
      verificationResult,
      chartResult,
      recentLeadsResult,
    ] = await Promise.all([
      pool.execute(
        `
          SELECT
            id,
            business_name,
            contact_name,
            email,
            avatar_url
          FROM vendor_panel_accounts
          WHERE id = ?
          LIMIT 1
        `,
        [vendorId]
      ),

      pool.execute(
        `
          SELECT
            COUNT(*) AS total_leads,
            SUM(
              CASE
                WHEN created_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                THEN 1 ELSE 0
              END
            ) AS current_month_leads
          FROM vendor_panel_leads
          WHERE vendor_id = ?
        `,
        [vendorId]
      ),

      pool.execute(
        `
          SELECT
            COUNT(*) AS total_views,
            SUM(
              CASE
                WHEN viewed_at >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
                THEN 1 ELSE 0
              END
            ) AS current_month_views
          FROM vendor_panel_profile_views
          WHERE vendor_id = ?
        `,
        [vendorId]
      ),

      pool.execute(
        `
          SELECT
            COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating,
            COUNT(*) AS review_count
          FROM vendor_panel_reviews
          WHERE vendor_id = ?
            AND status = 'published'
        `,
        [vendorId]
      ),

      pool.execute(
        `
          SELECT
            plan_name,
            plan_code,
            plan_status,
            starts_at,
            expires_at,
            GREATEST(DATEDIFF(expires_at, NOW()), 0) AS days_remaining
          FROM vendor_panel_subscriptions
          WHERE vendor_id = ?
            AND plan_status = 'active'
            AND expires_at >= NOW()
          ORDER BY expires_at DESC
          LIMIT 1
        `,
        [vendorId]
      ),

      pool.execute(
        `
          SELECT
            verification_status,
            certificate_url,
            verified_at,
            expires_at
          FROM vendor_panel_verifications
          WHERE vendor_id = ?
          LIMIT 1
        `,
        [vendorId]
      ),

      pool.execute(
        `
          WITH RECURSIVE date_series AS (
            SELECT CURRENT_DATE - INTERVAL 29 DAY AS activity_date
            UNION ALL
            SELECT activity_date + INTERVAL 1 DAY
            FROM date_series
            WHERE activity_date < CURRENT_DATE
          )
          SELECT
            DATE_FORMAT(ds.activity_date, '%Y-%m-%d') AS activity_date,
            COUNT(vpl.id) AS lead_count
          FROM date_series ds
          LEFT JOIN vendor_panel_leads vpl
            ON DATE(vpl.created_at) = ds.activity_date
            AND vpl.vendor_id = ?
          GROUP BY ds.activity_date
          ORDER BY ds.activity_date
        `,
        [vendorId]
      ),

      pool.execute(
        `
          SELECT
            id,
            customer_name,
            service_requested,
            status,
            created_at
          FROM vendor_panel_leads
          WHERE vendor_id = ?
          ORDER BY created_at DESC
          LIMIT 5
        `,
        [vendorId]
      ),
    ]);

    if (!vendorResult[0].length) {
      return res.status(404).json({
        success: false,
        message: "Vendor not found",
      });
    }

    const vendor = vendorResult[0][0];
    const leadStats = leadsResult[0][0];
    const viewStats = viewsResult[0][0];
    const ratingStats = ratingResult[0][0];
    const subscription = subscriptionResult[0][0] || null;
    const verification = verificationResult[0][0] || {
      verification_status: "not_submitted",
    };

    return res.json({
      success: true,
      data: {
        vendor: {
          id: vendor.id,
          businessName: vendor.business_name,
          contactName: vendor.contact_name,
          email: vendor.email,
          avatarUrl: vendor.avatar_url,
        },

        summary: {
          totalLeads: Number(leadStats.total_leads || 0),
          currentMonthLeads: Number(
            leadStats.current_month_leads || 0
          ),
          profileViews: Number(viewStats.total_views || 0),
          currentMonthViews: Number(
            viewStats.current_month_views || 0
          ),
          averageRating: Number(
            ratingStats.average_rating || 0
          ),
          reviewCount: Number(ratingStats.review_count || 0),
        },

        subscription: subscription
          ? {
              planName: subscription.plan_name,
              planCode: subscription.plan_code,
              status: subscription.plan_status,
              startsAt: subscription.starts_at,
              expiresAt: subscription.expires_at,
              daysRemaining: Number(
                subscription.days_remaining || 0
              ),
            }
          : null,

        verification: {
          status: verification.verification_status,
          certificateUrl: verification.certificate_url || null,
          verifiedAt: verification.verified_at || null,
          expiresAt: verification.expires_at || null,
        },

        leadActivity: chartResult[0].map((item) => ({
          date: item.activity_date,
          leads: Number(item.lead_count),
        })),

        recentLeads: recentLeadsResult[0].map((lead) => ({
          id: lead.id,
          customerName: lead.customer_name,
          serviceRequested: lead.service_requested,
          status: lead.status,
          createdAt: lead.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
};