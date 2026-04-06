import { useState } from "react";
import UserList from "./UserList";
import ChatPanel from "./ChatPanel";
import AIChatPanel from "./AIChatPanel";
import InterviewPanel from "./InterviewPanel";
import styles from "./Sidebar.module.css";

export default function Sidebar({
  mode, role, users, myId,
  messages, onSendMessage, unreadCount, onChatOpen,
  roomId, activeCode, language,
  timerDuration, timerStartedAt, onTimerStart, socket,
}) {
  const tabs = [
    { id: "users", label: "Users" },
    { id: "chat", label: "Chat" },
    ...(mode === "personal" ? [{ id: "ai", label: "✦ AI" }] : []),
    ...(mode === "interview" ? [{ id: "interview", label: "⏱ Interview" }] : []),
  ];

  const [activeTab, setActiveTab] = useState("users");

  const handleTabClick = (id) => {
    setActiveTab(id);
    if (id === "chat") onChatOpen?.();
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t.id}
            className={`${styles.tab} ${activeTab === t.id ? styles.tabActive : ""} ${t.id === "ai" ? styles.tabAI : ""} ${t.id === "interview" ? styles.tabInterview : ""}`}
            onClick={() => handleTabClick(t.id)}>
            {t.label}
            {t.id === "chat" && unreadCount > 0 && activeTab !== "chat" && (
              <span className={styles.unreadBadge}>{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === "users" && <UserList users={users} myId={myId} />}
        {activeTab === "chat" && <ChatPanel messages={messages} onSend={onSendMessage} myId={myId} />}
        {activeTab === "ai" && mode === "personal" && (
          <AIChatPanel roomId={roomId} activeCode={activeCode} language={language} />
        )}
        {activeTab === "interview" && mode === "interview" && (
          <InterviewPanel
            roomId={roomId} role={role}
            timerDuration={timerDuration}
            timerStartedAt={timerStartedAt}
            onTimerStart={onTimerStart}
            socket={socket}
          />
        )}
      </div>
    </div>
  );
}
