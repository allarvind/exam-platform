import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Upload, Search, CheckCircle } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../App";
import { useAuth } from "../../App";

const BLANK = { question_text: "", options: ["", "", "", ""], correct_option: 0, subject: "", image_path: null };

export default function AdminQuestions() {
  const { session } = useAuth();
  const toast = useToast();
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = list mode, {...} = edit mode
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviews, setImagePreviews] = useState({});
  const fileRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("questions").select("*").order("created_at", { ascending: false });
    if (error) toast(error.message);
    setQuestions(data || []);
    setLoading(false);
  }

  function openNew() { setForm({ ...BLANK, options: ["", "", "", ""] }); setImageFile(null); }
  function openEdit(q) {
    setForm({ ...q, options: [...(q.options || ["","","",""])] });
    setImageFile(null);
  }

  function updateOpt(i, v) {
    setForm((f) => { const opts = [...f.options]; opts[i] = v; return { ...f, options: opts }; });
  }

  async function handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreviews((p) => ({ ...p, _new: URL.createObjectURL(file) }));
  }

  async function saveQuestion() {
    if (!form.question_text.trim()) { toast("Question text is required."); return; }
    if (form.options.some((o) => !o.trim())) { toast("All 4 options are required."); return; }
    setSaving(true);

    let image_path = form.image_path;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `q/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("question-images").upload(path, imageFile);
      if (upErr) { toast(upErr.message); setSaving(false); return; }
      image_path = path;
    }

    const payload = {
      question_text: form.question_text.trim(),
      options: form.options.map((o) => o.trim()),
      correct_option: Number(form.correct_option),
      subject: form.subject.trim() || null,
      image_path,
      created_by: session.user.id,
    };

    if (form.id) {
      const { error } = await supabase.from("questions").update(payload).eq("id", form.id);
      if (error) { toast(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("questions").insert(payload);
      if (error) { toast(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setForm(null);
    load();
  }

  async function deleteQuestion(id) {
    if (!confirm("Delete this question? It will also be removed from any section it's assigned to.")) return;
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast(error.message); return; }
    load();
  }

  const subjects = [...new Set(questions.map((q) => q.subject).filter(Boolean))].sort();
  const filtered = questions.filter((q) => {
    const matchSearch = !search || q.question_text.toLowerCase().includes(search.toLowerCase());
    const matchSubject = !subjectFilter || q.subject === subjectFilter;
    return matchSearch && matchSubject;
  });

  // ---- Edit form ----
  if (form !== null) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="h1">{form.id ? "Edit question" : "New question"}</div>
          <div className="row">
            <button className="btn btn-ghost" onClick={() => { setForm(null); setImageFile(null); }}>Cancel</button>
            <button className="btn btn-primary" onClick={saveQuestion} disabled={saving}>
              {saving ? "Saving…" : "Save question"}
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="field">
            <label className="label">Subject / tag</label>
            <input className="input" placeholder="e.g. Pharmacology, Surgery" value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>

          <div className="field">
            <label className="label">Question text *</label>
            <textarea className="input" rows={4} value={form.question_text}
              onChange={(e) => setForm({ ...form, question_text: e.target.value })}
              style={{ resize: "vertical" }} placeholder="Type the question here…" />
          </div>

          <div className="field">
            <label className="label">Question image (optional)</label>
            <div className="row">
              <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                <Upload size={13} /> {imageFile ? "Change image" : "Upload image"}
              </button>
              {form.image_path && !imageFile && <span className="hint-sm">Image attached</span>}
              {imageFile && <span className="hint-sm">{imageFile.name}</span>}
            </div>
            {imagePreviews._new && <img src={imagePreviews._new} alt="preview" style={{ maxWidth: 300, borderRadius: 8, marginTop: 10, border: "1px solid #E3E5EE" }} />}
            <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={handleImage} />
          </div>

          <label className="label">Options * (mark the correct one)</label>
          {form.options.map((opt, i) => (
            <div key={i} className="row" style={{ marginBottom: 8 }}>
              <input type="radio" name="correct"
                checked={Number(form.correct_option) === i}
                onChange={() => setForm({ ...form, correct_option: i })}
                style={{ flexShrink: 0 }} />
              <span style={{ width: 24, fontWeight: 700, flexShrink: 0 }}>{String.fromCharCode(65 + i)}</span>
              <input className="input" style={{ flex: 1, margin: 0 }} value={opt}
                onChange={(e) => updateOpt(i, e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`} />
              {Number(form.correct_option) === i && <CheckCircle size={16} style={{ color: "#1E8E5A", flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- List ----
  return (
    <div className="page-wide">
      <div className="page-header">
        <div>
          <div className="eyebrow">Admin</div>
          <div className="h1">Question bank <span className="hint" style={{ fontSize: 16 }}>({questions.length} questions)</span></div>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus size={14} /> Add question</button>
      </div>

      <div className="row" style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#B8BCC8" }} />
          <input className="input" style={{ paddingLeft: 32, margin: 0 }} placeholder="Search questions…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input" style={{ width: "auto", margin: 0, flex: "0 1 180px" }} value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading && <p className="hint">Loading…</p>}
      {!loading && filtered.length === 0 && <p className="hint">No questions match your filter.</p>}

      <div className="table-wrap">
        {filtered.slice(0, 100).map((q) => (
          <div key={q.id} className="table-row" style={{ gridTemplateColumns: "1fr auto auto auto" }}>
            <div>
              <div style={{ fontSize: 13, marginBottom: 4 }}>{q.question_text.slice(0, 120)}{q.question_text.length > 120 ? "…" : ""}</div>
              <div className="hint-sm">{q.subject || "—"} · Correct: {String.fromCharCode(65 + q.correct_option)} ({q.options[q.correct_option]?.slice(0, 40)})</div>
            </div>
            {q.image_path && <span className="badge badge-published">Image</span>}
            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(q)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={() => deleteQuestion(q.id)}><Trash2 size={13} /></button>
          </div>
        ))}
        {filtered.length > 100 && <div className="table-row hint-sm">Showing first 100 — narrow your search to see more.</div>}
      </div>
    </div>
  );
}
