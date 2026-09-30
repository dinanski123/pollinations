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
        temperature: 0.4,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "stoicky_scene_plan",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["title", "hook", "scenes"],
              properties: {
                title: { type: "string" },
                hook: { type: "string" },
                scenes: {
                  type: "array",
                  minItems: sceneCount,
                  maxItems: sceneCount,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["n", "narration", "visual"],
                    properties: {
                      n: { type: "integer" },
                      narration: { type: "string" },
                      visual: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ error: data?.error?.message || data?.error || "Script generation failed." }, response.status);
    }

    const raw = extractText(data);
    const script = parseScript(raw, sceneCount);
    if (!script) {
      return json({
        error: "The AI returned text, but Stoicky could not parse the scene plan. Please retry.",
        details: raw ? String(raw).slice(0, 500) : "Empty model response."
      }, 502);
    }

    script.scenes = script.scenes.slice(0, sceneCount).map((scene, index) => ({
      n: index + 1,
      narration: String(scene?.narration || "").trim(),
      visual: String(scene?.visual || "").trim()
    }));

    if (script.scenes.length !== sceneCount || script.scenes.some(scene => !scene.visual)) {
      return json({ error: `The AI returned an incomplete scene plan. Stoicky needs ${sceneCount} usable scenes; please retry.` }, 502);
    }

    return json({ script });
  } catch (error) {
    return json({ error: error.message || "Unexpected script generation error." }, 500);
  }
}

function extractText(data) {
  const content = data?.choices?.[0]?.message?.content;
  const parts = flattenText(content);
  if (parts) return parts;

  if (Array.isArray(data?.output)) {
    const outputText = data.output.flatMap(item => flattenText(item?.content)).join("\n").trim();
    if (outputText) return outputText;
  }

  return flattenText(data?.output_text) || flattenText(data?.text) || "";
}

function flattenText(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(part => flattenText(
      typeof part === "string" ? part :
      part?.text ?? part?.value ?? part?.content ?? part?.output_text ?? ""
    )).filter(Boolean).join("\n");
  }
  if (value && typeof value === "object") {
    return flattenText(value.text ?? value.value ?? value.content ?? value.output_text ?? "");
  }
  return "";
}

function parseScript(raw, sceneCount) {
  if (!raw) return null;
  let cleaned = String(raw).trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const candidates = [cleaned];
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(cleaned.slice(first, last + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : null;
      if (scenes && scenes.length >= sceneCount) {
        return {
          title: String(parsed.title || "").trim(),
          hook: String(parsed.hook || "").trim(),
          scenes
        };
      }
    } catch {}
  }
  return null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}