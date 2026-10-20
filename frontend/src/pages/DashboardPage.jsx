import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  FileImage,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import ScanTable from "../components/ScanTable.jsx";
import { getAiStatus, getSummary } from "../services/api.js";
import "./DashboardPage.css";

function Stat({ icon, label, value, note }) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-caption">{label}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
export default function DashboardPage({ user }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState("");
  const [summaryRefresh, setSummaryRefresh] = useState(0);
  const [modelStatus, setModelStatus] = useState({ status: "loading" });
  const [statusRefresh, setStatusRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    getSummary()
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((err) => {
        if (active) {
          setSummaryError(
            err.response?.data?.message ||
              "Unable to load saved scan activity.",
          );
        }
      })
      .finally(() => {
        if (active) setSummaryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [summaryRefresh]);
  useEffect(() => {
    let active = true;
    getAiStatus()
      .then((status) => {
        if (active) setModelStatus(status);
      })
      .catch(() => {
        if (active) setModelStatus({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [statusRefresh]);
  useEffect(() => {
    function refreshAfterScan() {
      setSummaryLoading(true);
      setSummaryError("");
      setSummaryRefresh((value) => value + 1);
    }
    window.addEventListener("leafline:scan-saved", refreshAfterScan);
    return () =>
      window.removeEventListener("leafline:scan-saved", refreshAfterScan);
  }, []);

  const stats = summary?.stats;
  const statusCopy = {
    loading: {
      heading: "Checking model status…",
      detail: "Connecting through the Express API to verify the trained model.",
      label: "Checking AI service",
    },
    ready: {
      heading: "Model ready",
      detail:
        "The AI service reports that a trained model is available for screening.",
      label: "AI service connected",
    },
    not_configured: {
      heading: "Model not configured",
      detail:
        "The AI service is reachable, but it reports that no trained model is configured.",
      label: "Model unavailable",
    },
    unavailable: {
      heading: "AI service unavailable",
      detail:
        "Express could not verify the AI service. Check that the Flask service is running, then retry.",
      label: "AI service unreachable",
    },
    error: {
      heading: "Status check failed",
      detail:
        "Unable to check model status through the backend. Check the API connection and retry.",
      label: "Could not verify status",
    },
  }[modelStatus.status] || {
    heading: "Status check failed",
    detail: "The backend returned an unrecognized model status.",
    label: "Could not verify status",
  };
  const retrySummary = () => {
    setSummaryLoading(true);
    setSummaryError("");
    setSummaryRefresh((value) => value + 1);
  };
  const retryStatus = () => {
    setModelStatus({ status: "loading" });
    setStatusRefresh((value) => value + 1);
  };

  return (
    <div>
      <div className="welcome-row">
        <div>
          <p className="muted">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h2>Good to see you, {user?.name?.split(" ")[0] || "grower"}.</h2>
          <p className="muted">
            A clear record helps you spot changes over time.
          </p>
        </div>
        <Link className="button button-green" to="/scanner">
          <Upload size={15} />
          Start a scan
        </Link>
      </div>
      <div className="stat-grid">
        <Stat
          icon={<FileImage />}
          label="Total scans"
          value={
            summaryLoading ? "…" : summaryError ? "—" : (stats?.total ?? 0)
          }
          note="Saved observations"
        />
        <Stat
          icon={<Activity />}
          label="This month"
          value={
            summaryLoading ? "…" : summaryError ? "—" : (stats?.thisMonth ?? 0)
          }
          note="Saved this calendar month"
        />
        <Stat
          icon={<ShieldCheck />}
          label="Mean top score"
          value={
            summaryLoading
              ? "…"
              : summaryError || stats?.averageConfidence == null
                ? "—"
                : `${Math.round(stats.averageConfidence * 100)}%`
          }
          note="Average saved top score · not diagnosis"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">LATEST OBSERVATIONS</span>
              <h3>Recent scans</h3>
            </div>
            <Link className="text-link" to="/history">
              All history <ArrowRight size={13} />
            </Link>
          </div>
          {summaryLoading ? (
            <p className="dashboard-feedback" role="status">
              Loading recent scans…
            </p>
          ) : summaryError ? (
            <div
              className="dashboard-feedback dashboard-feedback-error"
              role="alert"
            >
              <p>{summaryError}</p>
              <button
                className="text-link dashboard-retry"
                type="button"
                onClick={retrySummary}
              >
                <RefreshCw size={13} /> Try again
              </button>
            </div>
          ) : summary?.recent?.length ? (
            <ScanTable scans={summary.recent} />
          ) : (
            <EmptyState
              icon={<Leaf />}
              title="No saved scans yet"
              text="Completed scans appear here after their results have been saved."
              action={
                <Link
                  to="/scanner"
                  className="button button-outline button-small"
                >
                  Make your first scan
                </Link>
              }
            />
          )}
        </section>
        <aside
          className={`panel readiness-panel model-status-card status-${modelStatus.status}`}
          aria-live="polite"
        >
          <span className="eyebrow">MODEL STATUS</span>
          <h3>{statusCopy.heading}</h3>
          <p>{statusCopy.detail}</p>
          <div className="readiness-line">
            <i className="status-dot" aria-hidden="true" />
            {statusCopy.label}
          </div>
          {modelStatus.status !== "loading" &&
            modelStatus.status !== "ready" && (
              <button
                className="text-link dashboard-retry"
                type="button"
                onClick={retryStatus}
              >
                <RefreshCw size={13} /> Check again
              </button>
            )}
          <Link className="text-link" to="/scanner">
            Open scanner <ArrowRight size={13} />
          </Link>
        </aside>
      </div>
      <section className="dashboard-bottom">
        <div className="bottom-copy">
          <span className="eyebrow">GOOD PHOTOS HELP</span>
          <h3>Take a moment to frame the leaf.</h3>
          <p>
            Use even daylight, a plain background, and one leaf with visible
            symptoms. Avoid blur and harsh shadows.
          </p>
          <Link className="text-link" to="/scanner">
            Photo tips <ArrowRight size={13} />
          </Link>
        </div>
        <div className="leaf-photo">
          <img
            src="https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=700&q=80"
            alt="Close-up of a healthy green leaf"
          />
        </div>
      </section>
    </div>
  );
}
