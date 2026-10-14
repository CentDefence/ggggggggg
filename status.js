const { get, sessionId, json } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");
  try {
    const sid = sessionId(req);
    const session = sid ? await get("tcl:session:" + sid) : null;
    if (!session || !session.discord) return json(res, 200, { authenticated: false, verified: false });
    const profile = await get("tcl:profile:" + session.discord.id);
    return json(res, 200, {
      authenticated: true,
      verified: Boolean(profile),
      profileUrl: profile ? "/profile.html?u=" + encodeURIComponent(profile.roblox.username) : null,
      discord: {
        id: session.discord.id,
        username: session.discord.username || session.discord.handle,
        avatar: session.discord.avatar || ""
      },
      profile: profile || null
    });
  } catch (error) {
    console.error("Verification status failed:", error.message);
    return json(res, 503, { error: "service_unavailable" });
  }
};
