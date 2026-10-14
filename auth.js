const crypto = require("node:crypto");

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error("Missing environment variable: " + name);
  return value;
}
function publicUrl(path) {
  return required("PUBLIC_SITE_URL").replace(/\/+$/, "") + path;
}
function redisUrl() {
  return required("UPSTASH_REDIS_REST_URL").replace(/\/+$/, "");
}
async function redis(command) {
  const response = await fetch(redisUrl(), {
    method: "POST",
    headers: { authorization: "Bearer " + required("UPSTASH_REDIS_REST_TOKEN"), "content-type": "application/json" },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error("Storage service request failed");
  const data = await response.json();
  if (data.error) throw new Error("Storage operation failed");
  return data.result;
}
async function put(key, value, ttl) {
  await redis(["SET", key, JSON.stringify(value), "EX", String(ttl)]);
}
async function get(key) {
  const value = await redis(["GET", key]);
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}
async function remove(key) {
  await redis(["DEL", key]);
}
function b64(value) {
  return Buffer.from(value).toString("base64url");
}
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(raw.split(";").map(part => {
    const i = part.indexOf("=");
    return i < 0 ? ["", ""] : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(pair => pair[0]));
}
function sign(value) {
  return crypto.createHmac("sha256", required("SESSION_SECRET")).update(value).digest("base64url");
}
function sessionId(req) {
  const token = parseCookies(req).tcl_session || "";
  const [sid, signature] = token.split(".");
  if (!sid || !signature) return null;
  const expected = sign(sid);
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sid;
}
function setSessionCookie(res, sid) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", "tcl_session=" + encodeURIComponent(sid + "." + sign(sid)) + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000" + secure);
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", "tcl_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" + secure);
}
function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader("Location", url);
  res.end();
}
function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}
function random() {
  return crypto.randomBytes(32).toString("base64url");
}
function errorRedirect(res, code) {
  redirect(res, publicUrl("/?verify=roblox&error=" + encodeURIComponent(code)));
}
function avatarUrl(user) {
  if (!user || !user.id || !user.avatar) return "";
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return "https://cdn.discordapp.com/avatars/" + encodeURIComponent(user.id) + "/" + encodeURIComponent(user.avatar) + "." + ext + "?size=128";
}
module.exports = { required, publicUrl, put, get, remove, redis, sessionId, setSessionCookie, clearSessionCookie, redirect, json, random, errorRedirect, avatarUrl };
