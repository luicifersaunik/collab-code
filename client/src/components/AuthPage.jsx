import { useState } from "react";
import styles from "./AuthPage.module.css";

export default function AuthPage({ onAuth }) {
  const [tab, setTab] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) return setError("All fields required.");
    setIsLoading(true);
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Something went wrong.");
      localStorage.setItem("cc_token", data.token);
      localStorage.setItem("cc_username", data.username);
      onAuth({ token: data.token, username: data.username });
    } catch {
      setError("Cannot reach server. Make sure the backend is running.");
    } finally {
      setIsLoading(false);
    }
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

        <div className={styles.tabs}>
          {["login", "register"].map((t) => (
            <button
              key={t}
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
            <input
              className={styles.input}
              placeholder="e.g. alex_dev"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Password</label>
            <input
              className={styles.input}
              type="password"
              placeholder={tab === "register" ? "At least 6 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className={styles.error}>⚠ {error}</p>}

          <button type="submit" className={styles.btn} disabled={isLoading}>
            {isLoading
              ? <span className={styles.spinner} />
              : tab === "login" ? "Sign In →" : "Create Account →"}
          </button>
        </form>

        <p className={styles.switchText}>
          {tab === "login" ? "No account? " : "Already have one? "}
          <button className={styles.switchLink} onClick={() => { setTab(tab === "login" ? "register" : "login"); setError(""); }}>
            {tab === "login" ? "Create one" : "Sign in"}
          </button>
        </p>

        <div className={styles.features}>
          {["Persistent sessions", "Secure JWT auth", "Saved room history", "Named cursors"].map((f) => (
            <span key={f} className={styles.feature}>✓ {f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
