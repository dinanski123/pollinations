export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const input = String(body.input || "").trim();
    const model = String(body.model || "elevenlabs/eleven-v3");
    const voice = String(body.voice || "rachel");
    const provider = String(body.provider || "pollinations");
    const voiceId = String(body.voiceId || env.ELEVENLABS_VOICE_ID || "").trim();
    const key = env.POLLINATIONS_API_KEY || request.headers.get("x-pollinations-key");

    if (!input) return json({ error: "Narration text is required." }, 400);
    if (input.length > 12000) return json({ error: "Narration is too long for one audio request." }, 413);
    if (!key) return json({ error: "Add a Pollinations API key in Stoicky Settings, or configure POLLINATIONS_API_KEY in Cloudflare Pages." }, 401);

    if (provider === "elevenlabs") {
      const elevenKey = env.ELEVENLABS_API_KEY;
      if (!elevenKey) return json({ error: "ElevenLabs is not configured. Add ELEVENLABS_API_KEY in Cloudflare Pages." }, 503);
      if (!voiceId) return json({ error: "Add an authorized ElevenLabs voice ID." }, 400);

      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            "xi-api-key": elevenKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: input,
            model_id: "eleven_multilingual_v2"
          })
        }
      );

      if (!upstream.ok) {
        const text = await upstream.text();
        let message = text;
        try {
          const parsed = JSON.parse(text);
          message = parsed?.detail?.message || parsed?.detail || parsed?.error || message;
        } catch {}
        return json({ error: message || "ElevenLabs voice generation failed." }, upstream.status);
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
          "Cache-Control": "no-store"
        }
      });
    }

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
