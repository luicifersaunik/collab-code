import { useEffect, useRef, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import socket from "../socket";
import Toolbar from "./Toolbar";
import UserList from "./UserList";
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

export default function EditorPage({ roomId, username, onLeave }) {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const isRemoteChange = useRef(false);
  const cursorsRef = useRef({}); // userId → { color, name, decorations }

  const addNotification = useCallback((msg) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, msg }]);
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 3000);
  }, []);

  // Socket setup
  useEffect(() => {
    socket.connect();

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join-room", { roomId, username });
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("room-state", ({ code: initialCode, language: lang, users: roomUsers, yourId }) => {
      setCode(initialCode);
      setLanguage(lang);
      setUsers(roomUsers);
      setMyId(yourId);
    });

    socket.on("code-update", ({ code: newCode }) => {
      isRemoteChange.current = true;
      setCode(newCode);
    });

    socket.on("language-update", ({ language: lang }) => {
      setLanguage(lang);
    });

    socket.on("users-updated", ({ users: updatedUsers }) => {
      setUsers(updatedUsers);
    });

    socket.on("user-joined", ({ user }) => {
      addNotification(`${user.name} joined the session`);
    });

    socket.on("user-left", ({ userId }) => {
      // Remove cursor decorations for departed user
      removeCursorDecorations(userId);
    });

    socket.on("cursor-update", ({ userId, position, selection, color, name }) => {
      renderRemoteCursor(userId, position, selection, color, name);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("room-state");
      socket.off("code-update");
      socket.off("language-update");
      socket.off("users-updated");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("cursor-update");
      socket.disconnect();
    };
    // eslint-disable-next-line
  }, [roomId, username]);

  const removeCursorDecorations = (userId) => {
    if (!editorRef.current || !cursorsRef.current[userId]) return;
    const { decorations } = cursorsRef.current[userId];
    editorRef.current.deltaDecorations(decorations, []);
    delete cursorsRef.current[userId];
  };

  const renderRemoteCursor = (userId, position, selection, color, name) => {
    if (!editorRef.current || !monacoRef.current) return;
    const monaco = monacoRef.current;
    const editor = editorRef.current;

    const prevDecorations = cursorsRef.current[userId]?.decorations || [];
    const newDecorations = [];

    // Cursor line decoration
    if (position) {
      newDecorations.push({
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
        options: {
          className: `remoteCursor-${userId.slice(0, 6)}`,
          afterContentClassName: `remoteCursorLabel-${userId.slice(0, 6)}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Selection decoration
    if (selection && (selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn)) {
      newDecorations.push({
        range: new monaco.Range(
          selection.startLineNumber, selection.startColumn,
          selection.endLineNumber, selection.endColumn
        ),
        options: {
          className: `remoteSelection-${userId.slice(0, 6)}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    // Inject dynamic CSS for this user's color
    const styleId = `cursor-style-${userId.slice(0, 6)}`;
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      const shortId = userId.slice(0, 6);
      style.textContent = `
        .remoteCursor-${shortId} {
          border-left: 2px solid ${color};
          margin-left: -1px;
        }
        .remoteCursorLabel-${shortId}::after {
          content: "${name}";
          background: ${color};
          color: #0a0e17;
          font-size: 10px;
          font-family: var(--font-mono);
          font-weight: 700;
          padding: 1px 5px;
          border-radius: 2px;
          position: absolute;
          white-space: nowrap;
          z-index: 100;
          pointer-events: none;
          top: -18px;
        }
        .remoteSelection-${shortId} {
          background: ${color}22;
        }
      `;
      document.head.appendChild(style);
    }

    const appliedDecorations = editor.deltaDecorations(prevDecorations, newDecorations);
    cursorsRef.current[userId] = { decorations: appliedDecorations, color, name };
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Cursor position tracking
    editor.onDidChangeCursorPosition((e) => {
      socket.emit("cursor-move", {
        roomId,
        position: e.position,
        selection: editor.getSelection(),
      });
    });

    editor.onDidChangeCursorSelection((e) => {
      socket.emit("cursor-move", {
        roomId,
        position: e.selection.getStartPosition(),
        selection: e.selection,
      });
    });
  };

  const handleCodeChange = (value) => {
    if (isRemoteChange.current) {
      isRemoteChange.current = false;
      setCode(value);
      return;
    }
    setCode(value);
    socket.emit("code-change", { roomId, code: value });
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    socket.emit("language-change", { roomId, language: lang });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(url);
    addNotification("Invite link copied!");
  };

  return (
    <div className={styles.container}>
      {/* Toolbar */}
      <Toolbar
        roomId={roomId}
        language={language}
        languages={SUPPORTED_LANGUAGES}
        isConnected={isConnected}
        onLanguageChange={handleLanguageChange}
        onCopyLink={handleCopyLink}
        onLeave={onLeave}
        userCount={users.length}
      />

      <div className={styles.workspace}>
        {/* Editor */}
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
              renderWhitespace: "selection",
              cursorBlinking: "phase",
              cursorSmoothCaretAnimation: "on",
              smoothScrolling: true,
              padding: { top: 16, bottom: 16 },
              lineHeight: 1.7,
              bracketPairColorization: { enabled: true },
              formatOnPaste: true,
              tabSize: 2,
              wordWrap: "off",
              glyphMargin: false,
              overviewRulerLanes: 0,
            }}
          />
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <UserList users={users} myId={myId} />
        </div>
      </div>

      {/* Notifications */}
      <div className={styles.notifications}>
        {notifications.map(({ id, msg }) => (
          <div key={id} className={styles.notification}>
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}
