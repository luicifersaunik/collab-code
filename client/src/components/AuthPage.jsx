import { useState, useEffect } from "react";
import { apiUrl } from "../api";
import styles from "./AuthPage.module.css";

export default function AuthPage({ onAuth }) {
  const [tab, setTab] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const githubEnabled = !!import.meta.env.VITE_GITHUB_OAUTH;

  // Handle GitHub OAuth callback  (?token=...&username=...&avatar=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const uname = params.get("username");
    const avatar = params.get("avatar") || "";
    if (token && uname) {
      localStorage.setItem("cc_token", token);
      localStorage.setItem("cc_username", uname);
      localStorage.setItem("cc_avatar", avatar);
      window.history.replaceState({}, "", window.location.pathname);
      onAuth({ token, username: uname, avatar });
    }
    const err = params.get("error");
    if (err === "github") setError("GitHub login failed. Please try again.");
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) return setError("All fields required.");
    setIsLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(apiUrl(endpoint), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Something went wrong.");
      localStorage.setItem("cc_token", data.token);
      localStorage.setItem("cc_username", data.username);
      localStorage.setItem("cc_avatar", data.avatar || "");
      onAuth({ token: data.token, username: data.username, avatar: data.avatar || "" });
    } catch {
      setError("Cannot reach server. Make sure the backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHub = () => {
    window.location.href = apiUrl("/api/auth/github");
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid} />
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>{"</>"}</span>
          <div>
            <h1 className={styles.logoTitle}>CollabCode</h1>
            <p className={styles.logoSub}>Sign in to start collaborating</p>
          </div>
        </div>

        {/* GitHub OAuth button */}
        {githubEnabled && (
          <>
            <button className={styles.githubBtn} onClick={handleGitHub}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12"/>
              </svg>
              Continue with GitHub
            </button>
            <div className={styles.divider}><span>or</span></div>
          </>
        )}

        <div className={styles.tabs}>
          {["login", "register"].map((t) => (
            <button key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => { setTab(t); setError(""); }}
            >
              {t === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input className={styles.input} placeholder="e.g. alex_dev"
              value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoFocus />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input className={styles.input} type="password"
              placeholder={tab === "register" ? "At least 6 characters" : "Your password"}
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className={styles.error}>⚠ {error}</p>}
          <button type="submit" className={styles.btn} disabled={isLoading}>
            {isLoading ? <span className={styles.spinner} /> : tab === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        <p className={styles.switchText}>
          {tab === "login" ? "No account? " : "Already have one? "}
          <button className={styles.switchLink} onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }}>
            {tab === "login" ? "Create one" : "Sign in"}
          </button>
        </p>

        <div className={styles.features}>
          {["Persistent sessions", "JWT auth", "GitHub OAuth", "Multi-file rooms"].map((f) => (
            <span key={f} className={styles.feature}>✓ {f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
