import {
  CircleHelp,
  ShieldCheck,
  Upload,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import EmptyState from "../components/EmptyState.jsx";
import { getScan } from "../services/api.js";
import { getPredictionCropLabel } from "../services/cropLabels.js";
import { getDiseaseGuidance } from "../services/diseaseGuidance.js";
import "./ResultPage.css";

export default function ResultPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [scan, setScan] = useState(state?.scan || null);
  const [loading, setLoading] = useState(!state?.scan);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!scan) {
      getScan(id)
        .then(setScan)
        .catch((requestError) =>
          setError(
            requestError.response?.data?.message ||
              "Unable to load this saved scan.",
          ),
        )
        .finally(() => setLoading(false));
    }
  }, [id, scan]);
  if (!scan)
    return (
      <EmptyState
        icon={<CircleHelp />}
        title={loading ? "Loading saved scan…" : "Result not available"}
        text={error || "Retrieving the saved model output."}
        action={
          !loading && (
            <Link className="button button-outline button-small" to="/history">
              Go to scan history
            </Link>
          )
        }
      />
    );
  const score = Number(scan.confidence || 0);
  const lowConfidence = scan.lowConfidence ?? score < 0.65;
  const cropLabel = getPredictionCropLabel(scan);
  const diseaseGuidance = getDiseaseGuidance(scan);
  return (
    <div className="result-page">
      <button className="back-button" onClick={() => navigate("/history")}>
        <ArrowLeft size={14} />
        Back to scan history
      </button>
      <div className="result-header">
        <div>
          <span className="eyebrow">
            SCREENING RESULT · {new Date(scan.createdAt).toLocaleString()}
          </span>
          <h2>{cropLabel}</h2>
          <p className="muted">
            Top model match:{" "}
            <strong>{scan.diseaseLabel || "No class returned"}</strong>
          </p>
        </div>
        <div
          className={`confidence-badge ${lowConfidence ? "confidence-low" : ""}`}
        >
          <span>MODEL SCORE</span>
          <strong>{Math.round(score * 100)}%</strong>
        </div>
      </div>
      {lowConfidence && (
        <div className="warning-banner">
          <CircleHelp size={17} />
          <div>
            <strong>Low confidence. Treat this result as inconclusive.</strong>
            <p>
              The image may be unclear or outside the model’s training classes.
              Retake it or seek field verification.
            </p>
          </div>
        </div>
      )}
      <div className="result-columns">
        <section className="panel result-main">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TOP CANDIDATES</span>
              <h3>Model output</h3>
            </div>
            <span className="result-tag">Not a diagnosis</span>
          </div>
          {(scan.predictions || []).map((item, i) => (
            <div className="prediction-row" key={`${item.label}-${i}`}>
              <span className="prediction-rank">0{i + 1}</span>
              <div className="prediction-info">
                <div>
                  <strong>{item.label}</strong>
                  <span>{Math.round(item.confidence * 100)}%</span>
                </div>
                <div className="confidence-track">
                  <i
                    style={{ width: `${Math.round(item.confidence * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {!scan.predictions?.length && (
            <p className="muted">
              No candidate list was returned by the model.
            </p>
          )}
          <div className="result-disclaimer">
            <ShieldCheck size={16} />
            <p>
              Image classification is preliminary. It does not confirm disease,
              rule out other causes, or provide treatment advice. Verify with a
              qualified local agronomist or extension service.
            </p>
          </div>
          <div className="field-guidance">
            <article>
              <h4>Symptoms</h4>
              <p>
                The model matched visual patterns in this image. It cannot
                confirm that a specific symptom or pathogen is present.
              </p>
            </article>
            <article>
              <h4>Suggested next steps if confirmed</h4>
              <p>{diseaseGuidance}</p>
            </article>
            <article>
              <h4>Treatment guidance</h4>
              <p>
                No treatment is prescribed. Do not apply pesticides from this
                screening alone; verify the diagnosis and follow local label
                requirements.
              </p>
            </article>
          </div>
        </section>
        <aside className="panel observation-panel">
          <span className="eyebrow">YOUR OBSERVATION</span>
          <h3>Keep context with the scan.</h3>
          <p>
            Model confidence is not the probability that a disease is present.
            Weather, cultivar, growth stage, and field history all matter.
          </p>
          <Link className="text-link" to="/library">
            Review the disease library <ArrowRight size={13} />
          </Link>
          <button
            className="button button-outline button-wide"
            onClick={() => navigate("/scanner")}
          >
            <Upload size={14} />
            Scan another leaf
          </button>
        </aside>
      </div>
    </div>
  );
}
