import { useState, useEffect } from "react";
import { apiUrl } from "./api";
import AuthPage from "./components/AuthPage";
import Landing from "./components/Landing";
import EditorPage from "./components/EditorPage";
import socket from "./socket";

export default function App() {
  const [auth, setAuth] = useState(null);
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (window.location.pathname === "/auth/callback") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token");
      const username = params.get("username");
      const avatar = decodeURIComponent(params.get("avatar") || "");
      if (token && username) {
        localStorage.setItem("cc_token", token);
        localStorage.setItem("cc_username", username);
        localStorage.setItem("cc_avatar", avatar);
        window.history.replaceState({}, "", "/");
        setAuth({ token, username, avatar });
        setAuthChecked(true);
        return;
      }
    }

    const token = localStorage.getItem("cc_token");
    const username = localStorage.getItem("cc_username");
    const avatar = localStorage.getItem("cc_avatar") || "";
    if (token && username) {
      fetch(apiUrl("/api/auth/me"), { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(data => { if (data.username) setAuth({ token, username: data.username, avatar }); else localStorage.clear(); })
        .catch(() => {})
        .finally(() => setAuthChecked(true));
    } else { setAuthChecked(true); }

    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room");
    if (roomFromUrl) setSession({ roomId: roomFromUrl.toUpperCase(), fromUrl: true });
  }, []);

  const handleAuth = (authData) => setAuth(authData);

  const handleJoin = ({ roomId, mode = "personal", role = "participant" }) => {
    setSession({ roomId, mode, role });
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
    localStorage.removeItem("cc_avatar");
    socket.disconnect();
    setAuth(null);
    setSession(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  if (!authChecked) return (
    <div style={{ height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0e17" }}>
      <span style={{ fontFamily:"JetBrains Mono,monospace",color:"#00d4ff",fontSize:14 }}>Loading…</span>
    </div>
  );

  if (!auth) return <AuthPage onAuth={handleAuth} />;

  if (!session || session.fromUrl) return (
    <Landing
      prefilledRoom={session?.fromUrl ? session.roomId : ""}
      username={auth.username} avatar={auth.avatar}
      onJoin={handleJoin} onLogout={handleLogout}
    />
  );

  return (
    <EditorPage
      roomId={session.roomId}
      username={auth.username}
      token={auth.token}
      avatar={auth.avatar}
      mode={session.mode || "personal"}
      role={session.role || "participant"}
      onLeave={handleLeave}
      onLogout={handleLogout}
    />
  );
}
