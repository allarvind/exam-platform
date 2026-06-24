import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { supabase } from "../../supabaseClient";
import Papa from "papaparse";

export default function ResultsViewer({ exam, onBack }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase.rpc("get_admin_scorecard", { p_exam_id: exam.id });
      if (err) { setError(err.message); setLoading(false); return; }
      setRows(data || []);
      setLoading(false);
    })();
  }, [exam.id]);

  function exportCSV() {
    if (!rows.length) return;
    // Pivot rows so each candidate has one row with all parts
    const byUser = {};
    rows.forEach((r) => {
      if (!byUser[r.user_id]) {
        byUser[r.user_id] = { name: r.name, email: r.email, college: r.college, phone: r.phone, parts: {} };
      }
      byUser[r.user_id].parts[r.part_label] = {
        status: r.status,
        correct: r.correct,
        total: r.total,
      };
    });
    const partLabels = [...new Set(rows.map((r) => r.part_label))].sort();
    const out = Object.values(byUser).map((u) => {
      const base = { Name: u.name, Email: u.email, College: u.college, Phone: u.phone };
      partLabels.forEach((pl) => {
        const p = u.parts[pl] || {};
        base[`${pl} status`]  = p.status  || "not_started";
        base[`${pl} correct`] = p.correct ?? "";
        base[`${pl} total`]   = p.total   ?? "";
      });
      const allDone = partLabels.every((pl) => (u.parts[pl] || {}).status === "completed");
      if (allDone) {
        base["Total correct"] = partLabels.reduce((s, pl) => s + ((u.parts[pl] || {}).correct || 0), 0);
        base["Total marks"]   = partLabels.reduce((s, pl) => s + ((u.parts[pl] || {}).total   || 0), 0);
      } else {
        base["Total correct"] = "";
        base["Total marks"]   = "";
      }
      return base;
    });
    const csv = Papa.unparse(out);
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `${exam.title.replace(/\s+/g, "_")}_results.csv`;
    a.click();
  }

  // Derive unique parts from rows
  const partLabels = [...new Set(rows.map((r) => r.part_label))].sort();

  // Pivot per-user
  const byUser = {};
  rows.forEach((r) => {
    if (!byUser[r.user_id]) byUser[r.user_id] = { ...r, parts: {} };
    byUser[r.user_id].parts[r.part_label] = { status: r.status, correct: r.correct, total: r.total };
  });
  const userRows = Object.values(byUser);

  return (
    <div className="page-wide">
      <div className="page-header">
        <div>
          <div className="eyebrow">Admin · {exam.title}</div>
          <h1 className="h1">Results</h1>
          <p className="hint">{userRows.length} candidates registered</p>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={onBack}>← Back</button>
          <button className="btn-secondary" onClick={exportCSV} disabled={!rows.length}>
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>

      {error   && <div className="error-box">{error}</div>}
      {loading && <p className="hint">Loading…</p>}

      {!loading && userRows.length === 0 && (
        <p className="hint">No candidates have started this exam yet.</p>
      )}

      {!loading && userRows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>College</th>
                {partLabels.map((pl) => (
                  <th key={pl}>{pl}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {userRows.map((u) => {
                const allDone = partLabels.every((pl) => (u.parts[pl] || {}).status === "completed");
                const totalC  = allDone ? partLabels.reduce((s, pl) => s + ((u.parts[pl] || {}).correct || 0), 0) : null;
                const totalM  = allDone ? partLabels.reduce((s, pl) => s + ((u.parts[pl] || {}).total   || 0), 0) : null;
                return (
                  <tr key={u.user_id}>
                    <td style={{ fontWeight: 500 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.college}</td>
                    {partLabels.map((pl) => {
                      const p = u.parts[pl] || {};
                      return (
                        <td key={pl}>
                          {p.status === "completed" && p.correct != null
                            ? `${p.correct} / ${p.total}`
                            : <span className={`badge badge-${p.status === "in_progress" ? "progress" : "draft"}`}>
                                {p.status || "not started"}
                              </span>}
                        </td>
                      );
                    })}
                    <td style={{ fontWeight: 600 }}>
                      {totalC != null ? `${totalC} / ${totalM}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
