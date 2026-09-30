export async function onRequestGet({ request, env }) {
  const key = env.POLLINATIONS_API_KEY || request.headers.get("x-pollinations-key");
  if (!key) return json({ error: "Pollinations connection is required." }, 401);
  try {
    const response = await fetch("https://gen.pollinations.ai/account/quests", {
      headers: { "Authorization": `Bearer ${key}`, "Accept": "application/json" }
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { error: text || "Quest service returned an invalid response." }; }
    if (!response.ok) return json({ error: data?.error?.message || data?.error || "Could not load quests." }, response.status);
    return json(data);
  } catch (error) {
    return json({ error: error.message || "Unexpected quest service error." }, 500);
  }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}