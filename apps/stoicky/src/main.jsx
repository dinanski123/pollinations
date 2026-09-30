import React, { useEffect, useRef, useState } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { createRoot } from "react-dom/client";
import { ArrowRight, Check, ChevronDown, ExternalLink, Film, Image as ImageIcon, Layers3, Link2, LogOut, Play, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
import "./styles.css";
import { deleteAssets, getAsset, requestPersistentStorage, safeFilename, saveAsset } from "./storage";

const seedProjects = [
  { id: 1, title: "The discipline nobody talks about", status: "Preview", scenes: 8, updated: "Example", image: "https://image.pollinations.ai/prompt/cinematic%20stoic%20man%20walking%20alone%20at%20night%20rain%20vertical?width=420&height=620&nologo=true", example: true },
  { id: 2, title: "7 rules for a stronger mind", status: "Example", scenes: 6, updated: "Example", image: "https://image.pollinations.ai/prompt/dark%20cinematic%20mountain%20silhouette%20sunrise%20vertical?width=420&height=620&nologo=true", example: true }
];

const durationSeconds = { "30 seconds": 30, "45 seconds": 45, "60 seconds": 60 };
const voiceModels = {
  Rachel: "rachel", Adam: "adam", Antoni: "antoni", Bella: "bella",
  Josh: "josh", Daniel: "daniel", Nova: "nova", Sage: "sage"
};
const FALLBACK_VIDEO_MODELS = [
  { id: "google/veo-3.1-fast", title: "Google Veo 3.1 Fast", input_modalities: ["text"] },
  { id: "google/gemini-omni-1.1-flash", title: "Google Gemini Omni 1.1 Flash", input_modalities: ["text", "image"] },
  { id: "bytedance/seedance-2.0", title: "Seedance 2.0", input_modalities: ["text", "image"] },
  { id: "bytedance/seedance-2.0-fast", title: "Seedance 2.0 Fast", input_modalities: ["text", "image"] },
  { id: "alibaba/wan-2.7", title: "Wan 2.7", input_modalities: ["text", "image"] },
  { id: "x-ai/grok-imagine-video-1.5", title: "Grok Imagine Video 1.5", input_modalities: ["text", "image"] },
  { id: "amazon/nova-reel-v1", title: "Amazon Nova Reel", input_modalities: ["text"] }
];
const CHARACTER_ASSET_ID = "stoicky-character-reference";
const POLLINATIONS_AUTHORIZE_URL = "https://enter.pollinations.ai/authorize";
const POLLINATIONS_TOKEN_URL = "https://enter.pollinations.ai/api/oauth/token";

function sceneCountFor(duration) {
  return duration === "30 seconds" ? 5 : duration === "45 seconds" ? 8 : 10;
}

function modelSupportsImage(model) {
  return (model?.input_modalities || model?.inputModalities || []).map(String).map(x => x.toLowerCase()).includes("image");
}

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
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not prepare the reference image.")), "image/jpeg", 0.82);
      };
      img.onerror = () => reject(new Error("That file is not a valid image."));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read the reference image."));
    reader.readAsDataURL(blob);
  });
}

function normalizeModels(data) {
  const list = Array.isArray(data?.models) ? data.models : [];
  return list
    .map(model => ({
      id: String(model.id || "").trim(),
      title: String(model.title || model.display_name || model.displayName || model.name || model.id || "").trim(),
      input_modalities: [
        ...(Array.isArray(model.input_modalities) ? model.input_modalities : []),
        ...(Array.isArray(model.inputModalities) ? model.inputModalities : [])
      ]
    }))
    .filter(model => model.id && model.title);
}

function App() {
  const [view, setView] = useState("create");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Stoic / cinematic");
  const [duration, setDuration] = useState("45 seconds");
  const [videoModel, setVideoModel] = useState("google/veo-3.1-fast");
  const [videoModels, setVideoModels] = useState(FALLBACK_VIDEO_MODELS);
  const [modelsLive, setModelsLive] = useState(false);
  const [voice, setVoice] = useState("rachel");
  const [voiceProvider, setVoiceProvider] = useState("pollinations");
  const [customVoiceId, setCustomVoiceId] = useState(() => localStorage.getItem("stoicky-elevenlabs-voice-id") || "");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [characterImage, setCharacterImage] = useState("");
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
  const ffmpegRef = useRef(null);

  const selectedModel = videoModels.find(model => model.id === videoModel) || { id: videoModel, title: videoModel, input_modalities: ["text"] };

  useEffect(() => {
    const stored = localStorage.getItem("stoicky-character-image");
    (async () => {
      try {
        if (stored) {
          await saveAsset(CHARACTER_ASSET_ID, await fetch(stored).then(r => r.blob()), "character-reference.jpg");
          localStorage.removeItem("stoicky-character-image");
        }
        const asset = await getAsset(CHARACTER_ASSET_ID);
        if (asset) setCharacterImage(URL.createObjectURL(asset.blob));
      } catch {
        setNotice("Saved character reference could not be loaded. You can choose it again.");
      }
    })();
  }, []);

  useEffect(() => {
    localStorage.setItem("stoicky-projects", JSON.stringify(projects.map(({ videoUrl, audioUrl, characterImage: _characterImage, ...project }) => project)));
  }, [projects]);

  useEffect(() => { requestPersistentStorage(); }, []);

  useEffect(() => {
    fetch("/api/models")
      .then(response => response.json())
      .then(data => {
        const models = normalizeModels(data);
        if (!models.length) return;
        setVideoModels(models);
        setModelsLive(Boolean(data.live));
        setVideoModel(current => models.some(model => model.id === current) ? current : models[0].id);
      })
      .catch(() => setModelsLive(false));
  }, []);

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
        if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || "Pollinations authorization failed.");
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
    if (!key) { setShowSettings(true); setNotice("Enter your Pollinations pk_ App Key first."); return; }
    if (!key.startsWith("pk_")) { setNotice("That does not look like a Pollinations App Key. It should start with pk_."); setShowSettings(true); return; }

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
      const blob = await resizeReferenceImage(file);
      await saveAsset(CHARACTER_ASSET_ID, blob, "character-reference.jpg");
      const previewUrl = URL.createObjectURL(blob);
      setCharacterImage(previewUrl);
      setNotice("Character reference saved in this browser.");
      const imageModel = videoModels.find(model => modelSupportsImage(model));
      if (!modelSupportsImage(selectedModel) && imageModel) {
        setVideoModel(imageModel.id);
        setNotice(`Character reference saved. Switched to ${imageModel.title}, which accepts image input.`);
      }
    } catch (error) {
      setNotice(error.message || "Could not save the character reference.");
    } finally {
      event.target.value = "";
    }
  };

  const clearCharacter = async () => {
    await deleteAssets([CHARACTER_ASSET_ID]);
    setCharacterImage("");
    localStorage.removeItem("stoicky-character-name");
    setCharacterName("");
    setNotice("Character reference removed from this browser.");
  };

  const loadFFmpeg = async () => {
    if (ffmpegRef.current?.loaded) return ffmpegRef.current;
    const ffmpeg = ffmpegRef.current || new FFmpeg();
    if (!ffmpeg.loaded) {
      setProgress("Loading browser video mixer (first use is about 30 MB)...");
      const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm")
      });
    }
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const stitchClips = async (clips, targetSeconds) => {
    const ffmpeg = await loadFFmpeg();
    setProgress(`Assembling ${clips.length} generated scenes in the browser...`);

    const files = [];
    for (let i = 0; i < clips.length; i++) {
      const name = `scene-${i}.mp4`;
      await ffmpeg.writeFile(name, await fetchFile(clips[i]));
      files.push(name);
    }

    const filters = files.map((_, i) =>
      `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,tpad=stop_mode=clone:stop_duration=6,trim=duration=6,setpts=PTS-STARTPTS[v${i}]`
    );
    filters.push(files.map((_, i) => `[v${i}]`).join("") + `concat=n=${files.length}:v=1:a=0[outv]`);

    await ffmpeg.exec([
      ...files.flatMap(name => ["-i", name]),
      "-filter_complex", filters.join(";"),
      "-map", "[outv]",
      "-t", String(targetSeconds),
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "stitched.mp4"
    ]);

    const data = await ffmpeg.readFile("stitched.mp4");
    files.forEach(name => { try { ffmpeg.deleteFile(name); } catch {} });
    try { ffmpeg.deleteFile("stitched.mp4"); } catch {}
    return URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
  };

  const muxVideoAndAudio = async (videoSource, audioSource) => {
    const ffmpeg = await loadFFmpeg();
    setProgress("Mixing narration into the finished video...");
    await ffmpeg.writeFile("mix-input.mp4", await fetchFile(videoSource));
    await ffmpeg.writeFile("mix-voice.mp3", await fetchFile(audioSource));
    await ffmpeg.exec([
      "-i", "mix-input.mp4",
      "-i", "mix-voice.mp3",
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-c:v", "copy",
      "-af", "apad",
      "-c:a", "aac",
      "-shortest",
      "-movflags", "+faststart",
      "mixed.mp4"
    ]);
    const data = await ffmpeg.readFile("mixed.mp4");
    try { ffmpeg.deleteFile("mix-input.mp4"); ffmpeg.deleteFile("mix-voice.mp3"); ffmpeg.deleteFile("mixed.mp4"); } catch {}
    return URL.createObjectURL(new Blob([data.buffer], { type: "video/mp4" }));
  };

  const openProject = async project => {
    if (!project.videoAssetId) {
      setNotice("This is an example project; there is no local video file to open.");
      return;
    }
    setNotice("");
    setProgress("Loading saved project from device storage...");
    try {
      const videoAsset = await getAsset(project.videoAssetId);
      const audioAsset = await getAsset(project.audioAssetId);
      if (!videoAsset) throw new Error("The saved video file is missing from this browser.");
      setVideoUrl(URL.createObjectURL(videoAsset.blob));
      setAudioUrl(audioAsset ? URL.createObjectURL(audioAsset.blob) : "");
      setTopic(project.script?.title || project.title || "");
      setView("create");
      setProgress("Saved project loaded.");
    } catch (error) {
      setNotice(error.message || "Could not load the saved project.");
      setProgress("");
    }
  };

  const downloadProject = async project => {
    try {
      const asset = await getAsset(project.videoAssetId);
      if (!asset) throw new Error("The saved video file is missing from this browser.");
      const url = URL.createObjectURL(asset.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = asset.filename || safeFilename(project.title) + ".mp4";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Video saved to your Downloads.");
    } catch (error) {
      setNotice(error.message || "Could not download the video.");
    }
  };

  const shareProject = async project => {
    try {
      const asset = await getAsset(project.videoAssetId);
      if (!asset) throw new Error("The saved video file is missing from this browser.");
      const file = new File([asset.blob], asset.filename || safeFilename(project.title) + ".mp4", { type: asset.mime || "video/mp4" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: project.title, files: [file] });
        setNotice("Video shared.");
      } else {
        await downloadProject(project);
        setNotice("File sharing is not supported here, so the video was downloaded instead.");
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      setNotice(error.message || "Could not share the video.");
    }
  };

  const deleteProject = async project => {
    if (project.example) return;
    const confirmed = window.confirm(`Delete “${project.title}”? This removes the project and its saved files from this browser.`);
    if (!confirmed) return;
    try {
      await deleteAssets([project.videoAssetId, project.audioAssetId]);
      setProjects(current => current.filter(item => item.id !== project.id));
      setVideoUrl("");
      setAudioUrl("");
      setNotice("Project and its saved files were deleted from this browser.");
    } catch (error) {
      setNotice(error.message || "Could not delete the saved files.");
    }
  };

  const generate = async () => {
    if (!topic.trim()) { setNotice("Add a topic first."); return; }
    if (!userToken) { setNotice("Connect Pollinations before generating a video."); return; }
    if (characterImage && !modelSupportsImage(selectedModel)) {
      setNotice("This video model does not accept image input. Choose an image-capable model or remove the face reference.");
      return;
    }

    const totalSeconds = durationSeconds[duration];
    const sceneCount = sceneCountFor(duration);
    const clipDuration = 6;
    const scriptModel = "openai/gpt-5.4-nano";
    let generatedClips = [];
    let generatedAudioUrl = "";

    setBusy(true);
    setNotice("");
    setVideoUrl("");
    setAudioUrl("");

    try {
      setProgress("Writing the scene-by-scene script...");
      const scriptRes = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ topic, style, duration, sceneCount, model: scriptModel })
      });
      const scriptData = await scriptRes.json();
      if (!scriptRes.ok) throw new Error(scriptData.error || "Script generation failed.");
      const script = scriptData.script;

      for (let index = 0; index < sceneCount; index++) {
        const scene = script.scenes[index];
        const continuity = `Keep visual continuity with the previous scene. Overall style: ${style}. Vertical 9:16. No text, captions, logos or UI.`;
        const subject = characterImage
          ? `The supplied person is the central on-camera subject. Preserve the person's recognizable appearance and keep them consistent. ${characterName ? `The person is described as "${characterName}".` : ""}`
          : "Use a coherent cinematic subject without showing a recognizable real person.";
        const prompt = `${scene.visual} ${continuity} ${subject} Natural motion, deliberate camera movement, cinematic lighting, realistic texture.`;

        setProgress(`Generating scene ${index + 1} of ${sceneCount} — this may take a few minutes...`);
        const videoRes = await fetch("/api/video", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            prompt,
            duration: clipDuration,
            model: videoModel,
            aspectRatio: "9:16",
            imageData: characterImage ? await blobToDataUrl(await fetch(characterImage).then(r => r.blob())) : "",
            imageInputSupported: modelSupportsImage(selectedModel)
          })
        });

        const type = videoRes.headers.get("content-type") || "";
        if (!videoRes.ok) {
          const errorData = type.includes("json") ? await videoRes.json() : { error: await videoRes.text() };
          throw new Error(`Scene ${index + 1} failed: ${errorData.error || "Video generation failed."}`);
        }
        const blob = await videoRes.blob();
        if (!blob.size) throw new Error(`Scene ${index + 1} returned an empty video.`);
        const clipUrl = URL.createObjectURL(blob);
        generatedClips.push(clipUrl);
      }

      const stitchedUrl = await stitchClips(generatedClips, totalSeconds);
      generatedClips.forEach(url => URL.revokeObjectURL(url));
      generatedClips = [];
      let finalUrl = stitchedUrl;

      if (voiceEnabled) {
        setProgress("Generating narration for the full edit...");
        const narration = [script.hook, ...(script.scenes || []).map(scene => scene.narration)].filter(Boolean).join(" ");
        const audioRes = await fetch("/api/audio", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ input: narration, model: "elevenlabs/eleven-v3", voice, provider: voiceProvider, voiceId: customVoiceId })
        });
        const audioType = audioRes.headers.get("content-type") || "";
        if (!audioRes.ok) {
          const errorData = audioType.includes("json") ? await audioRes.json() : { error: await audioRes.text() };
          throw new Error(errorData.error || "Narration generation failed.");
        }
        const audioBlob = await audioRes.blob();
        generatedAudioUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(generatedAudioUrl);
        finalUrl = await muxVideoAndAudio(finalUrl, generatedAudioUrl);
      }

      const projectId = Date.now();
      const videoAssetId = `project-${projectId}-video`;
      const audioAssetId = generatedAudioUrl ? `project-${projectId}-audio` : "";
      const title = script.title || topic.trim().slice(0, 54);

      setProgress("Saving the finished edit to device storage...");
      const finalBlob = await fetch(finalUrl).then(response => {
        if (!response.ok) throw new Error("Could not read the finished video for device storage.");
        return response.blob();
      });
      await saveAsset(videoAssetId, finalBlob, safeFilename(title) + ".mp4");
      if (generatedAudioUrl) {
        const audioBlob = await fetch(generatedAudioUrl).then(response => response.blob());
        await saveAsset(audioAssetId, audioBlob, safeFilename(title) + "-narration.mp3");
      }

      const project = {
        id: projectId,
        title,
        status: "Ready",
        scenes: sceneCount,
        duration: totalSeconds,
        updated: "Just now",
        image: seedProjects[0].image,
        videoAssetId,
        audioAssetId,
        voice,
        videoModel,
        script
      };

      setProjects(current => [project, ...current.filter(item => item.id !== projectId)]);
      setVideoUrl(finalUrl);
      setProgress(voiceEnabled ? `Finished ${totalSeconds}-second video with narration.` : `Finished ${totalSeconds}-second video.`);
      setView("projects");
    } catch (error) {
      generatedClips.forEach(url => URL.revokeObjectURL(url));
      setNotice(error.message || "Generation failed.");
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  const currentStep = progress.toLowerCase().includes("script") ? 0
    : progress.toLowerCase().includes("scene") || progress.toLowerCase().includes("assembling") ? 1
    : progress.toLowerCase().includes("narration") || progress.toLowerCase().includes("mixing") ? 2
    : 3;

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
              <div className="panel-head"><div><h2>Turn an idea into a video</h2><p>Build a real multi-scene edit with optional person reference and generated narration.</p></div><Wand2 size={20}/></div>
              <label>What should the video be about?</label>
              <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. 5 rules to become mentally stronger..." rows="5"/>
              <div className="examples"><span>Try:</span><button onClick={() => setTopic("5 stoic rules for staying calm under pressure")}>Stoic rules</button><button onClick={() => setTopic("Why discipline beats motivation every time")}>Discipline</button><button onClick={() => setTopic("3 habits that quietly change your life")}>Habits</button></div>
              <div className="field-row">
                <div><label>Visual style</label><select value={style} onChange={e => setStyle(e.target.value)}><option>Stoic / cinematic</option><option>Dark documentary</option><option>Minimal luxury</option><option>Motivational</option></select></div>
                <div><label>Duration</label><select value={duration} onChange={e => setDuration(e.target.value)}><option>30 seconds</option><option>45 seconds</option><option>60 seconds</option></select></div>
                <div><label>Video model</label><select value={videoModel} onChange={e => setVideoModel(e.target.value)}>{videoModels.map(model => <option key={model.id} value={model.id}>{model.title}</option>)}</select></div>
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
                {characterImage && <small>{modelSupportsImage(selectedModel) ? "Reference image is stored in IndexedDB and sent only with each compatible video request." : "The current model does not accept image input. Stoicky will switch to a compatible model when possible."}</small>}
              </div>
              <div className="audio-box">
                <div><label>Voice & narration</label><p>Generate spoken narration separately so video clips can remain video-only.</p></div>
                <div className="audio-controls">
                  <label className="toggle"><input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)}/><span/> Narration</label>
                  <select value={voiceProvider} onChange={e => setVoiceProvider(e.target.value)} disabled={!voiceEnabled}>
                    <option value="pollinations">Pollinations voice</option>
                    <option value="elevenlabs">Authorized custom voice</option>
                  </select>
                  {voiceProvider === "pollinations" ? <select value={voice} onChange={e => setVoice(e.target.value)} disabled={!voiceEnabled}>{Object.entries(voiceModels).map(([name,id]) => <option key={id} value={id}>{name}</option>)}</select> : <input className="voice-id" value={customVoiceId} onChange={e => { setCustomVoiceId(e.target.value); localStorage.setItem("stoicky-elevenlabs-voice-id", e.target.value); }} placeholder="ElevenLabs voice ID"/>}
                </div>
                {audioUrl && <audio controls src={audioUrl} className="audio-player"/>}
                <small>For an actual person’s voice, use an authorized/shared ElevenLabs voice ID. The ElevenLabs API key stays server-side in Cloudflare.</small>
              </div>
              {progress && <div className="progress"><span className="spinner"/><span>{progress}</span></div>}
              {notice && <div className="notice">{notice}{!userToken && <button onClick={() => setShowSettings(true)}>Open Settings</button>}</div>}
              <button className="generate" onClick={generate} disabled={busy}>{busy ? <><span className="spinner dark"/> Generating...</> : <><Sparkles size={17}/> Generate video <ArrowRight size={17}/></>}</button>
              <p className="fineprint">Each scene is generated separately, then stitched and mixed in your browser. Your approved Pollinations budget pays for the AI generations.</p>
            </div>

            <div className="panel pipeline">
              <div className="panel-head"><div><h2>Production pipeline</h2><p>{busy ? "Generating real scene clips and assembling them locally." : "Script → scenes → stitch → narration → saved project."}</p></div></div>
              {[["01","Script","AI writes the hook and exact scene plan."],["02","Scenes","Each scene becomes its own video generation."],["03","Edit","Browser FFmpeg stitches and trims the clips."],["04","Review","Narration is mixed and the project is saved."]].map((item,i) => <div className={"step " + (busy && i === currentStep ? "current" : "")} key={item[0]}><div className="step-no">{item[0]}</div><div><strong>{item[1]}</strong><p>{item[2]}</p></div>{busy && i < 3 && <span className="dot"/>}</div>)}
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
              <div className="thumb" style={{backgroundImage:'url("' + p.image + '")'}}><span className={"status " + (p.status === "Ready" ? "ready" : "")}>{p.status}</span>{p.videoAssetId ? <button className="play" onClick={() => openProject(p)}><Play size={18} fill="currentColor"/></button> : <span className="play" title="Example project"><ImageIcon size={16}/></span>}</div>
              <div className="project-info"><div className="project-title-row"><h3>{p.title}</h3>{!p.example && <button className="delete-project" title="Delete project" aria-label={"Delete " + p.title} onClick={() => deleteProject(p)}><Trash2 size={14}/></button>}</div><div><span>{p.scenes} scenes</span><span>·</span><span>{p.duration ? p.duration + " sec" : p.updated}</span></div>{p.videoAssetId && <div className="project-actions"><button className="watch-link" onClick={() => openProject(p)}>Open video <ArrowRight size={12}/></button><button className="watch-link" onClick={() => downloadProject(p)}>Download MP4 <ArrowRight size={12}/></button><button className="watch-link" onClick={() => shareProject(p)}>Share <ArrowRight size={12}/></button></div>}</div>
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
        <p className="modal-copy">Your publishable <b>pk_</b> App Key identifies Stoicky. When you connect, Pollinations asks you to approve a Pollen budget and returns a temporary user-authorized <b>sk_</b> token. Stoicky keeps that token in this browser session only.</p>
        {authError && <div className="notice">{authError}</div>}
        <button className="generate" onClick={connectPollinations} disabled={authLoading}>{authLoading ? <><span className="spinner dark"/> Connecting...</> : <><Link2 size={17}/> Connect Pollinations</>}</button>
        <button className="secondary-action" onClick={saveSettings}><Check size={14}/> Save App Key</button>
        {userToken && <button className="disconnect-btn" onClick={disconnectPollinations}><LogOut size={14}/> Disconnect</button>}
        <label className="model-label">Default video model</label>
        <select value={videoModel} onChange={e => setVideoModel(e.target.value)}>{videoModels.map(model => <option key={model.id} value={model.id}>{model.title}</option>)}</select>
        <p className="modal-copy">{modelsLive ? "Live Pollinations model catalog loaded." : "Using the built-in fallback model catalog until the live catalog is reachable."} {characterImage ? "Image-capable models are required for the current face reference." : ""}</p>
      </div></div>}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);