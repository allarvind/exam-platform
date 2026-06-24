import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, BarChart2, Trash2 } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../App";

export default function AdminExams() {
  const toast = useToast();
  const navigate = useNavigate();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("exams")
      .select("*, exam_parts(id, part_number, exam_sections(question_count))")
      .order("created_at", { ascending: false });
    if (error) toast(error.message);
    setExams(data || []);
    setLoading(false);
  }

  async function setStatus(examId, status) {
    const { error } = await supabase.from("exams").update({ status }).eq("id", examId);
    if (error) { toast(error.message); return; }
    await load();
  }

  async function deleteExam(examId) {
    if (!confirm("Delete this exam and all its data?")) return;
    const { error } = await supabase.from("exams").delete().eq("id", examId);
    if (error) { toast(error.message); return; }
    await load();
  }

  const statusFlow = { draft: ["published"], published: ["active", "draft"], active: ["closed"], closed: [] };

  return (
    <div className="page-wide">
      <div className="page-header">
        <div>
          <div className="eyebrow">Admin</div>
          <div className="h1">Exams</div>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/admin/exams/new")}>
          <Plus size={15} /> New exam
        </button>
      </div>

      {loading && <p className="hint">Loading…</p>}
      {!loading && exams.length === 0 && <p className="hint">No exams yet — create one to get started.</p>}

      {exams.map((exam) => {
        const totalQ = (exam.exam_parts || []).flatMap((p) => p.exam_sections || []).reduce((s, sec) => s + sec.question_count, 0);
        const parts = exam.exam_parts?.length || 0;
        return (
          <div key={exam.id} className="card" style={{ marginBottom: 12 }}>
            <div className="row-between">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ marginBottom: 4 }}>
                  <div className="h3">{exam.title}</div>
                  <span className={`badge badge-${exam.status}`}>{exam.status}</span>
                </div>
                {exam.description && <p className="hint-sm" style={{ marginBottom: 4 }}>{exam.description}</p>}
                <p className="hint-sm">{parts} part{parts !== 1 ? "s" : ""} · {totalQ} total questions</p>
              </div>
              <div className="row" style={{ flexShrink: 0 }}>
                {(statusFlow[exam.status] || []).map((s) => (
                  <button key={s} className="btn btn-secondary btn-sm" onClick={() => setStatus(exam.id, s)}>
                    → {s}
                  </button>
                ))}
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/results/${exam.id}`)}>
                  <BarChart2 size={14} /> Results
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/exams/${exam.id}`)}>
                  <Edit2 size={14} /> Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteExam(exam.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
