import { useState } from "react";
import { apiUrl } from "../api";
import styles from "./Landing.module.css";

export default function Landing({ prefilledRoom = "", username, avatar, onJoin, onLogout }) {
  const [mode, setMode] = useState("personal");
  const [tab, setTab] = useState(prefilledRoom ? "join" : "create");
  const [roomId, setRoomId] = useState(prefilledRoom);
  const [role, setRole] = useState("interviewer");
  const [timerDuration, setTimerDuration] = useState(45);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsLoading(true); setError("");
    try {
      const res = await fetch(apiUrl("/api/room/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, timerDuration: Number(timerDuration) }),
      });
      const { roomId: newRoomId } = await res.json();
      onJoin({ roomId: newRoomId, mode, role: mode === "interview" ? "interviewer" : "participant" });
    } catch { setError("Failed to create room. Is the server running?"); }
    finally { setIsLoading(false); }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomId.trim()) return setError("Please enter a room code.");
    setIsLoading(true); setError("");
    try {
      const res = await fetch(apiUrl(`/api/room/${roomId.trim().toUpperCase()}`));
      const { exists } = await res.json();
      if (!exists) { setError("Room not found."); setIsLoading(false); return; }
      onJoin({ roomId: roomId.trim().toUpperCase(), mode, role: mode === "interview" ? role : "participant" });
    } catch { setError("Failed to join room."); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={styles.container}>
      <div className={styles.grid} />
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.card}>
        {/* Header */}
        <div className={styles.topBar}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>{"</>"}</span>
            <div>
              <h1 className={styles.logoTitle}>CollabCode</h1>
              <p className={styles.logoSub}>Real-time collaborative editor</p>
            </div>
          </div>
          <div className={styles.userBadge}>
            {avatar
              ? <img src={avatar} className={styles.userAvatarImg} alt={username} />
              : <span className={styles.userAvatar}>{username?.charAt(0).toUpperCase()}</span>
            }
            <span className={styles.userName}>{username}</span>
            <button className={styles.logoutBtn} onClick={onLogout} title="Log out">↩</button>
          </div>
        </div>

        {/* Mode selector */}
        <div className={styles.modeGrid}>
          <button
            className={`${styles.modeCard} ${mode === "personal" ? styles.modeCardActive : ""}`}
            onClick={() => setMode("personal")}
          >
            <span className={styles.modeIcon}>👨‍💻</span>
            <span className={styles.modeTitle}>Personal</span>
            <span className={styles.modeSub}>Learn, practice & build with AI assistance</span>
            {mode === "personal" && <span className={styles.modeCheck}>✓</span>}
          </button>
          <button
            className={`${styles.modeCard} ${mode === "interview" ? styles.modeCardActiveInterview : ""}`}
            onClick={() => setMode("interview")}
          >
            <span className={styles.modeIcon}>🏢</span>
            <span className={styles.modeTitle}>Interview</span>
            <span className={styles.modeSub}>Conduct technical interviews, no AI for candidates</span>
            {mode === "interview" && <span className={styles.modeCheck}>✓</span>}
          </button>
        </div>

        {/* Feature pills */}
        <div className={styles.featurePills}>
          {mode === "personal"
            ? ["AI coding assistant", "Multi-file tabs", "Code execution", "Live cursors"].map(f => (
                <span key={f} className={`${styles.pill} ${styles.pillBlue}`}>✓ {f}</span>
              ))
            : ["Session timer", "Private notes", "Feedback form", "No AI for candidate"].map(f => (
                <span key={f} className={`${styles.pill} ${styles.pillPurple}`}>✓ {f}</span>
              ))
          }
        </div>

        {/* Create/Join tabs */}
        <div className={styles.tabs}>
          {["create", "join"].map(t => (
            <button key={t}
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
              <input className={`${styles.input} ${styles.inputMono}`}
                placeholder="e.g. A3B2C1D4"
                value={roomId} onChange={e => setRoomId(e.target.value.toUpperCase())}
                maxLength={8} autoFocus />
            </div>
          )}

          {/* Interview-specific options */}
          {mode === "interview" && tab === "create" && (
            <div className={styles.field}>
              <label className={styles.label}>Interview Duration (minutes)</label>
              <select className={styles.input} value={timerDuration} onChange={e => setTimerDuration(e.target.value)}>
                {[15, 30, 45, 60, 90].map(m => (
                  <option key={m} value={m}>{m} minutes</option>
                ))}
              </select>
            </div>
          )}

          {mode === "interview" && tab === "join" && (
            <div className={styles.field}>
              <label className={styles.label}>Joining as</label>
              <div className={styles.roleGrid}>
                <button type="button"
                  className={`${styles.roleBtn} ${role === "interviewer" ? styles.roleBtnActive : ""}`}
                  onClick={() => setRole("interviewer")}>
                  🎤 Interviewer
                </button>
                <button type="button"
                  className={`${styles.roleBtn} ${role === "participant" ? styles.roleBtnActive : ""}`}
                  onClick={() => setRole("participant")}>
                  👨‍💻 Candidate
                </button>
              </div>
            </div>
          )}

          {tab === "create" && mode === "personal" && (
            <div className={styles.createInfo}>
              A room will be created with AI assistant enabled. Share the link with collaborators.
            </div>
          )}
          {tab === "create" && mode === "interview" && (
            <div className={`${styles.createInfo} ${styles.createInfoInterview}`}>
              You'll be the interviewer. Share the room code with your candidate to join as participant.
            </div>
          )}

          {error && <p className={styles.error}>⚠ {error}</p>}

          <button type="submit" className={`${styles.btn} ${mode === "interview" ? styles.btnInterview : ""}`} disabled={isLoading}>
            {isLoading ? <span className={styles.spinner} /> : tab === "create" ? "Create Room →" : "Join Session →"}
          </button>
        </form>
      </div>
    </div>
  );
}
