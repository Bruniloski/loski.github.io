export async function onRequest(context) {
  const { env } = context;

  const owner = "Bruniloski";
  const repo = "loski.github.io";
  const path = "products";

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "wishlist-products",
  };

  if (env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  // 1) Llistar fitxers
  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers }
  );

  if (!listRes.ok) {
    return new Response("Error llistant productes", { status: 500 });
  }

  const files = (await listRes.json()).filter(
    (f) => f.type === "file" && (f.name.endsWith(".md") || f.name.endsWith(".markdown"))
  );

  let products = [];

  // 2) Llegir cada producte
  for (const f of files) {
    const rawRes = await fetch(f.download_url, { headers });
    if (!rawRes.ok) continue;

    const raw = await rawRes.text();
    const { data, body } = parseFrontmatter(raw);

    const slug = f.name.replace(/\.(md|markdown)$/i, "");

    products.push({
      slug, // 🔑 ID estable
      name: String(data.title ?? slug).trim(),
      price: Number(data.price ?? 0),
      priority: Boolean(data.priority),
      link: typeof data.link === "string" ? data.link.trim() : "",
      image: typeof data.image === "string" ? data.image.trim() : "",
      category: typeof data.category === "string" ? data.category.trim() : "otros",
      notes: (body || "").trim(),
      purchased: false,
    });
  }

  // 3) Merge amb D1: quins slugs estan comprats
  if (env.PURCHASES_DB && products.length) {
    const ids = products.map((p) => p.slug).filter(Boolean);
    const placeholders = ids.map(() => "?").join(",");

    const res = await env.PURCHASES_DB
      .prepare(`SELECT id FROM purchases WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();

    const bought = new Set((res.results || []).map((r) => r.id));

    products = products.map((p) => ({
      ...p,
      purchased: bought.has(p.slug),
    }));
  }

  return new Response(JSON.stringify(products), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Frontmatter: ---\nkey: value\n---\nbody...
function parseFrontmatter(text) {
  const match = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: text };

  const yaml = match[1];
  const body = match[2] ?? "";
  const data = {};

  yaml.split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return;

    const idx = t.indexOf(":");
    if (idx === -1) return;

    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();

    // treu quotes
    val = val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

    if (val === "true") data[key] = true;
    else if (val === "false") data[key] = false;
    else if (val !== "" && !Number.isNaN(Number(val))) data[key] = Number(val);
    else data[key] = val;
  });

  return { data, body };
}

