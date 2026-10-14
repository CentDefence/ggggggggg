# TRS CIS League — verification and player profiles

This package contains the redesigned TCL landing page, Discord sign-in, Roblox description-code verification, public player directory, public profile pages, and the preserved league archive at `/league.html`.

## Deploy

1. Upload the **contents** of this folder into the GitHub repository root. The `api/` folder must stay at the repository root. Do not use GitHub Pages for this project; GitHub Pages cannot run these serverless API routes.
2. Import/connect the repository in Vercel. Set the Vercel Root Directory to the repository root and use the default static build settings (no build command required).
3. Create an Upstash Redis database and add the required variables from `.env.example` in Vercel Project Settings → Environment Variables. Generate a unique `SESSION_SECRET` (at least 32 random characters).
4. Create a Discord application and OAuth2 client. Add `https://YOUR-PROJECT.vercel.app/api/auth/discord/callback` to its OAuth2 Redirects. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and `PUBLIC_SITE_URL` to match.
5. In Discord OAuth2 URL Generator enable the `identify` scope. The site never asks for either platform password.
6. Redeploy after setting environment variables.

Roblox ownership is checked without Roblox OAuth: the site creates a short-lived `TCL-XXXXXXXX` code; the player puts it in the Roblox profile About/Description, then submits their Roblox username. The server looks up the public Roblox profile and checks the description. Codes expire after 15 minutes and are single use.

Optional Discord role assignment: invite the bot to your server with Manage Roles, place the verified role below the bot's highest role, then set `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and `DISCORD_VERIFIED_ROLE_ID`. Leave those unset if you only need account linking.

## Pages and routes

- `/`: player directory and verification flow
- `/profile.html?u=RobloxUsername`: public profile
- `/league.html`: previous season/league pages
- `/api/verification/*`, `/api/profiles`: Vercel serverless functions

Profiles appear in the public directory only after both account ownership checks succeed. Configure a custom domain by changing `PUBLIC_SITE_URL` and adding the matching Discord callback URL.
