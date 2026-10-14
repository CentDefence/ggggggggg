const { get, redis, json } = require("./_lib/auth");

function publicProfile(profile) {
  return {
    discord: { id: profile.discord.id, username: profile.discord.username, avatar: profile.discord.avatar || "", roleAssigned: Boolean(profile.discord.roleAssigned) },
    roblox: { id: profile.roblox.id, username: profile.roblox.username, displayName: profile.roblox.displayName, profile: profile.roblox.profile, avatar: profile.roblox.avatar || "" },
    verifiedAt: profile.verifiedAt,
    url: "/profile.html?u=" + encodeURIComponent(profile.roblox.username)
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");
  try {
    const username = String(req.query.username || "").trim().replace(/^@/, "");
    if (username) {
      const discordId = await get("tcl:profile:roblox-name:" + username.toLowerCase());
      if (!discordId) return json(res, 404, { error: "profile_not_found" });
      const profile = await get("tcl:profile:" + discordId);
      if (!profile) return json(res, 404, { error: "profile_not_found" });
      return json(res, 200, { profile: publicProfile(profile) });
    }

    const q = String(req.query.q || "").trim().toLowerCase();
    const start = Math.max(0, Number.parseInt(req.query.offset || "0", 10) || 0);
    const ids = await redis(["ZREVRANGE", "tcl:profiles:index", String(start), String(start + 99)]);
    const matches = [];
    for (const id of ids || []) {
      const profile = await get("tcl:profile:" + id);
      if (!profile) continue;
      const haystack = [profile.roblox.username, profile.roblox.displayName, profile.discord.username, profile.discord.handle].join(" ").toLowerCase();
      if (!q || haystack.includes(q)) matches.push(publicProfile(profile));
      if (matches.length >= 40) break;
    }
    return json(res, 200, { profiles: matches, nextOffset: (ids || []).length === 100 ? start + 100 : null });
  } catch (error) {
    console.error("Public profiles lookup failed:", error.message);
    return json(res, 503, { error: "profiles_unavailable" });
  }
};
