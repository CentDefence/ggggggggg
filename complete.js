const { get, put, remove, redis, sessionId, json, avatarUrl } = require("../_lib/auth");

async function robloxUserByName(username) {
  const lookup = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false })
  });
  if (!lookup.ok) throw new Error("Roblox username lookup failed");
  const result = await lookup.json();
  const user = result.data && result.data[0];
  if (!user || !user.id) return null;

  const response = await fetch("https://users.roblox.com/v1/users/" + encodeURIComponent(user.id));
  if (!response.ok) throw new Error("Roblox profile lookup failed");
  const profile = await response.json();
  return { id: String(user.id), username: user.name || username, displayName: user.displayName || user.name || username, description: profile.description || "" };
}

async function robloxAvatar(userId) {
  const url = "https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=" + encodeURIComponent(userId) + "&size=420x420&format=Png&isCircular=false";
  const response = await fetch(url);
  if (!response.ok) return "";
  const body = await response.json();
  return body.data && body.data[0] && body.data[0].imageUrl || "";
}

async function grantVerifiedRole(discord, roleId, guildId, botToken) {
  const endpoint = "https://discord.com/api/v10/guilds/" + encodeURIComponent(guildId) + "/members/" + encodeURIComponent(discord.id);
  const headers = { authorization: "Bot " + botToken, "content-type": "application/json" };
  const joined = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify({ access_token: discord.accessToken })
  });
  if (!joined.ok) throw new Error("Discord could not add the member to the league server");
  let member;
  if (joined.status !== 204) {
    member = await joined.json();
  } else {
    const response = await fetch(endpoint, { headers: { authorization: headers.authorization } });
    if (!response.ok) throw new Error("Discord member lookup failed");
    member = await response.json();
  }
  const roles = [...new Set([...(member.roles || []), roleId])];
  const updated = await fetch(endpoint, { method: "PATCH", headers, body: JSON.stringify({ roles }) });
  if (!updated.ok) throw new Error("Discord could not assign the verified role");
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");
  try {
    const sid = sessionId(req);
    const session = sid ? await get("tcl:session:" + sid) : null;
    if (!session || !session.discord) return json(res, 401, { error: "discord_required" });

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const username = String(body.username || "").trim();
    const code = String(body.code || "").trim().toUpperCase();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) return json(res, 400, { error: "invalid_username" });
    if (!/^TCL-[A-Z0-9]{8}$/.test(code)) return json(res, 400, { error: "invalid_code" });

    const challengeKey = "tcl:verification:challenge:" + sid;
    const challenge = await get(challengeKey);
    if (!challenge || challenge.discordId !== session.discord.id || challenge.expiresAt < Date.now()) return json(res, 410, { error: "code_expired" });
    const attemptKey = "tcl:verification:attempts:" + sid;
    const attempts = Number(await redis(["INCR", attemptKey]));
    if (attempts === 1) await redis(["EXPIRE", attemptKey, "900"]);
    if (attempts > 12) return json(res, 429, { error: "too_many_attempts" });
    if (challenge.code !== code) return json(res, 400, { error: "wrong_code" });

    const roblox = await robloxUserByName(username);
    if (!roblox) return json(res, 404, { error: "roblox_user_not_found" });
    if (!roblox.description.toLowerCase().includes(code.toLowerCase())) return json(res, 422, { error: "code_not_in_description" });

    const discordId = session.discord.id;
    const existingDiscord = await get("tcl:profile:" + discordId);
    if (existingDiscord) return json(res, 409, { error: "already_verified", profileUrl: "/profile.html?u=" + encodeURIComponent(existingDiscord.roblox.username) });
    const existingRoblox = await get("tcl:roblox:" + roblox.id);
    if (existingRoblox && existingRoblox.discordId !== discordId) return json(res, 409, { error: "roblox_already_linked" });

    let roleAssigned = false;
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;
    const roleId = process.env.DISCORD_VERIFIED_ROLE_ID;
    if (botToken && guildId && roleId && session.discord.accessToken) {
      try {
        await grantVerifiedRole(session.discord, roleId, guildId, botToken);
        roleAssigned = true;
      } catch (error) {
        console.error("Verified role assignment failed:", error.message);
      }
    }

    const profile = {
      discord: {
        id: discordId,
        username: session.discord.username || session.discord.handle,
        handle: session.discord.handle,
        avatar: session.discord.avatar || "",
        roleAssigned
      },
      roblox: {
        id: roblox.id,
        username: roblox.username,
        displayName: roblox.displayName,
        profile: "https://www.roblox.com/users/" + encodeURIComponent(roblox.id) + "/profile",
        avatar: await robloxAvatar(roblox.id).catch(() => "")
      },
      verifiedAt: new Date().toISOString()
    };

    await put("tcl:discord:" + discordId, { robloxId: roblox.id }, 60 * 60 * 24 * 365 * 5);
    await put("tcl:roblox:" + roblox.id, { discordId }, 60 * 60 * 24 * 365 * 5);
    await put("tcl:profile:roblox-name:" + roblox.username.toLowerCase(), discordId, 60 * 60 * 24 * 365 * 5);
    await put("tcl:profile:" + discordId, profile, 60 * 60 * 24 * 365 * 5);
    await redis(["ZADD", "tcl:profiles:index", String(Date.now()), discordId]);
    await remove(challengeKey);
    await remove(attemptKey);
    await put("tcl:session:" + sid, { discord: { ...profile.discord }, verified: true }, 60 * 60 * 24 * 30);
    return json(res, 200, { ok: true, roleAssigned, profileUrl: "/profile.html?u=" + encodeURIComponent(roblox.username) });
  } catch (error) {
    console.error("Roblox verification failed:", error.message);
    return json(res, 503, { error: "verification_unavailable" });
  }
};
