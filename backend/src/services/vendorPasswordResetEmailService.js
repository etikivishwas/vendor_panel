const nodemailer = require("nodemailer");

const getFrontendUrl = () =>
  String(process.env.FRONTEND_URL || "http://localhost:5173")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "");

const getGmailConfiguration = () => {
  const user = String(process.env.GMAIL_USER || "").trim();

  // Google displays app passwords in groups. Removing whitespace lets either
  // "abcd efgh ijkl mnop" or "abcdefghijklmnop" work in the .env file.
  const appPassword = String(process.env.GMAIL_APP_PASSWORD || "").replace(
    /\s+/g,
    ""
  );

  return { user, appPassword };
};

const createGmailTransport = () => {
  const { user, appPassword } = getGmailConfiguration();

  if (!user || !appPassword) return null;

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass: appPassword,
    },
  });
};

const verifyGmailTransport = async () => {
  const transport = createGmailTransport();
  if (!transport) {
    return {
      configured: false,
      verified: false,
      message: "GMAIL_USER or GMAIL_APP_PASSWORD is missing",
    };
  }

  await transport.verify();

  return {
    configured: true,
    verified: true,
    message: "Gmail transport is ready",
  };
};

const sendVendorPasswordResetEmail = async ({
  email,
  contactName,
  rawToken,
}) => {
  const resetUrl = `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(
    rawToken
  )}`;

  const transport = createGmailTransport();

  if (!transport) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`Vendor password reset link for ${email}: ${resetUrl}`);

      return {
        delivered: false,
        developmentResetUrl: resetUrl,
      };
    }

    throw new Error(
      "Gmail password reset service is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD."
    );
  }

  const { user } = getGmailConfiguration();
  const fromName = String(
    process.env.GMAIL_FROM_NAME || "Tedo Bizz Vendor Support"
  ).trim();

  const info = await transport.sendMail({
    from: {
      name: fromName,
      address: user,
    },
    to: email,
    subject: "Reset your Tedo Bizz vendor password",
    text: [
      `Hello ${contactName || "Vendor"},`,
      "",
      "A password reset was requested for your Tedo Bizz vendor account.",
      `Reset your password: ${resetUrl}`,
      "",
      "This link expires in 15 minutes and can be used only once.",
      "If you did not request this reset, you can ignore this email.",
      "",
      "Tedo Bizz Vendor Support",
    ].join("\n"),
    html: `
      <div style="margin:0;padding:24px;background:#f3f6f8;font-family:Arial,sans-serif;color:#173042;line-height:1.6">
        <div style="max-width:560px;margin:0 auto;padding:28px;border:1px solid #d7e0e7;border-radius:10px;background:#ffffff">
          <div style="font-size:20px;font-weight:700;color:#08283d">Tedo Bizz</div>
          <div style="margin-top:2px;color:#6b7882;font-size:12px">Vendor Portal</div>
          <h2 style="margin:24px 0 10px;color:#102b3e">Reset your vendor password</h2>
          <p>Hello ${contactName || "Vendor"},</p>
          <p>A password reset was requested for your Tedo Bizz vendor account.</p>
          <p style="margin:24px 0">
            <a href="${resetUrl}"
               style="display:inline-block;padding:12px 20px;border-radius:6px;background:#08283d;color:#ffffff;text-decoration:none;font-weight:700">
              Reset Password
            </a>
          </p>
          <p>This link expires in <strong>15 minutes</strong> and can be used only once.</p>
          <p style="color:#6b7882;font-size:13px">If you did not request this reset, no action is required.</p>
        </div>
      </div>
    `,
  });

  return {
    delivered: true,
    messageId: info.messageId,
    developmentResetUrl: null,
  };
};

module.exports = {
  sendVendorPasswordResetEmail,
  verifyGmailTransport,
};
