import { ArrowUpRight, Leaf, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "./ScanTable.css";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function formatScore(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : "—";
}

export default function ScanTable({ scans, onDelete }) {
  const navigate = useNavigate();
  function openScan(scan) {
    navigate(`/result/${scan._id}`, { state: { scan } });
  }
  return (
    <div className="table-scroll">
      <table className="scan-table">
        <thead>
          <tr>
            <th>Crop</th>
            <th>Top match</th>
            <th>Model score</th>
            <th>Date</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => (
            <tr
              key={scan._id}
              role="link"
              tabIndex={0}
              aria-label={`Open ${scan.cropLabel || "crop"} scan from ${formatDate(scan.createdAt)}`}
              onClick={() => openScan(scan)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openScan(scan);
                }
              }}
            >
              <td>
                <span className="crop-cell-icon">
                  <Leaf size={14} />
                </span>
                {scan.cropLabel || "Unknown crop"}
              </td>
              <td>{scan.diseaseLabel || "No result"}</td>
              <td>
                <span className="score-cell">
                  {formatScore(scan.confidence)}
                </span>
              </td>
              <td>{formatDate(scan.createdAt)}</td>
              <td className="scan-table-action">
                {onDelete ? (
                  <button
                    className="history-delete"
                    type="button"
                    aria-label={`Delete ${scan.cropLabel || "crop"} prediction`}
                    title="Delete prediction"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(scan);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <ArrowUpRight size={14} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
