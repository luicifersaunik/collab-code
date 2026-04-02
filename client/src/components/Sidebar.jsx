import { useState } from "react";
import UserList from "./UserList";
import ChatPanel from "./ChatPanel";
import styles from "./Sidebar.module.css";

export default function Sidebar({ users, myId, messages, onSendMessage, unreadCount, onChatOpen }) {
  const [activeTab, setActiveTab] = useState("users");

  const handleTabClick = (tab) => {
    setActiveTab(tab);
    if (tab === "chat") onChatOpen?.();
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "users" ? styles.tabActive : ""}`}
          onClick={() => handleTabClick("users")}
        >
          Users
          <span className={styles.badge}>{users.length}</span>
        </button>
        <button
          className={`${styles.tab} ${activeTab === "chat" ? styles.tabActive : ""}`}
          onClick={() => handleTabClick("chat")}
        >
          Chat
          {unreadCount > 0 && activeTab !== "chat" && (
            <span className={`${styles.badge} ${styles.badgeUnread}`}>{unreadCount}</span>
          )}
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === "users" ? (
          <UserList users={users} myId={myId} />
        ) : (
          <ChatPanel messages={messages} onSend={onSendMessage} myId={myId} />
        )}
      </div>
    </div>
  );
}
