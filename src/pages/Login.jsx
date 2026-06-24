import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, COUNTRIES, flagEmoji } from "../supabaseClient";
import { useAuth } from "../App";

// ---- Reusable UI components shared across pages ----

export function CountryCodeSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  const sel = COUNTRIES.find((c) => c.dial === value) || COUNTRIES[0];

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.dial.includes(q));
  return (
    <div className="combobox" ref={ref}>
      <button type="button" className="cc-trigger" onClick={() => setOpen((o) => !o)}>
        {flagEmoji(sel.iso2)} {sel.dial} ▾
      </button>
      {open && (
        <div className="combobox-panel cc-panel">
          <input className="input" autoFocus placeholder="Search country" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="cc-list">
            {filtered.map((c) => (
              <div key={c.iso2} className="combobox-opt"
                onMouseDown={() => { onChange(c.dial); setOpen(false); setQ(""); }}>
                {flagEmoji(c.iso2)} {c.name} <span className="hint">{c.dial}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function SearchableSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const filtered = (options || []).filter((o) => o.toLowerCase().includes((value || "").toLowerCase())).slice(0, 50);
  return (
    <div className="combobox" ref={ref}>
      <input className="input" value={value} placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && (
        <div className="combobox-panel">
          {filtered.length ? filtered.map((o) => (
            <div key={o} className="combobox-opt" onMouseDown={() => { onChange(o); setOpen(false); }}>{o}</div>
          )) : <div className="combobox-opt combobox-empty">No match — what you typed will be saved</div>}
        </div>
      )}
    </div>
  );
}

// ---- Login page ----
export default function Login() {
  const { session, profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email | otp | profile
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [err, setErr] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session && profile) navigate("/dashboard", { replace: true });
    if (session && !profile) setStep("profile");
  }, [session, profile, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function sendOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email address."); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setErr(""); setOtp(""); setCooldown(30); setStep("otp");
  }

  async function verifyOtp() {
    if (otp.length < 6) { setErr("Enter the 6-digit code."); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    // session change triggers the useEffect above → routes to profile or dashboard
  }

  if (step === "profile") return <ProfileSetup />;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">Exam Platform</div>
        {step === "email" ? (
          <>
            <div className="h1" style={{ marginBottom: 6 }}>Sign in</div>
            <p className="hint" style={{ marginBottom: 16 }}>Enter your email — we'll send a one-time code.</p>
            <label className="label">Email address</label>
            <input className="input" type="email" placeholder="you@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendOtp()} />
            {err && <div className="error-msg">{err}</div>}
            <button className="btn btn-primary btn-block" onClick={sendOtp} disabled={busy}>
              {busy ? "Sending…" : "Send code"}
            </button>
          </>
        ) : (
          <>
            <div className="h1" style={{ marginBottom: 6 }}>Enter the code</div>
            <p className="hint" style={{ marginBottom: 16 }}>Sent to {email} — check your inbox.</p>
            <input className="input input-otp" inputMode="numeric" maxLength={6} placeholder="••••••"
              value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verifyOtp()} />
            {err && <div className="error-msg">{err}</div>}
            <button className="btn btn-primary btn-block" onClick={verifyOtp} disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </button>
            <div className="row-between" style={{ marginTop: 14 }}>
              <button className="link" onClick={() => { setStep("email"); setErr(""); }}>Different email</button>
              <button className="link" disabled={cooldown > 0} onClick={sendOtp}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- One-time profile capture ----
const COLLEGES = [
  "Davao Medical School Foundation, Philippines",
  "University of Perpetual Help System DALTA, Philippines",
  "Crimea Federal University, Russia",
  "Kursk State Medical University, Russia",
  "Tbilisi State Medical University, Georgia",
  "Astana Medical University, Kazakhstan",
  "China Medical University, China",
  "Dhaka Medical College, Bangladesh",
  "Tribhuvan University, Nepal",
  "Yerevan State Medical University, Armenia",
  // Replace with real NMC college list
];

function ProfileSetup() {
  const { session, setProfile } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ name:"", dial:"+91", phone:"", college:"", year:"", attempt:"1", state:"" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const yr = new Date().getFullYear();
  const years = Array.from({ length: 35 }, (_, i) => yr + 1 - i);
  const valid = f.name && f.phone && f.college && f.year && f.state;

  async function save() {
    setBusy(true);
    const { data, error } = await supabase.from("profiles").insert({
      id: session.user.id, email: session.user.email,
      name: f.name, country_dial: f.dial, phone: f.phone, college: f.college,
      graduation_year: Number(f.year), attempt_number: Number(f.attempt), state: f.state,
    }).select().single();
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setProfile(data);
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card auth-card-wide">
        <div className="eyebrow">One-time setup</div>
        <div className="h1" style={{ marginBottom: 6 }}>Complete your profile</div>
        <p className="hint" style={{ marginBottom: 18 }}>Asked once — saved against your login permanently.</p>

        <div className="field">
          <label className="label">Full name</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="field">
          <label className="label">Phone number</label>
          <div className="phone-row">
            <CountryCodeSelect value={f.dial} onChange={(v) => setF({ ...f, dial: v })} />
            <input className="input" inputMode="numeric" placeholder="98765 43210"
              value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>
        <div className="field">
          <label className="label">College / university</label>
          <SearchableSelect value={f.college} onChange={(v) => setF({ ...f, college: v })} options={COLLEGES} placeholder="Start typing…" />
        </div>
        <div className="field">
          <label className="label">Year of graduation</label>
          <select className="input" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })}>
            <option value="">Select year</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">FMGE attempt number</label>
          <select className="input" value={f.attempt} onChange={(e) => setF({ ...f, attempt: e.target.value })}>
            {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}{n===1?" (first attempt)":""}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="label">State</label>
          <input className="input" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />
        </div>
        {err && <div className="error-msg">{err}</div>}
        <button className="btn btn-primary btn-block" disabled={!valid || busy} onClick={save}>
          {busy ? "Saving…" : "Continue to dashboard"}
        </button>
      </div>
    </div>
  );
}
