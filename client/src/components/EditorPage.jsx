import { useEffect, useRef, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import socket from "../socket";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
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

export default function EditorPage({ roomId, username, token, onLeave, onLogout }) {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const chatOpenRef = useRef(false);
  // Execution
  const [execResult, setExecResult] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const isRemoteChange = useRef(false);
  const cursorsRef = useRef({});

  const addNotification = useCallback((msg) => {
    const id = Date.now() + Math.random();
    setNotifications((prev) => [...prev, { id, msg }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000);
  }, []);

  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { roomId, username });
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("room-state", ({ code: c, language: l, users: u, yourId, chatHistory }) => {
      setCode(c);
      setLanguage(l);
      setUsers(u);
      setMyId(yourId);
      setChatMessages(chatHistory || []);
    });

    socket.on("code-update", ({ code: newCode }) => {
      isRemoteChange.current = true;
      setCode(newCode);
    });

    socket.on("language-update", ({ language: l }) => setLanguage(l));
    socket.on("users-updated", ({ users: u }) => setUsers(u));

    socket.on("user-joined", ({ user }) => addNotification(`${user.name} joined`));

    socket.on("user-left", ({ userId }) => removeCursorDecorations(userId));

    socket.on("cursor-update", ({ userId, position, selection, color, name }) => {
      renderRemoteCursor(userId, position, selection, color, name);
    });

    socket.on("chat-message", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!chatOpenRef.current) {
        setUnreadChat((n) => n + 1);
      }
    });

    return () => {
      ["connect","disconnect","room-state","code-update","language-update",
       "users-updated","user-joined","user-left","cursor-update","chat-message"]
        .forEach((e) => socket.off(e));
      socket.disconnect();
    };
  }, [roomId, username]);

  // Pass JWT for socket auth
  useEffect(() => {
    if (token) socket.auth = { token };
  }, [token]);

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

    if (position) {
      decors.push({
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
        options: {
          className: `remoteCursor-${userId.slice(0,6)}`,
          afterContentClassName: `remoteCursorLabel-${userId.slice(0,6)}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    if (selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn)) {
      decors.push({
        range: new monaco.Range(selection.startLineNumber, selection.startColumn, selection.endLineNumber, selection.endColumn),
        options: {
          className: `remoteSelection-${userId.slice(0,6)}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    const styleId = `cursor-style-${userId.slice(0,6)}`;
    if (!document.getElementById(styleId)) {
      const s = document.createElement("style");
      s.id = styleId;
      const sid = userId.slice(0,6);
      s.textContent = `
        .remoteCursor-${sid} { border-left: 2px solid ${color}; margin-left: -1px; }
        .remoteCursorLabel-${sid}::after {
          content: "${name}"; background: ${color}; color: #0a0e17;
          font-size: 10px; font-family: var(--font-mono); font-weight: 700;
          padding: 1px 5px; border-radius: 2px; position: absolute;
          white-space: nowrap; z-index: 100; pointer-events: none; top: -18px;
        }
        .remoteSelection-${sid} { background: ${color}22; }
      `;
      document.head.appendChild(s);
    }

    cursorsRef.current[userId] = {
      decorations: editor.deltaDecorations(prev, decors),
      color, name,
    };
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => {
      socket.emit("cursor-move", { roomId, position: e.position, selection: editor.getSelection() });
    });
    editor.onDidChangeCursorSelection((e) => {
      socket.emit("cursor-move", { roomId, position: e.selection.getStartPosition(), selection: e.selection });
    });
  };

  const handleCodeChange = (value) => {
    if (isRemoteChange.current) { isRemoteChange.current = false; setCode(value); return; }
    setCode(value);
    socket.emit("code-change", { roomId, code: value });
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    socket.emit("language-change", { roomId, language: lang });
    setExecResult(null);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`);
    addNotification("Invite link copied!");
  };

  const handleSendMessage = (text) => {
    socket.emit("chat-message", { roomId, text });
  };

  const handleChatOpen = () => {
    chatOpenRef.current = true;
    setUnreadChat(0);
  };

  // Code execution
  const handleRun = async () => {
    setIsRunning(true);
    setExecResult(null);
    try {
      const res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      setExecResult(data);
    } catch {
      setExecResult({ error: "Failed to reach execution service." });
    } finally {
      setIsRunning(false);
    }
  };

  const canRun = RUNNABLE.has(language);

  return (
    <div className={styles.container}>
      <Toolbar
        roomId={roomId}
        language={language}
        languages={SUPPORTED_LANGUAGES}
        isConnected={isConnected}
        onLanguageChange={handleLanguageChange}
        onCopyLink={handleCopyLink}
        onLeave={onLeave}
        onLogout={onLogout}
        userCount={users.length}
        isRunning={isRunning}
        onRun={handleRun}
        canRun={canRun}
      />

      <div className={styles.workspace}>
        <div className={styles.editorColumn}>
          <div className={styles.editorWrapper}>
            <Editor
              height="100%"
              language={language}
              value={code}
              theme="vs-dark"
              onChange={handleCodeChange}
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
          </div>

          <OutputPanel
            result={execResult}
            isRunning={isRunning}
            onClose={() => setExecResult(null)}
          />
        </div>

        <div className={styles.sidebar}>
          <Sidebar
            users={users}
            myId={myId}
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
