import { useState, useEffect, useRef } from "react";
import { COUNTRIES, COLLEGES, flagEmoji } from "../../data/constants";

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function SearchableSelect({ value, onChange, options = COLLEGES, placeholder = "Type to search…" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = options
    .filter((o) => o.toLowerCase().includes((value || "").toLowerCase()))
    .slice(0, 60);

  return (
    <div className="combobox" ref={ref}>
      <input
        className="input"
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="combobox-panel">
          {filtered.map((opt) => (
            <div key={opt} className="combobox-option"
              onMouseDown={() => { onChange(opt); setOpen(false); }}>
              {opt}
            </div>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && (
        <div className="combobox-panel">
          <div className="combobox-option combobox-empty">
            No match — what you typed will be saved as entered
          </div>
        </div>
      )}
    </div>
  );
}

export function CountryCodeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef(null);
  const selected = COUNTRIES.find((c) => c.dial === value) || COUNTRIES[0];

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const filtered = COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.dial.includes(query)
  ).slice(0, 60);

  return (
    <div className="combobox" ref={ref} style={{ position: "relative" }}>
      <button type="button" className="cc-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{flagEmoji(selected.iso2)}</span>
        <span>{selected.dial}</span>
        <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div className="combobox-panel cc-panel">
          <input
            className="input"
            autoFocus
            placeholder="Search country…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cc-list">
            {filtered.map((c) => (
              <div key={c.iso2} className="combobox-option"
                onMouseDown={() => { onChange(c.dial); setOpen(false); setQuery(""); }}>
                {flagEmoji(c.iso2)} {c.name}{" "}
                <span className="muted" style={{ fontSize: 12 }}>{c.dial}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
