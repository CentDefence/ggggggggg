const crypto = require("node:crypto");
const { required, publicUrl, put, get, remove, sessionId, setSessionCookie, redirect, random, errorRedirect } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");
  try {
    const sid = sessionId(req) || random();
    const state = random();
    await put("tcl:session:" + sid, { ...(await get("tcl:session:" + sid) || {}), createdAt: Date.now() }, 1800);
    await put("tcl:oauth:discord:" + state, { sid }, 600);
    setSessionCookie(res, sid);
    const redirectUri = publicUrl("/api/auth/discord/callback");
    const url = new URL("https://discord.com/oauth2/authorize");
    url.searchParams.set("client_id", required("DISCORD_CLIENT_ID"));
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "identify guilds.join");
    url.searchParams.set("state", state);
    redirect(res, url.toString());
  } catch (error) {
    console.error("Discord OAuth start failed:", error.message);
    errorRedirect(res, "setup");
  }
};
