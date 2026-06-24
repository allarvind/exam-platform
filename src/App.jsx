import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import "./styles/global.css";

import { LoginScreen, OtpScreen, ProfileScreen } from "./components/auth/AuthScreens";
import CandidateDashboard from "./components/candidate/CandidateDashboard";
import ExamScreen         from "./components/candidate/ExamScreen";
import ResultScreen       from "./components/candidate/ResultScreen";
import AdminDashboard     from "./components/admin/AdminDashboard";
import ExamBuilder        from "./components/admin/ExamBuilder";
import QuestionManager    from "./components/admin/QuestionManager";
import ResultsViewer      from "./components/admin/ResultsViewer";

export default function App() {
  const [booted,  setBooted]  = useState(false);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);

  // auth
  const [screen,     setScreen]     = useState("login");
  const [email,      setEmail]      = useState("");
  const [otpInput,   setOtpInput]   = useState("");
  const [otpError,   setOtpError]   = useState("");
  const [otpCode,    setOtpCode]    = useState(""); // demo-only: show code on screen
  const [cooldown,   setCooldown]   = useState(0);

  // candidate state
  const [exams,          setExams]          = useState([]);
  const [attemptsByExam, setAttemptsByExam] = useState({});
  const [scoresByExam,   setScoresByExam]   = useState({});
  const [testDuration,   setTestDuration]   = useState(60);
  const [activeExamId,   setActiveExamId]   = useState(null);
  const [activePartNum,  setActivePartNum]  = useState(null);
  const [activeQuestions,setActiveQ]        = useState([]);
  const [activeResponses,setActiveR]        = useState({});
  const [allExamParts,   setAllExamParts]   = useState({});

  // admin state
  const [adminExams,    setAdminExams]    = useState([]);
  const [editingExam,   setEditingExam]   = useState(null);
  const [questionsExam, setQuestionsExam] = useState(null);
  const [resultsExam,   setResultsExam]   = useState(null);

  const [toast,   setToast]   = useState("");
  const toastRef  = useRef(null);

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 3500);
  }

  // ── bootstrap ─────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setBooted(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      setProfile(data || null);
      setScreen(data ? "dashboard" : "profile");
      setBooted(true);
    })();
  }, [session]);

  // ── cooldown tick ──────────────────────────────────────────────
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // ── load candidate data when dashboard opens ───────────────────
  useEffect(() => {
    if (screen !== "dashboard" || !session) return;
    loadExams();
  }, [screen, session]); // eslint-disable-line

  // ── reconcile active exam every 3s ────────────────────────────
  useEffect(() => {
    if (screen !== "exam" || !activeExamId || !activePartNum) return;
    const attempt = (attemptsByExam[activeExamId] || {})[activePartNum];
    if (!attempt) return;
    const id = setInterval(async () => {
      const { data } = await supabase.rpc("reconcile_attempt", { p_attempt_id: attempt.id });
      if (data) {
        setAttemptsByExam((prev) => ({
          ...prev,
          [activeExamId]: { ...(prev[activeExamId] || {}), [activePartNum]: data },
        }));
        if (data.status === "completed") {
          await loadScorecard(activeExamId);
          setScreen("result");
        }
      }
    }, 3000);
    return () => clearInterval(id);
  }, [screen, activeExamId, activePartNum, attemptsByExam]); // eslint-disable-line

  // ── refetch questions when section advances ────────────────────
  const prevSectionKey = useRef(null);
  useEffect(() => {
    if (screen !== "exam" || !activeExamId || !activePartNum) return;
    const attempt = (attemptsByExam[activeExamId] || {})[activePartNum];
    if (!attempt) return;
    const key = `${activeExamId}:${activePartNum}:${attempt.current_section_idx}`;
    if (prevSectionKey.current === key) return;
    prevSectionKey.current = key;
    loadQuestions(activeExamId, activePartNum, attempt.current_section_idx);
  }, [screen, activeExamId, activePartNum, attemptsByExam]); // eslint-disable-line

  // ── data loaders ───────────────────────────────────────────────
  async function loadExams() {
    const { data: examData } = await supabase.from("exams").select("*").eq("status", "active");
    if (!examData) return;

    const partsMap = {};
    for (const ex of examData) {
      const { data: parts } = await supabase.from("exam_parts").select("*")
        .eq("exam_id", ex.id).order("part_number");
      partsMap[ex.id] = parts || [];
    }
    setAllExamParts(partsMap);
    const enriched = examData.map((ex) => ({ ...ex, parts: partsMap[ex.id] || [] }));
    setExams(enriched);

    const attMap = {};
    for (const ex of examData) {
      const { data: atts } = await supabase.from("attempts").select("*")
        .eq("exam_id", ex.id).eq("user_id", session.user.id);
      const byPart = {};
      (atts || []).forEach((a) => { byPart[a.part_number] = a; });
      attMap[ex.id] = byPart;
    }
    setAttemptsByExam(attMap);

    const scMap = {};
    for (const ex of examData) {
      await loadScorecard(ex.id, scMap);
    }
    setScoresByExam(scMap);
  }

  async function loadScorecard(examId, mapRef) {
    const { data } = await supabase.rpc("get_my_scorecard", { p_exam_id: examId });
    const update = mapRef || {};
    update[examId] = data || [];
    if (!mapRef) setScoresByExam((prev) => ({ ...prev, [examId]: data || [] }));
    return update;
  }

  async function loadQuestions(examId, partNum, sectionIdx) {
    const { data } = await supabase.from("questions_public").select("*")
      .eq("exam_id", examId).eq("part_number", partNum).eq("section_idx", sectionIdx)
      .order("seq_in_section");
    setActiveQ(data || []);
  }

  async function loadResponses(attemptId) {
    const { data } = await supabase.from("responses").select("*").eq("attempt_id", attemptId);
    const map = {};
    (data || []).forEach((r) => { map[r.question_id] = { selected: r.selected_option, flagged: r.flagged }; });
    setActiveR(map);
  }

  async function loadAdminExams() {
    const { data: examData } = await supabase.from("exams").select("*").order("created_at", { ascending: false });
    if (!examData) return;
    const partsMap = {};
    for (const ex of examData) {
      const { data: parts } = await supabase.from("exam_parts").select("*").eq("exam_id", ex.id).order("part_number");
      partsMap[ex.id] = parts || [];
    }
    setAdminExams(examData.map((ex) => ({ ...ex, parts: partsMap[ex.id] || [] })));
  }

  // ── auth ────────────────────────────────────────────────────────
  function sendOtp() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showToast("Enter a valid email"); return; }
    // PRODUCTION: remove the demo code and use real supabase OTP
    const demoCode = "123123";
    setOtpCode(demoCode);
    // Real: supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    setOtpInput(""); setOtpError(""); setCooldown(30); setScreen("otp");
    showToast(`Demo — OTP is ${demoCode}`);
  }

  function verifyOtp() {
    // PRODUCTION: use supabase.auth.verifyOtp({ email, token: otpInput, type: "email" })
    if (otpInput === "123123") {
      // Fake a session for demo purposes — production uses real Supabase auth
      supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
        .then(() => supabase.auth.verifyOtp({ email, token: otpInput, type: "email" })
          .then(({ data, error }) => {
            if (error) setOtpError(error.message);
            else setSession(data.session);
          })
        ).catch(() => setOtpError("Verification failed."));
    } else {
      setOtpError("Incorrect code.");
    }
  }

  async function saveProfile(fields) {
    const { error } = await supabase.from("profiles").insert({
      id: session.user.id, email: session.user.email,
      name: fields.name, country_dial: fields.countryDial, phone: fields.phone,
      college: fields.college, graduation_year: Number(fields.graduationYear),
      attempt_number: Number(fields.attemptNumber), state: fields.state,
    });
    if (error) { showToast(error.message); return; }
    setProfile({ ...fields, id: session.user.id, email: session.user.email, is_admin: false });
    setScreen("dashboard");
  }

  // ── candidate actions ──────────────────────────────────────────
  async function startAttempt(examId, partNum, durSec) {
    const { data, error } = await supabase.rpc("start_or_get_attempt", {
      p_exam_id: examId, p_part_number: partNum,
    });
    // Note: test duration override is a frontend-only tool — production
    // removes this and uses the configured duration from exam_parts.sections.
    // To use it in testing, you'd need a separate dev function.
    if (error) { showToast(error.message); return; }
    setAttemptsByExam((prev) => ({
      ...prev,
      [examId]: { ...(prev[examId] || {}), [partNum]: data },
    }));
    await loadResponses(data.id);
    setActiveExamId(examId); setActivePartNum(partNum);
    setScreen("exam");
  }

  async function resumeAttempt(examId, partNum) {
    const attempt = (attemptsByExam[examId] || {})[partNum];
    if (!attempt) return;
    const { data } = await supabase.rpc("reconcile_attempt", { p_attempt_id: attempt.id });
    if (data) setAttemptsByExam((prev) => ({
      ...prev, [examId]: { ...(prev[examId] || {}), [partNum]: data },
    }));
    await loadResponses(attempt.id);
    setActiveExamId(examId); setActivePartNum(partNum);
    setScreen("exam");
  }

  async function answerQuestion(questionId, optionIdx) {
    const attempt = (attemptsByExam[activeExamId] || {})[activePartNum];
    if (!attempt) return;
    const { error } = await supabase.rpc("submit_answer", {
      p_attempt_id: attempt.id, p_question_id: questionId, p_option: optionIdx,
    });
    if (error) { showToast(error.message); return; }
    setActiveR((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), selected: optionIdx } }));
  }

  async function clearAnswer(questionId) {
    const attempt = (attemptsByExam[activeExamId] || {})[activePartNum];
    if (!attempt) return;
    await supabase.rpc("clear_answer", { p_attempt_id: attempt.id, p_question_id: questionId });
    setActiveR((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), selected: null } }));
  }

  async function toggleFlag(questionId) {
    const attempt = (attemptsByExam[activeExamId] || {})[activePartNum];
    if (!attempt) return;
    const cur = !!activeResponses[questionId]?.flagged;
    await supabase.rpc("toggle_flag", { p_attempt_id: attempt.id, p_question_id: questionId });
    setActiveR((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] || {}), flagged: !cur } }));
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null); setProfile(null); setScreen("login");
  }

  // ── render ─────────────────────────────────────────────────────
  if (!booted) return <div className="center"><p className="hint">Loading…</p></div>;

  const activeAttempt = activeExamId && activePartNum
    ? (attemptsByExam[activeExamId] || {})[activePartNum] : null;
  const activeExam    = exams.find((e) => e.id === activeExamId);
  const activePart    = (activeExam?.parts || []).find((p) => p.part_number === activePartNum);

  return (
    <>
      {toast && <div className="toast">{toast}</div>}

      {screen === "login"  && <LoginScreen email={email} setEmail={setEmail} onSend={sendOtp} />}
      {screen === "otp"    && (
        <OtpScreen email={email} code={otpCode} otpInput={otpInput} setOtpInput={setOtpInput}
          error={otpError} onVerify={verifyOtp}
          onResend={sendOtp} cooldown={cooldown} onBack={() => setScreen("login")} />
      )}
      {screen === "profile" && <ProfileScreen onSave={saveProfile} />}

      {screen === "dashboard" && (
        <CandidateDashboard
          profile={profile}
          exams={exams}
          attemptsByExam={attemptsByExam}
          scorecardsByExam={scoresByExam}
          testDuration={testDuration}
          setTestDuration={setTestDuration}
          onStart={startAttempt}
          onResume={resumeAttempt}
          onViewResult={(examId) => { setActiveExamId(examId); setScreen("result"); }}
          onLogout={logout}
          onOpenAdmin={() => { loadAdminExams(); setScreen("admin"); }}
        />
      )}

      {screen === "exam" && activeAttempt && activePart && (
        <ExamScreen
          attempt={activeAttempt}
          questions={activeQuestions}
          responses={activeResponses}
          part={activePart}
          examTitle={activeExam?.title || ""}
          onAnswer={answerQuestion}
          onClear={clearAnswer}
          onToggleFlag={toggleFlag}
          onBack={() => setScreen("dashboard")}
        />
      )}

      {screen === "result" && (
        <ResultScreen
          examTitle={activeExam?.title || exams.find((e) => e.id === activeExamId)?.title || ""}
          scorecard={scoresByExam[activeExamId] || []}
          onBack={() => setScreen("dashboard")}
        />
      )}

      {screen === "admin" && !editingExam && !questionsExam && !resultsExam && (
        <AdminDashboard
          exams={adminExams}
          onNew={() => setEditingExam({})}
          onEdit={(exam) => setEditingExam(exam)}
          onQuestions={(exam) => setQuestionsExam(exam)}
          onResults={(exam) => setResultsExam(exam)}
          onBack={() => setScreen("dashboard")}
        />
      )}

      {screen === "admin" && editingExam !== null && (
        <ExamBuilder
          exam={editingExam && editingExam.id ? editingExam : null}
          onSave={() => { setEditingExam(null); loadAdminExams(); }}
          onBack={() => setEditingExam(null)}
        />
      )}

      {screen === "admin" && questionsExam && (
        <QuestionManager exam={questionsExam} onBack={() => setQuestionsExam(null)} />
      )}

      {screen === "admin" && resultsExam && (
        <ResultsViewer exam={resultsExam} onBack={() => setResultsExam(null)} />
      )}
    </>
  );
}
