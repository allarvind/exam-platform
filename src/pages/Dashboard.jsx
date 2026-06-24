import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, ShieldCheck, BookOpen } from "lucide-react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../App";
import { useToast } from "../App";

export default function Dashboard() {
  const { profile, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [attempts, setAttempts] = useState({}); // keyed by part_id
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []); // eslint-disable-line

  async function load() {
    setLoading(true);
    const { data: examData, error } = await supabase
      .from("exams")
      .select("*, exam_parts(*, exam_sections(id, section_number, label, question_count, duration_seconds))")
      .in("status", ["published", "active"])
      .order("created_at");
    if (error) { toast(error.message); setLoading(false); return; }

    const { data: attemptData } = await supabase
      .from("attempts")
      .select("*")
      .eq("user_id", profile.id);

    const attMap = {};
    (attemptData || []).forEach((a) => { attMap[a.part_id] = a; });
    setExams(examData || []);
    setAttempts(attMap);
    setLoading(false);
  }

  async function startOrResume(exam, part) {
    const existing = attempts[part.id];
    if (existing) {
      navigate(`/exam/${exam.id}/part/${part.id}`);
      return;
    }
    // Check prior parts are done
    const priorParts = exam.exam_parts.filter((p) => p.part_number < part.part_number);
    const allPriorDone = priorParts.every((p) => attempts[p.id]?.status === "completed");
    if (!allPriorDone) { toast("Complete previous parts first."); return; }

    const { error } = await supabase.rpc("start_or_get_attempt", {
      p_exam_id: exam.id, p_part_id: part.id, p_test_mode: false,
    });
    if (error) { toast(error.message); return; }
    await load();
    navigate(`/exam/${exam.id}/part/${part.id}`);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Exam Platform</div>
          <div className="h1">Hi, {profile?.name?.split(" ")[0]}</div>
        </div>
        <div className="row">
          {profile?.is_admin && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/admin")}>
              <ShieldCheck size={14} /> Admin
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={logout}>
            <LogOut size={14} /> Log out
          </button>
        </div>
      </div>

      {loading && <p className="hint">Loading exams…</p>}
      {!loading && exams.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <BookOpen size={32} style={{ color: "#B8BCC8", margin: "0 auto 12px" }} />
          <p className="hint">No exams available right now. Check back soon.</p>
        </div>
      )}

      {exams.map((exam) => (
        <div key={exam.id} className="card" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <div>
              <div className="h2">{exam.title}</div>
              {exam.description && <p className="hint" style={{ marginTop: 4 }}>{exam.description}</p>}
            </div>
            <span className={`badge badge-${exam.status}`}>{exam.status}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            {(exam.exam_parts || []).sort((a,b) => a.part_number - b.part_number).map((part) => {
              const attempt = attempts[part.id];
              const status = attempt?.status || "not_started";
              const priorDone = exam.exam_parts
                .filter((p) => p.part_number < part.part_number)
                .every((p) => attempts[p.id]?.status === "completed");
              const locked = !priorDone;
              const sections = part.exam_sections || [];
              const totalQ = sections.reduce((s, sec) => s + sec.question_count, 0);
              const totalMin = sections.reduce((s, sec) => s + Math.round(sec.duration_seconds / 60), 0);

              return (
                <div key={part.id} className="card-sm" style={{ opacity: locked && status === "not_started" ? .6 : 1 }}>
                  <div className="row-between">
                    <div>
                      <div className="h3">{part.label} {part.part_number}</div>
                      <div className="hint-sm" style={{ marginTop: 3 }}>
                        {sections.length} section{sections.length !== 1 ? "s" : ""} ·{" "}
                        {totalQ} question{totalQ !== 1 ? "s" : ""} · {totalMin} min
                      </div>
                      {locked && <div className="hint-sm" style={{ marginTop: 3, color: "#B91C1C" }}>Complete previous part first</div>}
                    </div>
                    <div className="row">
                      <span className={`badge badge-${locked && status === "not_started" ? "locked" : status}`}>
                        {locked && status === "not_started" ? "Locked" : status.replace("_", " ")}
                      </span>
                      {!locked && status === "not_started" && (
                        <button className="btn btn-primary btn-sm" onClick={() => startOrResume(exam, part)}>Start</button>
                      )}
                      {status === "in_progress" && (
                        <button className="btn btn-primary btn-sm" onClick={() => navigate(`/exam/${exam.id}/part/${part.id}`)}>Resume</button>
                      )}
                      {status === "completed" && (
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/result/${exam.id}`)}>View result</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
