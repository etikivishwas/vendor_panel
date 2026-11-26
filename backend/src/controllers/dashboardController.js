const { pool } = require("../config/db");

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

const getMonthValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getAllowedMonths = () => {
  const today = new Date();

  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - index,
      1
    );

    return getMonthValue(date);
  });
};

const formatSqlDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDashboard = async (req, res, next) => {
  try {
    const accountId = Number(req.vendor.accountId || req.vendor.id);

    if (!Number.isInteger(accountId) || accountId <= 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid vendor account",
      });
    }

    const [accountRows] = await pool.execute(
      `
        SELECT
          id AS account_id,
          existing_vendor_id AS vendor_id,
          business_name,
          contact_name,
          email,
          avatar_url
        FROM vendor_panel_accounts
        WHERE id = ?
          AND status = 'active'
        LIMIT 1
      `,
      [accountId]
    );

    if (!accountRows.length) {
      return res.status(404).json({
        success: false,
        message: "Active vendor account not found",
      });
    }

    const vendor = accountRows[0];
    const vendorId = Number(vendor.vendor_id);

    if (!Number.isInteger(vendorId) || vendorId <= 0) {
      return res.status(409).json({
        success: false,
        message: "Vendor account is not linked to a vendor profile",
      });
    }

    const allowedMonths = getAllowedMonths();
    const requestedPeriod =
      typeof req.query.period === "string"
        ? req.query.period.trim().toLowerCase()
        : typeof req.query.month === "string"
          ? req.query.month.trim()
          : allowedMonths[0];

    const isTotalPeriod = requestedPeriod === "total";

    if (!isTotalPeriod && !MONTH_PATTERN.test(requestedPeriod)) {
      return res.status(400).json({
        success: false,
        message: "Invalid period. Use total or a month in YYYY-MM format.",
        allowedPeriods: ["total", ...allowedMonths],
      });
    }

    if (!isTotalPeriod && !allowedMonths.includes(requestedPeriod)) {
      return res.status(400).json({
        success: false,
        message: "The selected month must be within the last six months.",
        allowedPeriods: ["total", ...allowedMonths],
      });
    }

    let monthStart = null;
    let nextMonthStart = null;
    let selectedPeriodLabel = "Total";

    if (!isTotalPeriod) {
      const [selectedYear, selectedMonthNumber] = requestedPeriod
        .split("-")
        .map(Number);

      const monthStartDate = new Date(
        selectedYear,
        selectedMonthNumber - 1,
        1
      );
      const nextMonthStartDate = new Date(
        selectedYear,
        selectedMonthNumber,
        1
      );

      monthStart = formatSqlDate(monthStartDate);
      nextMonthStart = formatSqlDate(nextMonthStartDate);
      selectedPeriodLabel = new Intl.DateTimeFormat("en-IN", {
        month: "long",
        year: "numeric",
      }).format(monthStartDate);
    }

    const leadsQuery = isTotalPeriod
      ? `
          SELECT COUNT(*) AS lead_count
          FROM vendor_panel_leads
          WHERE vendor_id = ?
        `
      : `
          SELECT COUNT(*) AS lead_count
          FROM vendor_panel_leads
          WHERE vendor_id = ?
            AND created_at >= ?
            AND created_at < ?
        `;

    const leadsParams = isTotalPeriod
      ? [vendorId]
      : [vendorId, monthStart, nextMonthStart];

    const viewsQuery = isTotalPeriod
      ? `
          SELECT COUNT(*) AS view_count
          FROM vendor_panel_profile_views
          WHERE vendor_id = ?
        `
      : `
          SELECT COUNT(*) AS view_count
          FROM vendor_panel_profile_views
          WHERE vendor_id = ?
            AND viewed_at >= ?
            AND viewed_at < ?
        `;

    const viewsParams = isTotalPeriod
      ? [vendorId]
      : [vendorId, monthStart, nextMonthStart];

    const ratingQuery = isTotalPeriod
      ? `
          SELECT
            COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating,
            COUNT(*) AS review_count
          FROM vendor_panel_reviews
          WHERE vendor_id = ?
            AND status = 'published'
        `
      : `
          SELECT
            COALESCE(ROUND(AVG(rating), 1), 0) AS average_rating,
            COUNT(*) AS review_count
          FROM vendor_panel_reviews
          WHERE vendor_id = ?
            AND status = 'published'
            AND created_at >= ?
            AND created_at < ?
        `;

    const ratingParams = isTotalPeriod
      ? [vendorId]
      : [vendorId, monthStart, nextMonthStart];

    const activityQuery = isTotalPeriod
      ? `
          SELECT
            DATE_FORMAT(created_at, '%Y-%m') AS activity_date,
            COUNT(*) AS lead_count
          FROM vendor_panel_leads
          WHERE vendor_id = ?
          GROUP BY DATE_FORMAT(created_at, '%Y-%m')
          ORDER BY activity_date
        `
      : `
          WITH RECURSIVE date_series AS (
            SELECT CAST(? AS DATE) AS activity_date
            UNION ALL
            SELECT activity_date + INTERVAL 1 DAY
            FROM date_series
            WHERE activity_date + INTERVAL 1 DAY < CAST(? AS DATE)
          )
          SELECT
            DATE_FORMAT(ds.activity_date, '%Y-%m-%d') AS activity_date,
            COUNT(vpl.id) AS lead_count
          FROM date_series ds
          LEFT JOIN vendor_panel_leads vpl
            ON vpl.created_at >= ds.activity_date
            AND vpl.created_at < ds.activity_date + INTERVAL 1 DAY
            AND vpl.vendor_id = ?
          GROUP BY ds.activity_date
          ORDER BY ds.activity_date
        `;

    const activityParams = isTotalPeriod
      ? [vendorId]
      : [monthStart, nextMonthStart, vendorId];

    const allLeadsQuery = isTotalPeriod
      ? `
          SELECT
            id,
            customer_name,
            service_requested,
            status,
            created_at
          FROM vendor_panel_leads
          WHERE vendor_id = ?
          ORDER BY created_at DESC
        `
      : `
          SELECT
            id,
            customer_name,
            service_requested,
            status,
            created_at
          FROM vendor_panel_leads
          WHERE vendor_id = ?
            AND created_at >= ?
            AND created_at < ?
          ORDER BY created_at DESC
        `;

    const allLeadsParams = isTotalPeriod
      ? [vendorId]
      : [vendorId, monthStart, nextMonthStart];

    const [
      leadsResult,
      viewsResult,
      ratingResult,
      subscriptionResult,
      verificationResult,
      chartResult,
      allLeadsResult,
    ] = await Promise.all([
      pool.execute(leadsQuery, leadsParams),
      pool.execute(viewsQuery, viewsParams),
      pool.execute(ratingQuery, ratingParams),
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
      pool.execute(activityQuery, activityParams),
      pool.execute(allLeadsQuery, allLeadsParams),
    ]);

    const leadCount = Number(leadsResult[0][0]?.lead_count || 0);
    const viewCount = Number(viewsResult[0][0]?.view_count || 0);
    const ratingStats = ratingResult[0][0] || {};
    const subscription = subscriptionResult[0][0] || null;
    const verification = verificationResult[0][0] || {
      verification_status: "not_submitted",
    };

    return res.status(200).json({
      success: true,
      data: {
        selectedPeriod: {
          type: isTotalPeriod ? "total" : "month",
          value: requestedPeriod,
          month: isTotalPeriod ? null : requestedPeriod,
          label: selectedPeriodLabel,
          startDate: monthStart,
          endDateExclusive: nextMonthStart,
          allowedPeriods: ["total", ...allowedMonths],
        },
        vendor: {
          id: vendorId,
          accountId,
          businessName: vendor.business_name,
          contactName: vendor.contact_name,
          email: vendor.email,
          avatarUrl: vendor.avatar_url,
        },
        summary: {
          totalLeads: leadCount,
          selectedMonthLeads: isTotalPeriod ? null : leadCount,
          profileViews: viewCount,
          selectedMonthViews: isTotalPeriod ? null : viewCount,
          averageRating: Number(ratingStats.average_rating || 0),
          reviewCount: Number(ratingStats.review_count || 0),
        },
        subscription: subscription
          ? {
              planName: subscription.plan_name,
              planCode: subscription.plan_code,
              status: subscription.plan_status,
              startsAt: subscription.starts_at,
              expiresAt: subscription.expires_at,
              daysRemaining: Number(subscription.days_remaining || 0),
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
          leads: Number(item.lead_count || 0),
        })),
        recentLeads: allLeadsResult[0].map((lead) => ({
          id: Number(lead.id),
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
