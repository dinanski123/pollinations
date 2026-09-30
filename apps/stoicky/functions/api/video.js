export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const duration = Math.max(4, Math.min(60, Number(body.duration) || 8));
    const model = String(body.model || "google/veo-3.1-fast");
    const key = env.POLLINATIONS_API_KEY || request.headers.get("x-pollinations-key");

    if (!prompt) return json({ error: "Video prompt is required." }, 400);
    if (!key) return json({ error: "Add a Pollinations API key in Stoicky Settings, or configure POLLINATIONS_API_KEY in Cloudflare Pages." }, 401);

    const url = new URL(`https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}`);
    url.searchParams.set("model", model);
    url.searchParams.set("duration", String(duration));

    const upstream = await fetch(url, {
      headers: { "Authorization": `Bearer ${key}` }
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error?.message || parsed?.error || message;
      } catch {}
      return json({ error: message || "Video generation failed." }, upstream.status);
    }

    const contentType = upstream.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await upstream.json();
      return json(data);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType || "video/mp4",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return json({ error: error.message || "Unexpected video generation error." }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
