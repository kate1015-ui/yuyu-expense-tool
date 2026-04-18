import { useEffect, useRef } from "react";

/**
 * 地址輸入框，若 Google Maps Places API 已載入則啟用自動完成。
 * 未載入時退化為普通 input，使用者仍可手動輸入。
 */
export default function PlacesInput({ value, onChange, placeholder, className = "field" }) {
  const inputRef = useRef(null);
  const acRef    = useRef(null);

  useEffect(() => {
    if (!window.google?.maps?.places || !inputRef.current || acRef.current) return;

    acRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "tw" },
      fields: ["name", "formatted_address"],
      types: ["geocode", "establishment"],
    });

    acRef.current.addListener("place_changed", () => {
      const place = acRef.current.getPlace();
      const val = place.name || place.formatted_address || inputRef.current.value;
      onChange(val);
    });

    return () => {
      if (acRef.current) {
        window.google.maps.event.clearInstanceListeners(acRef.current);
        acRef.current = null;
      }
    };
  }); // re-run every render until Maps loads (no-op if already attached)

  return (
    <input
      ref={inputRef}
      className={className}
      defaultValue={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
