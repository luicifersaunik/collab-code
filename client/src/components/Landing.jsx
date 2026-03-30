import { useState } from "react";
import styles from "./Landing.module.css";

export default function Landing({ prefilledRoom = "", onJoin }) {
  const [tab, setTab] = useState(prefilledRoom ? "join" : "create");
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState(prefilledRoom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!username.trim()) return setError("Please enter your name.");
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/room/create", { method: "POST" });
      const { roomId: newRoomId } = await res.json();
      onJoin({ roomId: newRoomId, username: username.trim() });
    } catch {
      setError("Failed to create room. Is the server running?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return setError("Please enter your name.");
    if (!roomId.trim()) return setError("Please enter a room code.");
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/room/${roomId.trim().toUpperCase()}`);
      const { exists } = await res.json();
      if (!exists) {
        setError("Room not found. Check the code and try again.");
        setIsLoading(false);
        return;
      }
      onJoin({ roomId: roomId.trim().toUpperCase(), username: username.trim() });
    } catch {
      setError("Failed to join room. Is the server running?");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Background grid */}
      <div className={styles.grid} aria-hidden="true" />

      {/* Glow orbs */}
      <div className={styles.orb1} aria-hidden="true" />
      <div className={styles.orb2} aria-hidden="true" />

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoIcon}>{"</>"}</span>
          <div>
            <h1 className={styles.logoTitle}>CollabCode</h1>
            <p className={styles.logoSub}>Real-time collaborative editor</p>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "create" ? styles.tabActive : ""}`}
            onClick={() => { setTab("create"); setError(""); }}
          >
            Create Room
          </button>
          <button
            className={`${styles.tab} ${tab === "join" ? styles.tabActive : ""}`}
            onClick={() => { setTab("join"); setError(""); }}
          >
            Join Room
          </button>
        </div>

        {/* Form */}
        <form onSubmit={tab === "create" ? handleCreate : handleJoin} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>Your Name</label>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. Alex"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
            />
          </div>

          {tab === "join" && (
            <div className={styles.field}>
              <label className={styles.label}>Room Code</label>
              <input
                className={`${styles.input} ${styles.inputMono}`}
                type="text"
                placeholder="e.g. A3B2C1D4"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>
          )}

          {error && <p className={styles.error}>⚠ {error}</p>}

          <button
            type="submit"
            className={styles.btn}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className={styles.spinner} />
            ) : (
              tab === "create" ? "Create & Enter →" : "Join Session →"
            )}
          </button>
        </form>

        {/* Features */}
        <div className={styles.features}>
          {["Multi-user live editing", "Cursor sync", "Monaco Editor", "No signup"].map((f) => (
            <span key={f} className={styles.feature}>✓ {f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
