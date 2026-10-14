const { required } = require("../api/_lib/auth");

async function main() {
  const appId = required("DISCORD_CLIENT_ID");
  const guildId = required("DISCORD_GUILD_ID");
  const botToken = required("DISCORD_BOT_TOKEN");
  const endpoint = "https://discord.com/api/v10/applications/" + encodeURIComponent(appId) +
    "/guilds/" + encodeURIComponent(guildId) + "/commands";
  const commands = [
    { name: "verify", description: "Link Roblox and Discord to verify your league account", type: 1 },
    { name: "profile", description: "Open your TRS CIS League player profile", type: 1 }
  ];
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { authorization: "Bot " + botToken, "content-type": "application/json" },
    body: JSON.stringify(commands)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Discord command registration failed:", response.status, data.message || "");
    process.exitCode = 1;
    return;
  }
  console.log("Registered guild slash commands:", data.map(command => "/" + command.name).join(", "));
}
main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
