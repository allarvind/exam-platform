import { useState, useEffect, useRef } from "react";
import { Clock, Flag, ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase } from "../../supabaseClient";

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function ExamScreen({ attempt, questions, responses, part, examTitle,
  onAnswer, onClear, onToggleFlag, onBack }) {
  const sIdx      = attempt.current_section_idx;
  const section   = attempt.sections[sIdx];
  const [qId, setQId]         = useState(questions[0]?.id);
  const [now, setNow]         = useState(Date.now());
  const [imgUrl, setImgUrl]   = useState(null);
  const [optImgs, setOptImgs] = useState([]);
  const [zoomed, setZoomed]   = useState(false);
  const prevSIdx = useRef(sIdx);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (prevSIdx.current !== sIdx) {
      setQId(questions[0]?.id);
      prevSIdx.current = sIdx;
    }
  }, [sIdx, questions]);

  const q         = questions.find((x) => x.id === qId) || questions[0];
  const idx       = questions.findIndex((x) => x.id === q?.id);
  const selected  = responses[q?.id]?.selected;
  const flagged   = !!responses[q?.id]?.flagged;
  const endAtMs   = section?.end_at ? new Date(section.end_at).getTime() : 0;
  const remaining = endAtMs - now;
  const totalPart = Object.keys(responses).length;
  const totalQ    = attempt.sections.reduce((s, sec) => s + (sec.question_count || 0), 0);
  const answeredN = Object.values(responses).filter((r) => r?.selected != null).length;
  const low       = remaining < (section?.duration_seconds || 3000) * 1000 * 0.2;

  // Fetch signed URLs per question — expire in 120s, no bookmarkable links
  useEffect(() => {
    setImgUrl(null); setOptImgs([]); setZoomed(false);
    if (!q) return;
    if (q.image_path) {
      supabase.storage.from("question-images").createSignedUrl(q.image_path, 120)
        .then(({ data }) => setImgUrl(data?.signedUrl || null));
    }
    if (q.option_image_paths?.some(Boolean)) {
      Promise.all(
        q.option_image_paths.map((p) =>
          p ? supabase.storage.from("question-images").createSignedUrl(p, 120)
                .then(({ data }) => data?.signedUrl || null)
            : Promise.resolve(null)
        )
      ).then(setOptImgs);
    }
  }, [q?.id]); // eslint-disable-line

  if (!q) return <div className="exam-wrap"><p className="hint">Loading questions…</p></div>;

  return (
    <div className="exam-wrap">
      {zoomed && imgUrl && (
        <div className="zoom-overlay" onClick={() => setZoomed(false)}>
          <img src={imgUrl} alt="Question" />
        </div>
      )}

      <div className="exam-top">
        <div>
          <div className="eyebrow">{examTitle} — {part.label}</div>
          <h2 className="h2">Section {section?.label}</h2>
        </div>
        <div className={`timer mono ${low ? "timer-low" : ""}`}>
          <Clock size={16} />
          {formatTime(remaining)}
        </div>
      </div>

      <div className="exam-body">
        {/* Question card */}
        <div className="q-card">
          <div className="q-meta">
            <span>Q {idx + 1} of {questions.length} · Section {section?.label}</span>
            <span>QID {q.seq_in_section} · {q.marks} mark</span>
          </div>

          {imgUrl && (
            <img src={imgUrl} className="q-image" alt="Question" onClick={() => setZoomed(true)} title="Click to zoom" />
          )}

          <p className="q-text">{q.question_text}</p>

          <div className="options">
            {q.options.map((opt, i) => (
              <label key={i} className={`option ${selected === i ? "option-selected" : ""}`}>
                <input type="radio" name={`q-${q.id}`} checked={selected === i}
                  onChange={() => onAnswer(q.id, i)} style={{ display: "none" }} />
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span style={{ flex: 1 }}>
                  {opt}
                  {optImgs[i] && <img src={optImgs[i]} className="opt-img" alt={`Option ${String.fromCharCode(65+i)}`} />}
                </span>
              </label>
            ))}
          </div>

          <div className="q-actions">
            <button className="btn-ghost btn-sm" onClick={() => onClear(q.id)}>Clear</button>
            <button className={`btn-ghost btn-sm ${flagged ? "flag-active" : ""}`}
              onClick={() => onToggleFlag(q.id)}>
              <Flag size={13} /> {flagged ? "Flagged" : "Flag"}
            </button>
            <div className="spacer" />
            <button className="btn-secondary btn-sm" disabled={idx === 0}
              onClick={() => setQId(questions[idx - 1].id)}>
              <ChevronLeft size={13} /> Prev
            </button>
            <button className="btn btn-sm" disabled={idx === questions.length - 1}
              onClick={() => setQId(questions[idx + 1].id)}>
              Next <ChevronRight size={13} />
            </button>
          </div>
        </div>

        {/* Sidebar — active section only */}
        <div className="sidebar">
          <div className="hint-sm" style={{ marginBottom: 10 }}>
            Answered <strong>{answeredN}</strong> / {totalQ} total
          </div>
          <div style={{ marginBottom: 8 }}>
            <span className="badge-tag badge-section">Section {section?.label} · active</span>
          </div>
          <div className="q-grid">
            {questions.map((gq, i) => {
              const isAns = responses[gq.id]?.selected != null;
              const isCur = gq.id === q.id;
              const isFlg = !!responses[gq.id]?.flagged;
              return (
                <button key={gq.id} onClick={() => setQId(gq.id)}
                  className={["qnum",
                    isCur ? "qnum-cur" : "",
                    isAns && !isCur ? "qnum-ans" : "",
                    isFlg && !isCur ? "qnum-flag" : "",
                  ].join(" ")}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="exam-footer">
        <button className="btn-ghost btn-sm" onClick={onBack}>
          ← Back to dashboard (progress saved)
        </button>
        <span className="hint-sm">Every action validated against the database clock</span>
      </div>
    </div>
  );
}
