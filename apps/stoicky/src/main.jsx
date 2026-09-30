import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, ChevronDown, Film, Image as ImageIcon, Layers3, Play, Plus, Sparkles, Wand2, X } from "lucide-react";
import "./styles.css";

const seedProjects = [
  { id: 1, title: "The discipline nobody talks about", status: "Preview", scenes: 8, updated: "Example", image: "https://image.pollinations.ai/prompt/cinematic%20stoic%20man%20walking%20alone%20at%20night%20rain%20vertical?width=420&height=620&nologo=true" },
  { id: 2, title: "7 rules for a stronger mind", status: "Example", scenes: 6, updated: "Example", image: "https://image.pollinations.ai/prompt/dark%20cinematic%20mountain%20silhouette%20sunrise%20vertical?width=420&height=620&nologo=true" }
];

const durationSeconds = { "30 seconds": 30, "45 seconds": 45, "60 seconds": 60 };

function App() {
  const [view, setView] = useState("create");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Stoic / cinematic");
  const [duration, setDuration] = useState("45 seconds");
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stoicky-projects")) || seedProjects; } catch { return seedProjects; }
  });
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("stoicky-pollinations-key") || "");
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => { localStorage.setItem("stoicky-projects", JSON.stringify(projects)); }, [projects]);

  const saveKey = () => {
    localStorage.setItem("stoicky-pollinations-key", apiKey.trim());
    setShowSettings(false);
    setNotice("Settings saved.");
  };

  const authHeaders = () => apiKey.trim() ? { "x-pollinations-key": apiKey.trim() } : {};

  const generate = async () => {
    if (!topic.trim()) { setNotice("Add a topic first."); return; }
    setBusy(true); setNotice(""); setVideoUrl("");
    try {
      setProgress("Writing script...");
      const scriptRes = await fetch("/api/script", {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ topic, style, duration })
      });
      const scriptData = await scriptRes.json();
      if (!scriptRes.ok) throw new Error(scriptData.error || "Script generation failed.");

      const script = scriptData.script;
      setProgress("Preparing video prompt...");
      const visual = script.scenes?.slice(0, 4).map(s => s.visual).join(". ") || topic;
      const videoPrompt = `${style}, vertical 9:16 faceless short-form video about ${script.title || topic}. ${visual}. Cinematic movement, coherent subject, dramatic lighting, no text, no logos.`;

      setProgress("Generating video — this can take a few minutes...");
      const videoRes = await fetch("/api/video", {
        method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          prompt: videoPrompt,
          duration: durationSeconds[duration],
          model: "google/veo-3.1-fast"
        })
      });

      const type = videoRes.headers.get("content-type") || "";
      if (!videoRes.ok) {
        const errorData = type.includes("json") ? await videoRes.json() : { error: await videoRes.text() };
        throw new Error(errorData.error || "Video generation failed.");
      }

      let url = "";
      if (type.includes("application/json")) {
        const data = await videoRes.json();
        url = data?.data?.[0]?.url || data?.url || "";
        if (!url) throw new Error("Video service returned no video URL.");
      } else {
        const blob = await videoRes.blob();
        url = URL.createObjectURL(blob);
      }

      const project = {
        id: Date.now(),
        title: script.title || topic.trim().slice(0, 54),
        status: "Ready",
        scenes: script.scenes?.length || 0,
        updated: "Just now",
        image: seedProjects[0].image,
        videoUrl: url,
        script
      };
      setProjects(p => [project, ...p]);
      setVideoUrl(url);
      setProgress("Video ready.");
      setView("projects");
    } catch (error) {
      setNotice(error.message || "Generation failed.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Sparkles size={17}/></div><span>stoicky</span></div>
        <button className={"new-btn " + (view === "create" ? "active" : "")} onClick={() => { setView("create"); setNotice(""); }}><Plus size={18}/> New video</button>
        <nav>
          <button className={"nav-item " + (view === "projects" ? "active" : "")} onClick={() => setView("projects")}><Film size={17}/> Projects</button>
          <button className={"nav-item " + (view === "templates" ? "active" : "")} onClick={() => setView("templates")}><Layers3 size={17}/> Templates</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="usage"><div><span>Generation status</span><strong>{busy ? "WORKING" : "READY"}</strong></div><div className="meter"><i style={{width: busy ? "45%" : "100%"}}/></div><small>Powered by your Pollinations key</small></div>
          <button className="settings-btn" onClick={() => setShowSettings(true)}>Settings</button>
          <div className="user"><div className="avatar">F</div><div><strong>Creator</strong><span>Stoicky</span></div><ChevronDown size={15}/></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">AI VIDEO STUDIO</span><h1>{view === "create" ? "Create a video" : view === "projects" ? "Your projects" : "Templates"}</h1></div>
          <div className="top-actions"><span className="credit-pill">✦ Pollinations</span><button className="avatar small">F</button></div>
        </header>

        {view === "create" && (
          <section className="create-grid">
            <div className="panel composer">
              <div className="panel-head"><div><h2>Turn an idea into a video</h2><p>Stoicky writes the script and sends the finished prompt to Pollinations video generation.</p></div><Wand2 size={20}/></div>
              <label>What should the video be about?</label>
              <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. 5 rules to become mentally stronger..." rows="5"/>
              <div className="examples"><span>Try:</span><button onClick={() => setTopic("5 stoic rules for staying calm under pressure")}>Stoic rules</button><button onClick={() => setTopic("Why discipline beats motivation every time")}>Discipline</button><button onClick={() => setTopic("3 habits that quietly change your life")}>Habits</button></div>
              <div className="field-row">
                <div><label>Visual style</label><select value={style} onChange={e => setStyle(e.target.value)}><option>Stoic / cinematic</option><option>Dark documentary</option><option>Minimal luxury</option><option>Motivational</option></select></div>
                <div><label>Duration</label><select value={duration} onChange={e => setDuration(e.target.value)}><option>30 seconds</option><option>45 seconds</option><option>60 seconds</option></select></div>
              </div>
              {progress && <div className="progress"><span className="spinner"/><span>{progress}</span></div>}
              {notice && <div className="notice">{notice}{!apiKey && <button onClick={() => setShowSettings(true)}>Open Settings</button>}</div>}
              <button className="generate" onClick={generate} disabled={busy}>{busy ? <><span className="spinner dark"/> Generating...</> : <><Sparkles size={17}/> Generate video <ArrowRight size={17}/></>}</button>
              <p className="fineprint">Pollinations generation uses the API key you configure in Settings.</p>
            </div>

            <div className="panel pipeline">
              <div className="panel-head"><div><h2>Production pipeline</h2><p>{busy ? "Your generation is in progress." : "Everything happens in one flow."}</p></div></div>
              {[["01","Script","AI writes a short-form script with a strong hook."],["02","Scenes","The script becomes visual direction automatically."],["03","Video","Pollinations generates the cinematic video."],["04","Review","Preview the result and keep the project."]].map((item,i) => <div className={"step " + (busy && i === (progress?.includes("script") ? 0 : progress?.includes("video") ? 2 : 1) ? "current" : "")} key={item[0]}><div className="step-no">{item[0]}</div><div><strong>{item[1]}</strong><p>{item[2]}</p></div>{busy && i < 3 && <span className="dot"/>}</div>)}
              <div className="preview-card">
                {videoUrl ? <video className="preview-image video-preview" src={videoUrl} controls playsInline/> : <div className="preview-image" style={{backgroundImage:'url("' + seedProjects[0].image + '")'}}><button><Play size={17} fill="currentColor"/></button></div>}
                <div><span>{videoUrl ? "GENERATED VIDEO" : "LIVE PREVIEW"}</span><strong>Vertical · 9:16</strong></div>
              </div>
            </div>
          </section>
        )}

        {view === "projects" && (
          <section className="projects">
            <div className="project-toolbar"><p>{projects.length} videos</p><button className="generate compact" onClick={() => setView("create")}><Plus size={16}/> New video</button></div>
            <div className="project-grid">{projects.map(p => <article className="project-card" key={p.id}>
              <div className="thumb" style={{backgroundImage:'url("' + p.image + '")'}}><span className={"status " + (p.status === "Ready" ? "ready" : "")}>{p.status}</span>{p.videoUrl ? <button className="play" onClick={() => { setVideoUrl(p.videoUrl); setView("create"); }}><Play size={18} fill="currentColor"/></button> : <button className="play"><Play size={18} fill="currentColor"/></button>}</div>
              <div className="project-info"><h3>{p.title}</h3><div><span>{p.scenes} scenes</span><span>·</span><span>{p.updated}</span></div>{p.videoUrl && <a className="watch-link" href={p.videoUrl} target="_blank" rel="noreferrer">Open video <ArrowRight size={12}/></a>}</div>
            </article>)}</div>
          </section>
        )}

        {view === "templates" && (
          <section className="templates"><div className="template-hero"><div><span className="eyebrow">START FASTER</span><h2>Templates for faceless content.</h2><p>Pick a visual direction and spend your time on the idea—not the editing.</p></div></div><div className="template-grid">{["Stoic Motivation","Dark Psychology","Story / Narrative","Facts & Lists"].map((x,i)=><article key={x} className="template-card"><div className={"template-art art-" + i}><ImageIcon size={24}/></div><div><strong>{x}</strong><span>Vertical · 30–60 sec</span></div><button onClick={()=>{setStyle(x);setView("create")}}>Use template <ArrowRight size={14}/></button></article>)}</div></section>
        )}
      </main>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>Settings</h2><button onClick={() => setShowSettings(false)}><X size={18}/></button></div>
        <label>Pollinations API key</label><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk_..." autoComplete="off"/>
        <p className="modal-copy">Your key is stored only in this browser and sent to your Stoicky API function for generation. For a private deployment, you can instead set <b>POLLINATIONS_API_KEY</b> as a Cloudflare Pages secret.</p>
        <label>Video model</label><input value="google/veo-3.1-fast" readOnly/>
        <button className="generate" onClick={saveKey}><Check size={17}/> Save settings</button>
      </div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
