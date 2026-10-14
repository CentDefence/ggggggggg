const crypto = require("node:crypto");
const { required, publicUrl, put, get, sessionId, redirect, random, errorRedirect } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");
  try {
    const sid = sessionId(req);
    const session = sid ? await get("tcl:session:" + sid) : null;
    if (!sid || !session || !session.discord) return redirect(res, publicUrl("/verify.html"));
    const verifier = random() + random().slice(0, 20);
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const state = random();
    await put("tcl:oauth:roblox:" + state, { sid, verifier }, 600);
    const url = new URL("https://apis.roblox.com/oauth/v1/authorize");
    url.searchParams.set("client_id", required("ROBLOX_CLIENT_ID"));
    url.searchParams.set("redirect_uri", publicUrl("/api/auth/roblox/callback"));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    redirect(res, url.toString());
  } catch (error) {
    console.error("Roblox OAuth start failed:", error.message);
    errorRedirect(res, "setup");
  }
};
