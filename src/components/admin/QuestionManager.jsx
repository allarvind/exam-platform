import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Upload, Download, Image } from "lucide-react";
import { supabase } from "../../supabaseClient";
import Papa from "papaparse";

const EMPTY_Q = () => ({ question_text: "", options: ["", "", "", ""], correct_option: 0, marks: 1, image_path: null });

export default function QuestionManager({ exam, onBack }) {
  const [parts, setParts]           = useState([]);
  const [selPart, setSelPart]       = useState(null);
  const [selSection, setSelSection] = useState(null);
  const [questions, setQuestions]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [newQ, setNewQ]             = useState(null);
  const [error, setError]           = useState("");
  const [msg, setMsg]               = useState("");
  const fileRef = useRef(null);
  const imgRef  = useRef(null);

  useEffect(() => {
    supabase.from("exam_parts").select("*").eq("exam_id", exam.id).order("part_number")
      .then(({ data }) => {
        setParts(data || []);
        if (data?.length > 0) {
          setSelPart(data[0]);
          setSelSection(0);
        }
      });
  }, [exam.id]);

  useEffect(() => {
    if (!selPart || selSection == null) return;
    setLoading(true);
    supabase.from("questions")
      .select("*")
      .eq("exam_id", exam.id)
      .eq("part_number", selPart.part_number)
      .eq("section_idx", selSection)
      .order("seq_in_section")
      .then(({ data }) => { setQuestions(data || []); setLoading(false); });
  }, [exam.id, selPart, selSection]);

  const configured = selPart?.sections?.[selSection]?.question_count || 0;

  async function saveQuestion(q) {
    setSaving(true); setError(""); setMsg("");
    const next = questions.length + 1;
    const payload = {
      exam_id: exam.id,
      part_number: selPart.part_number,
      section_idx: selSection,
      seq_in_section: q.seq_in_section || next,
      question_text: q.question_text,
      options: q.options,
      correct_option: q.correct_option,
      marks: q.marks || 1,
      image_path: q.image_path || null,
      option_image_paths: q.option_image_paths || null,
    };
    const { error: err } = q.id
      ? await supabase.from("questions").update(payload).eq("id", q.id)
      : await supabase.from("questions").insert(payload);
    if (err) { setError(err.message); } else { setMsg("Saved."); setNewQ(null); refreshQ(); }
    setSaving(false);
  }

  async function deleteQuestion(id) {
    if (!window.confirm("Delete this question?")) return;
    await supabase.from("questions").delete().eq("id", id);
    refreshQ();
  }

  function refreshQ() {
    if (!selPart || selSection == null) return;
    supabase.from("questions")
      .select("*")
      .eq("exam_id", exam.id)
      .eq("part_number", selPart.part_number)
      .eq("section_idx", selSection)
      .order("seq_in_section")
      .then(({ data }) => setQuestions(data || []));
  }

  async function handleImageUpload(e, qForUpload) {
    const file = e.target.files[0];
    if (!file) return;
    const path = `exams/${exam.id}/${selPart.part_number}-${selSection}-${Date.now()}-${file.name}`;
    const { error: err } = await supabase.storage.from("question-images").upload(path, file);
    if (err) { setError(err.message); return; }
    if (qForUpload) {
      await supabase.from("questions").update({ image_path: path }).eq("id", qForUpload);
      refreshQ();
    } else if (newQ) {
      setNewQ((prev) => ({ ...prev, image_path: path }));
    }
    setMsg("Image uploaded.");
  }

  // CSV import
  function downloadTemplate() {
    const csv = Papa.unparse([{
      seq_in_section: "1",
      question_text: "Sample question?",
      option_a: "Answer A", option_b: "Answer B", option_c: "Answer C", option_d: "Answer D",
      correct_option: "0", // 0-indexed: 0=A, 1=B, 2=C, 3=D
      marks: "1",
      image_path: "",
    }]);
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "questions-template.csv";
    a.click();
  }

  function handleCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        setSaving(true); setError(""); setMsg("");
        let count = 0;
        for (const row of data) {
          const payload = {
            exam_id: exam.id,
            part_number: selPart.part_number,
            section_idx: selSection,
            seq_in_section: Number(row.seq_in_section) || (questions.length + count + 1),
            question_text: row.question_text || "",
            options: [row.option_a || "", row.option_b || "", row.option_c || "", row.option_d || ""],
            correct_option: Math.min(3, Math.max(0, Number(row.correct_option) || 0)),
            marks: Number(row.marks) || 1,
            image_path: row.image_path || null,
          };
          const { error: err } = await supabase.from("questions").insert(payload);
          if (err) { setError(`Row ${count + 1}: ${err.message}`); break; }
          count++;
        }
        if (!error) setMsg(`Imported ${count} questions.`);
        refreshQ();
        setSaving(false);
        e.target.value = "";
      },
    });
  }

  return (
    <div className="page-wide">
      <div className="page-header">
        <div>
          <div className="eyebrow">Admin · {exam.title}</div>
          <h1 className="h1">Questions</h1>
        </div>
        <button className="btn-secondary" onClick={onBack}>← Back</button>
      </div>

      {error && <div className="error-box">{error}</div>}
      {msg   && <div className="success-box">{msg}</div>}

      {/* Part/section selector */}
      <div className="card" style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <span className="label">Part</span>
          <select className="input" value={selPart?.id || ""} style={{ minWidth: 140 }}
            onChange={(e) => {
              const p = parts.find((pt) => pt.id === e.target.value);
              setSelPart(p || null);
              setSelSection(0);
            }}>
            {parts.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <span className="label">Section</span>
          <select className="input" value={selSection ?? ""} style={{ minWidth: 120 }}
            onChange={(e) => setSelSection(Number(e.target.value))}>
            {selPart?.sections?.map((sec, i) => (
              <option key={i} value={i}>Section {sec.label}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Progress</span>
          <span style={{ fontSize: 14 }}>
            <strong>{questions.length}</strong> / {configured} questions
            {questions.length > configured && (
              <span className="badge badge-progress" style={{ marginLeft: 8 }}>Over limit</span>
            )}
            {questions.length === configured && configured > 0 && (
              <span className="badge badge-done" style={{ marginLeft: 8 }}>Complete</span>
            )}
          </span>
        </div>
        <div className="spacer" style={{ flex: 1 }} />
        <button className="btn-secondary btn-sm" onClick={downloadTemplate}><Download size={12} /> CSV template</button>
        <label className="btn-secondary btn-sm" style={{ cursor: "pointer" }}>
          <Upload size={12} /> Import CSV
          <input type="file" accept=".csv" style={{ display: "none" }} ref={fileRef} onChange={handleCSV} />
        </label>
        <button className="btn btn-sm" onClick={() => setNewQ(EMPTY_Q())}><Plus size={12} /> Add question</button>
      </div>

      {/* New question form */}
      {newQ && (
        <QuestionForm
          q={newQ}
          onChange={setNewQ}
          onSave={() => saveQuestion(newQ)}
          onCancel={() => setNewQ(null)}
          onImageUpload={(e) => handleImageUpload(e, null)}
          saving={saving}
          label="New question"
        />
      )}

      {/* Question list */}
      {loading && <p className="hint">Loading…</p>}
      {!loading && questions.length === 0 && !newQ && (
        <p className="hint">No questions yet for this section. Add individually or import a CSV.</p>
      )}
      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          q={q}
          onDelete={() => deleteQuestion(q.id)}
          onImageUpload={(e) => handleImageUpload(e, q.id)}
        />
      ))}
    </div>
  );
}

function QuestionForm({ q, onChange, onSave, onCancel, onImageUpload, saving, label }) {
  return (
    <div className="q-admin-card" style={{ background: "#EEF0FF", borderColor: "#C7C9F0" }}>
      <div className="q-admin-card-head">
        <h3 className="h3">{label}</h3>
        <button className="btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
      <div className="field">
        <span className="label">Question text</span>
        <textarea className="input" rows={3} value={q.question_text}
          onChange={(e) => onChange((prev) => ({ ...prev, question_text: e.target.value }))} />
      </div>
      <div className="field">
        <span className="label">Options — select the correct answer with the radio button</span>
        {q.options.map((opt, i) => (
          <div key={i} className="option-admin-row">
            <input type="radio" name="correct" checked={q.correct_option === i}
              onChange={() => onChange((prev) => ({ ...prev, correct_option: i }))} />
            <span style={{ fontSize: 12, width: 16, fontWeight: 600 }}>{String.fromCharCode(65 + i)}</span>
            <input className="input" value={opt}
              onChange={(e) => {
                const opts = [...q.options];
                opts[i] = e.target.value;
                onChange((prev) => ({ ...prev, options: opts }));
              }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="label">Marks</span>
          <input className="input input-narrow" type="number" min={1} value={q.marks}
            onChange={(e) => onChange((prev) => ({ ...prev, marks: Number(e.target.value) }))} />
        </div>
        <div>
          <span className="label">Stem image (optional)</span>
          <label className="btn-secondary btn-sm" style={{ cursor: "pointer" }}>
            <Image size={12} /> {q.image_path ? "Change image" : "Upload image"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={onImageUpload} />
          </label>
          {q.image_path && <span className="hint-sm" style={{ marginLeft: 8 }}>✓ Image attached</span>}
        </div>
        <div className="spacer" />
        <button className="btn" disabled={saving || !q.question_text.trim() || q.options.some((o) => !o.trim())}
          onClick={onSave}>
          {saving ? "Saving…" : "Save question"}
        </button>
      </div>
    </div>
  );
}

function QuestionCard({ q, onDelete, onImageUpload }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="q-admin-card">
      <div className="q-admin-card-head">
        <div style={{ flex: 1 }}>
          <span className="hint-sm" style={{ marginRight: 8 }}>Q{q.seq_in_section}</span>
          <span style={{ fontSize: 13 }}>{q.question_text.slice(0, 90)}{q.question_text.length > 90 ? "…" : ""}</span>
          {q.image_path && <span className="badge-tag badge-section" style={{ marginLeft: 8 }}>Image</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn-ghost btn-sm" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Collapse" : "Expand"}
          </button>
          <button className="btn-danger btn-sm" onClick={onDelete}><Trash2 size={12} /></button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          {q.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
              <input type="radio" readOnly checked={q.correct_option === i} />
              <span style={{ fontWeight: q.correct_option === i ? 600 : 400 }}>
                {String.fromCharCode(65 + i)}. {opt}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 8 }}>
            <label className="btn-secondary btn-sm" style={{ cursor: "pointer" }}>
              <Image size={12} /> {q.image_path ? "Replace image" : "Add image"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={onImageUpload} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
