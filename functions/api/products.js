export async function onRequest() {
  // Repo y carpeta donde Decap guarda los productos
  const owner = "Bruniloski";
  const repo = "loski.github.io";
  const path = "products";

  // 1) Listar archivos en /products usando GitHub Contents API (repo público)
  const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const listRes = await fetch(listUrl, {
    headers: { "Accept": "application/vnd.github+json" },
  });

  if (!listRes.ok) {
    return new Response(
      JSON.stringify({ error: "No pude listar /products", status: listRes.status }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const entries = await listRes.json();
  const files = (Array.isArray(entries) ? entries : [])
    .filter(x => x.type === "file" && (x.name.endsWith(".md") || x.name.endsWith(".markdown")));

  // 2) Descargar cada markdown y sacar el frontmatter
  const products = [];
  for (const f of files) {
    const rawRes = await fetch(f.download_url);
    if (!rawRes.ok) continue;
    const text = await rawRes.text();

    const { data, body } = parseFrontmatter(text);

    // Adaptamos a tu estructura actual de UI:
    products.push({
      name: data.title || f.name.replace(/\.(md|markdown)$/i, ""),
      price: Number(data.price || 0),
      priority: !!data.priority,
      link: typeof data.link === "string" ? data.link : "",
      // En Decap la imagen suele quedar tipo "/uploads/xxx.jpg"
      imageDataUrl: typeof data.image === "string" ? data.image : "",
      notes: body || ""
    });
  }

  return new Response(JSON.stringify(products), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

// Frontmatter muy simple: ---\nkey: value\n---\nbody...
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
