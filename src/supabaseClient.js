import { createClient } from "@supabase/supabase-js";

// Stateful client-side mock database stored in localStorage
const MOCK_DB_KEY = "exam_platform_mock_db";
const MOCK_SESSION_KEY = "exam_platform_mock_session";

const defaultDB = {
  profiles: [
    {
      id: "admin-uid",
      email: "admin@example.com",
      name: "Dr. Admin",
      country_dial: "+91",
      phone: "9876543210",
      college: "All India Institute of Medical Sciences (AIIMS)",
      graduation_year: 2024,
      attempt_number: 1,
      state: "Delhi",
      is_admin: true,
      created_at: new Date().toISOString()
    },
    {
      id: "candidate-uid",
      email: "candidate@example.com",
      name: "Dr. Candidate",
      country_dial: "+91",
      phone: "9123456789",
      college: "Maulana Azad Medical College",
      graduation_year: 2025,
      attempt_number: 1,
      state: "Delhi",
      is_admin: false,
      created_at: new Date().toISOString()
    }
  ],
  exams: [
    {
      id: "exam-1-id",
      title: "FMGE High-Yield Mock Test 2026",
      description: "Foreign Medical Graduate Examination comprehensive mock test containing high-yield clinical questions.",
      instructions: "This exam consists of 2 parts. Each part contains multiple sections. Please complete all sections sequentially. Scores will only be visible once all parts of the exam are completed.",
      status: "active",
      parts_sequential: true,
      created_by: "admin-uid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  exam_parts: [
    {
      id: "part-1-id",
      exam_id: "exam-1-id",
      part_number: 1,
      label: "Part 1 - Clinical Sciences",
      sections: [
        { label: "A", question_count: 5, duration_seconds: 300 },
        { label: "B", question_count: 5, duration_seconds: 300 }
      ]
    },
    {
      id: "part-2-id",
      exam_id: "exam-1-id",
      part_number: 2,
      label: "Part 2 - Pre & Para Clinical",
      sections: [
        { label: "A", question_count: 5, duration_seconds: 300 }
      ]
    }
  ],
  questions: [
    // Part 1 Section A
    {
      id: "q-1",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 0,
      seq_in_section: 1,
      question_text: "A 45-year-old male presents with sudden onset of severe chest pain radiating to his back. His blood pressure is 180/110 mmHg. A chest X-ray shows mediastinal widening. What is the most likely diagnosis?",
      options: ["Acute myocardial infarction", "Aortic dissection", "Pulmonary embolism", "Tension pneumothorax"],
      correct_option: 1,
      marks: 1
    },
    {
      id: "q-2",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 0,
      seq_in_section: 2,
      question_text: "Which of the following is the drug of choice for the treatment of anaphylactic shock?",
      options: ["Atropine", "Dopamine", "Epinephrine", "Hydrocortisone"],
      correct_option: 2,
      marks: 1
    },
    {
      id: "q-3",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 0,
      seq_in_section: 3,
      question_text: "A patient presents with a history of fever, headache, and neck stiffness. Lumbar puncture reveals high opening pressure, low glucose, high protein, and neutrophilic pleocytosis. What is the most likely causative organism?",
      options: ["Streptococcus pneumoniae", "Cryptococcus neoformans", "Coxsackievirus", "Mycobacterium tuberculosis"],
      correct_option: 0,
      marks: 1
    },
    {
      id: "q-4",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 0,
      seq_in_section: 4,
      question_text: "A 60-year-old chronic smoker presents with hemoptysis and weight loss. Chest CT reveals a central lung mass. Biopsy shows keratin pearls and intercellular bridges. What is the histological type?",
      options: ["Adenocarcinoma", "Small cell carcinoma", "Squamous cell carcinoma", "Large cell carcinoma"],
      correct_option: 2,
      marks: 1
    },
    {
      id: "q-5",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 0,
      seq_in_section: 5,
      question_text: "Which of the following thyroid cancers is associated with RET proto-oncogene mutation and is part of MEN 2 syndrome?",
      options: ["Papillary carcinoma", "Follicular carcinoma", "Medullary carcinoma", "Anaplastic carcinoma"],
      correct_option: 2,
      marks: 1
    },
    // Part 1 Section B
    {
      id: "q-6",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 1,
      seq_in_section: 1,
      question_text: "A 28-year-old pregnant female at 32 weeks gestation presents with sudden onset of severe headache, visual disturbances, and right upper quadrant pain. Her blood pressure is 165/110 mmHg and urinalysis shows 3+ proteinuria. What is the immediate drug of choice to prevent seizures?",
      options: ["Phenytoin", "Diazepam", "Magnesium sulfate", "Labetalol"],
      correct_option: 2,
      marks: 1
    },
    {
      id: "q-7",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 1,
      seq_in_section: 2,
      question_text: "A 5-year-old child is brought to the emergency department with high fever, barking cough, and inspiratory stridor. A lateral neck X-ray shows subglottic narrowing (steeple sign). What is the most likely diagnosis?",
      options: ["Acute epiglottitis", "Laryngotracheobronchitis (Croup)", "Foreign body aspiration", "Retropharyngeal abscess"],
      correct_option: 1,
      marks: 1
    },
    {
      id: "q-8",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 1,
      seq_in_section: 3,
      question_text: "A 35-year-old female presents with fatigue, cold intolerance, weight gain, and dry skin. On examination, she has a diffuse, non-tender goiter. Her TSH is elevated and Free T4 is low. Anti-TPO antibodies are highly positive. What is the diagnosis?",
      options: ["Graves' disease", "Hashimoto's thyroiditis", "De Quervain's thyroiditis", "Subclinical hypothyroidism"],
      correct_option: 1,
      marks: 1
    },
    {
      id: "q-9",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 1,
      seq_in_section: 4,
      question_text: "Which of the following visual field defects is typically seen in patients with a pituitary adenoma compressing the optic chiasm?",
      options: ["Homonymous hemianopia", "Bitemporal hemianopia", "Binasal hemianopia", "Monocular blindness"],
      correct_option: 1,
      marks: 1
    },
    {
      id: "q-10",
      exam_id: "exam-1-id",
      part_number: 1,
      section_idx: 1,
      seq_in_section: 5,
      question_text: "A 50-year-old chronic alcoholic presents with hematemesis. Endoscopy reveals dilated subepithelial veins in the lower third of the esophagus. What is the primary cause of this condition?",
      options: ["Hepatic vein thrombosis", "Portal hypertension", "Right-sided heart failure", "Gastric ulcer disease"],
      correct_option: 1,
      marks: 1
    },
    // Part 2 Section A
    {
      id: "q-11",
      exam_id: "exam-1-id",
      part_number: 2,
      section_idx: 0,
      seq_in_section: 1,
      question_text: "A 30-year-old male is suspected of having tuberculosis. A sputum sample is stained with Ziehl-Neelsen stain. Which cell wall component of Mycobacterium tuberculosis is responsible for its acid-fast nature?",
      options: ["Peptidoglycan", "Mycolic acid", "Teichoic acid", "Lipopolysaccharide"],
      correct_option: 1,
      marks: 1
    },
    {
      id: "q-12",
      exam_id: "exam-1-id",
      part_number: 2,
      section_idx: 0,
      seq_in_section: 2,
      question_text: "A researcher is studying the mechanism of action of a new antibiotic that inhibits bacterial protein synthesis by binding to the 50S ribosomal subunit. Which of the following standard antibiotics shares this mechanism?",
      options: ["Gentamicin", "Tetracycline", "Erythromycin", "Penicillin"],
      correct_option: 2,
      marks: 1
    },
    {
      id: "q-13",
      exam_id: "exam-1-id",
      part_number: 2,
      section_idx: 0,
      seq_in_section: 3,
      question_text: "An autopsy of a patient who died of rheumatic heart disease shows microscopic nodules in the myocardium consisting of focus of fibrinoid necrosis surrounded by lymphocytes, plasma cells, and large mononuclear cells with owl-eye nucleoli. What are these cells called?",
      options: ["Aschoff cells", "Anitschkow cells", "Reed-Sternberg cells", "Langhans giant cells"],
      correct_option: 1,
      marks: 1
    },
    {
      id: "q-14",
      exam_id: "exam-1-id",
      part_number: 2,
      section_idx: 0,
      seq_in_section: 4,
      question_text: "Which of the following cranial nerves is responsible for the sensory innervation of the face and the motor innervation of the muscles of mastication?",
      options: ["CN VII (Facial)", "CN V (Trigeminal)", "CN IX (Glossopharyngeal)", "CN X (Vagus)"],
      correct_option: 1,
      marks: 1
    },
    {
      id: "q-15",
      exam_id: "exam-1-id",
      part_number: 2,
      section_idx: 0,
      seq_in_section: 5,
      question_text: "During nerve conduction studies, which of the following ions is primarily responsible for the rapid depolarization phase of the action potential?",
      options: ["Potassium (K+)", "Sodium (Na+)", "Calcium (Ca2+)", "Chloride (Cl-)"],
      correct_option: 1,
      marks: 1
    }
  ],
  attempts: [],
  responses: []
};

// Initialize DB in localStorage if not exists
function getDB() {
  const data = localStorage.getItem(MOCK_DB_KEY);
  if (!data) {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(defaultDB));
    return defaultDB;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return defaultDB;
  }
}

function saveDB(db) {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
}

// Session state management
let activeSession = null;
try {
  const sess = localStorage.getItem(MOCK_SESSION_KEY);
  if (sess) {
    activeSession = JSON.parse(sess);
  }
} catch (e) {}

let authListeners = [];

const notifyAuthListeners = () => {
  authListeners.forEach(listener => listener("SIGNED_IN", activeSession));
};

function getUserId() {
  return activeSession?.user?.id || null;
}

// Query builder helper
class SupabaseQueryBuilder {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.orderOpts = null;
    this.isSingle = false;
    this.isMaybeSingle = false;
    this.isInsert = false;
    this.isUpdate = false;
    this.isDelete = false;
    this.payload = null;
  }
  select(columns) {
    // Standard select doesn't do write ops
    return this;
  }
  insert(payload) {
    this.isInsert = true;
    this.payload = payload;
    return this;
  }
  update(payload) {
    this.isUpdate = true;
    this.payload = payload;
    return this;
  }
  delete() {
    this.isDelete = true;
    return this;
  }
  eq(col, val) {
    this.filters.push((item) => item[col] === val);
    return this;
  }
  order(col, opts) {
    this.orderOpts = { col, ...opts };
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }
  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }
  // Implement thenable interface so it can be awaited directly
  then(onfulfilled, onrejected) {
    return this.execute().then(onfulfilled, onrejected);
  }
  async execute() {
    const db = getDB();
    
    if (this.isInsert) {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const newRows = rows.map(r => ({ id: crypto.randomUUID(), ...r }));
      db[this.table] = [...(db[this.table] || []), ...newRows];
      saveDB(db);
      
      const resultData = Array.isArray(this.payload) ? newRows : newRows[0];
      if (this.isSingle) {
        return { data: newRows[0], error: null };
      }
      return { data: resultData, error: null };
    }
    
    if (this.isUpdate) {
      let updatedRows = [];
      db[this.table] = (db[this.table] || []).map(row => {
        let match = true;
        for (const filter of this.filters) {
          if (!filter(row)) {
            match = false;
            break;
          }
        }
        if (match) {
          const updated = { ...row, ...this.payload };
          updatedRows.push(updated);
          return updated;
        }
        return row;
      });
      saveDB(db);
      return { data: updatedRows, error: null };
    }
    
    if (this.isDelete) {
      db[this.table] = (db[this.table] || []).filter(row => {
        let match = true;
        for (const filter of this.filters) {
          if (!filter(row)) {
            match = false;
            break;
          }
        }
        return !match;
      });
      saveDB(db);
      return { error: null };
    }
    
    // Default: select
    let data = db[this.table] || [];

    // Filter by criteria
    for (const filter of this.filters) {
      data = data.filter(filter);
    }

    // Handle questions_public projection/view logic
    if (this.table === "questions_public") {
      const uid = getUserId();
      const isAdmin = db.profiles?.find(p => p.id === uid)?.is_admin;
      if (!isAdmin) {
        // Candidates only see questions if they have an active section in attempts
        data = db.questions.filter(q => {
          const attempt = db.attempts?.find(a => 
            a.user_id === uid && 
            a.exam_id === q.exam_id && 
            a.part_number === q.part_number && 
            a.status === "in_progress" && 
            a.current_section_idx === q.section_idx
          );
          return !!attempt;
        }).map(q => {
          // Remove correct_option for security/cheating prevention
          const { correct_option, ...publicQ } = q;
          return publicQ;
        });

        // Re-apply filters on public list
        for (const filter of this.filters) {
          data = data.filter(filter);
        }
      } else {
        // Admin gets correct_option too or standard questions
        data = db.questions;
        for (const filter of this.filters) {
          data = data.filter(filter);
        }
      }
    }

    if (this.orderOpts) {
      const { col, ascending } = this.orderOpts;
      data = [...data].sort((a, b) => {
        if (a[col] < b[col]) return ascending ? -1 : 1;
        if (a[col] > b[col]) return ascending ? 1 : -1;
        return 0;
      });
    }

    if (this.isSingle) {
      if (data.length === 0) return { data: null, error: new Error("Row not found") };
      return { data: data[0], error: null };
    }
    if (this.isMaybeSingle) {
      return { data: data[0] || null, error: null };
    }
    return { data, error: null };
  }
}

// RPC functions mirroring Supabase PL/pgSQL
const rpcHandlers = {
  start_or_get_attempt: async ({ p_exam_id, p_part_number }) => {
    const db = getDB();
    const uid = getUserId();
    if (!uid) throw new Error("Unauthorized");

    const exam = db.exams.find(e => e.id === p_exam_id && e.status === "active");
    if (!exam) throw new Error("Exam not found or not active");

    const part = db.exam_parts.find(p => p.exam_id === p_exam_id && p.part_number === p_part_number);
    if (!part) throw new Error("Part not found");

    if (exam.parts_sequential && p_part_number > 1) {
      const prevAttempt = db.attempts.find(a => a.user_id === uid && a.exam_id === p_exam_id && a.part_number === p_part_number - 1);
      if (!prevAttempt || prevAttempt.status !== "completed") {
        throw new Error(`Part ${p_part_number} is locked until Part ${p_part_number - 1} is completed`);
      }
    }

    let attempt = db.attempts.find(a => a.user_id === uid && a.exam_id === p_exam_id && a.part_number === p_part_number);
    if (attempt) {
      return await rpcHandlers.reconcile_attempt({ p_attempt_id: attempt.id });
    }

    // Build sections status
    const nowTs = new Date().toISOString();
    const sections = part.sections.map((sec, idx) => {
      if (idx === 0) {
        return {
          ...sec,
          status: "active",
          start_at: nowTs,
          end_at: new Date(Date.now() + sec.duration_seconds * 1000).toISOString()
        };
      }
      return {
        ...sec,
        status: "pending",
        start_at: null,
        end_at: null
      };
    });

    const newAttempt = {
      id: crypto.randomUUID(),
      user_id: uid,
      exam_id: p_exam_id,
      part_number: p_part_number,
      status: "in_progress",
      current_section_idx: 0,
      sections,
      completed_at: null,
      created_at: nowTs
    };

    db.attempts.push(newAttempt);
    saveDB(db);
    return newAttempt;
  },

  reconcile_attempt: async ({ p_attempt_id }) => {
    const db = getDB();
    const uid = getUserId();
    const attemptIdx = db.attempts.findIndex(a => a.id === p_attempt_id && a.user_id === uid);
    if (attemptIdx === -1) throw new Error("Attempt not found");

    let attempt = db.attempts[attemptIdx];
    let changed = false;

    while (attempt.status === "in_progress") {
      const idx = attempt.current_section_idx;
      const sec = attempt.sections[idx];
      const endAt = new Date(sec.end_at).getTime();
      const now = Date.now();

      if (now < endAt) break;

      // Section has ended
      sec.status = "completed";
      changed = true;

      if (idx + 1 < attempt.sections.length) {
        const nextSec = attempt.sections[idx + 1];
        nextSec.status = "active";
        nextSec.start_at = sec.end_at;
        nextSec.end_at = new Date(new Date(sec.end_at).getTime() + nextSec.duration_seconds * 1000).toISOString();
        attempt.current_section_idx = idx + 1;
      } else {
        attempt.status = "completed";
        attempt.completed_at = sec.end_at;
      }
    }

    if (changed) {
      db.attempts[attemptIdx] = attempt;
      saveDB(db);
    }
    return attempt;
  },

  submit_answer: async ({ p_attempt_id, p_question_id, p_option }) => {
    const db = getDB();
    const uid = getUserId();
    const attempt = await rpcHandlers.reconcile_attempt({ p_attempt_id });
    if (attempt.status !== "in_progress") throw new Error("Attempt is completed");

    const q = db.questions.find(x => x.id === p_question_id);
    if (!q) throw new Error("Unknown question");

    if (q.section_idx !== attempt.current_section_idx) throw new Error("Question not in active section");

    const sec = attempt.sections[attempt.current_section_idx];
    if (sec.status !== "active" || Date.now() >= new Date(sec.end_at).getTime()) {
      throw new Error("Section is locked");
    }

    const respIdx = db.responses.findIndex(r => r.attempt_id === p_attempt_id && r.question_id === p_question_id);
    const nowTs = new Date().toISOString();
    if (respIdx !== -1) {
      db.responses[respIdx].selected_option = p_option;
      db.responses[respIdx].answered_at = nowTs;
    } else {
      db.responses.push({
        attempt_id: p_attempt_id,
        question_id: p_question_id,
        selected_option: p_option,
        flagged: false,
        answered_at: nowTs
      });
    }
    saveDB(db);
  },

  clear_answer: async ({ p_attempt_id, p_question_id }) => {
    const db = getDB();
    const respIdx = db.responses.findIndex(r => r.attempt_id === p_attempt_id && r.question_id === p_question_id);
    if (respIdx !== -1) {
      db.responses[respIdx].selected_option = null;
      saveDB(db);
    }
  },

  toggle_flag: async ({ p_attempt_id, p_question_id }) => {
    const db = getDB();
    const respIdx = db.responses.findIndex(r => r.attempt_id === p_attempt_id && r.question_id === p_question_id);
    if (respIdx !== -1) {
      db.responses[respIdx].flagged = !db.responses[respIdx].flagged;
    } else {
      db.responses.push({
        attempt_id: p_attempt_id,
        question_id: p_question_id,
        selected_option: null,
        flagged: true,
        answered_at: new Date().toISOString()
      });
    }
    saveDB(db);
  },

  get_my_scorecard: async ({ p_exam_id }) => {
    const db = getDB();
    const uid = getUserId();
    if (!uid) return [];

    const parts = db.exam_parts.filter(p => p.exam_id === p_exam_id).sort((a, b) => a.part_number - b.part_number);
    const attempts = db.attempts.filter(a => a.user_id === uid && a.exam_id === p_exam_id);

    const allDone = parts.length > 0 && parts.every(p => {
      const att = attempts.find(a => a.part_number === p.part_number);
      return att && att.status === "completed";
    });

    return parts.map(p => {
      const att = attempts.find(a => a.part_number === p.part_number);
      let correct = null;
      let total = null;

      if (allDone && att) {
        const attResponses = db.responses.filter(r => r.attempt_id === att.id);
        correct = 0;
        total = 0;
        attResponses.forEach(r => {
          const q = db.questions.find(qItem => qItem.id === r.question_id);
          if (q) {
            total++;
            if (r.selected_option === q.correct_option) {
              correct++;
            }
          }
        });
      }

      return {
        part_number: p.part_number,
        part_label: p.label,
        status: att ? att.status : "not_started",
        correct,
        total,
        all_complete: allDone
      };
    });
  },

  get_admin_scorecard: async ({ p_exam_id }) => {
    const db = getDB();
    const uid = getUserId();
    const userProfile = db.profiles.find(p => p.id === uid);
    if (!userProfile || !userProfile.is_admin) throw new Error("Unauthorized");

    const parts = db.exam_parts.filter(p => p.exam_id === p_exam_id).sort((a, b) => a.part_number - b.part_number);
    const scorecards = [];

    db.profiles.forEach(p => {
      const pAttempts = db.attempts.filter(a => a.user_id === p.id && a.exam_id === p_exam_id);
      const allDone = parts.length > 0 && parts.every(ep => {
        const att = pAttempts.find(a => a.part_number === ep.part_number);
        return att && att.status === "completed";
      });

      parts.forEach(ep => {
        const att = pAttempts.find(a => a.part_number === ep.part_number);
        let correct = null;
        let total = null;

        if (allDone && att) {
          const attResponses = db.responses.filter(r => r.attempt_id === att.id);
          correct = 0;
          total = 0;
          attResponses.forEach(r => {
            const q = db.questions.find(qItem => qItem.id === r.question_id);
            if (q) {
              total++;
              if (r.selected_option === q.correct_option) {
                correct++;
              }
            }
          });
        }

        scorecards.push({
          user_id: p.id,
          email: p.email,
          name: p.name,
          college: p.college,
          phone: p.country_dial + p.phone,
          part_number: ep.part_number,
          part_label: ep.label,
          status: att ? att.status : "not_started",
          correct,
          total,
          all_complete: allDone
        });
      });
    });

    return scorecards;
  }
};

// Exported client
export const supabase = {
  auth: {
    async getSession() {
      return { data: { session: activeSession }, error: null };
    },
    onAuthStateChange(callback) {
      authListeners.push(callback);
      // Immediately call with current state
      setTimeout(() => callback("SIGNED_IN", activeSession), 0);
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners = authListeners.filter(l => l !== callback);
            }
          }
        }
      };
    },
    async signInWithOtp({ email, options }) {
      // Mock OTP sign in
      return { data: {}, error: null };
    },
    async verifyOtp({ email, token, type }) {
      if (token === "123123") {
        const db = getDB();
        let userProfile = db.profiles.find(p => p.email === email);
        let userId = userProfile ? userProfile.id : crypto.randomUUID();
        
        activeSession = {
          user: {
            id: userId,
            email: email
          },
          access_token: "mock-valid-jwt"
        };
        localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(activeSession));
        notifyAuthListeners();
        return { data: { session: activeSession }, error: null };
      }
      return { data: null, error: { message: "Invalid verification code" } };
    },
    async signOut() {
      activeSession = null;
      localStorage.removeItem(MOCK_SESSION_KEY);
      notifyAuthListeners();
      return { error: null };
    }
  },

  from(table) {
    return new SupabaseQueryBuilder(table);
  },

  async rpc(funcName, params) {
    if (rpcHandlers[funcName]) {
      try {
        const data = await rpcHandlers[funcName](params);
        return { data, error: null };
      } catch (e) {
        return { data: null, error: e };
      }
    }
    return { data: null, error: new Error(`RPC function ${funcName} not found`) };
  },

  storage: {
    from(bucket) {
      return {
        async createSignedUrl(path, expiry) {
          // If a placeholder path is used, return it directly
          return { data: { signedUrl: path }, error: null };
        }
      };
    }
  }
};
