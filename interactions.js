const crypto = require("node:crypto");
const { required, publicUrl } = require("../_lib/auth");

function verifyDiscordRequest(rawBody, signatureHex, timestamp) {
  if (!signatureHex || !timestamp || !/^[0-9a-f]{128}$/i.test(signatureHex)) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > 300) return false;
  const publicKey = required("DISCORD_PUBLIC_KEY");
  if (!/^[0-9a-f]{64}$/i.test(publicKey)) throw new Error("DISCORD_PUBLIC_KEY must be a 32-byte hexadecimal key");
  const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
  const derKey = crypto.createPublicKey({
    key: Buffer.concat([derPrefix, Buffer.from(publicKey, "hex")]),
    format: "der",
    type: "spki"
  });
  return crypto.verify(
    null,
    Buffer.from(timestamp + rawBody),
    derKey,
    Buffer.from(signatureHex, "hex")
  );
}

async function readRawBody(req, maxBytes = 1024 * 1024) {
  const size = Number(req.headers["content-length"] || 0);
  if (size > maxBytes) throw new Error("Request too large");
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error("Request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function interactionResponse(res, payload) {
  res.statusCode = 200;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return res.status(405).end("Method not allowed");
  }
  try {
    const rawBody = await readRawBody(req);
    const valid = verifyDiscordRequest(
      rawBody,
      req.headers["x-signature-ed25519"],
      req.headers["x-signature-timestamp"]
    );
    if (!valid) return res.status(401).end("Invalid Discord request signature");
    const interaction = JSON.parse(rawBody);
    if (interaction.type === 1) return interactionResponse(res, { type: 1 });
    if (interaction.type !== 2) return interactionResponse(res, { type: 4, data: { content: "This interaction is not supported.", flags: 64 } });

    const name = interaction.data && interaction.data.name;
    const links = {
      verify: { label: "Start Discord + Roblox verification", url: publicUrl("/verify.html") },
      profile: { label: "Open your TRS CIS League profile", url: publicUrl("/profile.html") }
    };
    const target = links[name];
    if (!target) return interactionResponse(res, { type: 4, data: { content: "I don't recognize that command.", flags: 64 } });
    return interactionResponse(res, {
      type: 4,
      data: {
        content: name === "verify"
          ? "Connect your Discord and Roblox accounts, then I will assign the verified role."
          : "Open your linked TRS CIS League profile.",
        flags: 64,
        components: [{
          type: 1,
          components: [{ type: 2, style: 5, label: target.label, url: target.url }]
        }]
      }
    });
  } catch (error) {
    console.error("Discord interaction failed:", error.message);
    if (error.message === "Request too large") return res.status(413).end("Request too large");
    return res.status(400).end("Invalid interaction");
  }
};
module.exports.config = { api: { bodyParser: false } };
