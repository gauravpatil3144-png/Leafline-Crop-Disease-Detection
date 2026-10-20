import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CloudUpload,
  FileImage,
  ShieldCheck,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createScan, getAiStatus } from "../services/api.js";
import "./ScannerPage.css";

export default function ScannerPage() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [service, setService] = useState(null);
  const navigate = useNavigate();
  function choose(next) {
    setError("");
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      setError("Image must be 10 MB or smaller.");
      return;
    }
    setFile(next);
    setPreview(URL.createObjectURL(next));
  }
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    getAiStatus()
      .then(setService)
      .catch((err) =>
        setService({
          service_available: false,
          model_ready: false,
          message:
            err.response?.data?.message || "AI service status is unavailable.",
        }),
      );
  }, []);
  async function scan() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await createScan(file);
      navigate(`/result/${result.scan._id}`, { state: { scan: result.scan } });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not reach the scan service. Check that both backend and AI service are running.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="page-lead">
        <div>
          <span className="eyebrow">NEW OBSERVATION</span>
          <h2>Let’s take a closer look.</h2>
          <p>
            Upload one clear crop-leaf image. Predictions require a trained
            model that supports the crop.
          </p>
        </div>
        <div
          className={`preliminary-pill ${service?.model_ready ? "model-ready" : "model-unready"}`}
        >
          <ShieldCheck size={14} />
          {service === null
            ? "Checking model status…"
            : service.model_ready
              ? "Model ready · preliminary screening"
              : service.service_available
                ? "Model not ready"
                : "AI service unavailable"}
        </div>
      </div>
      {service && !service.model_ready && (
        <div className="inline-error" role="status">
          {service.message ||
            "A trained model is not available. Train MobileNetV2 before scanning."}
        </div>
      )}
      <div className="scanner-layout">
        <section className="panel upload-panel">
          <div
            className={`drop-zone ${drag ? "dragging" : ""} ${preview ? "has-preview" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              choose(e.dataTransfer.files?.[0]);
            }}
          >
            {preview ? (
              <div className="preview-wrap">
                <img src={preview} alt="Selected crop leaf" />
                <button
                  className="remove-image"
                  onClick={() => {
                    setFile(null);
                    setPreview("");
                  }}
                  aria-label="Remove image"
                >
                  <X size={16} />
                </button>
                <div className="preview-label">
                  <Check size={13} />
                  Image ready
                </div>
              </div>
            ) : (
              <>
                <div className="upload-icon">
                  <CloudUpload size={24} />
                </div>
                <h3>Drop your leaf photo here</h3>
                <p>or browse files on your device</p>
                <label className="button button-outline browse-button">
                  <FileImage size={14} />
                  Choose image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(e) => choose(e.target.files?.[0])}
                  />
                </label>
                <div className="upload-spec">
                  JPG, PNG or WebP · Up to 10 MB
                </div>
              </>
            )}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="upload-footer">
            <span>
              <ShieldCheck size={14} />
              Processed for this scan.
            </span>
            <button
              className="button button-green"
              disabled={!file || busy || !service?.model_ready}
              onClick={scan}
            >
              {busy ? (
                "Sending image…"
              ) : service === null ? (
                "Checking model…"
              ) : !service.model_ready ? (
                "Model not ready"
              ) : (
                <>
                  Screen this leaf <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </section>
        <aside className="scan-guidance">
          {[
            [
              "01",
              "Frame one leaf",
              "Fill most of the image with one in-focus leaf.",
            ],
            [
              "02",
              "Use natural light",
              "Soft daylight and a plain background preserve detail.",
            ],
            [
              "03",
              "Check more than one",
              "Compare plants and ask a local expert to verify.",
            ],
          ].map(([n, title, text]) => (
            <article className="guide-card" key={n}>
              <span className="guide-number">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
          <div className="caution-box">
            <ShieldCheck size={16} />
            <p>
              Do not apply crop treatments based on an AI result alone. Verify
              first and follow local label requirements.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
