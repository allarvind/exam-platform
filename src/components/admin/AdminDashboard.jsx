import { Plus, Settings, Users, Upload } from "lucide-react";

export default function AdminDashboard({ exams, onNew, onEdit, onQuestions, onResults, onBack }) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="h1">All exams</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={onBack}>Candidate view</button>
          <button className="btn" onClick={onNew}><Plus size={14} /> New exam</button>
        </div>
      </div>

      {exams.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="hint">No exams yet. Create your first exam to get started.</p>
          <button className="btn" style={{ marginTop: 14 }} onClick={onNew}>
            <Plus size={14} /> Create exam
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Parts</th>
              <th>Sequential</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.map((exam) => (
              <tr key={exam.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{exam.title}</div>
                  {exam.description && (
                    <div className="hint-sm" style={{ marginTop: 2 }}>{exam.description}</div>
                  )}
                </td>
                <td>{exam.parts?.length || 0}</td>
                <td>{exam.parts_sequential ? "Yes" : "No"}</td>
                <td><span className={`badge badge-${exam.status}`}>{exam.status}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button className="btn-secondary btn-sm" onClick={() => onEdit(exam)}>
                      <Settings size={12} /> Configure
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => onQuestions(exam)}>
                      <Upload size={12} /> Questions
                    </button>
                    <button className="btn-secondary btn-sm" onClick={() => onResults(exam)}>
                      <Users size={12} /> Results
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
