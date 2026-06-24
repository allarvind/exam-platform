import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Plus, Trash2, Save, ArrowLeft, ExternalLink } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../App";
import { useAuth } from "../../App";

const DEFAULT_SECTION = (num) => ({
  _key: Math.random().toString(36).slice(2),
  section_number: num,
  label: String.fromCharCode(64 + num), // A, B, C...
  question_count: 50,
  duration_minutes: 50,
});

const DEFAULT_PART = (num) => ({
  _key: Math.random().toString(36).slice(2),
  part_number: num,
  label: "Part",
  sections: [DEFAULT_SECTION(1)],
  // db id once saved
  id: null,
});

export default function AdminExamEditor() {
  const { examId } = useParams();
  const { session } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const isNew = !examId;

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [requireAll, setRequireAll] = useState(true);
  const [parts, setParts] = useState([DEFAULT_PART(1)]);
  const [saving, setSaving] = useState(false);
  const [dbExam, setDbExam] = useState(null); // persisted exam row

  useEffect(() => {
    if (!isNew) load();
  }, [examId]); // eslint-disable-line

  async function load() {
    const { data, error } = await supabase
      .from("exams")
      .select("*, exam_parts(*, exam_sections(*))")
      .eq("id", examId)
      .single();
    if (error) { toast(error.message); return; }
    setDbExam(data);
    setTitle(data.title);
    setDesc(data.description || "");
    setRequireAll(data.require_all_parts);
    if (data.exam_parts?.length) {
      setParts(
        data.exam_parts
          .sort((a, b) => a.part_number - b.part_number)
          .map((p) => ({
            ...p,
            _key: p.id,
            sections: (p.exam_sections || [])
              .sort((a, b) => a.section_number - b.section_number)
              .map((s) => ({ ...s, _key: s.id, duration_minutes: Math.round(s.duration_seconds / 60) })),
          }))
      );
    }
  }

  function updatePart(idx, field, val) {
    setParts((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }

  function updateSection(pIdx, sIdx, field, val) {
    setParts((prev) => prev.map((p, i) => i !== pIdx ? p : {
      ...p,
      sections: p.sections.map((s, j) => j !== sIdx ? s : { ...s, [field]: val }),
    }));
  }

  function addPart() {
    setParts((prev) => [...prev, DEFAULT_PART(prev.length + 1)]);
  }

  function removePart(idx) {
    setParts((prev) => prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, part_number: i + 1 })));
  }

  function addSection(pIdx) {
    setParts((prev) => prev.map((p, i) => i !== pIdx ? p : {
      ...p,
      sections: [...p.sections, DEFAULT_SECTION(p.sections.length + 1)],
    }));
  }

  function removeSection(pIdx, sIdx) {
    setParts((prev) => prev.map((p, i) => i !== pIdx ? p : {
      ...p,
      sections: p.sections.filter((_, j) => j !== sIdx).map((s, j) => ({ ...s, section_number: j + 1 })),
    }));
  }

  async function save() {
    if (!title.trim()) { toast("Exam title is required."); return; }
    setSaving(true);

    // 1. Upsert exam
    const examPayload = {
      title: title.trim(), description: desc.trim() || null,
      require_all_parts: requireAll,
      created_by: session.user.id,
    };
    let exam;
    if (isNew) {
      const { data, error } = await supabase.from("exams").insert(examPayload).select().single();
      if (error) { toast(error.message); setSaving(false); return; }
      exam = data;
    } else {
      const { data, error } = await supabase.from("exams").update(examPayload).eq("id", examId).select().single();
      if (error) { toast(error.message); setSaving(false); return; }
      exam = data;
    }

    // 2. Delete then re-insert parts + sections (simplest correct approach)
    await supabase.from("exam_parts").delete().eq("exam_id", exam.id);
    for (const part of parts) {
      const { data: dbPart, error: pErr } = await supabase.from("exam_parts")
        .insert({ exam_id: exam.id, part_number: part.part_number, label: part.label })
        .select().single();
      if (pErr) { toast(pErr.message); setSaving(false); return; }

      for (const sec of part.sections) {
        const { error: sErr } = await supabase.from("exam_sections").insert({
          part_id: dbPart.id,
          section_number: sec.section_number,
          label: sec.label,
          question_count: Number(sec.question_count),
          duration_seconds: Number(sec.duration_minutes) * 60,
        });
        if (sErr) { toast(sErr.message); setSaving(false); return; }
      }
    }

    setSaving(false);
    toast("Saved.");
    if (isNew) navigate(`/admin/exams/${exam.id}`, { replace: true });
    else load();
  }

  // Get all section IDs for question assignment links (only available after first save)
  async function getSectionId(part, sec) {
    const { data } = await supabase
      .from("exam_sections")
      .select("id")
      .eq("section_number", sec.section_number)
      .in("part_id",
        (await supabase.from("exam_parts").select("id").eq("exam_id", dbExam?.id || examId)
          .eq("part_number", part.part_number)).data?.map((p) => p.id) || []
      )
      .maybeSingle();
    return data?.id;
  }

  async function goToQuestions(part, sec) {
    const id = await getSectionId(part, sec);
    if (!id) { toast("Save the exam first."); return; }
    navigate(`/admin/sections/${id}/questions`);
  }

  const totalQ = parts.reduce((s, p) => s + p.sections.reduce((ss, sec) => ss + Number(sec.question_count), 0), 0);
  const totalMin = parts.reduce((s, p) => s + p.sections.reduce((ss, sec) => ss + Number(sec.duration_minutes), 0), 0);

  return (
    <div className="page-wide">
      <div className="page-header">
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/admin/exams")}>
            <ArrowLeft size={14} />
          </button>
          <div>
            <div className="eyebrow">Admin · Exams</div>
            <div className="h1">{isNew ? "New exam" : title || "Edit exam"}</div>
          </div>
        </div>
        <div className="row">
          <div className="hint-sm" style={{ color: "#5B6178" }}>
            {totalQ} questions · {totalMin} min total
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Basic info */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="h3" style={{ marginBottom: 14 }}>Exam details</div>
        <div className="field">
          <label className="label">Title *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DBMCI FMGE National Mock — June 2026" />
        </div>
        <div className="field">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional — shown to candidates on the dashboard" style={{ resize: "vertical" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
          <input type="checkbox" checked={requireAll} onChange={(e) => setRequireAll(e.target.checked)} />
          Show score only after all parts are completed
        </label>
      </div>

      {/* Parts + sections */}
      <div className="h3" style={{ marginBottom: 12 }}>Parts & sections</div>
      {parts.map((part, pIdx) => (
        <div key={part._key} className="part-cfg">
          <div className="part-header">
            <div className="h3" style={{ flex: 1 }}>
              <input className="input" style={{ width: 80, display: "inline-block", marginRight: 6 }}
                value={part.label} onChange={(e) => updatePart(pIdx, "label", e.target.value)} />
              {part.part_number}
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => removePart(pIdx)} disabled={parts.length === 1}>
              <Trash2 size={13} />
            </button>
          </div>

          {/* Sections */}
          {part.sections.map((sec, sIdx) => (
            <div key={sec._key} className="section-cfg">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div className="row">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Section</div>
                  <input className="input" style={{ width: 60 }} value={sec.label}
                    onChange={(e) => updateSection(pIdx, sIdx, "label", e.target.value)} />
                </div>
                <div className="row">
                  {!isNew && (
                    <button className="btn btn-ghost btn-sm" title="Manage questions for this section"
                      onClick={() => goToQuestions(part, sec)}>
                      <ExternalLink size={13} /> Questions
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => removeSection(pIdx, sIdx)} disabled={part.sections.length === 1}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <div className="row">
                <div style={{ flex: 1 }}>
                  <label className="label">Number of questions</label>
                  <input className="input" type="number" min={1} max={200}
                    value={sec.question_count}
                    onChange={(e) => updateSection(pIdx, sIdx, "question_count", e.target.value)} />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="label">Duration (minutes)</label>
                  <input className="input" type="number" min={1} max={300}
                    value={sec.duration_minutes}
                    onChange={(e) => updateSection(pIdx, sIdx, "duration_minutes", e.target.value)} />
                </div>
              </div>
              <div className="hint-sm" style={{ marginTop: 6 }}>
                {sec.question_count} questions · {sec.duration_minutes} min
                {sec.question_count > 0 && sec.duration_minutes > 0
                  ? ` · ~${(sec.duration_minutes / sec.question_count * 60).toFixed(0)}s per question`
                  : ""}
              </div>
            </div>
          ))}

          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => addSection(pIdx)}>
            <Plus size={13} /> Add section
          </button>
        </div>
      ))}

      <button className="btn btn-secondary" onClick={addPart}>
        <Plus size={14} /> Add part
      </button>

      {!isNew && (
        <div className="card" style={{ marginTop: 24, background: "#FFF6E5", borderColor: "#F2D49B" }}>
          <div className="h3" style={{ marginBottom: 6 }}>Next steps</div>
          <p className="hint-sm">
            After saving, use the <strong>Questions</strong> button on each section to assign questions from the bank.
            Then set the exam status to <strong>published</strong> to make it visible to candidates.
          </p>
        </div>
      )}
    </div>
  );
}
