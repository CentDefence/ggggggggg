const { required, publicUrl, put, get, remove, sessionId, redirect, errorRedirect, avatarUrl } = require("../../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");
  const code = req.query.code;
  const state = req.query.state;
  if (!code || !state) return errorRedirect(res, "roblox");
  try {
    const sid = sessionId(req);
    const pending = await get("tcl:oauth:roblox:" + state);
    await remove("tcl:oauth:roblox:" + state);
    if (!sid || !pending || pending.sid !== sid) return errorRedirect(res, "state");
    const body = new URLSearchParams({
      client_id: required("ROBLOX_CLIENT_ID"),
      client_secret: required("ROBLOX_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: publicUrl("/api/auth/roblox/callback"),
      code_verifier: pending.verifier
    });
    const tokenResponse = await fetch("https://apis.roblox.com/oauth/v1/token", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body
    });
    if (!tokenResponse.ok) return errorRedirect(res, "roblox");
    const token = await tokenResponse.json();
    const userResponse = await fetch("https://apis.roblox.com/oauth/v1/userinfo", {
      headers: { authorization: "Bearer " + token.access_token }
    });
    if (!userResponse.ok) return errorRedirect(res, "roblox");
    const user = await userResponse.json();
    if (!user.sub) return errorRedirect(res, "roblox");
    const session = await get("tcl:session:" + sid);
    if (!session || !session.discord) return errorRedirect(res, "state");

    const discordId = session.discord.id;
    const robloxId = String(user.sub);
    const linkedRoblox = await get("tcl:roblox:" + robloxId);
    const linkedDiscord = await get("tcl:discord:" + discordId);
    if ((linkedRoblox && linkedRoblox.discordId !== discordId) ||
        (linkedDiscord && linkedDiscord.robloxId !== robloxId)) return errorRedirect(res, "already-linked");

    const guildId = required("DISCORD_GUILD_ID");
    const roleId = required("DISCORD_VERIFIED_ROLE_ID");
    const api = "https://discord.com/api/v10/guilds/" + encodeURIComponent(guildId) + "/members/" + encodeURIComponent(discordId);
    const headers = { authorization: "Bot " + required("DISCORD_BOT_TOKEN"), "content-type": "application/json" };
    const joinResponse = await fetch(api, {
      method: "PUT", headers,
      body: JSON.stringify({ access_token: session.discord.accessToken })
    });
    if (!joinResponse.ok && joinResponse.status !== 204) {
      console.error("Discord guild join failed with status", joinResponse.status);
      return errorRedirect(res, "bot");
    }
    const memberResponse = await fetch(api, { headers: { authorization: headers.authorization } });
    if (!memberResponse.ok) {
      console.error("Discord member lookup failed with status", memberResponse.status);
      return errorRedirect(res, "bot");
    }
    const member = await memberResponse.json();
    const roles = [...new Set([...(member.roles || []), roleId])];
    const roleResponse = await fetch(api, {
      method: "PATCH", headers,
      body: JSON.stringify({ roles })
    });
    if (!roleResponse.ok) {
      console.error("Discord role assignment failed with status", roleResponse.status);
      return errorRedirect(res, "bot");
    }

    const profile = {
      discord: {
        id: discordId,
        username: session.discord.username,
        handle: session.discord.handle,
        avatar: session.discord.avatar
      },
      roblox: {
        id: robloxId,
        username: user.preferred_username || user.name || user.nickname || "Roblox user",
        displayName: user.name || user.nickname || user.preferred_username || "Roblox user",
        profile: user.profile || "https://www.roblox.com/users/" + encodeURIComponent(robloxId) + "/profile",
        avatar: user.picture || ""
      },
      verifiedAt: new Date().toISOString()
    };
    await put("tcl:discord:" + discordId, { robloxId }, 60 * 60 * 24 * 365 * 5);
    await put("tcl:roblox:" + robloxId, { discordId }, 60 * 60 * 24 * 365 * 5);
    await put("tcl:profile:" + discordId, profile, 60 * 60 * 24 * 365 * 5);
    await put("tcl:session:" + sid, { discord: profile.discord, verified: true }, 60 * 60 * 24 * 30);
    redirect(res, publicUrl("/profile.html"));
  } catch (error) {
    console.error("Roblox OAuth callback failed:", error.message);
    errorRedirect(res, "setup");
  }
};
