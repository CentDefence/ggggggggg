const { get, remove, sessionId, clearSessionCookie, publicUrl, redirect } = require("./_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).end("Method not allowed");
  try {
    const sid = sessionId(req);
    if (sid) await remove("tcl:session:" + sid);
  } catch (error) {
    console.error("Logout cleanup failed:", error.message);
  }
  clearSessionCookie(res);
  redirect(res, publicUrl("/"));
};
