import { useEffect, useRef, useState } from "react";
import RFB from "@novnc/novnc";

type Status = "connected" | "disconnected";

interface CellProps {
  name: string;
  teamName: string | null;
  token: string;
  wsPort: number;
  vncPassword: string;
  isFull: boolean;
  hasFull: boolean;
  onToggleFull: () => void;
}

const statusColor: Record<Status, string> = {
  connected: "border-green-400 text-green-400",
  disconnected: "border-red-400 text-red-400",
};

export default function Cell({ name, teamName, token, wsPort, vncPassword, isFull, hasFull, onToggleFull }: CellProps) {
  const screenRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("disconnected");

  useEffect(() => {
    if (!screenRef.current) return;
    let rfb: RFB | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let connectTimeout: ReturnType<typeof setTimeout>;
    let cancelled = false;

    function connect() {
      if (cancelled || !screenRef.current) return;
      screenRef.current.replaceChildren();
      const url = `ws://${window.location.hostname}:${wsPort}/?token=${token}`;
      rfb = new RFB(screenRef.current, url, { credentials: { password: vncPassword } });
      rfb.viewOnly = true;
      rfb.scaleViewport = true;
      rfb.background = "#000"; // match container bg-black, noVNC defaults to gray
      // RFB has no connect timeout of its own: a target whose TCP connect
      // hangs (dropped packets, no RST) leaves the WebSocket "pending"
      // forever with no connect/disconnect event ever firing. Force one.
      connectTimeout = setTimeout(() => rfb?.disconnect(), 8000);
      rfb.addEventListener("connect", () => {
        clearTimeout(connectTimeout);
        setStatus("connected");
      });
      rfb.addEventListener("disconnect", () => {
        clearTimeout(connectTimeout);
        if (cancelled) return;
        setStatus("disconnected");
        retryTimer = setTimeout(connect, 3000);
      });
    }
    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(connectTimeout);
      rfb?.disconnect();
    };
  }, [token, wsPort, vncPassword]);

  return (
    <div
      onClick={onToggleFull}
      className={
        isFull
          ? "fixed inset-0 z-99 cursor-pointer bg-black"
          : `relative cursor-pointer bg-black ${hasFull ? "hidden" : ""}`
      }
    >
      <span
        className={`absolute top-0.5 left-0.5 z-10 border-l-4 bg-black/80 px-1.5 py-0.5 text-xs ${statusColor[status]}`}
      >
        {teamName ? `${teamName} — ${name}` : name}
      </span>
      <div ref={screenRef} className={isFull ? "h-screen" : "aspect-video border border-neutral-800"} />
      {/* noVNC's canvas calls stopPropagation/preventDefault on every mouse
          event unconditionally, even in viewOnly mode, so it swallows clicks
          before they reach this div's onClick. Sit above the canvas to
          intercept clicks before noVNC ever sees them. */}
      <div className="absolute inset-0" />
    </div>
  );
}
