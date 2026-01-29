export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = (body?.id ?? "").toString().trim();

    if (!env.PURCHASES_DB) {
      return new Response(JSON.stringify({ error: "Missing PURCHASES_DB binding" }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    if (!id || id.length > 120) {
      return new Response(JSON.stringify({ error: "Invalid id" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const now = new Date().toISOString();

    // Idempotent: si ja existeix, no fa res.
    await env.PURCHASES_DB
      .prepare(`INSERT OR IGNORE INTO purchases (id, purchased, purchased_at) VALUES (?, 1, ?)`)
      .bind(id, now)
      .run();

    return new Response(JSON.stringify({ ok: true, id }), {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
}
