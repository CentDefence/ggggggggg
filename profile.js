const { get, sessionId, json } = require("./_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");
  try {
    const sid = sessionId(req);
    const session = sid ? await get("tcl:session:" + sid) : null;
    if (!session || !session.discord) return json(res, 401, { error: "not_authenticated" });
    const profile = await get("tcl:profile:" + session.discord.id);
    if (!profile) return json(res, 401, { error: "not_verified" });
    return json(res, 200, profile);
  } catch (error) {
    console.error("Profile lookup failed:", error.message);
    return json(res, 503, { error: "profile_unavailable" });
  }
};
