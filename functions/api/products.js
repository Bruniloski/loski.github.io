export async function onRequest() {
  const owner = "Bruniloski";
  const repo = "loski.github.io";
  const path = "products";

  const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const listRes = await fetch(listUrl, {
    headers: { Accept: "application/vnd.github+json" },
  });

  if (!listRes.ok) {
    return json(
      { error: "No pude listar /products", status: listRes.status },
      500
    );
  }

  const entries = await listRes.json();
  const files = (Array.isArray(entries) ? entries : []).filter(
    (x) =>
      x.type === "file" &&
      (x.name.endsWith(".md") || x.name.endsWith(".markdown"))
  );

  const products = [];
  for (const f of files) {
    const rawRes = await fetch(f.download_url);
    if (!rawRes.ok) continue;

    const text = await rawRes.text();
    const { data, body } = parseFrontmatter(text);

    products.push({
      name: String(data.title ?? f.name.replace(/\.(md|markdown)$/i, "")).trim(),
      price: Number(data.price ?? 0),
      priority: !!data.priority,
      link: typeof data.link === "string" ? data.link.trim() : "",
      image: typeof data.image === "string" ? data.image.trim() : "",
      notes: (body || "").trim(),
      slug: f.name.replace(/\.(md|markdown)$/i, ""),
    });
  }

  // orden por prioridad primero, luego por precio desc
  products.sort((a, b) => {
    const ap = a.priority ? 1 : 0;
    const bp = b.priority ? 1 : 0;
    if (bp !== ap) return bp - ap;
    return Number(b.price) - Number(a.price);
  });

  return new Response(JSON.stringify(products), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

// Frontmatter simple: ---\nkey: value\n---\nbody...
function parseFrontmatter(md) {
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };

  const yaml = m[1];
  const body = m[2] ?? "";
  const data = {};

  for (const line of yaml.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf(":");
    if (i === -1) continue;

    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();

    // quitar comillas si las hay
    val = val.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

    // tipos básicos
    if (val === "true") data[key] = true;
    else if (val === "false") data[key] = false;
    else if (!Number.isNaN(Number(val)) && val !== "") data[key] = Number(val);
    else data[key] = val;
  }

  return { data, body };
}
