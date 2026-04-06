import { useState, useEffect, useRef } from "react";
import { apiUrl } from "../api";
import styles from "./InterviewPanel.module.css";

export default function InterviewPanel({ roomId, role, timerDuration, timerStartedAt, onTimerStart, socket }) {
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState({ rating: 0, strengths: "", improvements: "", decision: "pending" });
  const [feedbackSaved, setFeedbackSaved] = useState(false);
  const [activeTab, setActiveTab] = useState("timer");
  const [timeLeft, setTimeLeft] = useState(null);
  const notesTimer = useRef(null);
  const isInterviewer = role === "interviewer";

  // Timer countdown
  useEffect(() => {
    if (!timerStartedAt) { setTimeLeft(null); return; }
    const total = timerDuration * 60 * 1000;
    const update = () => {
      const elapsed = Date.now() - timerStartedAt;
      const left = Math.max(0, total - elapsed);
      setTimeLeft(left);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt, timerDuration]);

  // Auto-save notes with debounce
  const handleNotesChange = (val) => {
    setNotes(val);
    clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      socket?.emit("notes-update", { roomId, notes: val });
    }, 1000);
  };

  const saveFeedback = async () => {
    await fetch(apiUrl(`/api/room/${roomId}/feedback`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    });
    setFeedbackSaved(true);
    setTimeout(() => setFeedbackSaved(false), 2000);
  };

  const formatTime = (ms) => {
    if (ms === null) return `${timerDuration}:00`;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const timerPct = timerStartedAt ? Math.max(0, timeLeft / (timerDuration * 60 * 1000)) : 1;
  const timerColor = timerPct > 0.5 ? "#06ffa5" : timerPct > 0.2 ? "#ffd93d" : "#ff4757";

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {["timer", isInterviewer && "notes", isInterviewer && "feedback"].filter(Boolean).map(t => (
          <button key={t}
            className={`${styles.tab} ${activeTab === t ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(t)}>
            {t === "timer" ? "⏱ Timer" : t === "notes" ? "📝 Notes" : "📊 Feedback"}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {/* TIMER TAB */}
        {activeTab === "timer" && (
          <div className={styles.timerPane}>
            <div className={styles.timerCircle}>
              <svg viewBox="0 0 120 120" className={styles.timerSvg}>
                <circle cx="60" cy="60" r="54" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle cx="60" cy="60" r="54" fill="none" stroke={timerColor}
                  strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - timerPct)}`}
                  transform="rotate(-90 60 60)"
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
                />
              </svg>
              <div className={styles.timerDisplay}>
                <span className={styles.timerTime} style={{ color: timerColor }}>{formatTime(timeLeft)}</span>
                <span className={styles.timerLabel}>{timerStartedAt ? "remaining" : `${timerDuration} min`}</span>
              </div>
            </div>

            {isInterviewer && !timerStartedAt && (
              <button className={styles.startBtn} onClick={onTimerStart}>
                ▶ Start Timer
              </button>
            )}
            {!timerStartedAt && !isInterviewer && (
              <p className={styles.waitingText}>Waiting for interviewer to start timer…</p>
            )}
            {timeLeft === 0 && (
              <div className={styles.timeUpBanner}>⏰ Time's up!</div>
            )}

            <div className={styles.timerInfo}>
              <div className={styles.timerInfoRow}>
                <span>Duration</span><span>{timerDuration} min</span>
              </div>
              <div className={styles.timerInfoRow}>
                <span>Your role</span>
                <span className={isInterviewer ? styles.roleInterviewer : styles.roleCandidate}>
                  {isInterviewer ? "🎤 Interviewer" : "👨‍💻 Candidate"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* NOTES TAB — interviewer only */}
        {activeTab === "notes" && isInterviewer && (
          <div className={styles.notesPane}>
            <p className={styles.notesHint}>Private notes — only you can see these. Auto-saved.</p>
            <textarea
              className={styles.notesArea}
              placeholder={`Candidate observations...\n\n• Problem-solving approach\n• Communication\n• Code quality\n• Edge cases considered`}
              value={notes}
              onChange={e => handleNotesChange(e.target.value)}
            />
          </div>
        )}

        {/* FEEDBACK TAB — interviewer only */}
        {activeTab === "feedback" && isInterviewer && (
          <div className={styles.feedbackPane}>
            <div className={styles.feedbackField}>
              <label className={styles.feedbackLabel}>Overall Rating</label>
              <div className={styles.stars}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} className={`${styles.star} ${n <= feedback.rating ? styles.starActive : ""}`}
                    onClick={() => setFeedback(p => ({ ...p, rating: n }))}>★</button>
                ))}
              </div>
            </div>

            <div className={styles.feedbackField}>
              <label className={styles.feedbackLabel}>Decision</label>
              <div className={styles.decisionBtns}>
                {[["hire","✅ Hire"], ["no-hire","❌ No Hire"], ["pending","⏳ Pending"]].map(([val, label]) => (
                  <button key={val}
                    className={`${styles.decisionBtn} ${feedback.decision === val ? styles.decisionActive : ""}`}
                    onClick={() => setFeedback(p => ({ ...p, decision: val }))}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.feedbackField}>
              <label className={styles.feedbackLabel}>Strengths</label>
              <textarea className={styles.feedbackArea} rows={3}
                placeholder="What did the candidate do well?"
                value={feedback.strengths}
                onChange={e => setFeedback(p => ({ ...p, strengths: e.target.value }))} />
            </div>

            <div className={styles.feedbackField}>
              <label className={styles.feedbackLabel}>Areas for Improvement</label>
              <textarea className={styles.feedbackArea} rows={3}
                placeholder="What could be improved?"
                value={feedback.improvements}
                onChange={e => setFeedback(p => ({ ...p, improvements: e.target.value }))} />
            </div>

            <button className={`${styles.saveBtn} ${feedbackSaved ? styles.saveBtnSaved : ""}`} onClick={saveFeedback}>
              {feedbackSaved ? "✓ Saved!" : "Save Feedback"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
