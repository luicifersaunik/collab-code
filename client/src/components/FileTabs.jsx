import { useState, useRef } from "react";
import styles from "./FileTabs.module.css";

const LANG_EXT = {
  javascript: ".js", typescript: ".ts", python: ".py", java: ".java",
  cpp: ".cpp", c: ".c", csharp: ".cs", rust: ".rs", go: ".go",
  html: ".html", css: ".css", json: ".json", markdown: ".md",
  sql: ".sql", shell: ".sh", ruby: ".rb", php: ".php",
};

const EXT_LANG = Object.fromEntries(Object.entries(LANG_EXT).map(([l, e]) => [e, l]));

function detectLanguage(filename) {
  const ext = filename.match(/\.[^.]+$/)?.[0] || "";
  return EXT_LANG[ext] || "javascript";
}

export default function FileTabs({ files, activeFileId, onSwitch, onCreate, onRename, onDelete }) {
  const [renaming, setRenaming] = useState(null); // fileId being renamed
  const [renameVal, setRenameVal] = useState("");
  const inputRef = useRef(null);

  const startRename = (file, e) => {
    e.stopPropagation();
    setRenaming(file.id);
    setRenameVal(file.name);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const commitRename = () => {
    if (!renameVal.trim()) { setRenaming(null); return; }
    const newName = renameVal.trim();
    const lang = detectLanguage(newName);
    onRename(renaming, newName, lang);
    setRenaming(null);
  };

  const handleNewFile = () => {
    const id = `file-${Date.now()}`;
    const name = `untitled-${files.length + 1}.js`;
    onCreate({ id, name, language: "javascript", content: "" });
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {files.map((file) => (
          <div
            key={file.id}
            className={`${styles.tab} ${file.id === activeFileId ? styles.tabActive : ""}`}
            onClick={() => onSwitch(file.id)}
          >
            {renaming === file.id ? (
              <input
                ref={inputRef}
                className={styles.renameInput}
                value={renameVal}
                onChange={(e) => setRenameVal(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <>
                <span className={styles.tabIcon}>{getFileIcon(file.name)}</span>
                <span className={styles.tabName} onDoubleClick={(e) => startRename(file, e)}>
                  {file.name}
                </span>
                {files.length > 1 && (
                  <button
                    className={styles.closeBtn}
                    onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                    title="Close file"
                  >✕</button>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <button className={styles.newFileBtn} onClick={handleNewFile} title="New file">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

function getFileIcon(name) {
  const ext = name.match(/\.[^.]+$/)?.[0] || "";
  const icons = {
    ".js": "JS", ".ts": "TS", ".jsx": "JX", ".tsx": "TX",
    ".py": "PY", ".java": "JV", ".cpp": "C+", ".c": "C",
    ".cs": "C#", ".rs": "RS", ".go": "GO", ".html": "HT",
    ".css": "CS", ".json": "{}","  .md": "MD", ".sh": "SH",
    ".rb": "RB", ".php": "PH",
  };
  return icons[ext] || "{}";
}
