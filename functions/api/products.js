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

  // 1️⃣ Llistar fitxers
  const listRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers }
  );

  if (!listRes.ok) {
    return new Response("Error llistant productes", { status: 500 });
  }

  const files = (await listRes.json()).filter(
    f => f.type === "file" && f.name.endsWith(".md")
  );

  let products = [];

  // 2️⃣ Llegir cada producte
  for (const f of files) {
    const raw = await fetch(f.download_url, { headers }).then(r => r.text());
    const { data, body } = parseFrontmatter(raw);

    const slug = f.name.replace(".md", "");

    products.push({
      slug,                              // 🔑 ID
      name: data.title || slug,
      price: Number(data.price || 0),
      priority: !!data.priority,
      link: data.link || "",
      image: data.image || "",
      category: data.category || "otros",
      notes: body || "",
      purchased: false                  // 👈 per defecte
    });
  }

  // 3️⃣ Preguntar a D1 quins estan comprats
  if (env.PURCHASES_DB && products.length) {
    const ids = products.map(p => p.slug);
    const placeholders = ids.map(() => "?").join(",");

    const res = await env.PURCHASES_DB
      .prepare(`SELECT id FROM purchases WHERE id IN (${placeholders})`)
      .bind(...ids)
      .all();

    const bought = new Set(res.results.map(r => r.id));

    products = products.map(p => ({
      ...p,
      purchased: bought.has(p.slug)
    }));
  }

  return new Response(JSON.stringify(products), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

// 🧠 lector simple de frontmatter
function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: text };

  const data = {};
  match[1].split("\n").forEach(line => {
    const [k, ...v] = line.split(":");
    if (k) data[k.trim()] = v.join(":").trim();
  });

  return { data, body: match[2] };
}
