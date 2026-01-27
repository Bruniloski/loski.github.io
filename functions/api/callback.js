export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    return new Response("OAuth failed", { status: 400 });
  }

  // Esto es lo que Decap espera
  const redirectTo = `${url.origin}/admin/#/auth?token=${tokenData.access_token}`;
  return Response.redirect(redirectTo, 302);
}
