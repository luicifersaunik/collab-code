import { useState } from "react";
import styles from "./OutputPanel.module.css";

export default function OutputPanel({ result, isRunning, stdin, onStdinChange, onClose }) {
  const [activeTab, setActiveTab] = useState("output");
  const hasError = result?.stderr || result?.compile_output;
  const statusOk = result?.status === "Accepted";

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={`${styles.panelTab} ${activeTab === "output" ? styles.panelTabActive : ""}`}
            onClick={() => setActiveTab("output")}>Output</button>
          <button className={`${styles.panelTab} ${activeTab === "stdin" ? styles.panelTabActive : ""}`}
            onClick={() => setActiveTab("stdin")}>
            stdin
            {stdin && <span className={styles.stdinDot} />}
          </button>
          {result && (
            <>
              <span className={`${styles.statusBadge} ${statusOk ? styles.statusOk : styles.statusErr}`}>
                {result.status}
              </span>
              {result.time && <span className={styles.meta}>{result.time}s</span>}
              {result.memory && <span className={styles.meta}>{(result.memory / 1024).toFixed(1)} MB</span>}
            </>
          )}
          {isRunning && (
            <span className={styles.running}><span className={styles.runSpinner} /> Running…</span>
          )}
        </div>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div className={styles.body}>
        {activeTab === "stdin" ? (
          <div className={styles.stdinPane}>
            <p className={styles.stdinLabel}>Standard Input — your program will read from this</p>
            <textarea
              className={styles.stdinArea}
              placeholder={"Enter input for your program...\ne.g. if Python does input(), type here"}
              value={stdin}
              onChange={(e) => onStdinChange(e.target.value)}
              spellCheck={false}
            />
          </div>
        ) : (
          <>
            {isRunning && !result && <p className={styles.placeholder}>Executing code…</p>}
            {result?.compile_output && (
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Compile Error</span>
                <pre className={`${styles.pre} ${styles.preErr}`}>{result.compile_output}</pre>
              </div>
            )}
            {result?.stderr && (
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Stderr</span>
                <pre className={`${styles.pre} ${styles.preErr}`}>{result.stderr}</pre>
              </div>
            )}
            {result?.stdout !== undefined && (
              <div className={styles.section}>
                {hasError && <span className={styles.sectionLabel}>Stdout</span>}
                <pre className={styles.pre}>
                  {result.stdout || <span className={styles.empty}>No output.</span>}
                </pre>
              </div>
            )}
            {result?.error && <pre className={`${styles.pre} ${styles.preErr}`}>{result.error}</pre>}
          </>
        )}
      </div>
    </div>
  );
}
