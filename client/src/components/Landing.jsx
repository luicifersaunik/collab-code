import { useState } from "react";
import styles from "./Landing.module.css";
import { apiUrl } from "../api";

export default function Landing({ prefilledRoom = "", username, onJoin, onLogout }) {
  const [tab, setTab] = useState(prefilledRoom ? "join" : "create");
  const [roomId, setRoomId] = useState(prefilledRoom);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
     const res = await fetch(apiUrl("/api/room/create"), { method: "POST" });
      const { roomId: newRoomId } = await res.json();
      onJoin({ roomId: newRoomId });
    } catch {
      setError("Failed to create room. Is the server running?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomId.trim()) return setError("Please enter a room code.");
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/room/${roomId.trim().toUpperCase()}`));
      const { exists } = await res.json();
      if (!exists) { setError("Room not found. Check the code and try again."); setIsLoading(false); return; }
      onJoin({ roomId: roomId.trim().toUpperCase() });
    } catch {
      setError("Failed to join room. Is the server running?");
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
        {/* Header with user info */}
        <div className={styles.topBar}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>{"</>"}</span>
            <div>
              <h1 className={styles.logoTitle}>CollabCode</h1>
              <p className={styles.logoSub}>Real-time collaborative editor</p>
            </div>
          </div>
          <div className={styles.userBadge}>
            <span className={styles.userAvatar}>{username?.charAt(0).toUpperCase()}</span>
            <span className={styles.userName}>{username}</span>
            <button className={styles.logoutBtn} onClick={onLogout} title="Log out">↩</button>
          </div>
        </div>

        <div className={styles.tabs}>
          {["create", "join"].map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => { setTab(t); setError(""); }}
            >
              {t === "create" ? "Create Room" : "Join Room"}
            </button>
          ))}
        </div>

        <form onSubmit={tab === "create" ? handleCreate : handleJoin} className={styles.form}>
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
                autoFocus
              />
            </div>
          )}

          {tab === "create" && (
            <div className={styles.createInfo}>
              <p>A new room will be created and you'll receive a shareable invite link.</p>
            </div>
          )}

          {error && <p className={styles.error}>⚠ {error}</p>}

          <button type="submit" className={styles.btn} disabled={isLoading}>
            {isLoading
              ? <span className={styles.spinner} />
              : tab === "create" ? "Create Room →" : "Join Session →"}
          </button>
        </form>

        <div className={styles.features}>
          {["Multi-user live editing", "Live cursor sync", "Chat panel", "Code execution"].map((f) => (
            <span key={f} className={styles.feature}>✓ {f}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
