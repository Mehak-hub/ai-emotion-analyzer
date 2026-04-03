import type { User } from "./AuthPage";

interface DashboardProps {
  user: User;
  onStartInterview: () => void;
  onLogout: () => void;
}

const EMOTION_COLORS: Record<string, string> = {
  happy: "#10b981", neutral: "#6366f1", surprised: "#f59e0b",
  sad: "#60a5fa", fearful: "#fb923c", disgusted: "#a78bfa", angry: "#ef4444",
};

const QUESTIONS_SHORT = [
  "About yourself","Why hire you","Strengths","5 years",
  "Handle pressure","Challenge","Motivation","Weakness",
];

export default function Dashboard({ user, onStartInterview, onLogout }: DashboardProps) {
  const sessions = user.sessions ?? [];
  const hasSessions = sessions.length > 0;

  const avgScore = hasSessions ? Math.round(sessions.reduce((s,r) => s+r.score,0)/sessions.length) : 0;
  const avgEmotion = hasSessions ? Math.round(sessions.reduce((s,r) => s+(r.emotionScore??r.score),0)/sessions.length) : 0;
  const avgAI = hasSessions ? Math.round(sessions.reduce((s,r) => s+(r.aiScore??r.score),0)/sessions.length) : 0;
  const bestScore = hasSessions ? Math.max(...sessions.map(s=>s.score)) : 0;
  const hiredCount = sessions.filter(s=>s.verdict==="hired").length;
  const readyPct = hasSessions ? Math.round((hiredCount/sessions.length)*100) : 0;

  const emotionFreq: Record<string,number> = {};
  sessions.forEach(s => {
    (s.emotionLog??[]).forEach((e: any) => {
      emotionFreq[e.emotion] = (emotionFreq[e.emotion]??0)+1;
    });
  });
  const totalEmotions = Object.values(emotionFreq).reduce((a,b)=>a+b,0)||1;

  const qScores: number[] = Array(8).fill(0);
  const qCounts: number[] = Array(8).fill(0);
  sessions.forEach(s => {
    (s.answers??[]).forEach((a: any,i: number) => {
      if(i<8){ qScores[i]+=(a.aiScore??0); qCounts[i]++; }
    });
  });
  const qAvg = qScores.map((s,i) => qCounts[i]>0 ? Math.round(s/qCounts[i]) : null);
  const trend = [...sessions].reverse().slice(-8);

  const exportCSV = () => {
    const rows = [
      ["Date","Overall Score","Emotion Score","AI Score","Verdict","Questions"],
      ...sessions.map(s=>[s.date,s.score,s.emotionScore??s.score,s.aiScore??s.score,s.verdict,s.questions])
    ];
    const csv = rows.map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=user.name.replace(" ","_")+"_interview_data.csv";
    a.click(); URL.revokeObjectURL(url);
  };

  const exportReport = () => {
    const lines = [
      "INTERVIEWAI - PERFORMANCE REPORT",
      "Generated: "+new Date().toLocaleDateString("en-IN"),
      "User: "+user.name+" ("+user.email+")",
      "Member Since: "+user.createdAt,
      "",
      "=== OVERALL ANALYTICS ===",
      "Total Sessions: "+sessions.length,
      "Average Score: "+avgScore+"/100",
      "Best Score: "+bestScore+"/100",
      "Emotion Score Avg: "+avgEmotion+"/100",
      "AI Answer Score Avg: "+avgAI+"/100",
      "Interview Ready Rate: "+readyPct+"%",
      "",
      "=== QUESTION PERFORMANCE ===",
      ...qAvg.map((q,i)=>"Q"+(i+1)+" ("+QUESTIONS_SHORT[i]+"): "+(q!==null?q+"/100":"Not attempted")),
      "",
      "=== SESSION HISTORY ===",
      ...sessions.map((s,i)=>"Session "+(i+1)+" | "+s.date+" | Score: "+s.score+"/100 | "+s.verdict.toUpperCase()),
      "",
      "=== DOMINANT EMOTIONS ===",
      ...Object.entries(emotionFreq).sort((a,b)=>b[1]-a[1]).map(([e,c])=>e+": "+Math.round(c/totalEmotions*100)+"%"),
    ];
    const blob = new Blob([lines.join("\n")],{type:"text/plain"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=user.name.replace(" ","_")+"_report.txt";
    a.click(); URL.revokeObjectURL(url);
  };

  const sc = (s: number) => s>=75?"#10b981":s>=50?"#f59e0b":"#ef4444";
  const vc = (v: string) => v==="hired"?"#10b981":v==="maybe"?"#f59e0b":"#ef4444";
  const vl = (v: string) => v==="hired"?"Ready":v==="maybe"?"Improving":"Practice";

  const pg: React.CSSProperties = { minHeight:"100vh",background:"#080f1e",color:"#e2e8f0",fontFamily:"'Segoe UI','Helvetica Neue',sans-serif" };
  const card: React.CSSProperties = { background:"#0d1726",borderRadius:14,padding:20,border:"1px solid #1e2d45" };

  return (
    <div style={pg}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 32px",background:"#0d1726",borderBottom:"1px solid #1e2d45",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:24}}>AI</span>
          <span style={{fontSize:17,fontWeight:800,color:"#f1f5f9"}}>InterviewAI</span>
          <span style={{fontSize:11,background:"#1e2d45",padding:"3px 10px",borderRadius:10,color:"#6366f1",fontWeight:700,marginLeft:6}}>Analytics Dashboard</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:13,color:"#94a3b8"}}>Hi, <strong style={{color:"#f1f5f9"}}>{user.name}</strong></span>
          <button onClick={exportCSV} style={{padding:"7px 12px",background:"#1e2d45",border:"1px solid #334155",borderRadius:8,color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Export CSV</button>
          <button onClick={exportReport} style={{padding:"7px 12px",background:"#1e2d45",border:"1px solid #334155",borderRadius:8,color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Export Report</button>
          <button onClick={onStartInterview} style={{padding:"8px 18px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:8,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Start Interview</button>
          <button onClick={onLogout} style={{padding:"7px 12px",background:"transparent",border:"1px solid #1e2d45",borderRadius:8,color:"#64748b",fontSize:12,cursor:"pointer"}}>Logout</button>
        </div>
      </div>

      <div style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:14,marginBottom:24}}>
          {[
            {label:"Total Sessions",value:sessions.length,unit:"",color:"#6366f1",icon:"[List]"},
            {label:"Average Score",value:avgScore,unit:"/100",color:sc(avgScore),icon:"[Chart]"},
            {label:"Best Score",value:bestScore,unit:"/100",color:"#10b981",icon:"[Trophy]"},
            {label:"Emotion Avg",value:avgEmotion,unit:"/100",color:"#f59e0b",icon:":)"},
            {label:"AI Answer Avg",value:avgAI,unit:"/100",color:"#8b5cf6",icon:"[Bot]"},
            {label:"Ready Rate",value:readyPct,unit:"%",color:"#10b981",icon:"[OK]"},
          ].map(({label,value,unit,color,icon}) => (
            <div key={label} style={{...card,padding:"16px 14px"}}>
              <div style={{fontSize:18,marginBottom:6}}>{icon}</div>
              <div style={{fontSize:26,fontWeight:900,color,lineHeight:1}}>{value}<span style={{fontSize:13,color:"#64748b"}}>{unit}</span></div>
              <div style={{fontSize:11,color:"#64748b",marginTop:4}}>{label}</div>
            </div>
          ))}
        </div>

        {!hasSessions ? (
          <div style={{...card,textAlign:"center",padding:"80px 20px"}}>
            <div style={{fontSize:48,marginBottom:16}}>[Chart]</div>
            <h2 style={{fontSize:22,fontWeight:800,color:"#f1f5f9",margin:"0 0 10px"}}>No Interview Data Yet</h2>
            <p style={{fontSize:14,color:"#64748b",marginBottom:24}}>Complete your first interview to see analytics and insights.</p>
            <button onClick={onStartInterview} style={{padding:"14px 32px",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer"}}>Start First Interview</button>
          </div>
        ) : (
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18}}>
              <div style={card}>
                <h3 style={{fontSize:14,fontWeight:700,color:"#f1f5f9",margin:"0 0 18px"}}>Score Trend (Last {trend.length} Sessions)</h3>
                <div style={{display:"flex",alignItems:"flex-end",gap:8,height:110}}>
                  {trend.map((s,i) => {
                    const h = Math.max(8,(s.score/100)*110);
                    return (
                      <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                        <div style={{fontSize:9,color:"#64748b"}}>{s.score}</div>
                        <div style={{width:"100%",height:h,background:sc(s.score),borderRadius:"4px 4px 0 0"}} />
                        <div style={{fontSize:8,color:"#475569",textAlign:"center"}}>{s.date.split(" ").slice(0,2).join(" ")}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:10,marginTop:10}}>
                  {[["#10b981","75+ (Ready)"],["#f59e0b","50-74"],["#ef4444","<50"]].map(([c,l]) => (
                    <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
                      <div style={{width:8,height:8,background:c,borderRadius:2}} />
                      <span style={{fontSize:10,color:"#64748b"}}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={card}>
                <h3 style={{fontSize:14,fontWeight:700,color:"#f1f5f9",margin:"0 0 14px"}}>Emotion Distribution</h3>
                {Object.entries(emotionFreq).sort((a,b)=>b[1]-a[1]).map(([em,count]) => {
                  const pct = Math.round(count/totalEmotions*100);
                  const color = EMOTION_COLORS[em]??"#6366f1";
                  return (
                    <div key={em} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{width:72,fontSize:11,textTransform:"capitalize",color:"#94a3b8"}}>{em}</span>
                      <div style={{flex:1,background:"#080f1e",borderRadius:4,height:8,overflow:"hidden"}}>
                        <div style={{width:pct+"%",height:"100%",background:color,borderRadius:4}} />
                      </div>
                      <span style={{width:30,fontSize:11,color:"#64748b",textAlign:"right"}}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{...card,marginBottom:18}}>
              <h3 style={{fontSize:14,fontWeight:700,color:"#f1f5f9",margin:"0 0 14px"}}>Question Performance Heatmap (Avg AI Score)</h3>
              <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:8}}>
                {qAvg.map((score,i) => {
                  const bg = score===null?"#1e2d45":score>=75?"#064e3b":score>=50?"#451a03":"#1c0505";
                  const border = score===null?"#334155":score>=75?"#10b981":score>=50?"#f59e0b":"#ef4444";
                  const color = score===null?"#475569":score>=75?"#10b981":score>=50?"#f59e0b":"#ef4444";
                  return (
                    <div key={i} style={{background:bg,border:"1px solid "+border,borderRadius:10,padding:"12px 6px",textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:900,color,marginBottom:3}}>{score!==null?score:"--"}</div>
                      <div style={{fontSize:9,color:"#475569",lineHeight:1.3}}>Q{i+1}</div>
                      <div style={{fontSize:8,color:"#334155",marginTop:2,lineHeight:1.3}}>{QUESTIONS_SHORT[i]}</div>
                    </div>
                  );
                })}
              </div>
              <p style={{fontSize:11,color:"#475569",margin:"10px 0 0"}}>Green = Strong (75+) . Yellow = Average (50-74) . Red = Needs Work . Gray = Not attempted</p>
            </div>

            <div style={{...card,marginBottom:18}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <h3 style={{fontSize:14,fontWeight:700,color:"#f1f5f9",margin:0}}>Session History</h3>
                <button onClick={exportCSV} style={{padding:"6px 12px",background:"#1e2d45",border:"1px solid #334155",borderRadius:8,color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Download CSV</button>
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                  <thead>
                    <tr>
                      {["#","Date","Overall","Emotion","AI Answer","Verdict","Questions"].map(h => (
                        <th key={h} style={{textAlign:"left",padding:"8px 10px",color:"#64748b",fontWeight:600,fontSize:11,borderBottom:"1px solid #1e2d45",textTransform:"uppercase",letterSpacing:"0.5px"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s,i) => (
                      <tr key={i} style={{borderBottom:"1px solid #0f172a"}}>
                        <td style={{padding:"9px 10px",color:"#475569"}}>{sessions.length-i}</td>
                        <td style={{padding:"9px 10px",color:"#94a3b8"}}>{s.date}</td>
                        <td style={{padding:"9px 10px"}}><strong style={{color:sc(s.score)}}>{s.score}/100</strong></td>
                        <td style={{padding:"9px 10px",color:"#10b981"}}>{s.emotionScore??s.score}/100</td>
                        <td style={{padding:"9px 10px",color:"#8b5cf6"}}>{s.aiScore??s.score}/100</td>
                        <td style={{padding:"9px 10px"}}><span style={{padding:"3px 10px",background:vc(s.verdict)+"22",color:vc(s.verdict),borderRadius:10,fontSize:11,fontWeight:700}}>{vl(s.verdict)}</span></td>
                        <td style={{padding:"9px 10px",color:"#64748b"}}>{s.questions}/8</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:700,color:"#f1f5f9",margin:"0 0 14px"}}>AI-Generated Insights</h3>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
                {[
                  {
                    label:"Strongest Question",color:"#6366f1",
                    value: qAvg.some(q=>q!==null)
                      ? "Q"+(qAvg.reduce((b,q,i)=>(q!==null&&(b===-1||(qAvg[b]??0)<q))?i:b,-1)+1)+": "+QUESTIONS_SHORT[qAvg.reduce((b,q,i)=>(q!==null&&(b===-1||(qAvg[b]??0)<q))?i:b,-1)]
                      : "Complete an interview to see insights"
                  },
                  {
                    label:"Needs Most Work",color:"#ef4444",
                    value: qAvg.some(q=>q!==null)
                      ? "Q"+(qAvg.reduce((w,q,i)=>(q!==null&&(w===-1||(qAvg[w]??101)>q))?i:w,-1)+1)+": "+QUESTIONS_SHORT[qAvg.reduce((w,q,i)=>(q!==null&&(w===-1||(qAvg[w]??101)>q))?i:w,-1)]
                      : "Complete an interview to see insights"
                  },
                  {
                    label:"Top Emotion",color:"#10b981",
                    value: Object.keys(emotionFreq).length>0
                      ? Object.entries(emotionFreq).sort((a,b)=>b[1]-a[1])[0][0]+" ("+Math.round(Object.entries(emotionFreq).sort((a,b)=>b[1]-a[1])[0][1]/totalEmotions*100)+"% of time)"
                      : "No emotion data yet"
                  },
                  {
                    label:"Progress Trend",color:"#f59e0b",
                    value: sessions.length>=2
                      ? (sessions[0].score>sessions[1].score?"Improving":"sessions[0].score<sessions[1].score"?"Declining":"Stable")+" -- last score "+(sessions[0].score>sessions[1].score?"+":"")+(sessions[0].score-sessions[1].score)+" from previous"
                      : "Complete 2+ interviews to track progress"
                  },
                ].map(({label,color,value}) => (
                  <div key={label} style={{background:"#080f1e",borderRadius:10,padding:14,border:"1px solid #1e2d45"}}>
                    <div style={{fontSize:12,fontWeight:700,color,marginBottom:8}}>{label}</div>
                    <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.5}}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
