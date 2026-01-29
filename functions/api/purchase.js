export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = (body?.id ?? "").toString().trim();
    const action = (body?.action ?? "mark").toString().trim(); // "mark" | "unmark"

    if (!env.PURCHASES_DB) {
      return json({ error: "Missing PURCHASES_DB binding" }, 500);
    }

    if (!id || id.length > 120) {
      return json({ error: "Invalid id" }, 400);
    }

    if (action === "mark") {
      const now = new Date().toISOString();
      await env.PURCHASES_DB
        .prepare(`INSERT OR IGNORE INTO purchases (id, purchased, purchased_at) VALUES (?, 1, ?)`)
        .bind(id, now)
        .run();
      return json({ ok: true, id, action });
    }

    if (action === "unmark") {
      await env.PURCHASES_DB
        .prepare(`DELETE FROM purchases WHERE id = ?`)
        .bind(id)
        .run();
      return json({ ok: true, id, action });
    }

    return json({ error: "Invalid action" }, 400);
  } catch {
    return json({ error: "Bad request" }, 400);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
