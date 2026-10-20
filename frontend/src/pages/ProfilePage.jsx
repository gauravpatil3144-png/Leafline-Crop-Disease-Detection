import { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { updateProfile } from "../services/api.js";

export default function ProfilePage({ user, onUpdateUser }) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const updated = await updateProfile({
        name: form.get("name"),
        email: form.get("email"),
      });
      localStorage.setItem("leafline_user", JSON.stringify(updated));
      onUpdateUser(updated);
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to update profile.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="page-lead compact">
        <div>
          <span className="eyebrow">ACCOUNT</span>
          <h2>Profile & settings</h2>
          <p>Manage the details associated with your personal workspace.</p>
        </div>
      </div>
      <section className="panel settings-panel">
        <div className="settings-heading">
          <div className="large-avatar">
            {user?.name?.[0]?.toUpperCase() || "G"}
          </div>
          <div>
            <h3>Personal details</h3>
            <p>Used only for your Leafline account.</p>
          </div>
        </div>
        <form className="settings-form" onSubmit={submit}>
          <label>
            Full name
            <input
              name="name"
              defaultValue={user?.name || ""}
              minLength="2"
              required
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              defaultValue={user?.email || ""}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          {saved && (
            <div className="form-success">
              <Check size={14} />
              Profile updated.
            </div>
          )}
          <button className="button button-green" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>
      <div className="settings-note">
        <ShieldCheck size={17} />
        <div>
          <strong>Private by default</strong>
          <p>
            Your scan records are attached to your account and aren’t shared
            with other users.
          </p>
        </div>
      </div>
    </div>
  );
}
