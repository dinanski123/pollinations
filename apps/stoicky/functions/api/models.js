const FALLBACK_VIDEO_MODELS = [
  { id: "google/veo-3.1-fast", title: "Google Veo 3.1 Fast", input_modalities: ["text"] },
  { id: "google/gemini-omni-1.1-flash", title: "Google Gemini Omni 1.1 Flash", input_modalities: ["text", "image"] },
  { id: "bytedance/seedance-2.0", title: "Seedance 2.0", input_modalities: ["text", "image"] },
  { id: "bytedance/seedance-2.0-fast", title: "Seedance 2.0 Fast", input_modalities: ["text", "image"] },
  { id: "bytedance/seedance-2.0-mini", title: "Seedance 2.0 Mini", input_modalities: ["text", "image"] },
  { id: "alibaba/wan-2.7", title: "Wan 2.7", input_modalities: ["text", "image"] },
  { id: "x-ai/grok-imagine-video-1.5", title: "Grok Imagine Video 1.5", input_modalities: ["text", "image"] },
  { id: "amazon/nova-reel-v1", title: "Amazon Nova Reel", input_modalities: ["text"] }
];

export async function onRequestGet() {
  try {
    const response = await fetch("https://gen.pollinations.ai/v1/models", {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) throw new Error("Model catalog unavailable.");

    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const videos = models
      .filter(isVideoModel)
      .map(normalizeModel)
      .filter(model => model.id);

    return json({ models: videos.length ? videos : FALLBACK_VIDEO_MODELS, live: videos.length > 0 });
  } catch {
    return json({ models: FALLBACK_VIDEO_MODELS, live: false });
  }
}

function isVideoModel(model) {
  const id = String(model?.id || model?.name || "").toLowerCase();
  const type = String(model?.type || model?.modality || "").toLowerCase();
  const output = [...(model?.output_modalities || []), ...(model?.outputModalities || [])].map(String).map(x => x.toLowerCase());
  return type === "video" || output.includes("video") || /video|veo|seedance|wan-2|nova-reel|happyhorse|p-video|minimax-h3/.test(id);
}

function normalizeModel(model) {
  const id = String(model.id || model.name || "").trim();
  const title = String(model.title || model.display_name || model.displayName || model.name || id).trim();
  const input = [
    ...(Array.isArray(model.input_modalities) ? model.input_modalities : []),
    ...(Array.isArray(model.inputModalities) ? model.inputModalities : [])
  ].map(String).map(x => x.toLowerCase());
  const capabilities = model.capabilities || {};
  const duration = model.duration || model.durations || capabilities.duration || capabilities.durations || null;
  return {
    id,
    title,
    input_modalities: input.length ? [...new Set(input)] : ["text"],
    duration
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
    }
  });
}