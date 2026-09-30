import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, ChevronDown, Film, Image as ImageIcon, Layers3, Link2, LogOut, Play, Plus, Sparkles, Wand2, X } from "lucide-react";
import "./styles.css";

const seedProjects = [
  { id: 1, title: "The discipline nobody talks about", status: "Preview", scenes: 8, updated: "Example", image: "https://image.pollinations.ai/prompt/cinematic%20stoic%20man%20walking%20alone%20at%20night%20rain%20vertical?width=420&height=620&nologo=true" },
  { id: 2, title: "7 rules for a stronger mind", status: "Example", scenes: 6, updated: "Example", image: "https://image.pollinations.ai/prompt/dark%20cinematic%20mountain%20silhouette%20sunrise%20vertical?width=420&height=620&nologo=true" }
];

const durationSeconds = { "30 seconds": 30, "45 seconds": 45, "60 seconds": 60 };
const videoModels = {
  "Google Veo 3.1 Fast": "google/veo-3.1-fast",
  "Amazon Nova Reel": "amazon/nova-reel-v1",
  "Seedance 2.0 Fast": "bytedance/seedance-2.0-fast",
  "Wan 2.7": "alibaba/wan-2.7"
};
const POLLINATIONS_AUTHORIZE_URL = "https://enter.pollinations.ai/authorize";
const POLLINATIONS_TOKEN_URL = "https://enter.pollinations.ai/api/oauth/token";

function redirectUri() {
  return window.location.origin + "/callback";
}

function randomToken(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}

function base64Url(bytes) {
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createPkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function App() {
  const [view, setView] = useState("create");
  const [quests, setQuests] = useState(null);
  const [questLoading, setQuestLoading] = useState(false);
  const [questError, setQuestError] = useState("");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Stoic / cinematic");
  const [duration, setDuration] = useState("45 seconds");
  const [videoModel, setVideoModel] = useState("google/veo-3.1-fast");
  const [projects, setProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem("stoicky-projects")) || seedProjects; } catch { return seedProjects; }
  });
  const [appKey, setAppKey] = useState(() => localStorage.getItem("stoicky-pollinations-app-key") || "");
  const [userToken, setUserToken] = useState(() => sessionStorage.getItem("stoicky-pollinations-token") || "");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    localStorage.setItem("stoicky-projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    const finishOAuth = async () => {
      if (window.location.pathname !== "/callback") return;

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const expectedState = sessionStorage.getItem("stoicky-pollinations-state");
      const verifier = sessionStorage.getItem("stoicky-pollinations-verifier");
      const storedAppKey = localStorage.getItem("stoicky-pollinations-app-key") || "";

      if (!code) {
        const error = params.get("error");
        if (error) setAuthError(params.get("error_description") || error);
        window.history.replaceState({}, "", "/");
        return;
      }

      if (!state || !expectedState || state !== expectedState || !verifier || !storedAppKey) {
        setAuthError("Pollinations authorization could not be verified. Please connect again.");
        window.history.replaceState({}, "", "/");
        return;
      }

      setAuthLoading(true);
      try {
        const response = await fetch(POLLINATIONS_TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            client_id: storedAppKey,
            redirect_uri: redirectUri(),
            code_verifier: verifier
          })
        });
        const data = await response.json();
        if (!response.ok || !data.access_token) {
          throw new Error(data.error_description || data.error || "Pollinations authorization failed.");
        }
        sessionStorage.setItem("stoicky-pollinations-token", data.access_token);
        setUserToken(data.access_token);
        setAuthError("");
        setNotice("Pollinations connected.");
      } catch (error) {
        setAuthError(error.message || "Pollinations authorization failed.");
      } finally {
        sessionStorage.removeItem("stoicky-pollinations-state");
        sessionStorage.removeItem("stoicky-pollinations-verifier");
        setAuthLoading(false);
        window.history.replaceState({}, "", "/");
      }
    };

    finishOAuth();
  }, []);

  const saveSettings = () => {
    const key = appKey.trim();
    if (!key || !key.startsWith("pk_")) {
      setAuthError("Enter your Pollinations App Key starting with pk_.");
      return;
    }
    localStorage.setItem("stoicky-pollinations-app-key", key);
    setAppKey(key);
    setAuthError("");
    setShowSettings(false);
    setNotice("Pollinations App Key saved.");
  };

  const connectPollinations = async () => {
    const key = appKey.trim();
    if (!key) {
      setShowSettings(true);
      setNotice("Enter your Pollinations pk_ App Key first.");
      return;
    }
    if (!key.startsWith("pk_")) {
      setNotice("That does not look like a Pollinations App Key. It should start with pk_.");
      setShowSettings(true);
      return;
    }

    localStorage.setItem("stoicky-pollinations-app-key", key);

    const verifier = randomToken(48);
    const state = randomToken(24);
    const challenge = await createPkceChallenge(verifier);

    sessionStorage.setItem("stoicky-pollinations-verifier", verifier);
    sessionStorage.setItem("stoicky-pollinations-state", state);

    const params = new URLSearchParams({
      response_type: "code",
      client_id: key,
      redirect_uri: redirectUri(),
      scope: "usage",
      models: "openai/gpt-5.4-nano,google/veo-3.1-fast,amazon/nova-reel-v1,bytedance/seedance-2.0-fast,alibaba/wan-2.7",
      expiry: "7",
      budget: "25",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    window.location.href = POLLINATIONS_AUTHORIZE_URL + "?" + params.toString();
  };

  const loadQuests = async () => {
    if (!userToken) { setNotice("Connect Pollinations to view your quests."); return; }
    setQuestLoading(true);
    setQuestError("");
    try {
      const response = await fetch("/api/quests", { headers: authHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load Pollinations quests.");
      setQuests(data);
    } catch (error) {
      setQuestError(error.message || "Could not load quests.");
    } finally {
      setQuestLoading(false);
    }
  };

  const disconnectPollinations = () => {
    sessionStorage.removeItem("stoicky-pollinations-token");
    setUserToken("");
    setNotice("Pollinations disconnected.");
  };

  const authHeaders = () => userToken ? { "x-pollinations-key": userToken } : {};

  const generate = async () => {
    if (!topic.trim()) { setNotice("Add a topic first."); return; }
    if (!userToken) { setNotice("Connect Pollinations before generating a video."); return; }

    setBusy(true);
    setNotice("");
    setVideoUrl("");

    try {
      setProgress("Writing script...");
      const scriptRes = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
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
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          prompt: videoPrompt,
          duration: durationSeconds[duration],
          model: videoModel
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
          <button className={"nav-item " + (view === "quests" ? "active" : "")} onClick={() => { setView("quests"); loadQuests(); }}><Sparkles size={17}/> Pollen & Quests</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="usage"><div><span>Generation status</span><strong>{busy ? "WORKING" : "READY"}</strong></div><div className="meter"><i style={{width: busy ? "45%" : "100%"}}/></div><small>{userToken ? "Pollinations wallet connected" : "Connect Pollinations to generate"}</small></div>
          <button className="settings-btn" onClick={() => setShowSettings(true)}>Settings</button>
          <div className="user"><div className="avatar">F</div><div><strong>Creator</strong><span>Stoicky</span></div><ChevronDown size={15}/></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">AI VIDEO STUDIO</span><h1>{view === "create" ? "Create a video" : view === "projects" ? "Your projects" : view === "quests" ? "Pollen & Quests" : "Templates"}</h1></div>
          <div className="top-actions">
            <button className={"connect-pill " + (userToken ? "connected" : "")} onClick={userToken ? disconnectPollinations : connectPollinations} disabled={authLoading}>
              {authLoading ? <span className="spinner"/> : userToken ? <><Check size={13}/> Connected</> : <><Link2 size={13}/> Connect Pollinations</>}
            </button>
            <button className="avatar small">F</button>
          </div>
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
                <div><label>Video model</label><select value={videoModel} onChange={e => setVideoModel(e.target.value)}>{Object.entries(videoModels).map(([name,id]) => <option key={id} value={id}>{name}</option>)}</select></div>
              </div>
              {progress && <div className="progress"><span className="spinner"/><span>{progress}</span></div>}
              {notice && <div className="notice">{notice}{!userToken && <button onClick={() => setShowSettings(true)}>Open Settings</button>}</div>}
              <button className="generate" onClick={generate} disabled={busy}>{busy ? <><span className="spinner dark"/> Generating...</> : <><Sparkles size={17}/> Generate video <ArrowRight size={17}/></>}</button>
              <p className="fineprint">Your Pollinations connection authorizes Stoicky to use the Pollen budget you approve.</p>
            </div>

            <div className="panel pipeline">
              <div className="panel-head"><div><h2>Production pipeline</h2><p>{busy ? "Your generation is in progress." : "Everything happens in one flow."}</p></div></div>
              {[[ "01","Script","AI writes a short-form script with a strong hook."],[ "02","Scenes","The script becomes visual direction automatically."],[ "03","Video","Pollinations generates the cinematic video."],[ "04","Review","Preview the result and keep the project." ]].map((item,i) => <div className={"step " + (busy && i === (progress?.includes("script") ? 0 : progress?.includes("video") ? 2 : 1) ? "current" : "")} key={item[0]}><div className="step-no">{item[0]}</div><div><strong>{item[1]}</strong><p>{item[2]}</p></div>{busy && i < 3 && <span className="dot"/>}</div>)}
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

        {view === "quests" && (
          <section className="quests">
            <div className="panel quest-hero">
              <div><span className="eyebrow">POLLINATIONS</span><h2>Earn free Pollen through real usage.</h2><p>Stoicky can show your current quest status and help you complete eligible activities. Rewards are claimed in Pollinations, not automatically by Stoicky.</p></div>
              <button className="secondary-action quest-refresh" onClick={loadQuests} disabled={questLoading}>{questLoading ? "Refreshing..." : "Refresh quests"}</button>
            </div>
            {!userToken ? <div className="panel empty-state"><Sparkles size={24}/><h3>Connect Pollinations first</h3><p>Connect your Pollinations account so Stoicky can read your quest status.</p><button className="generate compact" onClick={connectPollinations}><Link2 size={15}/> Connect Pollinations</button></div> :
              questError ? <div className="notice">{questError}</div> :
              !quests ? <div className="panel empty-state"><span className="spinner"/><p>Loading your quests...</p></div> :
              <div className="quest-grid">
                {(() => {
                  const list = Array.isArray(quests) ? quests : (quests.quests || quests.data || []);
                  return list.map((q, i) => {
                    const completed = Boolean(q.completed || q.claimed || q.status === "completed" || q.status === "claimed");
                    const claimable = Boolean(q.claimable || q.status === "claimable");
                    return <article className={"panel quest-card " + (completed ? "done" : "")} key={q.id || q.questId || i}>
                      <div className="quest-card-top"><span className={"quest-state " + (completed ? "done" : claimable ? "claimable" : "")}>{completed ? "COMPLETED" : claimable ? "CLAIMABLE" : "OPEN"}</span><strong>+{q.reward ?? q.rewardAmount ?? q.pollen ?? "?"} Pollen</strong></div>
                      <h3>{q.title || q.name || q.description || "Pollinations Quest"}</h3>
                      <p>{q.description || q.instructions || "Complete the qualifying activity shown in Pollinations."}</p>
                      {claimable && <a className="watch-link" href="https://enter.pollinations.ai/quests" target="_blank" rel="noreferrer">Claim in Pollinations <ArrowRight size={12}/></a>}
                    </article>;
                  });
                })()}
              </div>}
            <div className="panel quest-note"><strong>Keep it legitimate.</strong><span>Stoicky will only surface quests and use its normal AI features. It will not spam requests or manufacture activity just to farm rewards.</span><a href="https://enter.pollinations.ai/quests" target="_blank" rel="noreferrer">Open Quest Center <ArrowRight size={12}/></a></div>
          </section>
        )}

        {view === "templates" && (
          <section className="templates"><div className="template-hero"><div><span className="eyebrow">START FASTER</span><h2>Templates for faceless content.</h2><p>Pick a visual direction and spend your time on the idea—not the editing.</p></div></div><div className="template-grid">{["Stoic Motivation","Dark Psychology","Story / Narrative","Facts & Lists"].map((x,i)=><article key={x} className="template-card"><div className={"template-art art-" + i}><ImageIcon size={24}/></div><div><strong>{x}</strong><span>Vertical · 30–60 sec</span></div><button onClick={()=>{setStyle(x);setView("create")}}>Use template <ArrowRight size={14}/></button></article>)}</div></section>
        )}
      </main>

      {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>Pollinations</h2><button onClick={() => setShowSettings(false)}><X size={18}/></button></div>
        <label>Pollinations App Key</label>
        <input type="text" value={appKey} onChange={e => setAppKey(e.target.value)} placeholder="pk_..." autoComplete="off"/>
        <p className="modal-copy">Your publishable <b>pk_</b> App Key identifies Stoicky. When you connect, Pollinations asks you to approve a Pollen budget and returns a temporary user-authorized <b>sk_</b> token. Stoicky keeps that token in this browser session only.</p><p className="modal-copy"><b>Important:</b> the App Key must permit at least one text model for script generation and the video model you want to use. Stoicky no longer hard-restricts the OAuth request to a fixed model list; the permissions on your App Key control access.</p>
        {authError && <div className="notice">{authError}</div>}
        <button className="generate" onClick={connectPollinations} disabled={authLoading}>{authLoading ? <><span className="spinner dark"/> Connecting...</> : <><Link2 size={17}/> Connect Pollinations</>}</button>
        <button className="secondary-action" onClick={saveSettings}><Check size={14}/> Save App Key</button>
        {userToken && <button className="disconnect-btn" onClick={disconnectPollinations}><LogOut size={14}/> Disconnect</button>}
        <label className="model-label">Default video model</label>
        <select value={videoModel} onChange={e => setVideoModel(e.target.value)}>{Object.entries(videoModels).map(([name,id]) => <option key={id} value={id}>{name}</option>)}</select>
        <p className="modal-copy">Nova Reel is available through Pollinations as <b>amazon/nova-reel-v1</b>. Your approved model restrictions must include any model you select.</p>
      </div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
