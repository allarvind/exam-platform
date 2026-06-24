export default function ResultScreen({ examTitle, scorecard, onBack }) {
  const allDone = scorecard?.length > 0 && scorecard.every((r) => r.status === "completed");
  const totalCorrect = allDone ? scorecard.reduce((s, r) => s + (r.correct || 0), 0) : null;
  const totalMarks   = allDone ? scorecard.reduce((s, r) => s + (r.total  || 0), 0)  : null;

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="eyebrow">{examTitle}</div>
        {allDone ? (
          <>
            <h1 className="h1">Final score</h1>
            <div className="score-big">{totalCorrect}<span> / {totalMarks}</span></div>
            <p className="hint-sm">
              Combined across all parts. Section-wise data is stored for analytics but not displayed.
            </p>
          </>
        ) : (
          <>
            <h1 className="h1">Answers recorded</h1>
            <p className="hint" style={{ marginBottom: 12 }}>
              Your score isn't shown yet — it unlocks once every part of this exam is completed.
            </p>
            {scorecard?.map((r) => (
              <div key={r.part_number} style={{ display: "flex", justifyContent: "space-between",
                padding: "8px 0", borderBottom: "1px solid #F0F1F5", fontSize: 13 }}>
                <span>{r.part_label}</span>
                <span className={`badge badge-${r.status === "completed" ? "done" : r.status === "in_progress" ? "progress" : "draft"}`}>
                  {r.status === "completed" ? "Done" : r.status === "in_progress" ? "In progress" : "Not started"}
                </span>
              </div>
            ))}
          </>
        )}
        <button className="btn btn-block" style={{ marginTop: 18 }} onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
