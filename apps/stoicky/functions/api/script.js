export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const topic = String(body.topic || "").trim();
    const style = String(body.style || "Stoic / cinematic");
    const duration = String(body.duration || "45 seconds");
    const sceneCount = Math.max(4, Math.min(10, Number(body.sceneCount) || 6));
    const model = String(body.model || "openai/gpt-5.4-nano");
    const key = env.POLLINATIONS_API_KEY || request.headers.get("x-pollinations-key");

    if (!topic) return json({ error: "Topic is required." }, 400);
    if (!key) return json({ error: "Add a Pollinations API key in Stoicky Settings, or configure POLLINATIONS_API_KEY in Cloudflare Pages." }, 401);

    const prompt = `Create a short-form video script about: "${topic}".
Style: ${style}. Target duration: ${duration}. The video will be rendered as exactly ${sceneCount} separate cinematic clips and stitched together in order.
Return ONLY valid JSON with this shape:
{"title":"...","hook":"...","scenes":[{"n":1,"narration":"...","visual":"..."}]}
Create exactly ${sceneCount} scenes. Each scene must describe one self-contained visual beat that can be generated as a single 6-second vertical clip. Keep the main subject, wardrobe, environment, lighting and visual language coherent between scenes. Narration must be concise and spoken naturally. Visual prompts should be concrete cinematic directions: subject action, setting, camera movement, lighting and mood. Do not put text, captions, logos or UI elements inside the scene.`;

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
    const cleaned = String(raw).replace(/^\`\`\`json\s*/i, "").replace(/\s*\`\`\`$/i, "").trim();
    let script;
    try { script = JSON.parse(cleaned); }
    catch { return json({ error: "The AI returned an invalid script format.", raw }); }

    if (!Array.isArray(script.scenes) || script.scenes.length < sceneCount) {
      return json({ error: `The AI returned only ${script.scenes?.length || 0} scenes; ${sceneCount} are required. Please retry.` }, 502);
    }

    script.scenes = script.scenes.slice(0, sceneCount).map((scene, index) => ({
      n: index + 1,
      narration: String(scene?.narration || "").trim(),
      visual: String(scene?.visual || "").trim()
    }));

    if (script.scenes.some(scene => !scene.visual)) {
      return json({ error: "One or more generated scenes are missing visual direction. Please retry." }, 502);
    }

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