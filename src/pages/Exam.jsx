import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Clock, Flag, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { supabase, formatTime } from "../supabaseClient";
import { useAuth } from "../App";
import { useToast } from "../App";

export default function Exam() {
  const { examId, partId } = useParams();
  const { profile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [responses, setResponses] = useState({}); // {qId: {selected, flagged}}
  const [qId, setQId] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [imageUrls, setImageUrls] = useState({}); // {path: signedUrl}
  const [zoomed, setZoomed] = useState(null); // url to zoom
  const [loading, setLoading] = useState(true);
  const prevSectionKey = useRef(null);

  // Boot: start or resume attempt
  useEffect(() => { boot(); }, []); // eslint-disable-line

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Reconcile against server every 4 seconds
  useEffect(() => {
    if (!attempt) return;
    const id = setInterval(() => refresh(), 4000);
    return () => clearInterval(id);
  }, [attempt]); // eslint-disable-line

  // If attempt completes, go to result
  useEffect(() => {
    if (attempt?.status === "completed") navigate(`/result/${examId}`, { replace: true });
  }, [attempt?.status]); // eslint-disable-line

  // Reload questions when section changes
  useEffect(() => {
    if (!attempt) return;
    const key = `${attempt.current_section_idx}`;
    if (prevSectionKey.current === key) return;
    prevSectionKey.current = key;
    loadQuestions();
  }, [attempt?.current_section_idx]); // eslint-disable-line

  async function boot() {
    setLoading(true);
    // Reconcile any existing attempt
    const { data: existing } = await supabase
      .from("attempts")
      .select("*")
      .eq("user_id", profile.id)
      .eq("part_id", partId)
      .maybeSingle();

    if (existing) {
      const { data: rec } = await supabase.rpc("reconcile_attempt", { p_attempt_id: existing.id });
      setAttempt(rec || existing);
    } else {
      toast("No active attempt found — return to dashboard.");
      navigate("/dashboard");
      return;
    }
    await loadResponses(existing.id);
    setLoading(false);
  }

  async function refresh() {
    if (!attempt) return;
    const { data } = await supabase.rpc("reconcile_attempt", { p_attempt_id: attempt.id });
    if (data) setAttempt(data);
  }

  async function loadQuestions() {
    const { data, error } = await supabase
      .from("questions_active")
      .select("*")
      .order("sequence_number");
    if (error) { toast(error.message); return; }
    const qs = data || [];
    setQuestions(qs);
    if (qs.length > 0) setQId(qs[0].id);
    // Fetch signed URLs for any images
    const paths = [...new Set([
      ...qs.filter((q) => q.image_path).map((q) => q.image_path),
      ...qs.flatMap((q) => (q.option_image_paths || []).filter(Boolean)),
    ])];
    if (paths.length === 0) return;
    const urls = {};
    await Promise.all(paths.map(async (p) => {
      const { data: d } = await supabase.storage.from("question-images").createSignedUrl(p, 120);
      if (d?.signedUrl) urls[p] = d.signedUrl;
    }));
    setImageUrls(urls);
  }

  async function loadResponses(attemptId) {
    const { data } = await supabase.from("responses").select("*").eq("attempt_id", attemptId);
    const map = {};
    (data || []).forEach((r) => { map[r.question_id] = { selected: r.selected_option, flagged: r.flagged }; });
    setResponses(map);
  }

  async function answer(qId, opt) {
    setResponses((prev) => ({ ...prev, [qId]: { ...prev[qId], selected: opt } }));
    const { error } = await supabase.rpc("submit_answer", {
      p_attempt_id: attempt.id, p_question_id: qId, p_option: opt,
    });
    if (error) {
      toast(error.message);
      await refresh();
    }
  }

  async function clearAnswer(qId) {
    setResponses((prev) => ({ ...prev, [qId]: { ...prev[qId], selected: null } }));
    await supabase.rpc("clear_answer", { p_attempt_id: attempt.id, p_question_id: qId });
  }

  async function toggleFlag(qId) {
    const cur = !!responses[qId]?.flagged;
    setResponses((prev) => ({ ...prev, [qId]: { ...prev[qId], flagged: !cur } }));
    await supabase.rpc("toggle_flag", { p_attempt_id: attempt.id, p_question_id: qId });
  }

  if (loading || !attempt) {
    return <div className="auth-wrap"><div className="hint">Loading exam…</div></div>;
  }

  const sectionState = attempt.section_states[attempt.current_section_idx];
  const endMs = sectionState?.end_at ? new Date(sectionState.end_at).getTime() : 0;
  const remaining = endMs - now;
  const low = remaining < 3 * 60 * 1000; // last 3 minutes

  const q = questions.find((x) => x.id === qId) || questions[0];
  const idxInSection = questions.findIndex((x) => x.id === q?.id);
  const answeredTotal = Object.values(responses).filter((r) => r.selected != null).length;

  if (!q) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="h2">No questions loaded</div>
          <p className="hint" style={{ margin: "12px 0" }}>This section has no questions assigned yet.</p>
          <button className="btn btn-secondary btn-block" onClick={() => navigate("/dashboard")}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-shell">
      {zoomed && (
        <div className="zoom-overlay" onClick={() => setZoomed(null)}>
          <img src={zoomed} className="zoom-img" alt="zoomed" />
        </div>
      )}

      <div className="exam-topbar">
        <div>
          <div className="eyebrow">Section {sectionState?.section_label || (attempt.current_section_idx + 1)} of {attempt.section_states.length}</div>
          <div className="h2" style={{ marginTop: 2 }}>{q ? `Question ${idxInSection + 1} of ${questions.length}` : "—"}</div>
        </div>
        <div className={`timer ${low ? "timer-low" : ""}`}>
          <Clock size={15} />
          <span className="mono">{formatTime(remaining)}</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>
          <LogOut size={14} /> Dashboard
        </button>
      </div>

      <div className="exam-body">
        {/* Question card */}
        <div className="question-card">
          <div className="qmeta">
            <span>QID {String(q.id).slice(0, 8)}</span>
            <span>1 mark · {q.subject || "General"}</span>
          </div>

          {q.image_path && imageUrls[q.image_path] && (
            <img src={imageUrls[q.image_path]} className="qimage" alt="question"
              onClick={() => setZoomed(imageUrls[q.image_path])} />
          )}

          <p className="qtext">{q.question_text}</p>

          <div className="options">
            {(q.options || []).map((opt, i) => (
              <label key={i} className={`option ${responses[q.id]?.selected === i ? "option-selected" : ""}`}>
                <input type="radio" name={`q-${q.id}`} style={{ display: "none" }}
                  checked={responses[q.id]?.selected === i}
                  onChange={() => answer(q.id, i)} />
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <div style={{ flex: 1 }}>
                  <div>{opt}</div>
                  {q.option_image_paths?.[i] && imageUrls[q.option_image_paths[i]] && (
                    <img src={imageUrls[q.option_image_paths[i]]} className="option-img" alt={`option ${String.fromCharCode(65+i)}`}
                      onClick={() => setZoomed(imageUrls[q.option_image_paths[i]])} />
                  )}
                </div>
              </label>
            ))}
          </div>

          <div className="qactions">
            <button className="btn btn-ghost btn-sm" onClick={() => clearAnswer(q.id)}>Clear</button>
            <button className={`btn btn-ghost btn-sm ${responses[q.id]?.flagged ? "flag-active" : ""}`}
              onClick={() => toggleFlag(q.id)}>
              <Flag size={13} /> {responses[q.id]?.flagged ? "Flagged" : "Flag"}
            </button>
            <div className="spacer" />
            <button className="btn btn-secondary btn-sm" disabled={idxInSection === 0}
              onClick={() => setQId(questions[idxInSection - 1].id)}>
              <ChevronLeft size={13} /> Prev
            </button>
            <button className="btn btn-primary btn-sm" disabled={idxInSection === questions.length - 1}
              onClick={() => setQId(questions[idxInSection + 1].id)}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="sidebar">
          <div className="answered-count">
            Answered <strong>{answeredTotal}</strong> · Flagged{" "}
            <strong>{Object.values(responses).filter((r) => r.flagged).length}</strong>
          </div>
          <div className="grid-label">This section</div>
          <div className="grid-nums">
            {questions.map((gq, i) => (
              <button key={gq.id} onClick={() => setQId(gq.id)}
                className={[
                  "num-btn",
                  gq.id === q.id ? "current" : "",
                  responses[gq.id]?.selected != null ? "answered" : "",
                  responses[gq.id]?.flagged ? "flagged" : "",
                ].join(" ")}>
                {i + 1}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: "12px", background: "#F7F8FA", borderRadius: 8 }}>
            <div className="hint-sm" style={{ marginBottom: 6 }}>Section timer</div>
            <div className={`timer ${low ? "timer-low" : ""}`} style={{ display: "inline-flex" }}>
              <Clock size={13} />
              <span className="mono" style={{ fontSize: 14 }}>{formatTime(remaining)}</span>
            </div>
            <div className="hint-sm" style={{ marginTop: 8 }}>
              The next section starts automatically when the timer reaches 00:00.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
