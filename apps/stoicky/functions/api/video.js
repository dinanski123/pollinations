export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    const duration = Math.max(4, Math.min(60, Number(body.duration) || 8));
    const model = String(body.model || "google/veo-3.1-fast");
    const imageData = String(body.imageData || "").trim();
    const key = env.POLLINATIONS_API_KEY || request.headers.get("x-pollinations-key");

    if (!prompt) return json({ error: "Video prompt is required." }, 400);
    if (!key) return json({ error: "Add a Pollinations API key in Stoicky Settings, or configure POLLINATIONS_API_KEY in Cloudflare Pages." }, 401);
    if (imageData && imageData.length > 5_000_000) return json({ error: "Face reference image is too large. Use a clear JPG/PNG under 5 MB." }, 413);

    let upstream;
    if (imageData) {
      // Pollinations supports image inputs for video-capable models through the OpenAI-compatible
      // media conversation endpoint. The image is used as the video's starting/reference frame.
      upstream = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: `${prompt}. Use the supplied reference image as the same person's appearance. Preserve recognizable facial identity, hair, skin tone and overall likeness throughout the shot. Do not add captions or logos.` },
              { type: "image_url", image_url: { url: imageData } }
            ]
          }]
        })
      });
    } else {
      const url = new URL(`https://gen.pollinations.ai/video/${encodeURIComponent(prompt)}`);
      url.searchParams.set("model", model);
      url.searchParams.set("duration", String(duration));
      upstream = await fetch(url, {
        headers: { "Authorization": `Bearer ${key}` }
      });
    }

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
      if (imageData) {
        const content = data?.choices?.[0]?.message?.content || "";
        const urls = [...content.matchAll(/https?:\\/\\/[^\\s)]+/g)].map(m => m[0]);
        const url = data?.data?.[0]?.url || data?.url || urls[0] || "";
        if (!url) return json({ error: "The video model returned no video URL." }, 502);
        return json({ url, raw: data });
      }
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
