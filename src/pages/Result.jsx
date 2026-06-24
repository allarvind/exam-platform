import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { useToast } from "../App";

export default function Result() {
  const { examId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [exam, setExam] = useState(null);

  useEffect(() => {
    load();
  }, [examId]); // eslint-disable-line

  async function load() {
    const [{ data: scorecard }, { data: examData }] = await Promise.all([
      supabase.rpc("get_my_scorecard", { p_exam_id: examId }),
      supabase.from("exams").select("title").eq("id", examId).single(),
    ]);
    setData(Array.isArray(scorecard) ? scorecard[0] : scorecard);
    setExam(examData);
  }

  if (!data) return <div className="auth-wrap"><div className="hint">Loading…</div></div>;

  const parts = data.parts || [];
  const allDone = data.all_done;

  return (
    <div className="auth-wrap" style={{ alignItems: "flex-start" }}>
      <div className="auth-card auth-card-wide">
        <div className="eyebrow">{exam?.title || "Exam"}</div>

        {allDone ? (
          <>
            <div className="h1" style={{ marginBottom: 6 }}>Final score</div>
            <div className="score-big">
              {data.total_correct}<span> / {data.total_marks}</span>
            </div>
            <p className="hint-sm" style={{ marginBottom: 20 }}>
              Combined across all {parts.length} part{parts.length !== 1 ? "s" : ""}.
              Section-wise timing is stored for analytics but not displayed, by design.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {parts.map((p) => (
                <div key={p.part_id} className="card-sm row-between">
                  <span className="h3">{p.label} {p.part_number}</span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{p.correct} / {p.total}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="h1" style={{ marginBottom: 6 }}>Responses saved</div>
            <p className="hint" style={{ marginBottom: 20 }}>
              {data.parts_done} of {data.parts_total} part{data.parts_total !== 1 ? "s" : ""} completed.
              Your score will show once all parts are submitted.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {parts.map((p) => (
                <div key={p.part_id} className="card-sm row-between">
                  <span className="h3">{p.label} {p.part_number}</span>
                  <span className={`badge badge-${p.status}`}>{p.status.replace("_", " ")}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <button className="btn btn-primary btn-block" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
