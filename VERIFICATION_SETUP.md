# Verification setup checklist

## Discord OAuth

- Create a Discord application at the Developer Portal.
- OAuth2 Redirect URI: `https://YOUR-PROJECT.vercel.app/api/auth/discord/callback`.
- OAuth scope: `identify`.
- Put Client ID and Client Secret in Vercel environment variables.
- Set `PUBLIC_SITE_URL` to the exact public origin (no trailing slash).

## Redis storage

Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Generate a long random `SESSION_SECRET`. Redis stores short-lived login sessions and codes plus verified public profile records.

## Roblox

No Roblox app or OAuth client is needed for this flow. The public Roblox users API is queried server-side; verification succeeds only when the submitted code exists in the Roblox profile description. The one-time code expires after 15 minutes.

## Optional role assignment

Set `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and `DISCORD_VERIFIED_ROLE_ID`. Give the bot Manage Roles permission and place its highest role above the target role. Members must authorize with Discord; the bot joins them to the configured server and assigns the verified role.

## Hosting

Use Vercel Functions with the repository root as the project root. GitHub Pages alone cannot run the `/api` handlers. After environment variable changes, redeploy the project.
