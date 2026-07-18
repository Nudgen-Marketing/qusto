"use client";

import { useEffect, useState } from "react";

export function LiveConnection() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const source = new EventSource("/api/internal/events/stream");
    const ready = () => setConnected(true);
    source.addEventListener("ready", ready);
    source.addEventListener("trace", () => window.location.reload());
    source.onerror = () => setConnected(false);
    return () => source.close();
  }, []);
  return (
    <span>
      <i data-connected={connected} />
      {connected ? "Live connection" : "Reconnecting"}
    </span>
  );
}
