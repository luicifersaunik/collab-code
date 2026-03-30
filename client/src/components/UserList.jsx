import styles from "./UserList.module.css";

export default function UserList({ users, myId }) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>COLLABORATORS</span>
        <span className={styles.headerCount}>{users.length}</span>
      </div>

      <div className={styles.list}>
        {users.map((user) => (
          <div key={user.id} className={styles.user}>
            <div
              className={styles.avatar}
              style={{ background: user.color + "22", border: `1.5px solid ${user.color}` }}
            >
              <span style={{ color: user.color }}>{user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {user.name}
                {user.id === myId && <span className={styles.youBadge}> you</span>}
              </span>
              <span className={styles.userStatus}>● editing</span>
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className={styles.footer}>
        <p className={styles.footerText}>
          Cursors are color-coded per collaborator. Changes sync in real-time.
        </p>
      </div>
    </div>
  );
}
