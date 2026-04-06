import { useState, useRef, useEffect } from "react";
import { apiUrl } from "../api";
import styles from "./AIChatPanel.module.css";

const QUICK_PROMPTS = [
  { label: "Explain code", prompt: "Explain what this code does step by step." },
  { label: "Fix bug", prompt: "Find and fix any bugs in this code." },
  { label: "Optimize", prompt: "Optimize this code for performance." },
  { label: "Add comments", prompt: "Add clear comments to explain this code." },
  { label: "Write tests", prompt: "Write unit tests for this code." },
  { label: "Explain error", prompt: "Explain what this error means and how to fix it." },
];

export default function AIChatPanel({ roomId, activeCode, language }) {
  const [messages, setMessages] = useState([
    { role: "assistant", text: `👋 Hi! I'm your AI coding assistant. I can see your **${language}** code. Ask me anything — explain, debug, optimize, or write tests.` }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (prompt) => {
    const text = (prompt || input).trim();
    if (!text || isLoading) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setIsLoading(true);

    try {
      const res = await fetch(apiUrl("/api/ai-assist"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, prompt: text, code: activeCode, language }),
      });
      const data = await res.json();
      if (data.error) {
        setMessages(prev => [...prev, { role: "assistant", text: `⚠️ ${data.error}`, isError: true }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: data.reply }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", text: "⚠️ Failed to reach AI service.", isError: true }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Simple markdown code block renderer
  const renderMessage = (text) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```")) {
        const lines = part.slice(3, -3).split("\n");
        const lang = lines[0];
        const code = lines.slice(1).join("\n");
        return (
          <div key={i} className={styles.codeBlock}>
            {lang && <span className={styles.codeLang}>{lang}</span>}
            <pre><code>{code}</code></pre>
          </div>
        );
      }
      return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>;
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.aiIcon}>✦</span>
          <span className={styles.title}>AI Assistant</span>
        </div>
        <span className={styles.badge}>Personal</span>
      </div>

      {/* Quick prompts */}
      <div className={styles.quickPrompts}>
        {QUICK_PROMPTS.map(q => (
          <button key={q.label} className={styles.quickBtn} onClick={() => send(q.prompt)} disabled={isLoading}>
            {q.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={`${styles.message} ${msg.role === "user" ? styles.messageUser : styles.messageAI} ${msg.isError ? styles.messageError : ""}`}>
            {msg.role === "assistant" && <span className={styles.msgIcon}>✦</span>}
            <div className={styles.msgContent}>{renderMessage(msg.text)}</div>
          </div>
        ))}
        {isLoading && (
          <div className={`${styles.message} ${styles.messageAI}`}>
            <span className={styles.msgIcon}>✦</span>
            <div className={styles.typing}>
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <textarea
          ref={inputRef}
          className={styles.textarea}
          placeholder="Ask anything about your code..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          maxLength={1000}
          disabled={isLoading}
        />
        <button className={styles.sendBtn} onClick={() => send()} disabled={!input.trim() || isLoading}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
