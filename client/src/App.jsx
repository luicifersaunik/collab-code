import { useState, useEffect } from "react";
import AuthPage from "./components/AuthPage";
import Landing from "./components/Landing";
import EditorPage from "./components/EditorPage";
import socket from "./socket";

export default function App() {
  const [auth, setAuth] = useState(null);       // { token, username } | null
  const [session, setSession] = useState(null); // { roomId } | null
  const [authChecked, setAuthChecked] = useState(false);

  // On mount — restore auth from localStorage
  useEffect(() => {
    const token = localStorage.getItem("cc_token");
    const username = localStorage.getItem("cc_username");
    if (token && username) {
      // Verify token is still valid
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((data) => {
          if (data.username) setAuth({ token, username: data.username });
          else { localStorage.clear(); }
        })
        .catch(() => {})
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }

    // Pre-fill room from URL
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room");
    if (roomFromUrl) setSession({ roomId: roomFromUrl.toUpperCase(), fromUrl: true });
  }, []);

  const handleAuth = (authData) => setAuth(authData);

  const handleJoin = ({ roomId }) => {
    setSession({ roomId });
    const url = new URL(window.location);
    url.searchParams.set("room", roomId);
    window.history.pushState({}, "", url);
  };

  const handleLeave = () => {
    socket.disconnect();
    setSession(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  const handleLogout = () => {
    localStorage.removeItem("cc_token");
    localStorage.removeItem("cc_username");
    socket.disconnect();
    setAuth(null);
    setSession(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  if (!authChecked) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0e17" }}>
        <span style={{ fontFamily: "JetBrains Mono, monospace", color: "#00d4ff", fontSize: 14 }}>Loading…</span>
      </div>
    );
  }

  if (!auth) return <AuthPage onAuth={handleAuth} />;

  if (!session || session.fromUrl) {
    return (
      <Landing
        prefilledRoom={session?.fromUrl ? session.roomId : ""}
        username={auth.username}
        onJoin={handleJoin}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <EditorPage
      roomId={session.roomId}
      username={auth.username}
      token={auth.token}
      onLeave={handleLeave}
      onLogout={handleLogout}
    />
  );
}
