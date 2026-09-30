import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, ChevronDown, Film, Image as ImageIcon, Layers3, Play, Plus, Sparkles, Wand2, X } from "lucide-react";
import "./styles.css";

const seedProjects = [
  { id: 1, title: "The discipline nobody talks about", status: "Ready", scenes: 8, updated: "Just now", image: "https://image.pollinations.ai/prompt/cinematic%20stoic%20man%20walking%20alone%20at%20night%20rain%20vertical?width=420&height=620&nologo=true" },
  { id: 2, title: "7 rules for a stronger mind", status: "Draft", scenes: 6, updated: "Yesterday", image: "https://image.pollinations.ai/prompt/dark%20cinematic%20mountain%20silhouette%20sunrise%20vertical?width=420&height=620&nologo=true" }
];

function App() {
  const [view, setView] = useState("create");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Stoic / cinematic");
  const [duration, setDuration] = useState("45 seconds");
  const [projects, setProjects] = useState(seedProjects);
  const [showSettings, setShowSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");

  const generate = () => {
    if (!topic.trim()) { setNotice("Add a topic first."); return; }
    setGenerating(true); setNotice("");
    setTimeout(() => {
      const title = topic.trim().slice(0, 54);
      const prompt = encodeURIComponent(style + " " + title + " cinematic vertical faceless video");
      setProjects(p => [{ id: Date.now(), title, status: "Ready", scenes: duration.startsWith("60") ? 10 : 8, updated: "Just now", image: "https://image.pollinations.ai/prompt/" + prompt + "?width=420&height=620&nologo=true" }, ...p]);
      setGenerating(false); setView("projects");
    }, 1100);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={17}/></div><span>stoicky</span></div>
        <button className={"new-btn " + (view === "create" ? "active" : "")} onClick={() => setView("create")}><Plus size={18}/> New video</button>
        <nav>
          <button className={"nav-item " + (view === "projects" ? "active" : "")} onClick={() => setView("projects")}><Film size={17}/> Projects</button>
          <button className={"nav-item " + (view === "templates" ? "active" : "")} onClick={() => setView("templates")}><Layers3 size={17}/> Templates</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="usage"><div><span>Free credits</span><strong>82%</strong></div><div className="meter"><i/></div><small>18 of 100 credits used</small></div>
          <button className="settings-btn" onClick={() => setShowSettings(true)}>Settings</button>
          <div className="user"><div className="avatar">F</div><div><strong>Creator</strong><span>Free plan</span></div><ChevronDown size={15}/></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">AI VIDEO STUDIO</span><h1>{view === "create" ? "Create a video" : view === "projects" ? "Your projects" : "Templates"}</h1></div>
          <div className="top-actions"><span className="credit-pill">✦ 82 credits</span><button className="avatar small">F</button></div>
        </header>

        {view === "create" && (
          <section className="create-grid">
            <div className="panel composer">
              <div className="panel-head"><div><h2>Turn an idea into a video</h2><p>Write a topic and Stoicky builds the script, scenes and visuals.</p></div><Wand2 size={20}/></div>
              <label>What should the video be about?</label>
              <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. 5 rules to become mentally stronger..." rows="5"/>
              <div className="examples"><span>Try:</span><button onClick={() => setTopic("5 stoic rules for staying calm under pressure")}>Stoic rules</button><button onClick={() => setTopic("Why discipline beats motivation every time")}>Discipline</button><button onClick={() => setTopic("3 habits that quietly change your life")}>Habits</button></div>
              <div className="field-row">
                <div><label>Visual style</label><select value={style} onChange={e => setStyle(e.target.value)}><option>Stoic / cinematic</option><option>Dark documentary</option><option>Minimal luxury</option><option>Motivational</option></select></div>
                <div><label>Duration</label><select value={duration} onChange={e => setDuration(e.target.value)}><option>30 seconds</option><option>45 seconds</option><option>60 seconds</option></select></div>
              </div>
              {notice && <div className="notice">{notice}</div>}
              <button className="generate" onClick={generate} disabled={generating}>{generating ? <><span className="spinner"/> Creating...</> : <><Sparkles size={17}/> Generate video <ArrowRight size={17}/></>}</button>
              <p className="fineprint">Powered by Pollinations AI · You review everything before export.</p>
            </div>

            <div className="panel pipeline">
              <div className="panel-head"><div><h2>Production pipeline</h2><p>Everything happens in one flow.</p></div></div>
              {[
                ["01","Script","AI writes a short-form script with a strong hook."],
                ["02","Scenes","The script becomes visual scenes automatically."],
                ["03","Visuals","Generate matching imagery for every beat."],
                ["04","Render","Review your result and export the finished video."]
              ].map((item,i) => <div className={"step " + (i === 0 ? "current" : "")} key={item[0]}><div className="step-no">{item[0]}</div><div><strong>{item[1]}</strong><p>{item[2]}</p></div>{i === 0 && <span className="dot"/>}</div>)}
              <div className="preview-card"><div className="preview-image" style={{backgroundImage:'url("' + seedProjects[0].image + '")'}}><button><Play size={17} fill="currentColor"/></button></div><div><span>LIVE PREVIEW</span><strong>Vertical · 9:16</strong></div></div>
            </div>
          </section>
        )}

        {view === "projects" && (
          <section className="projects">
            <div className="project-toolbar"><p>{projects.length} videos</p><button className="generate compact" onClick={() => setView("create")}><Plus size={16}/> New video</button></div>
            <div className="project-grid">{projects.map(p => <article className="project-card" key={p.id}><div className="thumb" style={{backgroundImage:'url("' + p.image + '")'}}><span className={"status " + (p.status === "Ready" ? "ready" : "")}>{p.status}</span><button className="play"><Play size={18} fill="currentColor"/></button></div><div className="project-info"><h3>{p.title}</h3><div><span>{p.scenes} scenes</span><span>·</span><span>{p.updated}</span></div></div></article>)}</div>
          </section>
        )}

        {view === "templates" && (
          <section className="templates"><div className="template-hero"><div><span className="eyebrow">START FASTER</span><h2>Templates for faceless content.</h2><p>Pick a visual direction and spend your time on the idea—not the editing.</p></div></div><div className="template-grid">{["Stoic Motivation","Dark Psychology","Story / Narrative","Facts & Lists"].map((x,i)=><article key={x} className="template-card"><div className={"template-art art-" + i}><ImageIcon size={24}/></div><div><strong>{x}</strong><span>Vertical · 30–60 sec</span></div><button onClick={()=>{setStyle(x);setView("create")}}>Use template <ArrowRight size={14}/></button></article>)}</div></section>
        )}
      </main>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><h2>Settings</h2><button onClick={() => setShowSettings(false)}><X size={18}/></button></div><label>Pollinations API key</label><input type="password" placeholder="Optional — add your own key"/><p className="modal-copy">Use your own Pollinations account when you want generation usage attached to your account.</p><label>Default format</label><select><option>Vertical · 9:16</option><option>Square · 1:1</option><option>Landscape · 16:9</option></select><button className="generate" onClick={() => setShowSettings(false)}><Check size={17}/> Save settings</button></div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
