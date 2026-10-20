import { useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Brand from "../components/Brand.jsx";
import { login, register } from "../services/api.js";

export default function AuthPage({ mode, onAuth }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result =
        mode === "login"
          ? await login({
              email: form.get("email"),
              password: form.get("password"),
            })
          : await register({
              name: form.get("name"),
              email: form.get("email"),
              password: form.get("password"),
            });
      onAuth(result);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Could not connect. Check that the API is running and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-form-side">
        <div className="auth-top">
          <Brand />
          <Link to="/" className="auth-back">
            <ArrowLeft size={14} /> Home
          </Link>
        </div>
        <div className="auth-card">
          <div className="eyebrow">YOUR GROWING SEASON, ORGANIZED</div>
          <h1>{mode === "login" ? "Welcome back." : "Let’s get growing."}</h1>
          <p className="auth-sub">
            {mode === "login"
              ? "Sign in to pick up where you left off."
              : "Create an account to save and review crop observations."}
          </p>
          <form onSubmit={submit} className="form-stack">
            {mode === "register" && (
              <label>
                Your name
                <input
                  name="name"
                  autoComplete="name"
                  minLength="2"
                  required
                  placeholder="e.g. Jamie Green"
                />
              </label>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength="8"
                required
                placeholder="At least 8 characters"
              />
            </label>
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <button className="button button-dark button-wide" disabled={busy}>
              {busy
                ? "Please wait"
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}{" "}
              {!busy && <ArrowRight size={15} />}
            </button>
          </form>
          <p className="auth-switch">
            {mode === "login" ? "New to Leafline?" : "Already have an account?"}{" "}
            <Link to={mode === "login" ? "/register" : "/login"}>
              {mode === "login" ? "Create an account" : "Sign in"}
            </Link>
          </p>
          <div className="privacy-note">
            <ShieldCheck size={14} />
            Your scans are private to your account.
          </div>
        </div>
        <small className="auth-legal">
          Model outputs are preliminary observations and require field
          verification.
        </small>
      </section>
      <aside className="auth-image">
        <img
          src="https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?auto=format&fit=crop&w=1200&q=85"
          alt="Sunlight falling across a cultivated field"
        />
        <div className="auth-image-caption">
          <span>GROW WITH GOOD INFORMATION</span>
          <p>
            Every observation
            <br />
            has a place here.
          </p>
        </div>
      </aside>
    </main>
  );
}
