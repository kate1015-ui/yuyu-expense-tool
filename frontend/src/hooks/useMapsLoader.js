import { useState, useEffect } from "react";
import { api } from "../api/client";

// Module-level singleton so script loads only once
let state = "idle"; // "idle" | "loading" | "ready" | "error"
let listeners = [];

function notify() {
  listeners.forEach(fn => fn());
}

export function useMapsLoader() {
  const [ready, setReady] = useState(state === "ready");

  useEffect(() => {
    const update = () => setReady(state === "ready");
    listeners.push(update);

    if (state === "idle") {
      state = "loading";
      api.getConfig()
        .then(({ google_maps_api_key }) => {
          if (!google_maps_api_key || google_maps_api_key.startsWith("your_")) {
            state = "error";
            notify();
            return;
          }
          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${google_maps_api_key}&libraries=places&language=zh-TW&region=TW`;
          script.async = true;
          script.onload = () => { state = "ready"; notify(); };
          script.onerror = () => { state = "error"; notify(); };
          document.head.appendChild(script);
        })
        .catch(() => { state = "error"; notify(); });
    } else if (state === "ready") {
      setReady(true);
    }

    return () => {
      listeners = listeners.filter(fn => fn !== update);
    };
  }, []);

  return ready;
}
