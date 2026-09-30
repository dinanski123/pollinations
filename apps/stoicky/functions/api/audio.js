export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const input = String(body.input || "").trim();
    const model = String(body.model || "elevenlabs/eleven-v3");
    const voice = String(body.voice || "rachel");
    const key = env.POLLINATIONS_API_KEY || request.headers.get("x-pollinations-key");

    if (!input) return json({ error: "Narration text is required." }, 400);
    if (input.length > 12000) return json({ error: "Narration is too long for one audio request." }, 413);
    if (!key) return json({ error: "Add a Pollinations API key in Stoicky Settings, or configure POLLINATIONS_API_KEY in Cloudflare Pages." }, 401);

    const upstream = await fetch("https://gen.pollinations.ai/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        voice,
        input,
        response_format: "mp3"
      })
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error?.message || parsed?.error || message;
      } catch {}
      return json({ error: message || "Voice generation failed." }, upstream.status);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return json({ error: error.message || "Unexpected audio generation error." }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
