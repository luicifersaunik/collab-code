import { useState, useEffect, useRef } from "react";
import styles from "./ChatPanel.module.css";

export default function ChatPanel({ messages, onSend, myId }) {
  const [draft, setDraft] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>CHAT</span>
        <span className={styles.headerCount}>{messages.length}</span>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <span>💬</span>
            <p>No messages yet.</p>
            <p>Say hello to your collaborators!</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.userId === myId;
          return (
            <div key={msg.id} className={`${styles.message} ${isMe ? styles.messageMe : ""}`}>
              {!isMe && (
                <div className={styles.avatar} style={{ background: msg.color + "22", border: `1.5px solid ${msg.color}` }}>
                  <span style={{ color: msg.color }}>{msg.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className={styles.bubble}>
                {!isMe && (
                  <span className={styles.username} style={{ color: msg.color }}>{msg.username}</span>
                )}
                <p className={styles.text}>{msg.text}</p>
                <span className={styles.time}>{formatTime(msg.timestamp)}</span>
              </div>
              {isMe && (
                <div className={styles.avatar} style={{ background: msg.color + "22", border: `1.5px solid ${msg.color}` }}>
                  <span style={{ color: msg.color }}>{msg.username.charAt(0).toUpperCase()}</span>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.textarea}
          placeholder="Message… (Enter to send)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          maxLength={500}
        />
        <button
          className={styles.sendBtn}
          onClick={send}
          disabled={!draft.trim()}
          title="Send (Enter)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
