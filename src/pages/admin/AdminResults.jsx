import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../App";

export default function AdminResults() {
  const { examId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [examId]); // eslint-disable-line

  async function load() {
    setLoading(true);
    const [{ data: examData }, { data: scoreData, error }] = await Promise.all([
      supabase.from("exams").select("title, exam_parts(part_number, label)").eq("id", examId).single(),
      supabase.rpc("get_admin_scorecard", { p_exam_id: examId }),
    ]);
    if (error) toast(error.message);
    setExam(examData);
    setRows(scoreData || []);
    setLoading(false);
  }

  function exportCsv() {
    const cols = ["Name", "Email", "College", "State", "Attempt #", "Parts done", "Parts total", "Total correct", "Total marks", "Complete"];
    const csvRows = [cols.join(","),
      ...rows.map((r) => [
        `"${r.name}"`, `"${r.email}"`, `"${r.college}"`, `"${r.state}"`,
        r.attempt_number,
        r.parts_done, r.parts_total,
        r.total_correct ?? "", r.total_marks ?? "",
        r.all_done ? "Yes" : "No",
      ].join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `results-${examId.slice(0,8)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const complete = rows.filter((r) => r.all_done).length;
  const inProgress = rows.filter((r) => !r.all_done && r.parts_done > 0).length;
  const notStarted = rows.filter((r) => r.parts_done === 0).length;

  return (
    <div className="page-wide">
      <div className="page-header">
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/admin/exams")}><ArrowLeft size={14} /></button>
          <div>
            <div className="eyebrow">Results</div>
            <div className="h1">{exam?.title || "Exam"}</div>
          </div>
        </div>
        <div className="row">
          <div className="hint-sm">{rows.length} candidates · {complete} complete · {inProgress} in progress</div>
          <button className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {loading && <p className="hint">Loading…</p>}
      {!loading && rows.length === 0 && <p className="hint">No candidates have started this exam yet.</p>}

      {rows.length > 0 && (
        <div className="table-wrap">
          <div className="table-row table-head" style={{ gridTemplateColumns: "1.4fr 1.6fr 1.4fr 0.8fr 0.7fr 0.7fr 0.7fr" }}>
            <span>Name</span><span>Email</span><span>College</span><span>State</span>
            <span>Parts</span><span>Score</span><span>Status</span>
          </div>
          {rows.map((r) => (
            <div key={r.user_id} className="table-row" style={{ gridTemplateColumns: "1.4fr 1.6fr 1.4fr 0.8fr 0.7fr 0.7fr 0.7fr" }}>
              <div>
                <div style={{ fontSize: 13 }}>{r.name}</div>
                <div className="hint-sm">Attempt #{r.attempt_number}</div>
              </div>
              <span style={{ fontSize: 12 }}>{r.email}</span>
              <span style={{ fontSize: 12 }}>{r.college}</span>
              <span style={{ fontSize: 12 }}>{r.state}</span>
              <span style={{ fontSize: 13 }}>{r.parts_done}/{r.parts_total}</span>
              <span style={{ fontWeight: 700, fontSize: 13 }}>
                {r.all_done ? `${r.total_correct}/${r.total_marks}` : "—"}
              </span>
              <span className={`badge badge-${r.all_done ? "completed" : r.parts_done > 0 ? "in_progress" : "not_started"}`}>
                {r.all_done ? "Complete" : r.parts_done > 0 ? "In progress" : "Not started"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
