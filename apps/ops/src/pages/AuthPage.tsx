import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Binoculars,
  Eye,
  EyeOff,
  Footprints,
  Leaf,
  LockKeyhole,
  ShieldCheck,
  ChartNoAxesCombined,
} from "lucide-react";
import { Brand } from "../components/Brand.js";
import { Reveal } from "../components/Reveal.js";
import { useAuth } from "../auth/AuthContext.js";

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const auth = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (isRegister && password !== data.get("confirm")) {
      setError("Your passwords don’t match. Please check and try again.");
      return;
    }
    setPending(true);
    try {
      if (isRegister)
        await auth.register(
          String(data.get("name") ?? "").trim(),
          email,
          password,
        );
      else await auth.signIn(email, password);
      navigate("/dashboard", { replace: true });
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setPending(false);
    }
  }
  if (auth.user) return <Navigate to="/dashboard" replace />;
  return (
    <main className="auth-page" id="main-content">
      <section className="auth-story">
        <div className="auth-rings" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <Brand light />
        <div className="auth-story-content">
          <Reveal>
            <span className="story-emblem">
              <Leaf size={35} strokeWidth={1.3} />
            </span>
            <p className="eyebrow light">CONNECTED BY PURPOSE</p>
            <h1>
              A wilder tomorrow.
              <br />
              Starts with <em>us.</em>
            </h1>
            <p className="story-description">
              The people. The places. The wildlife.
              <br />
              One shared commitment to protect them.
            </p>
            <div className="story-features">
              <span>
                <Binoculars size={19} /> Bring field observations together
              </span>
              <span>
                <Footprints size={19} /> Support the people on the ground
              </span>
              <span>
                <ChartNoAxesCombined size={19} /> Make every insight count
              </span>
            </div>
          </Reveal>
        </div>
        <div className="auth-story-footer">
          <span className="live-dot" />
          <span>Made for Sri Lanka’s wild future</span>
          <span>01 / 04</span>
        </div>
      </section>
      <section className="auth-form-side">
        <Link className="back-link" to="/">
          <ArrowLeft size={16} /> Back to home
        </Link>
        <div className="auth-form-wrap">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <span className="form-kicker">
            <span />{" "}
            {isRegister ? "JOIN THE MISSION" : "YOUR CONSERVATION WORKSPACE"}
          </span>
          <h2>
            {isRegister
              ? "A shared purpose.\nA place for you."
              : "Welcome back."}
          </h2>
          <p className="auth-intro">
            {isRegister
              ? "Create an account and take your first step with us."
              : "Good to see you. Sign in to your workspace."}
          </p>
          <form
            onSubmit={submit}
            aria-label={isRegister ? "Create account" : "Sign in"}
          >
            {isRegister && (
              <label className="field-label" htmlFor="name">
                FULL NAME
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Your full name"
                  minLength={2}
                  maxLength={100}
                  required
                  disabled={pending}
                />
              </label>
            )}
            <label className="field-label" htmlFor="email">
              EMAIL ADDRESS
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                required
                disabled={pending}
              />
            </label>
            <div className="password-heading">
              <label className="field-label" htmlFor="password">
                PASSWORD
              </label>
              {!isRegister && (
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setHelp(!help)}
                  aria-expanded={help}
                  aria-controls="password-help"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="password-input">
              <input
                id="password"
                name="password"
                type={visible ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={
                  isRegister
                    ? "Create a strong password"
                    : "Enter your password"
                }
                minLength={isRegister ? 12 : 1}
                maxLength={128}
                required
                disabled={pending}
                aria-describedby={isRegister ? "password-hint" : undefined}
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? "Hide password" : "Show password"}
                aria-pressed={visible}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {isRegister && (
              <>
                <p className="field-hint" id="password-hint">
                  Use 12 or more characters. A memorable phrase works well.
                </p>
                <label className="field-label" htmlFor="confirm">
                  CONFIRM PASSWORD
                  <input
                    id="confirm"
                    name="confirm"
                    type={visible ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Enter your password again"
                    minLength={12}
                    maxLength={128}
                    required
                    disabled={pending}
                  />
                </label>
                <div className="account-note">
                  <ShieldCheck size={18} />
                  <p>
                    You’ll join as a Researcher. A park manager must grant
                    access to their park before you can see park data.
                  </p>
                </div>
              </>
            )}
            {help && (
              <p className="help-notice" id="password-help" role="status">
                Password recovery is not available yet. Please contact your park
                manager for help; no reset email has been sent.
              </p>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button button-green auth-submit"
              type="submit"
              disabled={pending || auth.loading}
            >
              {pending ? (
                <>
                  <span className="spinner" />
                  {isRegister ? "Creating your account…" : "Signing you in…"}
                </>
              ) : (
                <>
                  {isRegister ? "Create account" : "Sign in"}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
          <p className="auth-switch">
            {isRegister
              ? "Already part of the mission?"
              : "New to Wana Rakshaka?"}{" "}
            <Link to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
              <ArrowUp />
            </Link>
          </p>
          <div className="auth-secure">
            <LockKeyhole size={13} />
            <span>
              Your password is securely hashed. Your work stays yours.
            </span>
          </div>
        </div>
        <div className="auth-form-footer">
          <span>© {new Date().getFullYear()} Wana Rakshaka</span>
          <span>Protect. Connect. Conserve.</span>
        </div>
      </section>
    </main>
  );
}
function ArrowUp() {
  return <span aria-hidden="true">↗</span>;
}
