import { useState } from "react";
import { Field, SearchableSelect, CountryCodeSelect } from "../shared/FormComponents";

export function LoginScreen({ onSend, email, setEmail }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">Exam Platform</div>
        <h1 className="h1">Sign in</h1>
        <p className="hint" style={{ marginBottom: 16 }}>
          Enter your email — we'll send a one-time code.
        </p>
        <input
          className="input"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSend()}
          style={{ marginBottom: 10 }}
        />
        <button className="btn btn-block" onClick={onSend}>Send code</button>
      </div>
    </div>
  );
}

export function OtpScreen({ email, code, otpInput, setOtpInput, error, onVerify, onResend, cooldown, onBack }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">Verify</div>
        <h1 className="h1">Enter the code</h1>
        <p className="hint" style={{ marginBottom: 12 }}>Sent to {email}</p>
        {code && (
          <div className="info-box">
            Demo — no real email sent. Your code: <strong className="mono">{code}</strong>
          </div>
        )}
        <input
          className="input input-otp"
          inputMode="numeric"
          maxLength={6}
          placeholder="••••••"
          value={otpInput}
          onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && onVerify()}
          style={{ margin: "10px 0" }}
        />
        {error && <div className="error-box">{error}</div>}
        <button className="btn btn-block" onClick={onVerify}>Verify</button>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
          <button className="link" onClick={onBack}>Different email</button>
          <button className="link" disabled={cooldown > 0} onClick={onResend}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProfileScreen({ onSave }) {
  const [name, setName]               = useState("");
  const [countryDial, setCountryDial] = useState("+91");
  const [phone, setPhone]             = useState("");
  const [college, setCollege]         = useState("");
  const [graduationYear, setGradYear] = useState("");
  const [attemptNumber, setAttempt]   = useState("1");
  const [state, setState]             = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 35 }, (_, i) => currentYear + 1 - i);
  const valid  = name.trim() && phone.trim() && college.trim() && graduationYear && state.trim();

  return (
    <div className="auth-wrap">
      <div className="auth-card auth-card-wide">
        <div className="eyebrow">One-time setup</div>
        <h1 className="h1">Complete your profile</h1>
        <p className="hint" style={{ marginBottom: 16 }}>
          Saved against your login — not asked again.
        </p>

        <Field label="Full name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Phone number">
          <div className="phone-row">
            <CountryCodeSelect value={countryDial} onChange={setCountryDial} />
            <input className="input" inputMode="numeric" placeholder="98765 43210"
              value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
          </div>
        </Field>

        <Field label="College / university">
          <SearchableSelect value={college} onChange={setCollege} placeholder="Start typing your college…" />
        </Field>

        <div className="form-row">
          <Field label="Year of graduation">
            <select className="input" value={graduationYear} onChange={(e) => setGradYear(e.target.value)}>
              <option value="">Select year</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </Field>

          <Field label="FMGE attempt number">
            <select className="input" value={attemptNumber} onChange={(e) => setAttempt(e.target.value)}>
              {[1,2,3,4,5].map((n) => (
                <option key={n} value={n}>{n}{n === 1 ? " (first)" : ""}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="State">
          <input className="input" value={state} onChange={(e) => setState(e.target.value)} />
        </Field>

        <button
          className="btn btn-block"
          disabled={!valid}
          onClick={() => onSave({ name, countryDial, phone, college, graduationYear, attemptNumber, state })}
        >
          Continue to dashboard
        </button>
      </div>
    </div>
  );
}
