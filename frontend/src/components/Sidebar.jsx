import {
  BadgeCheck,
  BriefcaseBusiness,
  CircleUserRound,
  CreditCard,
  LayoutDashboard,
  Settings,
  SlidersHorizontal,
  Upload,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/dashboard",
  },
  {
    label: "My Profile",
    icon: CircleUserRound,
    path: "/profile",
  },
  {
    label: "Document Verification",
    icon: BadgeCheck,
    path: "/document-verification",
  },
  {
    label: "Services",
    icon: BriefcaseBusiness,
    path: "/services",
  },
  {
    label: "Subscriptions",
    icon: CreditCard,
    path: "/subscriptions",
  },
  {
    label: "Settings",
    icon: Settings,
    path: "/settings",
  },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div>
        <div className="brand">
          <span className="brand-icon">
            <SlidersHorizontal size={21} />
          </span>

          <div>
            <strong>Tedo Bizz</strong>
            <small>Vendor Portal</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) =>
                  [
                    "sidebar-link",
                    isActive ? "active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <button
        className="upgrade-button"
        type="button"
      >
        <Upload size={15} />
        <span>Upgrade Plan</span>
      </button>
    </aside>
  );
}

export default Sidebar;