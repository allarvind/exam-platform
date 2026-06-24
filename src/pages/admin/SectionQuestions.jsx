import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Search, ArrowUp, ArrowDown } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { useToast } from "../../App";

export default function AdminSectionQuestions() {
  const { sectionId } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const [section, setSection] = useState(null);
  const [assigned, setAssigned] = useState([]);
  const [bank, setBank] = useState([]);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [sectionId]); // eslint-disable-line

  async function load() {
    setLoading(true);
    const [{ data: sec }, { data: asgn }, { data: bankData }] = await Promise.all([
      supabase.from("exam_sections").select("*, exam_parts(label, part_number, exams(title))").eq("id", sectionId).single(),
      supabase.from("exam_section_questions")
        .select("sequence_number, questions(*)")
        .eq("section_id", sectionId)
        .order("sequence_number"),
      supabase.from("questions").select("*").order("created_at", { ascending: false }),
    ]);
    setSection(sec);
    setAssigned((asgn || []).map((a) => ({ ...a.questions, seq: a.sequence_number })));
    setBank(bankData || []);
    setLoading(false);
  }

  async function addQuestion(q) {
    const maxSeq = assigned.reduce((m, a) => Math.max(m, a.seq || 0), 0);
    const { error } = await supabase.from("exam_section_questions").insert({
      section_id: sectionId, question_id: q.id, sequence_number: maxSeq + 1,
    });
    if (error) { toast(error.message); return; }
    await load();
  }

  async function removeQuestion(qId) {
    const { error } = await supabase.from("exam_section_questions")
      .delete().eq("section_id", sectionId).eq("question_id", qId);
    if (error) { toast(error.message); return; }
    await load();
  }

  async function moveQuestion(idx, dir) {
    const other = idx + dir;
    if (other < 0 || other >= assigned.length) return;
    const a = assigned[idx]; const b = assigned[other];
    await Promise.all([
      supabase.from("exam_section_questions").update({ sequence_number: b.seq })
        .eq("section_id", sectionId).eq("question_id", a.id),
      supabase.from("exam_section_questions").update({ sequence_number: a.seq })
        .eq("section_id", sectionId).eq("question_id", b.id),
    ]);
    await load();
  }

  const assignedIds = new Set(assigned.map((a) => a.id));
  const bankFiltered = bank.filter((q) => {
    const notAssigned = !assignedIds.has(q.id);
    const matchSearch = !search || q.question_text.toLowerCase().includes(search.toLowerCase());
    const matchSubject = !subjectFilter || q.subject === subjectFilter;
    return notAssigned && matchSearch && matchSubject;
  });

  const subjects = [...new Set(bank.map((q) => q.subject).filter(Boolean))].sort();
  const sectionTitle = section
    ? `${section.exam_parts?.exams?.title} · ${section.exam_parts?.label} ${section.exam_parts?.part_number} · Section ${section.label}`
    : "Section";

  return (
    <div className="page-wide">
      <div className="page-header">
        <div className="row">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}><ArrowLeft size={14} /></button>
          <div>
            <div className="eyebrow">{sectionTitle}</div>
            <div className="h1">
              Questions assigned: {assigned.length} / {section?.question_count || "?"}
            </div>
          </div>
        </div>
        {assigned.length < (section?.question_count || 0) && (
          <div className="badge badge-in_progress">
            {(section?.question_count || 0) - assigned.length} more needed
          </div>
        )}
        {assigned.length >= (section?.question_count || 0) && assigned.length > 0 && (
          <div className="badge badge-completed">Fully assigned</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Assigned questions */}
        <div>
          <div className="h3" style={{ marginBottom: 10 }}>Assigned (in order)</div>
          {assigned.length === 0 && <p className="hint-sm">No questions assigned yet. Add from the bank →</p>}
          <div className="table-wrap">
            {assigned.map((q, i) => (
              <div key={q.id} className="table-row" style={{ gridTemplateColumns: "24px 1fr auto auto auto" }}>
                <span className="hint-sm" style={{ fontWeight: 700 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 12 }}>{q.question_text.slice(0, 80)}{q.question_text.length > 80 ? "…" : ""}</div>
                  {q.subject && <div className="hint-sm">{q.subject}</div>}
                </div>
                <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => moveQuestion(i, -1)}><ArrowUp size={12} /></button>
                <button className="btn btn-ghost btn-sm" disabled={i === assigned.length - 1} onClick={() => moveQuestion(i, 1)}><ArrowDown size={12} /></button>
                <button className="btn btn-danger btn-sm" onClick={() => removeQuestion(q.id)}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Question bank */}
        <div>
          <div className="h3" style={{ marginBottom: 10 }}>Question bank ({bankFiltered.length} available)</div>
          <div className="row" style={{ marginBottom: 10 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#B8BCC8" }} />
              <input className="input" style={{ paddingLeft: 30, margin: 0, fontSize: 12 }} placeholder="Search…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input" style={{ width: 130, margin: 0, fontSize: 12 }}
              value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="table-wrap" style={{ maxHeight: 600, overflowY: "auto" }}>
            {bankFiltered.slice(0, 50).map((q) => (
              <div key={q.id} className="table-row" style={{ gridTemplateColumns: "1fr auto" }}>
                <div>
                  <div style={{ fontSize: 12 }}>{q.question_text.slice(0, 90)}{q.question_text.length > 90 ? "…" : ""}</div>
                  {q.subject && <div className="hint-sm">{q.subject}</div>}
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => addQuestion(q)}><Plus size={12} /></button>
              </div>
            ))}
            {bankFiltered.length === 0 && <div className="table-row hint-sm">No unassigned questions match.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
