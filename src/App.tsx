import { useCallback, useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import AuthPage, { getCurrentUser, logoutUser, saveSession } from "./AuthPage";
import type { User } from "./AuthPage";
import Dashboard from "./Dashboard";

type Category = "hr" | "tech" | "data";

const CATEGORY_META: Record<Category, { label: string; emoji: string; color: string; desc: string }> = {
  hr:   { label: "HR Round",      emoji: "🤝", color: "#10b981", desc: "Behavioural, culture fit, soft skills" },
  tech: { label: "Technical",     emoji: "💻", color: "#6366f1", desc: "DSA, system design, coding concepts" },
  data: { label: "Data/Analytics",emoji: "📊", color: "#f59e0b", desc: "SQL, statistics, ML, data thinking" },
};

const QUESTIONS: Record<Category, string[]> = {
  hr: [
    "Tell me about yourself and your background.",
    "Why should we hire you for this position?",
    "What are your greatest professional strengths?",
    "Where do you see yourself in 5 years?",
    "How do you handle pressure or stressful situations?",
    "Describe a challenge you faced and how you overcame it.",
    "What motivates you to perform your best at work?",
    "What is your biggest weakness and how are you working on it?",
  ],
  tech: [
    "Explain the difference between a stack and a queue with real-world examples.",
    "How would you design a URL shortening service like bit.ly?",
    "What is the difference between REST and GraphQL?",
    "Explain how garbage collection works in your preferred language.",
    "How do you ensure code quality in a team environment?",
    "What is a race condition and how do you prevent it?",
    "Describe the CAP theorem and when you would trade consistency for availability.",
    "Walk me through how you would debug a production performance issue.",
  ],
  data: [
    "Explain the difference between supervised and unsupervised learning.",
    "How would you handle missing values in a large dataset?",
    "Write a SQL query to find the second highest salary from an employees table.",
    "What is the bias-variance tradeoff and why does it matter?",
    "How would you design an A/B test for a new product feature?",
    "Explain overfitting and the techniques you use to prevent it.",
    "How do you communicate a complex data insight to a non-technical stakeholder?",
    "Describe a data project you have worked on and the impact it had.",
  ],
};

const EMOTION_META: Record<string, { emoji: string; color: string; score: number; tip: string }> = {
  happy:    { emoji: "😊", color: "#10b981", score: 100, tip: "Excellent! You look confident and warm." },
  neutral:  { emoji: "😐", color: "#6366f1", score: 75,  tip: "Good composure. Try smiling slightly more." },
  surprised:{ emoji: "😲", color: "#f59e0b", score: 55,  tip: "Stay composed, avoid showing shock." },
  sad:      { emoji: "😢", color: "#60a5fa", score: 40,  tip: "Lift your energy, take a deep breath!" },
  fearful:  { emoji: "😨", color: "#fb923c", score: 35,  tip: "You seem nervous. Relax your shoulders." },
  disgusted:{ emoji: "🤢", color: "#a78bfa", score: 30,  tip: "Keep a neutral or positive expression." },
  angry:    { emoji: "😠", color: "#ef4444", score: 20,  tip: "Relax your face, you may seem aggressive." },
};

type Phase = "dashboard" | "welcome" | "category" | "interview" | "result";
type EmotionLog = { emotion: string; confidence: number; questionIndex: number };
type AnswerLog = { question: string; transcript: string; aiScore: number; aiFeedback: string; emotion: string; confidence: number };

const scoreAnswerWithAI = async (question: string, answer: string, category: Category): Promise<{ score: number; feedback: string }> => {
  if (!answer || answer.trim().length < 5) return { score: 0, feedback: "No answer was recorded." };
  const fallback = answer.trim().length > 30
    ? { score: 65, feedback: "Good attempt. Add more structure and detail to improve your answer." }
    : { score: 45, feedback: "Try giving a longer and more specific response next time." };
  try {
    const context = category === "tech" ? "a technical software engineering interview" : category === "data" ? "a data science and analytics interview" : "an HR behavioural interview";
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 150,
        messages: [{ role: "user", content: "You are an expert interview coach for " + context + ". Question: \"" + question + "\" Answer: \"" + answer + "\". Score 0-100 on relevance, clarity, depth, and confidence. Respond ONLY valid JSON like {\"score\": 78, \"feedback\": \"Two short sentences.\"}" }],
      }),
    });
    clearTimeout(timeoutId);
    if (!response.ok) return fallback;
    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";
    if (!text) return fallback;
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return { score: typeof parsed.score === "number" ? parsed.score : fallback.score, feedback: typeof parsed.feedback === "string" ? parsed.feedback : fallback.feedback };
  } catch { return fallback; }
};

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const detectionRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const qIndexRef = useRef(0);
  const answerLogRef = useRef<AnswerLog[]>([]);
  const emotionLogRef = useRef<EmotionLog[]>([]);
  const transcriptRef = useRef("");
  const emotionRef = useRef("neutral");
  const confidenceRef = useRef(0);
  const categoryRef = useRef<Category>("hr");
  const userRef = useRef<User | null>(null);
  const submittingRef = useRef(false);
  const phaseRef = useRef<Phase>("dashboard");

  const [user, setUser] = useState<User | null>(() => getCurrentUser());
  const [phase, setPhase] = useState<Phase>("dashboard");
  const [category, setCategory] = useState<Category>("hr");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [emotion, setEmotion] = useState("neutral");
  const [confidence, setConfidence] = useState(0);
  const [allEmotions, setAllEmotions] = useState<Record<string, number>>({});
  const [qIndex, setQIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [emotionLog, setEmotionLog] = useState<EmotionLog[]>([]);
  const [answerLog, setAnswerLog] = useState<AnswerLog[]>([]);
  const [timer, setTimer] = useState(60);
  const [isScoringAI, setIsScoringAI] = useState(false);

  useEffect(() => { qIndexRef.current = qIndex; }, [qIndex]);
  useEffect(() => { answerLogRef.current = answerLog; }, [answerLog]);
  useEffect(() => { emotionLogRef.current = emotionLog; }, [emotionLog]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { emotionRef.current = emotion; }, [emotion]);
  useEffect(() => { confidenceRef.current = confidence; }, [confidence]);
  useEffect(() => { categoryRef.current = category; }, [category]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    void startCamera(); void loadModels(); setupMic();
    return () => {
      if (detectionRef.current) clearInterval(detectionRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      recognitionRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => { if (streamRef.current && videoRef.current) videoRef.current.srcObject = streamRef.current; }, [phase]);
  useEffect(() => { if (phase !== "interview") stopTimer(); }, [phase]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) { console.error("Camera error", e); }
  };

  const loadModels = async () => {
    try {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
      await faceapi.nets.faceExpressionNet.loadFromUri("/models");
      setModelsLoaded(true); startDetection();
    } catch (e) { console.error("Model loading error", e); }
  };

  const startDetection = () => {
    if (detectionRef.current) clearInterval(detectionRef.current);
    detectionRef.current = setInterval(async () => {
      if (!videoRef.current) return;
      try {
        const d = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        if (d.length > 0) {
          const exp = d[0].expressions as unknown as Record<string, number>;
          setAllEmotions(exp);
          const top = Object.keys(exp).reduce((a, b) => exp[a] > exp[b] ? a : b);
          setEmotion(top); setConfidence(Math.round(exp[top] * 100));
        }
      } catch (e) { console.error("Detection error", e); }
    }, 1200);
  };

  const setupMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR(); r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => { let t = ""; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; setTranscript(t); transcriptRef.current = t; };
    r.onend = () => setIsListening(false);
    recognitionRef.current = r;
  };

  const toggleMic = () => {
    if (!recognitionRef.current) { alert("Speech recognition not supported."); return; }
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { setTranscript(""); transcriptRef.current = ""; recognitionRef.current.start(); setIsListening(true); }
  };

  const speak = (text: string) => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.92; u.pitch = 1.05; window.speechSynthesis.speak(u); };

  // ── FIX 1: Centralized stopTimer ────────────────────────────
  const stopTimer = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  // ── FIX 2: startTimer correctly triggers saveAndNext ────────
  const startTimer = () => {
    stopTimer();
    setTimer(60);
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          stopTimer();
          if (phaseRef.current === "interview" && !submittingRef.current) void saveAndNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishInterview = (finalAnswers: AnswerLog[], finalEmotions: EmotionLog[]) => {
    stopTimer();
    window.speechSynthesis.cancel();
    if (finalAnswers.length === 0) return;
    const totalEmotion = finalAnswers.reduce((s, a) => s + (EMOTION_META[a.emotion]?.score ?? 50), 0);
    const totalAI = finalAnswers.reduce((s, a) => s + a.aiScore, 0);
    const avgEmotion = Math.round(totalEmotion / finalAnswers.length);
    const avgAI = Math.round(totalAI / finalAnswers.length);
    const avgScore = Math.round((avgEmotion + avgAI) / 2);
    const verdict = avgScore >= 75 ? "hired" : avgScore >= 50 ? "maybe" : "practice";
    const currentUser = userRef.current;
    const currentCategory = categoryRef.current;
    if (currentUser) {
      saveSession(currentUser.email, {
        date: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        score: avgScore, emotionScore: avgEmotion, aiScore: avgAI, verdict,
        questions: finalAnswers.length, emotionLog: finalEmotions, answers: finalAnswers,
        category: CATEGORY_META[currentCategory].label,
      });
      const stored = localStorage.getItem("interviewai_users");
      if (stored) {
        const users = JSON.parse(stored);
        const updated = users[currentUser.email];
        if (updated) setUser({ ...updated });
      }
    }
    phaseRef.current = "result";
    setPhase("result");
  };

  // ── FIX 3: saveAndNext correctly handles Q8 finish ──────────
  const saveAndNext = async () => {
    if (submittingRef.current) return;
    if (phaseRef.current !== "interview") return;
    submittingRef.current = true;
    setIsScoringAI(true);
    stopTimer();
    recognitionRef.current?.stop(); setIsListening(false);

    const currentIndex = qIndexRef.current;
    const currentCategory = categoryRef.current;
    const totalQuestions = QUESTIONS[currentCategory].length;

    let aiScore = 50; let aiFeedback = "Answer recorded.";
    try {
      const res = await scoreAnswerWithAI(QUESTIONS[currentCategory][currentIndex], transcriptRef.current, currentCategory);
      aiScore = res.score; aiFeedback = res.feedback;
    } catch (err) { console.error("AI scoring failed:", err); }

    const answer: AnswerLog = { question: QUESTIONS[currentCategory][currentIndex], transcript: transcriptRef.current, aiScore, aiFeedback, emotion: emotionRef.current, confidence: confidenceRef.current };
    const updatedAnswers = [...answerLogRef.current, answer];
    const updatedEmotions = [...emotionLogRef.current, { emotion: emotionRef.current, confidence: confidenceRef.current, questionIndex: currentIndex }];

    answerLogRef.current = updatedAnswers;
    emotionLogRef.current = updatedEmotions;
    setAnswerLog(updatedAnswers);
    setEmotionLog(updatedEmotions);
    setTranscript(""); transcriptRef.current = "";
    setIsScoringAI(false);
    submittingRef.current = false;

    // ── KEY FIX: Last question goes to result ────────────────
    if (currentIndex >= totalQuestions - 1) {
      finishInterview(updatedAnswers, updatedEmotions);
      return;
    }

    const nextIndex = currentIndex + 1;
    qIndexRef.current = nextIndex;
    setQIndex(nextIndex);
    speak(QUESTIONS[currentCategory][nextIndex]);
    startTimer();
  };

  const startInterview = () => {
    stopTimer(); recognitionRef.current?.stop(); window.speechSynthesis.cancel();
    submittingRef.current = false;
    setAnswerLog([]); answerLogRef.current = [];
    setEmotionLog([]); emotionLogRef.current = [];
    setTranscript(""); transcriptRef.current = "";
    setQIndex(0); qIndexRef.current = 0;
    setTimer(60); setIsListening(false); setIsScoringAI(false);
    phaseRef.current = "interview"; setPhase("interview");
    speak(QUESTIONS[categoryRef.current][0]); startTimer();
  };

  const calcResult = useCallback(() => {
    if (answerLog.length === 0) return { avg: 0, avgEmotion: 0, avgAI: 0, verdict: "incomplete", dominant: "neutral" };
    const totalEmotion = answerLog.reduce((sum, a) => sum + (EMOTION_META[a.emotion]?.score ?? 50), 0);
    const totalAI = answerLog.reduce((sum, a) => sum + a.aiScore, 0);
    const avgEmotion = Math.round(totalEmotion / answerLog.length);
    const avgAI = Math.round(totalAI / answerLog.length);
    const avg = Math.round((avgEmotion + avgAI) / 2);
    const freq: Record<string, number> = {};
    answerLog.forEach(a => { freq[a.emotion] = (freq[a.emotion] ?? 0) + 1; });
    const dominant = Object.keys(freq).reduce((a, b) => freq[a] > freq[b] ? a : b);
    return { avg, avgEmotion, avgAI, verdict: avg >= 75 ? "hired" : avg >= 50 ? "maybe" : "practice", dominant };
  }, [answerLog]);

  const handleLogout = () => { logoutUser(); setUser(null); setPhase("dashboard"); };
  const meta = EMOTION_META[emotion] ?? EMOTION_META.neutral;
  const timerPct = (timer / 60) * 100;
  const timerColor = timer > 30 ? "#10b981" : timer > 10 ? "#f59e0b" : "#ef4444";
  const catMeta = CATEGORY_META[category];
  const questions = QUESTIONS[category];

  if (!user) return <AuthPage onLogin={(u) => { setUser(u); setPhase("dashboard"); }} />;
  if (phase === "dashboard") return <Dashboard user={user} onStartInterview={() => setPhase("welcome")} onLogout={handleLogout} />;

  if (phase === "category") return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 560, padding: "0 20px" }}>
        <button onClick={() => setPhase("welcome")} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", marginBottom: 28, padding: 0 }}>Back</button>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🎯</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#f1f5f9", margin: "0 0 6px" }}>Choose Interview Type</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Each category has 8 tailored questions scored by AI</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
          {(Object.keys(CATEGORY_META) as Category[]).map(cat => {
            const cm = CATEGORY_META[cat]; const selected = category === cat;
            return (
              <button key={cat} onClick={() => setCategory(cat)} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", background: selected ? cm.color + "18" : "#0d1726", border: "2px solid " + (selected ? cm.color : "#1e2d45"), borderRadius: 14, cursor: "pointer", textAlign: "left", width: "100%" }}>
                <span style={{ fontSize: 30 }}>{cm.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: selected ? cm.color : "#f1f5f9", marginBottom: 2 }}>{cm.label}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{cm.desc}</div>
                </div>
                <div style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + (selected ? cm.color : "#1e2d45"), background: selected ? cm.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {selected && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                </div>
              </button>
            );
          })}
        </div>
        <button onClick={startInterview} disabled={!modelsLoaded} style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg," + catMeta.color + "," + catMeta.color + "bb)", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 800, cursor: modelsLoaded ? "pointer" : "not-allowed", opacity: modelsLoaded ? 1 : 0.5 }}>
          {modelsLoaded ? "Start " + catMeta.label + " Interview" : "Loading AI Models..."}
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: "#475569", marginTop: 10 }}>{questions.length} questions · ~10 minutes · camera required</p>
      </div>
    </div>
  );

  if (phase === "welcome") return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", minHeight: "100vh", flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 480px", background: "#0d1726", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 16 }}>
          <div style={{ position: "relative", width: "100%", borderRadius: 16, overflow: "hidden", boxShadow: "0 0 60px rgba(99,102,241,0.3)" }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: "block", transform: "scaleX(-1)" }} />
            {modelsLoaded && <div style={{ position: "absolute", bottom: 12, left: 12, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, color: "#fff", background: meta.color }}>{emotion} {confidence}%</div>}
            {!modelsLoaded && <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 14 }}>Loading AI Models...</div>}
          </div>
          <div style={{ fontSize: 13, color: "#475569", textAlign: "center" }}>Camera preview — make sure you are visible</div>
        </div>
        <div style={{ flex: 1, padding: "50px 50px 50px 40px", display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 320 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <span style={{ fontSize: 22 }}>🧠</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: "#f1f5f9" }}>InterviewAI</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
              <button onClick={() => setPhase("dashboard")} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #1e2d45", borderRadius: 8, color: "#64748b", fontSize: 12, cursor: "pointer" }}>Dashboard</button>
              <button onClick={handleLogout} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #1e2d45", borderRadius: 8, color: "#64748b", fontSize: 12, cursor: "pointer" }}>Logout</button>
            </div>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, lineHeight: 1.1, margin: "0 0 14px", color: "#f1f5f9", letterSpacing: "-1px" }}>Ace Your Next<br /><span style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Interview</span></h1>
          <p style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.7, margin: "0 0 24px", maxWidth: 420 }}>Practice with AI emotion analysis, voice recognition, and get a data-driven performance verdict.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {[["🎯","Emotion Detection","Live face analysis"],["🎤","Voice Recognition","Transcribes answers"],["🤖","AI Answer Scoring","Claude grades answers"],["📈","Analytics","Track progress over time"]].map(([icon, title, desc]) => (
              <div key={String(title)} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#0d1726", padding: "12px 14px", borderRadius: 10, border: "1px solid #1e2d45" }}>
                <span style={{ fontSize: 18 }}>{icon}</span>
                <div><div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9" }}>{title}</div><div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{desc}</div></div>
              </div>
            ))}
          </div>
          {user.sessions && user.sessions.length > 0 && (
            <div style={{ background: "#0d1726", border: "1px solid #1e2d45", borderRadius: 12, padding: "12px 14px", marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", marginBottom: 8 }}>Recent Sessions</div>
              {user.sessions.slice(0, 3).map((s: any, i: number) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #0f172a" }}>
                  <span style={{ fontSize: 11, color: "#475569" }}>{s.date}</span>
                  {s.category && <span style={{ fontSize: 10, color: "#64748b", background: "#1e2d45", padding: "2px 7px", borderRadius: 8 }}>{s.category}</span>}
                  <span style={{ fontSize: 11, fontWeight: 700, color: s.verdict === "hired" ? "#10b981" : s.verdict === "maybe" ? "#f59e0b" : "#ef4444" }}>{s.verdict === "hired" ? "Ready" : s.verdict === "maybe" ? "Improving" : "Practice"}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{s.score}/100</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setPhase("category")} disabled={!modelsLoaded} style={{ padding: "15px 28px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", opacity: modelsLoaded ? 1 : 0.5 }}>
            {modelsLoaded ? "Choose Interview Type" : "Loading AI Models..."}
          </button>
          <p style={{ fontSize: 12, color: "#475569", marginTop: 10 }}>3 categories · 8 questions each · ~10 minutes · camera required</p>
        </div>
      </div>
    </div>
  );

  if (phase === "result") {
    const { avg, avgEmotion, avgAI, verdict, dominant } = calcResult();
    const vm = verdict === "hired"
      ? { title: "You are Ready to Proceed!", sub: "Outstanding! Strong confidence and excellent answers.", color: "#10b981", bg: "#052e16" }
      : verdict === "maybe"
        ? { title: "Good Effort, Keep Practicing!", sub: "You showed potential. Practice more and you will be ready.", color: "#f59e0b", bg: "#1c1002" }
        : { title: "More Practice Needed", sub: "Focus on positive expressions and STAR-structured answers.", color: "#ef4444", bg: "#1c0505" };

    const exportReport = () => {
      const lines = ["INTERVIEWAI SESSION REPORT","Date: " + new Date().toLocaleDateString("en-IN"),"Candidate: " + user.name,"Category: " + CATEGORY_META[category].label,"","=== SCORES ===","Overall: " + avg + "/100","AI Answers: " + avgAI + "/100","Emotion: " + avgEmotion + "/100","Verdict: " + verdict.toUpperCase(),"","=== QUESTION BREAKDOWN ===",
        ...answerLog.map((a, i) => "Q" + (i + 1) + ": " + a.question + "\nAnswer: " + (a.transcript || "None") + "\nAI Score: " + a.aiScore + "/100\nFeedback: " + a.aiFeedback + "\nEmotion: " + a.emotion + " (" + a.confidence + "%)\n")];
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob); const a = document.createElement("a");
      a.href = url; a.download = "interview_report_" + category + ".txt"; a.click(); URL.revokeObjectURL(url);
    };

    const resetToCategory = () => {
      stopTimer(); submittingRef.current = false;
      setAnswerLog([]); answerLogRef.current = [];
      setEmotionLog([]); emotionLogRef.current = [];
      setQIndex(0); qIndexRef.current = 0;
      setTranscript(""); transcriptRef.current = "";
      setTimer(60); setIsScoringAI(false);
      phaseRef.current = "category"; setPhase("category");
    };

    return (
      <div style={{ minHeight: "100vh", background: "#080f1e", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "36px 20px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <span style={{ padding: "5px 14px", background: catMeta.color + "18", border: "1px solid " + catMeta.color + "55", borderRadius: 20, fontSize: 13, color: catMeta.color, fontWeight: 700 }}>{catMeta.emoji} {catMeta.label} Interview</span>
          </div>
          <div style={{ border: "2px solid " + vm.color, borderRadius: 20, padding: "28px 32px", marginBottom: 24, textAlign: "center", background: vm.bg }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, margin: "0 0 8px", color: vm.color }}>{vm.title}</h1>
            <p style={{ fontSize: 15, color: "#94a3b8", margin: "0 0 20px", lineHeight: 1.6 }}>{vm.sub}</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
              {[{ v: avg, l: "Overall", c: vm.color }, { v: avgAI, l: "Answers", c: "#6366f1" }, { v: avgEmotion, l: "Emotion", c: "#10b981" }].map(({ v, l, c }) => (
                <div key={l} style={{ width: 90, height: 90, border: "4px solid " + c, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 28, fontWeight: 900, lineHeight: 1, color: c }}>{v}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{l}</span>
                </div>
              ))}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[["Verdict", avg >= 75 ? "Excellent" : avg >= 50 ? "Average" : "Needs Work", vm.color],["Category", catMeta.emoji + " " + catMeta.label, "#f1f5f9"],["Top Emotion", dominant, "#f1f5f9"],["Questions Done", answerLog.length + "/" + questions.length, "#f1f5f9"]].map(([label, val, color]) => (
                  <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", gap: 20, fontSize: 13, color: "#94a3b8" }}><span>{label}</span><strong style={{ color: String(color) }}>{val}</strong></div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: "#0d1726", borderRadius: 14, padding: 20, border: "1px solid #1e2d45", marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", margin: "0 0 16px" }}>Emotion Timeline During Interview</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
              {answerLog.map((a, i) => {
                const score = EMOTION_META[a.emotion]?.score ?? 50;
                const h = Math.max(10, (score / 100) * 100);
                const color = EMOTION_META[a.emotion]?.color ?? "#6366f1";
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ fontSize: 9, color: "#64748b" }}>{score}</div>
                    <div style={{ width: "100%", height: h, background: color, borderRadius: "4px 4px 0 0" }} title={a.emotion + " Q" + (i + 1)} />
                    <div style={{ fontSize: 9, color: "#475569" }}>Q{i + 1}</div>
                    <div style={{ fontSize: 9, color: "#64748b" }}>{a.emotion.slice(0, 3)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              {Object.entries(EMOTION_META).map(([em, m]) => (
                <div key={em} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#64748b" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: m.color }} />{em}
                </div>
              ))}
            </div>
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 14px", color: "#f1f5f9" }}>Question-by-Question Breakdown</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            {answerLog.map((a, i) => {
              const em = EMOTION_META[a.emotion] ?? EMOTION_META.neutral;
              return (
                <div key={i} style={{ background: "#0d1726", borderRadius: 12, padding: 14, border: "1px solid #1e2d45", borderLeft: "4px solid " + em.color }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>Q{i + 1}: {a.question}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, color: "#fff", background: em.color }}>{a.emotion} {a.confidence}%</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>Emotion Score: {em.score}/100</span>
                  </div>
                  {a.transcript && <div style={{ fontSize: 13, color: "#94a3b8", fontStyle: "italic", marginBottom: 8 }}>"{a.transcript}"</div>}
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>AI Score: <strong style={{ color: a.aiScore >= 75 ? "#10b981" : a.aiScore >= 50 ? "#f59e0b" : "#ef4444" }}>{a.aiScore}/100</strong></div>
                  <div style={{ fontSize: 13, color: "#94a3b8", background: "#080f1e", padding: "8px 10px", borderRadius: 6, marginBottom: 6 }}>{a.aiFeedback}</div>
                  <div style={{ fontSize: 12, color: "#475569" }}>Tip: {em.tip}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <button onClick={() => setPhase("dashboard")} style={{ flex: 1, padding: "13px", background: "#1e2d45", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", minWidth: 120 }}>View Analytics</button>
            <button onClick={exportReport} style={{ flex: 1, padding: "13px", background: "#1e2d45", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", minWidth: 120 }}>Download Report</button>
            <button onClick={resetToCategory} style={{ flex: 1, padding: "13px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer", minWidth: 120 }}>Practice Again</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080f1e", color: "#e2e8f0", fontFamily: "'Segoe UI',sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 24px", background: "#0d1726", borderBottom: "1px solid #1e2d45", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: "#f1f5f9" }}>InterviewAI</span>
          <span style={{ fontSize: 11, color: catMeta.color, background: catMeta.color + "18", padding: "2px 8px", borderRadius: 10, fontWeight: 700 }}>{catMeta.emoji} {catMeta.label}</span>
          <span style={{ fontSize: 12, color: "#475569" }}>{user.name}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: 1, margin: "0 28px" }}>
          <div style={{ width: "100%", maxWidth: 360, height: 6, background: "#1e2d45", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ width: (qIndex / questions.length * 100) + "%", height: "100%", background: "linear-gradient(90deg," + catMeta.color + "," + catMeta.color + "99)", borderRadius: 6, transition: "width 0.4s ease" }} />
          </div>
          <span style={{ fontSize: 11, color: "#64748b" }}>Question {qIndex + 1} of {questions.length}</span>
        </div>
        <div style={{ border: "1.5px solid " + timerColor, borderRadius: 20, padding: "5px 14px", fontSize: 14, fontWeight: 700, minWidth: 60, textAlign: "center", color: timerColor }}>{timer}s</div>
      </div>

      <div style={{ display: "flex", gap: 18, padding: "18px 20px", flexWrap: "wrap" }}>
        <div style={{ flex: "0 0 320px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", boxShadow: "0 0 40px rgba(99,102,241,0.2)" }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: "block", transform: "scaleX(-1)" }} />
            <div style={{ position: "absolute", bottom: 12, left: 12, padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, color: "#fff", background: meta.color }}>{emotion}</div>
            <div style={{ height: 4, background: "linear-gradient(90deg," + timerColor + " " + timerPct + "%,#1e293b " + timerPct + "%)" }} />
          </div>
          <div style={{ background: "#0d1726", borderRadius: 12, padding: 14, border: "1px solid #1e2d45" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Confidence</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: meta.color }}>{confidence}%</span>
            </div>
            <div style={{ background: "#080f1e", borderRadius: 8, height: 10, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ width: confidence + "%", height: "100%", background: meta.color, borderRadius: 8, transition: "width 0.5s" }} />
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{meta.tip}</p>
          </div>
          <div style={{ background: "#0d1726", borderRadius: 12, padding: 14, border: "1px solid #1e2d45" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>Live Emotion Analysis</div>
            {Object.entries(allEmotions).sort((a, b) => b[1] - a[1]).map(([em, val]) => {
              const m = EMOTION_META[em] ?? EMOTION_META.neutral;
              return (
                <div key={em} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ width: 80, fontSize: 11, textTransform: "capitalize" }}>{em}</span>
                  <div style={{ flex: 1, background: "#080f1e", borderRadius: 4, height: 6, overflow: "hidden" }}>
                    <div style={{ width: Math.round(val * 100) + "%", height: "100%", background: m.color, borderRadius: 4 }} />
                  </div>
                  <span style={{ width: 30, fontSize: 11, color: "#64748b", textAlign: "right" }}>{Math.round(val * 100)}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, minWidth: 280 }}>
          <div style={{ background: "#0d1726", borderRadius: 14, padding: 22, border: "1px solid #1e2d45" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ background: catMeta.color + "22", padding: "4px 12px", borderRadius: 20, fontSize: 12, color: catMeta.color, fontWeight: 700 }}>Question {qIndex + 1}</span>
              <button onClick={() => speak(questions[qIndex])} style={{ background: "#1e2d45", border: "none", borderRadius: 8, padding: "6px 14px", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>Read Aloud</button>
            </div>
            <p style={{ fontSize: 20, fontWeight: 700, margin: "0 0 14px", color: "#f1f5f9", lineHeight: 1.5 }}>"{questions[qIndex]}"</p>
            <div style={{ borderTop: "1px solid #1e2d45", paddingTop: 12 }}>
              <span style={{ fontSize: 12, color: "#475569" }}>Be specific. Use real examples from your experience.</span>
            </div>
          </div>

          <div style={{ background: "#0d1726", borderRadius: 14, padding: 18, border: "1px solid #1e2d45" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>Your Answer</span>
              <button onClick={toggleMic} style={{ border: "none", borderRadius: 8, padding: "8px 18px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 700, background: isListening ? "#ef4444" : "#6366f1" }}>
                {isListening ? "Stop Recording" : "Start Recording"}
              </button>
            </div>
            {isListening && <div style={{ fontSize: 12, color: "#ef4444", marginBottom: 8 }}>Listening...</div>}
            <div style={{ minHeight: 80, background: "#080f1e", borderRadius: 10, padding: 14, fontSize: 14, color: "#e2e8f0", lineHeight: 1.7 }}>
              {transcript || <span style={{ color: "#475569" }}>Start recording to see your answer...</span>}
            </div>
          </div>

          <div style={{ background: "#0d1726", borderRadius: 14, padding: 18, border: "1px solid #1e2d45" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", marginBottom: 12 }}>STAR Answer Framework</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[["S","Situation","#6366f1"],["T","Task","#f59e0b"],["A","Action","#10b981"],["R","Result","#ec4899"]].map(([l, w, c]) => (
                <div key={String(l)} style={{ background: "#080f1e", borderRadius: 8, padding: "10px 8px", textAlign: "center", borderTop: "3px solid " + c }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: c, display: "block" }}>{l}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>{w}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── FIXED: Green button on Q8, always clickable ── */}
          <button
            onClick={() => void saveAndNext()}
            disabled={isScoringAI}
            style={{
              padding: "15px",
              background: isScoringAI ? "#1e2d45" : qIndex + 1 >= questions.length ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
              border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 800,
              cursor: isScoringAI ? "not-allowed" : "pointer", opacity: isScoringAI ? 0.7 : 1,
              boxShadow: qIndex + 1 >= questions.length ? "0 6px 20px rgba(16,185,129,0.4)" : "0 6px 20px rgba(99,102,241,0.35)",
            }}
          >
            {isScoringAI ? "AI Scoring Your Answer..." : qIndex + 1 >= questions.length ? "Finish Interview and See Results" : "Save and Next Question"}
          </button>
        </div>
      </div>
    </div>
  );
}
