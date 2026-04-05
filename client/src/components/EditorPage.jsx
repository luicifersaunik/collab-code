import { useEffect, useRef, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import socket from "../socket";
import { apiUrl } from "../api";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
import FileTabs from "./FileTabs";
import OutputPanel from "./OutputPanel";
import styles from "./EditorPage.module.css";

const SUPPORTED_LANGUAGES = [
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "java", label: "Java" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "csharp", label: "C#" },
  { id: "rust", label: "Rust" },
  { id: "go", label: "Go" },
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
  { id: "json", label: "JSON" },
  { id: "markdown", label: "Markdown" },
  { id: "sql", label: "SQL" },
  { id: "shell", label: "Shell" },
];

const RUNNABLE = new Set(["javascript","typescript","python","java","cpp","c","csharp","rust","go","shell","ruby","php","swift","kotlin"]);

export default function EditorPage({ roomId, username, token, avatar, onLeave, onLogout }) {
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState(null);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [execResult, setExecResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [stdin, setStdin] = useState("");

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const cursorsRef = useRef({});
  const chatOpenRef = useRef(false);

  // Yjs: one Y.Doc per file
  const ydocsRef = useRef({});       // fileId → Y.Doc
  const bindingRef = useRef(null);   // current MonacoBinding

  const activeFile = files.find(f => f.id === activeFileId);

  const addNotification = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setNotifications(p => [...p, { id, msg }]);
    setTimeout(() => setNotifications(p => p.filter(n => n.id !== id)), 3000);
  }, []);

  // ── Get or create a Y.Doc for a file ──────────────────────────────────────
  const getYDoc = useCallback((fileId) => {
    if (!ydocsRef.current[fileId]) {
      const doc = new Y.Doc();
      doc.on("update", (update) => {
        socket.emit("yjs-update", { roomId, fileId, update: Buffer.from(update).toString("base64") });
      });
      ydocsRef.current[fileId] = doc;
    }
    return ydocsRef.current[fileId];
  }, [roomId]);

  // ── Bind Monaco to current file's Y.Doc ───────────────────────────────────
  const bindEditor = useCallback((fileId) => {
    if (!editorRef.current || !monacoRef.current) return;
    if (bindingRef.current) { bindingRef.current.destroy(); bindingRef.current = null; }
    const doc = getYDoc(fileId);
    const yText = doc.getText("content");
    bindingRef.current = new MonacoBinding(
      yText,
      editorRef.current.getModel(),
      new Set([editorRef.current])
    );
  }, [getYDoc]);

  // ── Socket setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (token) socket.auth = { token };
    socket.connect();

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { roomId, username });
    });
    socket.on("disconnect", () => setIsConnected(false));

    socket.on("room-state", ({ files: f, activeFileId: afId, users: u, yourId, chatHistory, yjsStates }) => {
      setFiles(f);
      setActiveFileId(afId);
      setUsers(u);
      setMyId(yourId);
      setChatMessages(chatHistory || []);

      // Apply server Yjs state for all files
      if (yjsStates) {
        Object.entries(yjsStates).forEach(([fileId, b64]) => {
          const doc = getYDoc(fileId);
          Y.applyUpdate(doc, Buffer.from(b64, "base64"));
        });
      }
    });

    socket.on("yjs-update", ({ fileId, update }) => {
      const doc = getYDoc(fileId);
      Y.applyUpdate(doc, Buffer.from(update, "base64"));
    });

    socket.on("users-updated", ({ users: u }) => setUsers(u));
    socket.on("user-joined", ({ user }) => addNotification(`${user.name} joined`));
    socket.on("user-left", ({ userId }) => removeCursorDecorations(userId));

    socket.on("cursor-update", ({ userId, fileId, position, selection, color, name }) => {
      if (fileId === activeFileId) renderRemoteCursor(userId, position, selection, color, name);
    });

    socket.on("file-created", ({ file }) => {
      setFiles(p => [...p, file]);
      addNotification(`File "${file.name}" created`);
    });
    socket.on("file-renamed", ({ fileId, name }) => {
      setFiles(p => p.map(f => f.id === fileId ? { ...f, name } : f));
    });
    socket.on("file-deleted", ({ fileId }) => {
      setFiles(p => {
        const remaining = p.filter(f => f.id !== fileId);
        if (remaining.length > 0) setActiveFileId(remaining[0].id);
        return remaining;
      });
      delete ydocsRef.current[fileId];
    });
    socket.on("language-update", ({ fileId, language }) => {
      setFiles(p => p.map(f => f.id === fileId ? { ...f, language } : f));
    });

    socket.on("chat-message", (msg) => {
      setChatMessages(p => [...p, msg]);
      if (!chatOpenRef.current) setUnreadChat(n => n + 1);
    });

    return () => {
      ["connect","disconnect","room-state","yjs-update","users-updated","user-joined",
       "user-left","cursor-update","file-created","file-renamed","file-deleted",
       "language-update","chat-message"].forEach(e => socket.off(e));
      if (bindingRef.current) bindingRef.current.destroy();
      socket.disconnect();
    };
  }, [roomId, username]);

  // Re-bind editor when active file changes
  useEffect(() => {
    if (activeFileId && editorRef.current) bindEditor(activeFileId);
  }, [activeFileId, bindEditor]);

  // ── Cursor helpers ────────────────────────────────────────────────────────
  const removeCursorDecorations = (userId) => {
    if (!editorRef.current || !cursorsRef.current[userId]) return;
    editorRef.current.deltaDecorations(cursorsRef.current[userId].decorations, []);
    delete cursorsRef.current[userId];
  };

  const renderRemoteCursor = (userId, position, selection, color, name) => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const prev = cursorsRef.current[userId]?.decorations || [];
    const decors = [];
    if (position) decors.push({
      range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
      options: {
        className: `remoteCursor-${userId.slice(0,6)}`,
        afterContentClassName: `remoteCursorLabel-${userId.slice(0,6)}`,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    });
    if (selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn)) {
      decors.push({
        range: new monaco.Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn),
        options: { className: `remoteSelection-${userId.slice(0,6)}`, stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
      });
    }
    const styleId = `cursor-style-${userId.slice(0,6)}`;
    if (!document.getElementById(styleId)) {
      const s = document.createElement("style");
      s.id = styleId;
      const sid = userId.slice(0,6);
      s.textContent = `
        .remoteCursor-${sid}{border-left:2px solid ${color};margin-left:-1px;}
        .remoteCursorLabel-${sid}::after{content:"${name}";background:${color};color:#0a0e17;font-size:10px;font-family:var(--font-mono);font-weight:700;padding:1px 5px;border-radius:2px;position:absolute;white-space:nowrap;z-index:100;pointer-events:none;top:-18px;}
        .remoteSelection-${sid}{background:${color}22;}
      `;
      document.head.appendChild(s);
    }
    cursorsRef.current[userId] = { decorations: editor.deltaDecorations(prev, decors), color, name };
  };

  // ── Editor mount ──────────────────────────────────────────────────────────
  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    if (activeFileId) bindEditor(activeFileId);

    editor.onDidChangeCursorPosition((e) => {
      socket.emit("cursor-move", { roomId, fileId: activeFileId, position: e.position, selection: editor.getSelection() });
    });
    editor.onDidChangeCursorSelection((e) => {
      socket.emit("cursor-move", { roomId, fileId: activeFileId, position: e.selection.getStartPosition(), selection: e.selection });
    });
  };

  // ── File tab handlers ─────────────────────────────────────────────────────
  const handleFileSwitch = (fileId) => {
    setActiveFileId(fileId);
    socket.emit("file-switch", { roomId, fileId });
    setExecResult(null);
    // Bind editor to new file
    setTimeout(() => bindEditor(fileId), 50);
  };

  const handleFileCreate = (file) => {
    const doc = getYDoc(file.id);
    doc.getText("content").insert(0, file.content || "");
    socket.emit("file-create", { roomId, file });
    setActiveFileId(file.id);
  };

  const handleFileRename = (fileId, name, language) => {
    socket.emit("file-rename", { roomId, fileId, name });
    if (language) socket.emit("language-change", { roomId, fileId, language });
  };

  const handleFileDelete = (fileId) => {
    if (files.length <= 1) return addNotification("Cannot delete the last file.");
    socket.emit("file-delete", { roomId, fileId });
  };

  // ── Language change ───────────────────────────────────────────────────────
  const handleLanguageChange = (language) => {
    if (!activeFileId) return;
    setFiles(p => p.map(f => f.id === activeFileId ? { ...f, language } : f));
    socket.emit("language-change", { roomId, fileId: activeFileId, language });
    setExecResult(null);
  };

  // ── Run ───────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    if (!activeFile) return;
    setIsRunning(true);
    setExecResult(null);
    try {
      const code = ydocsRef.current[activeFileId]?.getText("content").toString() || "";
      const res = await fetch(apiUrl("/api/execute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language: activeFile.language, stdin }),
      });
      setExecResult(await res.json());
    } catch { setExecResult({ error: "Failed to reach execution service." }); }
    finally { setIsRunning(false); }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`);
    addNotification("Invite link copied!");
  };

  const handleSendMessage = (text) => socket.emit("chat-message", { roomId, text });
  const handleChatOpen = () => { chatOpenRef.current = true; setUnreadChat(0); };

  const canRun = RUNNABLE.has(activeFile?.language || "");

  return (
    <div className={styles.container}>
      <Toolbar
        roomId={roomId} username={username} avatar={avatar}
        language={activeFile?.language || "javascript"}
        languages={SUPPORTED_LANGUAGES}
        isConnected={isConnected}
        onLanguageChange={handleLanguageChange}
        onCopyLink={handleCopyLink}
        onLeave={onLeave} onLogout={onLogout}
        userCount={users.length}
        isRunning={isRunning} onRun={handleRun} canRun={canRun}
      />

      <div className={styles.workspace}>
        <div className={styles.editorColumn}>
          <FileTabs
            files={files}
            activeFileId={activeFileId}
            onSwitch={handleFileSwitch}
            onCreate={handleFileCreate}
            onRename={handleFileRename}
            onDelete={handleFileDelete}
          />
          <div className={styles.editorWrapper}>
            {activeFile && (
              <Editor
                key={activeFileId}
                height="100%"
                language={activeFile.language}
                defaultValue=""
                theme="vs-dark"
                onMount={handleEditorDidMount}
                options={{
                  fontSize: 14,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontLigatures: true,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  cursorBlinking: "phase",
                  cursorSmoothCaretAnimation: "on",
                  smoothScrolling: true,
                  padding: { top: 16, bottom: 16 },
                  lineHeight: 1.7,
                  bracketPairColorization: { enabled: true },
                  tabSize: 2,
                }}
              />
            )}
          </div>
          {(execResult || isRunning) && (
            <OutputPanel
              result={execResult}
              isRunning={isRunning}
              stdin={stdin}
              onStdinChange={setStdin}
              onClose={() => setExecResult(null)}
            />
          )}
        </div>

        <div className={styles.sidebar}>
          <Sidebar
            users={users} myId={myId}
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            unreadCount={unreadChat}
            onChatOpen={handleChatOpen}
          />
        </div>
      </div>

      <div className={styles.notifications}>
        {notifications.map(({ id, msg }) => (
          <div key={id} className={styles.notification}>{msg}</div>
        ))}
      </div>
    </div>
  );
}
