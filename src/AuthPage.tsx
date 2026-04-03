import { useState } from "react";

export const refreshUser = () => {
  const user = getCurrentUser();
  return user;
};

export interface User {
  name: string;
  email: string;
  password: string;
  createdAt: string;
  sessions: SessionRecord[];
}

export interface SessionRecord {
  date: string;
  score: number;
  verdict: string;
  questions: number;
}

export const getUsers = (): Record<string, User> => {
  try { return JSON.parse(localStorage.getItem("interviewai_users") ?? "{}"); }
  catch { return {}; }
};

export const saveUsers = (users: Record<string, User>) => {
  localStorage.setItem("interviewai_users", JSON.stringify(users));
};

export const getCurrentUser = (): User | null => {
  try {
    const email = localStorage.getItem("interviewai_current");
    if (!email) return null;
    const users = getUsers();
    return users[email] ?? null;
  } catch { return null; }
};

export const saveSession = (email: string, record: SessionRecord) => {
  const users = getUsers();
  if (users[email]) {
    users[email].sessions = [record, ...(users[email].sessions ?? [])].slice(0, 10);
    saveUsers(users);
  }
};

export const logoutUser = () => localStorage.removeItem("interviewai_current");

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!email.includes("@")) return "Enter a valid email address.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    if (mode === "signup" && name.trim().length < 2) return "Enter your full name.";
    return "";
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError(""); setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const users = getUsers();
    if (mode === "login") {
      const user = users[email];
      if (!user) { setError("No account found. Please sign up."); setLoading(false); return; }
      if (user.password !== password) { setError("Incorrect password."); setLoading(false); return; }
      localStorage.setItem("interviewai_current", email);
      onLogin(user);
    } else {
      if (users[email]) { setError("Account already exists. Please login."); setLoading(false); return; }
      const newUser: User = {
        name: name.trim(), email, password,
        createdAt: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }),
        sessions: [],
      };
      users[email] = newUser;
      saveUsers(users);
      localStorage.setItem("interviewai_current", email);
      onLogin(newUser);
    }
    setLoading(false);
  };

  const S: Record<string, React.CSSProperties> = {
    page: { display: "flex", minHeight: "100vh", background: "#080f1e", fontFamily: "'Segoe UI', sans-serif" },
    leftPanel: { flex: "0 0 480px", background: "linear-gradient(160deg, #0d1f3c 0%, #0a1628 100%)", borderRight: "1px solid #1e2d45", display: "flex", alignItems: "center", justifyContent: "center", padding: 48 },
    leftInner: { maxWidth: 380 },
    brandRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 40 },
    brandIcon: { fontSize: 32 },
    brandName: { fontSize: 20, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.5px" },
    leftTitle: { fontSize: 40, fontWeight: 900, color: "#f1f5f9", lineHeight: 1.15, margin: "0 0 16px", letterSpacing: "-1px" },
    grad: { background: "linear-gradient(135deg,#6366f1,#8b5cf6,#ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    leftDesc: { fontSize: 15, color: "#64748b", lineHeight: 1.7, margin: "0 0 32px" },
    statRow: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 },
    statChip: { display: "flex", alignItems: "center", gap: 6, background: "#0f1f35", border: "1px solid #1e2d45", borderRadius: 20, padding: "6px 14px", fontSize: 13, color: "#94a3b8" },
    quoteBox: { background: "#0f1f35", borderLeft: "3px solid #6366f1", borderRadius: "0 8px 8px 0", padding: "14px 16px" },
    quoteText: { fontSize: 14, color: "#94a3b8", fontStyle: "italic", margin: "0 0 6px", lineHeight: 1.6 },
    quoteAuthor: { fontSize: 12, color: "#475569", margin: 0 },
    rightPanel: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 },
    formCard: { width: "100%", maxWidth: 420, background: "#0d1726", borderRadius: 20, padding: "36px 36px", border: "1px solid #1e2d45", boxShadow: "0 24px 60px rgba(0,0,0,0.4)" },
    tabs: { display: "flex", background: "#080f1e", borderRadius: 10, padding: 4, marginBottom: 28 },
    tab: { flex: 1, padding: "10px", border: "none", background: "transparent", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", borderRadius: 8 },
    tabActive: { background: "#1e2d45", color: "#f1f5f9" },
    formTitle: { fontSize: 24, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.5px" },
    formSub: { fontSize: 13, color: "#64748b", margin: "0 0 24px" },
    fieldWrap: { marginBottom: 16 },
    label: { display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6, letterSpacing: "0.5px", textTransform: "uppercase" },
    input: { width: "100%", padding: "12px 14px", background: "#080f1e", border: "1px solid #1e2d45", borderRadius: 10, color: "#f1f5f9", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "'Segoe UI', sans-serif" },
    errorBox: { background: "#1c0505", border: "1px solid #ef4444", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#ef4444", marginBottom: 16 },
    submitBtn: { width: "100%", padding: "14px", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", marginBottom: 16, boxShadow: "0 6px 24px rgba(99,102,241,0.35)" },
    switchText: { fontSize: 13, color: "#64748b", textAlign: "center", margin: "0 0 16px" },
    switchLink: { color: "#6366f1", cursor: "pointer", fontWeight: 700 },
    demoBox: { background: "#0f1f35", borderRadius: 8, padding: "10px 14px", textAlign: "center" },
    demoText: { fontSize: 12, color: "#475569", margin: 0 },
  };

  return (
    <div style={S.page}>
      <div style={S.leftPanel}>
        <div style={S.leftInner}>
          <div style={S.brandRow}>
            <span style={S.brandIcon}>AI</span>
            <span style={S.brandName}>InterviewAI</span>
          </div>
          <h1 style={S.leftTitle}>Your Personal<br /><span style={S.grad}>Interview Coach</span></h1>
          <p style={S.leftDesc}>Practice interviews with real-time AI emotion analysis, voice recognition, and personalised feedback.</p>
          <div style={S.statRow}>
            {[["[Target]", "AI Scoring"], [":)", "Emotion AI"], ["[Mic]", "Voice Analysis"], ["[Chart]", "Reports"]].map(([icon, label]) => (
              <div key={String(label)} style={S.statChip}>
                <span>{icon}</span>
                <span style={{ fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>
          <div style={S.quoteBox}>
            <p style={S.quoteText}>"The secret of getting ahead is getting started."</p>
            <p style={S.quoteAuthor}>-- Mark Twain</p>
          </div>
        </div>
      </div>
      <div style={S.rightPanel}>
        <div style={S.formCard}>
          <div style={S.tabs}>
            <button onClick={() => { setMode("login"); setError(""); }} style={{ ...S.tab, ...(mode === "login" ? S.tabActive : {}) }}>Login</button>
            <button onClick={() => { setMode("signup"); setError(""); }} style={{ ...S.tab, ...(mode === "signup" ? S.tabActive : {}) }}>Sign Up</button>
          </div>
          <h2 style={S.formTitle}>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p style={S.formSub}>{mode === "login" ? "Login to continue your interview practice" : "Start your AI-powered interview journey"}</p>
          {mode === "signup" && (
            <div style={S.fieldWrap}>
              <label style={S.label}>Full Name</label>
              <input style={S.input} placeholder="e.g. Mehak Sharma" value={name} onChange={e => setName(e.target.value)} />
            </div>
          )}
          <div style={S.fieldWrap}>
            <label style={S.label}>Email Address</label>
            <input style={S.input} placeholder="you@example.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div style={S.fieldWrap}>
            <label style={S.label}>Password</label>
            <input style={S.input} placeholder={mode === "signup" ? "Min 6 characters" : "Enter your password"} type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {error && <div style={S.errorBox}>{error}</div>}
          <button onClick={handleSubmit} disabled={loading} style={S.submitBtn}>
            {loading ? "Please wait..." : mode === "login" ? "Login and Start Practicing" : "Create Account"}
          </button>
          <p style={S.switchText}>
            {mode === "login" ? "Don't have an account? " : "Already have an account? "}
            <span style={S.switchLink} onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>
              {mode === "login" ? "Sign Up" : "Login"}
            </span>
          </p>
          {mode === "login" && (
            <div style={S.demoBox}>
              <p style={S.demoText}>Demo: sign up with any email and password to try!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
