import { useState, useEffect } from "react";
import Landing from "./components/Landing";
import EditorPage from "./components/EditorPage";
import socket from "./socket";

export default function App() {
  const [session, setSession] = useState(null); // { roomId, username }

  useEffect(() => {
    // Check URL for room param (shareable links)
    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = params.get("room");
    if (roomFromUrl) {
      setSession((prev) =>
        prev ? prev : { roomId: roomFromUrl.toUpperCase(), username: null, needsName: true }
      );
    }
  }, []);

  const handleJoin = ({ roomId, username }) => {
    setSession({ roomId, username });
    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set("room", roomId);
    window.history.pushState({}, "", url);
  };

  const handleLeave = () => {
    socket.disconnect();
    setSession(null);
    window.history.pushState({}, "", window.location.pathname);
  };

  if (!session || session.needsName) {
    return (
      <Landing
        prefilledRoom={session?.needsName ? session.roomId : ""}
        onJoin={handleJoin}
      />
    );
  }

  return (
    <EditorPage
      roomId={session.roomId}
      username={session.username}
      onLeave={handleLeave}
    />
  );
}
