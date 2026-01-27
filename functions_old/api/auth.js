export async function onRequest(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (provider !== "github") {
    return new Response("Invalid provider", { status: 400 });
  }

  const redirectUri = `${url.origin}/api/callback`;
  const clientId = env.GITHUB_CLIENT_ID;
  const scope = "repo";

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}`;

  return Response.redirect(githubAuthUrl, 302);
}
