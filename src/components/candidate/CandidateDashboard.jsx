import { Lock, LogOut, ShieldCheck } from "lucide-react";

function partStatus(attempt) {
  if (!attempt) return "not_started";
  return attempt.status;
}

export default function CandidateDashboard({
  profile, exams, attemptsByExam, scorecardsByExam,
  testDuration, setTestDuration,
  onStart, onResume, onViewResult, onLogout, onOpenAdmin,
}) {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Exam Platform</div>
          <h1 className="h1">Hi, {profile?.name?.split(" ")[0] || "candidate"}</h1>
        </div>
        <div className="page-header-actions">
          {profile?.is_admin && (
            <button className="btn-secondary btn-sm" onClick={onOpenAdmin}>
              <ShieldCheck size={13} /> Admin
            </button>
          )}
          <button className="btn-ghost" onClick={onLogout}><LogOut size={14} /> Log out</button>
        </div>
      </div>

      {/* Testing control */}
      <div className="card" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div className="label">Section duration (testing only)</div>
          <p className="hint-sm">Production value is whatever you configured per exam. Change here to test the timer flow quickly.</p>
        </div>
        <input type="number" min={10} className="input input-narrow" value={testDuration}
          onChange={(e) => setTestDuration(Math.max(10, Number(e.target.value) || 10))} />
        <span className="hint-sm">seconds / section</span>
      </div>

      {exams.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <p className="hint">No active exams right now.</p>
        </div>
      )}

      {exams.map((exam) => {
        const attempts  = attemptsByExam[exam.id] || {};
        const scorecard = scorecardsByExam[exam.id] || [];
        const allDone   = scorecard.length > 0 && scorecard.every((r) => r.status === "completed");
        const totalCorrect = allDone ? scorecard.reduce((s, r) => s + (r.correct || 0), 0) : null;
        const totalMarks   = allDone ? scorecard.reduce((s, r) => s + (r.total  || 0), 0) : null;

        return (
          <div key={exam.id} className="card" style={{ marginBottom: 16 }}>
            <div className="page-header" style={{ marginBottom: 10 }}>
              <div>
                <h2 className="h2">{exam.title}</h2>
                {exam.description && <p className="hint" style={{ marginTop: 4 }}>{exam.description}</p>}
              </div>
              {allDone && totalCorrect != null && (
                <div style={{ textAlign: "right" }}>
                  <div className="hint-sm">Final score</div>
                  <div className="score-big" style={{ fontSize: 28, margin: "4px 0" }}>
                    {totalCorrect}<span> / {totalMarks}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid-2">
              {(exam.parts || []).map((part, pIdx) => {
                const attempt  = attempts[part.part_number];
                const st       = partStatus(attempt);
                const prevDone = !exam.parts_sequential || pIdx === 0 ||
                  partStatus(attempts[(exam.parts[pIdx - 1] || {}).part_number]) === "completed";
                const locked   = !prevDone;
                const sc       = scorecard.find((r) => r.part_number === part.part_number);
                const totalQ   = (part.sections || []).reduce((s, sec) => s + (sec.question_count || 0), 0);
                const totalMin = (part.sections || []).reduce((s, sec) => s + Math.ceil((sec.duration_seconds || 0) / 60), 0);

                return (
                  <div key={part.id} className="card-sm" style={{ opacity: locked ? 0.55 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <h3 className="h3">{part.label}</h3>
                      <span className={`badge badge-${locked ? "locked" : st === "completed" ? "done" : st === "in_progress" ? "progress" : "draft"}`}>
                        {locked ? "Locked" : st === "completed" ? "Completed" : st === "in_progress" ? "In progress" : "Not started"}
                      </span>
                    </div>
                    <p className="hint-sm" style={{ marginBottom: 10 }}>
                      {totalQ} questions · {part.sections?.length || 0} sections · ~{totalMin} min
                    </p>
                    {locked && <p className="hint-sm">Unlocks after {exam.parts[pIdx - 1]?.label} is completed</p>}
                    {!locked && st === "completed" && !allDone && (
                      <p className="hint-sm">Completed — score shows once all parts are done</p>
                    )}
                    <div style={{ marginTop: 10 }}>
                      {locked && (
                        <button className="btn-secondary btn-sm" disabled><Lock size={12} /> Locked</button>
                      )}
                      {!locked && st === "not_started" && (
                        <button className="btn btn-sm" onClick={() => onStart(exam.id, part.part_number, testDuration)}>
                          Start {part.label}
                        </button>
                      )}
                      {!locked && st === "in_progress" && (
                        <button className="btn btn-sm" onClick={() => onResume(exam.id, part.part_number)}>
                          Resume {part.label}
                        </button>
                      )}
                      {!locked && st === "completed" && (
                        <button className="btn-secondary btn-sm" onClick={() => onViewResult(exam.id)}>
                          {allDone ? "View score" : "View status"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
