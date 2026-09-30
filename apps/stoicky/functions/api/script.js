export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const topic = String(body.topic || "").trim();
    const style = String(body.style || "Stoic / cinematic");
    const duration = String(body.duration || "45 seconds");
    const model = String(body.model || "openai/gpt-5.4-nano");
    const key = env.POLLINATIONS_API_KEY || request.headers.get("x-pollinations-key");

    if (!topic) return json({ error: "Topic is required." }, 400);
    if (!key) return json({ error: "Add a Pollinations API key in Stoicky Settings, or configure POLLINATIONS_API_KEY in Cloudflare Pages." }, 401);

    const prompt = `Create a short-form faceless video script about: "${topic}".
Style: ${style}. Target duration: ${duration}.
Return ONLY valid JSON with this shape:
{"title":"...","hook":"...","scenes":[{"n":1,"narration":"...","visual":"..."}]}
Create 6-10 scenes. Narration must be concise and spoken naturally. Visual prompts should describe cinematic 9:16 imagery and contain no text or logos.`;

    const response = await fetch("https://gen.pollinations.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a professional short-form video writer. Follow the requested JSON format exactly." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    if (!response.ok) return json({ error: data?.error?.message || data?.error || "Script generation failed." }, response.status);

    const raw = data?.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
    let script;
    try { script = JSON.parse(cleaned); }
    catch { return json({ error: "The AI returned an invalid script format.", raw }); }

    return json({ script });
  } catch (error) {
    return json({ error: error.message || "Unexpected script generation error." }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
