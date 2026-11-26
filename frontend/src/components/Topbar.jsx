import {
  Bell,
  CheckCheck,
  ChevronDown,
  Clock3,
  FileCheck2,
  HelpCircle,
  LogOut,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getVendorNotifications,
  markAllVendorNotificationsRead,
  markVendorNotificationRead,
} from "../api/notificationApi";
import "../styles/topbarNotifications.css";
import "../styles/topbarVendorMenu.css";

const ADMIN_PHONE_NUMBER = "919876543210";
const ADMIN_DISPLAY_NUMBER = "+91 98765 43210";

const ADMIN_WHATSAPP_MESSAGE =
  "Hello Admin, I am a vendor and need help with the Tedo Bizz vendor portal.";

const notificationIcon = (type) => {
  if (type === "verification_approved") return ShieldCheck;
  if (type === "verification_submitted") return FileCheck2;
  return Clock3;
};

const timeAgo = (dateValue) => {
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return new Date(dateValue).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
};

function Topbar({ vendor }) {
  const navigate = useNavigate();
  const notificationRef = useRef(null);
  const helpMenuRef = useRef(null);
  const vendorMenuRef = useRef(null);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [vendorMenuOpen, setVendorMenuOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationError, setNotificationError] = useState("");
  const [helpMenuOpen, setHelpMenuOpen] = useState(false);

  const businessName = vendor?.businessName || "Vendor";
  const vendorEmail = vendor?.email || "Vendor account";

  const initials = businessName
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "VP";

  const loadNotifications = async ({ silent = false } = {}) => {
    if (!silent) setNotificationsLoading(true);

    try {
      const data = await getVendorNotifications(12);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      setNotificationError("");
    } catch (requestError) {
      if (!silent) {
        setNotificationError(
          requestError.response?.data?.message ||
          "Unable to load notifications"
        );
      }
    } finally {
      if (!silent) setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();

    const timer = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const closeMenus = (event) => {
      const clickedNotifications =
        notificationRef.current?.contains(event.target);

      const clickedHelpMenu =
        helpMenuRef.current?.contains(event.target);

      const clickedVendorMenu =
        vendorMenuRef.current?.contains(event.target);

      if (!clickedNotifications) {
        setNotificationsOpen(false);
      }

      if (!clickedHelpMenu) {
        setHelpMenuOpen(false);
      }

      if (!clickedVendorMenu) {
        setVendorMenuOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setHelpMenuOpen(false);
        setVendorMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const toggleNotifications = () => {
    const nextOpen = !notificationsOpen;

    setNotificationsOpen(nextOpen);
    setHelpMenuOpen(false);
    setVendorMenuOpen(false);

    if (nextOpen) {
      loadNotifications();
    }
  };

  const toggleVendorMenu = () => {
    setVendorMenuOpen((current) => !current);
    setNotificationsOpen(false);
    setHelpMenuOpen(false);
  };

  const toggleHelpMenu = () => {
    setHelpMenuOpen((current) => !current);
    setNotificationsOpen(false);
    setVendorMenuOpen(false);
  };

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, isRead: true } : item
        )
      );
      setUnreadCount((current) => Math.max(0, current - 1));

      try {
        await markVendorNotificationRead(notification.id);
      } catch {
        loadNotifications({ silent: true });
      }
    }

    setNotificationsOpen(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
  };

  const markAllRead = async () => {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, isRead: true }))
    );
    setUnreadCount(0);

    try {
      await markAllVendorNotificationsRead();
    } catch {
      loadNotifications({ silent: true });
    }
  };

  const openWhatsAppSupport = () => {
    const whatsappUrl =
      `https://wa.me/${ADMIN_PHONE_NUMBER}` +
      `?text=${encodeURIComponent(
        ADMIN_WHATSAPP_MESSAGE
      )}`;

    setHelpMenuOpen(false);

    window.open(
      whatsappUrl,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const callAdmin = () => {
    setHelpMenuOpen(false);

    window.location.href =
      `tel:+${ADMIN_PHONE_NUMBER}`;
  };

  const handleLogout = () => {
    setVendorMenuOpen(false);
    setNotificationsOpen(false);
    setHelpMenuOpen(false);

    localStorage.removeItem("vendorToken");
    localStorage.removeItem("vendor");

    navigate("/login", { replace: true });
  };

  return (
    <header className="topbar">
      <label className="search-box">
        <Search size={18} />
        <input type="search" placeholder="Search leads, services, etc..." />
      </label>

      <div className="topbar-actions">
        <div className="notification-menu" ref={notificationRef}>
          <button
            className={`icon-button ${notificationsOpen ? "active" : ""}`}
            type="button"
            onClick={toggleNotifications}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <>
                <span className="notification-dot" />
                <span className="notification-count">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </>
            )}
          </button>

          {notificationsOpen && (
            <section className="notification-dropdown">
              <header>
                <div>
                  <h2>Notifications</h2>
                  <p>
                    {unreadCount
                      ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"
                      }`
                      : "You're all caught up"}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead}>
                    <CheckCheck size={15} /> Mark all read
                  </button>
                )}
              </header>

              <div className="notification-list">
                {notificationsLoading ? (
                  <div className="notification-empty">
                    <Clock3 className="notification-spinner" size={22} />
                    Loading notifications...
                  </div>
                ) : notificationError ? (
                  <div className="notification-empty error">
                    {notificationError}
                  </div>
                ) : notifications.length ? (
                  notifications.map((notification) => {
                    const Icon = notificationIcon(notification.type);
                    return (
                      <button
                        className={`notification-item ${notification.isRead ? "read" : "unread"
                          }`}
                        type="button"
                        onClick={() => openNotification(notification)}
                        key={notification.id}
                      >
                        <span
                          className={`notification-type-icon ${notification.type}`}
                        >
                          <Icon size={18} />
                        </span>
                        <span className="notification-copy">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>{timeAgo(notification.createdAt)}</small>
                        </span>
                        {!notification.isRead && (
                          <span className="notification-unread-marker" />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="notification-empty">
                    <Bell size={24} />
                    <strong>No notifications yet</strong>
                    <span>
                      Updates about document verification will appear here.
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        <div
          className="help-menu-wrapper"
          ref={helpMenuRef}
        >
          <button
            className={`icon-button ${helpMenuOpen ? "active" : ""
              }`}
            type="button"
            onClick={toggleHelpMenu}
            aria-label="Contact admin for help"
            aria-haspopup="dialog"
            aria-expanded={helpMenuOpen}
          >
            <HelpCircle size={19} />
          </button>

          {helpMenuOpen && (
            <section
              className="vendor-help-dropdown"
              role="dialog"
              aria-label="Vendor support options"
            >
              <header className="vendor-help-header">
                <span className="vendor-help-header-icon">
                  <HelpCircle size={20} />
                </span>

                <div>
                  <h2>Need help?</h2>

                  <p>
                    Contact the administrator using one of
                    the options below.
                  </p>
                </div>
              </header>

              <div className="vendor-help-options">
                <button
                  type="button"
                  className="vendor-help-option whatsapp"
                  onClick={openWhatsAppSupport}
                >
                  <span className="vendor-help-option-icon">
                    <MessageCircle size={19} />
                  </span>

                  <span>
                    <strong>WhatsApp Admin</strong>
                    <small>
                      Send a WhatsApp support message
                    </small>
                  </span>

                  <b aria-hidden="true">›</b>
                </button>

                <button
                  type="button"
                  className="vendor-help-option call"
                  onClick={callAdmin}
                >
                  <span className="vendor-help-option-icon">
                    <Phone size={18} />
                  </span>

                  <span>
                    <strong>Call Admin</strong>
                    <small>{ADMIN_DISPLAY_NUMBER}</small>
                  </span>

                  <b aria-hidden="true">›</b>
                </button>
              </div>

              <p className="vendor-help-note">
                Calling is available on devices that support
                phone calls.
              </p>
            </section>
          )}
        </div>

        <span className="topbar-divider" />

        <div className="vendor-menu-wrapper" ref={vendorMenuRef}>
          <button
            className={`vendor-menu ${vendorMenuOpen ? "active" : ""}`}
            type="button"
            onClick={toggleVendorMenu}
            aria-haspopup="menu"
            aria-expanded={vendorMenuOpen}
          >
            <span className="avatar">{initials}</span>
            <span>{businessName}</span>
            <ChevronDown
              className={vendorMenuOpen ? "vendor-menu-chevron open" : "vendor-menu-chevron"}
              size={15}
            />
          </button>

          {vendorMenuOpen && (
            <section className="vendor-account-dropdown" role="menu">
              <header>
                <span className="vendor-dropdown-avatar">{initials}</span>
                <div>
                  <strong>{businessName}</strong>
                  <small>{vendorEmail}</small>
                </div>
              </header>

              <div className="vendor-account-actions">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setVendorMenuOpen(false);
                    navigate("/profile");
                  }}
                >
                  <UserRound size={17} />
                  <span>
                    <strong>My Profile</strong>
                    <small>View and update account details</small>
                  </span>
                </button>

                <button
                  className="vendor-logout-button"
                  type="button"
                  role="menuitem"
                  onClick={handleLogout}
                >
                  <LogOut size={17} />
                  <span>
                    <strong>Logout</strong>
                    <small>Sign out from the vendor portal</small>
                  </span>
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </header>
  );
}

export default Topbar;
