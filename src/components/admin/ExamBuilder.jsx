import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../../supabaseClient";

function newSection() {
  return { label: "A", question_count: 50, duration_seconds: 3000 };
}
function newPart(num) {
  return { part_number: num, label: `Part ${num}`, sections: [newSection()] };
}

export default function ExamBuilder({ exam: initialExam, onSave, onBack }) {
  const isNew = !initialExam?.id;
  const [title,        setTitle]       = useState(initialExam?.title        || "");
  const [description,  setDesc]        = useState(initialExam?.description  || "");
  const [instructions, setInst]        = useState(initialExam?.instructions || "");
  const [sequential,   setSequential]  = useState(initialExam?.parts_sequential !== false);
  const [status,       setStatus]      = useState(initialExam?.status       || "draft");
  const [parts,        setParts]       = useState(() =>
    initialExam?.parts?.map((p) => ({
      id: p.id,
      part_number: p.part_number,
      label: p.label,
      sections: p.sections || [newSection()],
    })) || [newPart(1)]
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function addPart() {
    setParts((prev) => [...prev, newPart(prev.length + 1)]);
  }
  function removePart(i) {
    setParts((prev) => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, part_number: idx + 1 })));
  }
  function updatePart(i, field, val) {
    setParts((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  }
  function addSection(partIdx) {
    setParts((prev) => prev.map((p, i) => {
      if (i !== partIdx) return p;
      const next = { ...newSection(), label: String.fromCharCode(65 + p.sections.length) };
      return { ...p, sections: [...p.sections, next] };
    }));
  }
  function removeSection(partIdx, secIdx) {
    setParts((prev) => prev.map((p, i) => {
      if (i !== partIdx) return p;
      return { ...p, sections: p.sections.filter((_, si) => si !== secIdx) };
    }));
  }
  function updateSection(partIdx, secIdx, field, val) {
    setParts((prev) => prev.map((p, i) => {
      if (i !== partIdx) return p;
      const secs = p.sections.map((s, si) => si === secIdx ? { ...s, [field]: val } : s);
      return { ...p, sections: secs };
    }));
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    if (parts.some((p) => !p.label.trim())) { setError("All parts need a label."); return; }
    if (parts.some((p) => p.sections.length === 0)) { setError("Each part needs at least one section."); return; }
    setSaving(true); setError("");

    try {
      let examId = initialExam?.id;

      if (isNew) {
        const { data, error: err } = await supabase.from("exams").insert({
          title, description, instructions, status, parts_sequential: sequential,
        }).select().single();
        if (err) throw err;
        examId = data.id;
      } else {
        const { error: err } = await supabase.from("exams").update({
          title, description, instructions, status, parts_sequential: sequential,
          updated_at: new Date().toISOString(),
        }).eq("id", examId);
        if (err) throw err;
      }

      // Delete all existing parts and re-insert — simplest for a config builder
      if (!isNew) {
        await supabase.from("exam_parts").delete().eq("exam_id", examId);
      }

      for (const part of parts) {
        const { error: err } = await supabase.from("exam_parts").insert({
          exam_id: examId,
          part_number: part.part_number,
          label: part.label,
          sections: part.sections,
        });
        if (err) throw err;
      }

      onSave();
    } catch (e) {
      setError(e.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="eyebrow">Admin</div>
          <h1 className="h1">{isNew ? "New exam" : "Configure exam"}</h1>
        </div>
        <div className="page-header-actions">
          <button className="btn-secondary" onClick={onBack}>Cancel</button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {/* Basic info */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="h3" style={{ marginBottom: 14 }}>Exam details</h3>
        <div className="field">
          <span className="label">Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. FMGE National Mock Jun 2026" />
        </div>
        <div className="field">
          <span className="label">Description (shown on dashboard)</span>
          <input className="input" value={description} onChange={(e) => setDesc(e.target.value)} placeholder="Short description…" />
        </div>
        <div className="field">
          <span className="label">Instructions (shown before each part)</span>
          <textarea className="input" value={instructions} onChange={(e) => setInst(e.target.value)}
            placeholder="Read all questions carefully…" rows={3} />
        </div>
        <div className="form-row">
          <div className="field">
            <span className="label">Status</span>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">Draft (invisible to candidates)</option>
              <option value="active">Active (visible to candidates)</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div className="field">
            <span className="label">Part sequencing</span>
            <select className="input" value={sequential ? "yes" : "no"}
              onChange={(e) => setSequential(e.target.value === "yes")}>
              <option value="yes">Sequential — Part 2 locked until Part 1 done</option>
              <option value="no">Independent — any part can be started anytime</option>
            </select>
          </div>
        </div>
      </div>

      {/* Parts builder */}
      <div className="section-label">Exam structure — parts &amp; sections</div>

      {parts.map((part, pIdx) => (
        <div key={pIdx} className="part-builder">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
              <span className="label" style={{ marginBottom: 0, minWidth: 36 }}>Label</span>
              <input className="input" style={{ maxWidth: 160 }} value={part.label}
                onChange={(e) => updatePart(pIdx, "label", e.target.value)} placeholder={`Part ${pIdx + 1}`} />
            </div>
            {parts.length > 1 && (
              <button className="btn-danger btn-sm" onClick={() => removePart(pIdx)}>
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Sections */}
          <div style={{ marginLeft: 12 }}>
            <div style={{ display: "flex", gap: 8, fontSize: 11, fontWeight: 600, color: "#5B6178",
              textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 6 }}>
              <span style={{ flex: "0 0 90px" }}>Section label</span>
              <span style={{ flex: "0 0 130px" }}>Questions</span>
              <span style={{ flex: "0 0 160px" }}>Duration (seconds)</span>
              <span style={{ flex: "0 0 60px" }}>~Minutes</span>
            </div>
            {part.sections.map((sec, sIdx) => (
              <div key={sIdx} className="section-row">
                <input className="input" style={{ flex: "0 0 90px" }}
                  value={sec.label}
                  onChange={(e) => updateSection(pIdx, sIdx, "label", e.target.value)}
                  placeholder="A" />
                <input className="input" style={{ flex: "0 0 130px" }}
                  type="number" min={1}
                  value={sec.question_count}
                  onChange={(e) => updateSection(pIdx, sIdx, "question_count", Math.max(1, Number(e.target.value)))} />
                <input className="input" style={{ flex: "0 0 160px" }}
                  type="number" min={60} step={60}
                  value={sec.duration_seconds}
                  onChange={(e) => updateSection(pIdx, sIdx, "duration_seconds", Math.max(60, Number(e.target.value)))} />
                <span className="hint-sm" style={{ flex: "0 0 60px" }}>
                  ~{Math.ceil(sec.duration_seconds / 60)} min
                </span>
                {part.sections.length > 1 && (
                  <button className="btn-ghost btn-sm" onClick={() => removeSection(pIdx, sIdx)}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
            <button className="btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => addSection(pIdx)}>
              <Plus size={12} /> Add section
            </button>
          </div>

          {/* Part summary */}
          <div className="hint-sm" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #F0F1F5" }}>
            Total: {part.sections.reduce((s, sec) => s + sec.question_count, 0)} questions ·{" "}
            {Math.ceil(part.sections.reduce((s, sec) => s + sec.duration_seconds, 0) / 60)} minutes
          </div>
        </div>
      ))}

      <button className="btn-secondary" onClick={addPart}>
        <Plus size={13} /> Add part
      </button>

      {/* Grand total */}
      <div className="card" style={{ marginTop: 16 }}>
        <span className="label">Grand total</span>
        <div style={{ fontSize: 14 }}>
          {parts.length} part{parts.length !== 1 ? "s" : ""} ·{" "}
          {parts.reduce((s, p) => s + p.sections.reduce((ss, sec) => ss + sec.question_count, 0), 0)} questions ·{" "}
          ~{Math.ceil(parts.reduce((s, p) => s + p.sections.reduce((ss, sec) => ss + sec.duration_seconds, 0), 0) / 60)} minutes total
        </div>
      </div>
    </div>
  );
}
