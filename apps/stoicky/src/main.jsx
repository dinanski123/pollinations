import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, ChevronDown, ExternalLink, Film, Image as ImageIcon, Layers3, Link2, LogOut, Play, Plus, Sparkles, Wand2, X } from "lucide-react";
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
const voiceModels = {
  "Rachel": "rachel",
  "Adam": "adam",
  "Antoni": "antoni",
  "Bella": "bella",
  "Josh": "josh",
  "Daniel": "daniel",
  "Nova": "nova",
  "Sage": "sage"
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

function resizeReferenceImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the reference image."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1024;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("That file is not a valid image."));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function App() {
  const [view, setView] = useState("create");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Stoic / cinematic");
  const [duration, setDuration] = useState("45 seconds");
  const [videoModel, setVideoModel] = useState("google/veo-3.1-fast");
  const [voice, setVoice] = useState("rachel");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [characterImage, setCharacterImage] = useState(() => localStorage.getItem("stoicky-character-image") || "");
  const [characterName, setCharacterName] = useState(() => localStorage.getItem("stoicky-character-name") || "");
  const [audioUrl, setAudioUrl] = useState("");
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
      expiry: "7",
      budget: "25",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });

    window.location.href = POLLINATIONS_AUTHORIZE_URL + "?" + params.toString();
  };

  const disconnectPollinations = () => {
    sessionStorage.removeItem("stoicky-pollinations-token");
    setUserToken("");
    setNotice("Pollinations disconnected.");
  };

  const authHeaders = () => userToken ? { "x-pollinations-key": userToken } : {};

  const handleCharacterUpload = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (!file.type.startsWith("image/")) throw new Error("Choose a JPG or PNG image.");
      const dataUrl = await resizeReferenceImage(file);
      if (dataUrl.length > 2_000_000) throw new Error("Reference image is still too large. Choose a smaller photo.");
      setCharacterImage(dataUrl);
      localStorage.setItem("stoicky-character-image", dataUrl);
      setNotice("Character reference saved in this browser.");
    } catch (error) {
      setNotice(error.message || "Could not save the character reference.");
    } finally {
      event.target.value = "";
    }
  };

  const clearCharacter = () => {
    localStorage.removeItem("stoicky-character-image");
    localStorage.removeItem("stoicky-character-name");
    setCharacterImage("");
    setCharacterName("");
  };

  const generate = async () => {
    if (!topic.trim()) { setNotice("Add a topic first."); return; }
    if (!userToken) { setNotice("Connect Pollinations before generating a video."); return; }

    setBusy(true);
    setNotice("");
    setVideoUrl("");
    setAudioUrl("");

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
          model: videoModel,
          imageData: characterImage || ""
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

      let generatedAudioUrl = "";
      if (voiceEnabled) {
        setProgress("Generating narration...");
        const narration = [script.hook, ...(script.scenes || []).map(scene => scene.narration)].filter(Boolean).join(" ");
        const audioRes = await fetch("/api/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ input: narration, model: "elevenlabs/eleven-v3", voice })
        });
        const audioType = audioRes.headers.get("content-type") || "";
        if (!audioRes.ok) {
          const errorData = audioType.includes("json") ? await audioRes.json() : { error: await audioRes.text() };
          throw new Error(errorData.error || "Narration generation failed.");
        }
        const audioBlob = await audioRes.blob();
        generatedAudioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(generatedAudioUrl);
      }

      const project = {
        id: Date.now(),
        title: script.title || topic.trim().slice(0, 54),
        status: "Ready",
        scenes: script.scenes?.length || 0,
        updated: "Just now",
        image: seedProjects[0].image,
        videoUrl: url,
        audioUrl: generatedAudioUrl,
        characterImage,
        voice,
        script
      };

      setProjects(p => [project, ...p]);
      setVideoUrl(url);
      setProgress(voiceEnabled ? "Video and narration ready." : "Video ready.");
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
          <button className="nav-item" onClick={() => window.open("https://enter.pollinations.ai/quests", "_blank", "noopener,noreferrer")}><Sparkles size={17}/> Pollen & Quests <ExternalLink size={13}/></button>
        </nav>
        <div className="sidebar-bottom">
          <div className="usage"><div><span>Generation status</span><strong>{busy ? "WORKING" : "READY"}</strong></div><div className="meter"><i style={{width: busy ? "45%" : "100%"}}/></div><small>{userToken ? "Pollinations wallet connected" : "Connect Pollinations to generate"}</small></div>
          <button className="settings-btn" onClick={() => setShowSettings(true)}>Settings</button>
          <div className="user"><div className="avatar">F</div><div><strong>Creator</strong><span>Stoicky</span></div><ChevronDown size={15}/></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div><span className="eyebrow">AI VIDEO STUDIO</span><h1>{view === "create" ? "Create a video" : view === "projects" ? "Your projects" : "Templates"}</h1></div>
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
              <div className="panel-head"><div><h2>Turn an idea into a video</h2><p>Build a cinematic video with an optional real-person reference and generated narration.</p></div><Wand2 size={20}/></div>
              <label>What should the video be about?</label>
              <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. 5 rules to become mentally stronger..." rows="5"/>
              <div className="examples"><span>Try:</span><button onClick={() => setTopic("5 stoic rules for staying calm under pressure")}>Stoic rules</button><button onClick={() => setTopic("Why discipline beats motivation every time")}>Discipline</button><button onClick={() => setTopic("3 habits that quietly change your life")}>Habits</button></div>
              <div className="field-row">
                <div><label>Visual style</label><select value={style} onChange={e => setStyle(e.target.value)}><option>Stoic / cinematic</option><option>Dark documentary</option><option>Minimal luxury</option><option>Motivational</option></select></div>
                <div><label>Duration</label><select value={duration} onChange={e => setDuration(e.target.value)}><option>30 seconds</option><option>45 seconds</option><option>60 seconds</option></select></div>
                <div><label>Video model</label><select value={videoModel} onChange={e => setVideoModel(e.target.value)}>{Object.entries(videoModels).map(([name,id]) => <option key={id} value={id}>{name}</option>)}</select></div>
              </div>
              <div className="character-box">
                <div className="character-head"><div><label>Person / face reference</label><p>Upload a photo only when you have permission to use the person’s likeness.</p></div>{characterImage && <button className="clear-character" onClick={clearCharacter}>Remove</button>}</div>
                <div className="character-controls">
                  {characterImage ? <img src={characterImage} className="character-thumb" alt="Saved face reference"/> : <div className="character-placeholder">No person selected</div>}
                  <div className="character-inputs">
                    <input value={characterName} onChange={e => { setCharacterName(e.target.value); localStorage.setItem("stoicky-character-name", e.target.value); }} placeholder="Person name (optional)"/>
                    <label className="upload-button">Choose photo<input type="file" accept="image/png,image/jpeg" onChange={handleCharacterUpload}/></label>
                  </div>
                </div>
                {characterImage && <small>Face reference is sent only with the video request. Compatible video models may use it as a starting/reference image.</small>}
              </div>
              <div className="audio-box">
                <div><label>Voice & narration</label><p>Generate spoken narration separately so silent video models can still have audio.</p></div>
                <div className="audio-controls">
                  <label className="toggle"><input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)}/><span/> Narration</label>
                  <select value={voice} onChange={e => setVoice(e.target.value)} disabled={!voiceEnabled}>{Object.entries(voiceModels).map(([name,id]) => <option key={id} value={id}>{name}</option>)}</select>
                </div>
                {audioUrl && <audio controls src={audioUrl} className="audio-player"/>}
                <small>For a person’s actual cloned voice, we’ll add an authorized voice-cloning provider separately. Pollinations’ current TTS API provides preset voices; its model-publishing docs do not support voice cloning.</small>
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
                {audioUrl && <div className="audio-preview"><span>NARRATION</span><audio controls src={audioUrl}/></div>}
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
