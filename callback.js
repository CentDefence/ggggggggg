const { required, publicUrl, put, get, remove, sessionId, redirect, errorRedirect, avatarUrl } = require("../../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");
  const code = req.query.code;
  const state = req.query.state;
  if (!code || !state) return errorRedirect(res, "discord");
  try {
    const sid = sessionId(req);
    const pending = await get("tcl:oauth:discord:" + state);
    await remove("tcl:oauth:discord:" + state);
    if (!sid || !pending || pending.sid !== sid) return errorRedirect(res, "state");
    const body = new URLSearchParams({
      client_id: required("DISCORD_CLIENT_ID"),
      client_secret: required("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: publicUrl("/api/auth/discord/callback")
    });
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body
    });
    if (!tokenResponse.ok) return errorRedirect(res, "discord");
    const token = await tokenResponse.json();
    const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
      headers: { authorization: "Bearer " + token.access_token }
    });
    if (!userResponse.ok) return errorRedirect(res, "discord");
    const user = await userResponse.json();
    const session = await get("tcl:session:" + sid) || {};
    session.discord = {
      id: String(user.id),
      username: user.global_name || user.username,
      handle: user.username,
      avatar: avatarUrl(user),
      accessToken: token.access_token
    };
    await put("tcl:session:" + sid, session, 1800);
    const linked = await get("tcl:profile:" + String(user.id));
    redirect(res, publicUrl(linked ? "/profile.html?u=" + encodeURIComponent(linked.roblox.username) : "/?verify=roblox"));
  } catch (error) {
    console.error("Discord OAuth callback failed:", error.message);
    errorRedirect(res, "setup");
  }
};
