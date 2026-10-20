import {
  BookOpen,
  CircleHelp,
  Gauge,
  History,
  LogOut,
  Menu,
  Settings,
  Stethoscope,
  Upload,
  X,
} from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import Brand from "../components/Brand.jsx";

const titles = {
  "/dashboard": "Overview",
  "/scanner": "New scan",
  "/history": "Scan history",
  "/library": "Disease library",
  "/profile": "Profile & settings",
};
export default function WorkspaceLayout({ user, logout }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const title = titles[location.pathname] || "Scan result";
  return (
    <div className="workspace">
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav">
          <NavLink to="/dashboard" onClick={() => setOpen(false)}>
            <Gauge size={16} />
            Overview
          </NavLink>
          <NavLink to="/scanner" onClick={() => setOpen(false)}>
            <Stethoscope size={16} />
            New scan<span className="nav-plus">+</span>
          </NavLink>
          <NavLink to="/history" onClick={() => setOpen(false)}>
            <History size={16} />
            Scan history
          </NavLink>
          <NavLink to="/library" onClick={() => setOpen(false)}>
            <BookOpen size={16} />
            Disease library
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-box">
            <CircleHelp size={16} />
            <strong>Need a second opinion?</strong>
            <p>AI results are a first look, not a diagnosis.</p>
            <a href="https://extension.org" target="_blank" rel="noreferrer">
              Find local extension support ↗
            </a>
          </div>
          <NavLink
            to="/profile"
            className="profile-link"
            onClick={() => setOpen(false)}
          >
            <span className="avatar">
              {user?.name?.[0]?.toUpperCase() || "G"}
            </span>
            <span className="profile-label">
              <strong>{user?.name || "Grower"}</strong>
              <small>Personal workspace</small>
            </span>
            <Settings size={15} />
          </NavLink>
          <button className="logout-link" onClick={logout}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
          <div>
            <div className="breadcrumb">
              WORKSPACE <span>/</span> {title.toUpperCase()}
            </div>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <span className="service-indicator">
              <i /> Workspace
            </span>
            <NavLink
              className="button button-dark button-small"
              to="/scanner"
              onClick={() => setOpen(false)}
            >
              <Upload size={14} /> Scan a leaf
            </NavLink>
          </div>
        </header>
        <div className="workspace-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
