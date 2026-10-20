import { useEffect, useState } from "react";
import { Filter, History, Search, Upload, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import ScanTable from "../components/ScanTable.jsx";
import { deletePrediction, getScans } from "../services/api.js";
import "./HistoryPage.css";

const crops = [
  "Apple",
  "Blueberry",
  "Cherry",
  "Corn",
  "Cotton",
  "Grape",
  "Peach",
  "Pepper",
  "Potato",
  "Raspberry",
  "Soybean",
  "Squash",
  "Strawberry",
  "Tomato",
];
export default function HistoryPage() {
  const [data, setData] = useState({
    scans: [],
    pagination: { page: 1, pages: 1, total: 0 },
  });
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  useEffect(() => {
    getScans({ search: query, crop, page, limit: 10 })
      .then(setData)
      .catch((err) =>
        setError(err.response?.data?.message || "Unable to load scan history."),
      );
  }, [query, crop, page]);
  async function removePrediction(scan) {
    if (!window.confirm(`Delete the prediction for ${scan.cropLabel}?`)) return;
    setError("");
    try {
      await deletePrediction(scan._id);
      setData((current) => ({
        ...current,
        scans: current.scans.filter((item) => item._id !== scan._id),
        pagination: {
          ...current.pagination,
          total: Math.max(0, current.pagination.total - 1),
        },
      }));
    } catch (err) {
      setError(
        err.response?.data?.message || "Unable to delete this prediction.",
      );
    }
  }
  return (
    <div>
      <div className="page-lead compact">
        <div>
          <span className="eyebrow">YOUR FIELD NOTES</span>
          <h2>Scan history</h2>
          <p>
            Review saved model outputs. Empty results mean no scans have been
            recorded.
          </p>
        </div>
        <Link className="button button-green" to="/scanner">
          <Upload size={14} />
          New scan
        </Link>
      </div>
      <div className="history-controls">
        <label className="search-field">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => {
              setPage(1);
              setQuery(e.target.value);
            }}
            placeholder="Search crop or result"
          />
        </label>
        <label className="select-field">
          <Filter size={14} />
          <select
            value={crop}
            onChange={(e) => {
              setPage(1);
              setCrop(e.target.value);
            }}
          >
            <option value="">All crops</option>
            {crops.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <ChevronDown size={13} />
        </label>
        <span className="result-count">{data.pagination.total || 0} scans</span>
      </div>
      {error && <div className="inline-error">{error}</div>}
      <section className="panel history-panel">
        {data.scans.length ? (
          <ScanTable scans={data.scans} onDelete={removePrediction} />
        ) : (
          <EmptyState
            icon={<History />}
            title="No matching scans"
            text="Saved scan history appears after the configured model returns a result."
          />
        )}
      </section>
      {data.pagination.pages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {data.pagination.pages}
          </span>
          <button
            disabled={page >= data.pagination.pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
