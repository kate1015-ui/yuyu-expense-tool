import { useState } from "react";

const STORAGE_KEY_TRANSIT = "yuyu_presets_transit";
const STORAGE_KEY_DRIVE   = "yuyu_presets_drive";

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); }
  catch { return []; }
}
function save(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

export function useTransitPresets() {
  const [presets, setPresets] = useState(() => load(STORAGE_KEY_TRANSIT));

  function addPreset(leg) {
    // leg: { origin, destination, tool, amount }
    const existing = load(STORAGE_KEY_TRANSIT);
    const dup = existing.find(p =>
      p.origin === leg.origin &&
      p.destination === leg.destination &&
      p.tool === leg.tool
    );
    if (dup) return; // 已存在就略過
    const next = [...existing, { ...leg, id: Date.now() }];
    save(STORAGE_KEY_TRANSIT, next);
    setPresets(next);
  }

  function removePreset(id) {
    const next = load(STORAGE_KEY_TRANSIT).filter(p => p.id !== id);
    save(STORAGE_KEY_TRANSIT, next);
    setPresets(next);
  }

  return { presets, addPreset, removePreset };
}

export function useDrivePresets() {
  const [presets, setPresets] = useState(() => load(STORAGE_KEY_DRIVE));

  function addPreset(leg) {
    // leg: { description, origin, destination }
    const existing = load(STORAGE_KEY_DRIVE);
    const dup = existing.find(p =>
      p.origin === leg.origin && p.destination === leg.destination
    );
    if (dup) return;
    const next = [...existing, { ...leg, id: Date.now() }];
    save(STORAGE_KEY_DRIVE, next);
    setPresets(next);
  }

  function removePreset(id) {
    const next = load(STORAGE_KEY_DRIVE).filter(p => p.id !== id);
    save(STORAGE_KEY_DRIVE, next);
    setPresets(next);
  }

  return { presets, addPreset, removePreset };
}
