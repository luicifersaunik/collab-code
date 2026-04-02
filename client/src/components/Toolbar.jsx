import styles from "./Toolbar.module.css";

export default function Toolbar({
  roomId, language, languages, isConnected,
  onLanguageChange, onCopyLink, onLeave, onLogout,
  userCount, isRunning, onRun, canRun,
}) {
  return (
    <div className={styles.toolbar}>
      <div className={styles.brand}>
        <span className={styles.brandIcon}>{"</>"}</span>
        <span className={styles.brandName}>CollabCode</span>
      </div>

      <div className={styles.roomInfo}>
        <span className={styles.roomLabel}>ROOM</span>
        <span className={styles.roomId}>{roomId}</span>
        <button className={styles.copyBtn} onClick={onCopyLink} title="Copy invite link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>

      <div className={styles.status}>
        <span className={`${styles.dot} ${isConnected ? styles.dotGreen : styles.dotRed}`} />
        <span className={styles.statusText}>
          {isConnected ? `${userCount} online` : "Connecting…"}
        </span>
      </div>

      <div className={styles.spacer} />

      <select
        className={styles.select}
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
      >
        {languages.map((l) => (
          <option key={l.id} value={l.id}>{l.label}</option>
        ))}
      </select>

      {/* Run Button */}
      <button
        className={`${styles.runBtn} ${isRunning ? styles.runBtnRunning : ""}`}
        onClick={onRun}
        disabled={isRunning || !canRun}
        title={canRun ? "Run code (Judge0)" : `'${language}' not supported for execution`}
      >
        {isRunning ? (
          <><span className={styles.runSpinner} /> Running…</>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
            Run
          </>
        )}
      </button>

      <button className={styles.leaveBtn} onClick={onLeave} title="Leave session">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
          <polyline points="16,17 21,12 16,7"></polyline>
          <line x1="21" y1="12" x2="9" y2="12"></line>
        </svg>
        Leave
      </button>

      <button className={styles.logoutBtn} onClick={onLogout} title="Log out">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="4"></circle>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"></path>
        </svg>
      </button>
    </div>
  );
}
