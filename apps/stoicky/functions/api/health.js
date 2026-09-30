export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, service: "stoicky-api" }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
