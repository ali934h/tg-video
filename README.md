# tg-video

Simple Telegram bot that downloads videos and audio from YouTube and other yt-dlp-supported sites (including NSFW), with cookie support for restricted content.

## Prerequisites

- Ubuntu 22.04 / 24.04 server with **root** access
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- Telegram **API_ID** and **API_HASH** from <https://my.telegram.org/apps>
- Your Telegram numeric user id (ask [@userinfobot](https://t.me/userinfobot))

## Install

One-line install (run as root):

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/octaviasloane/tg-video/main/install.sh)
```

The installer will:

- install Node.js 20, ffmpeg, yt-dlp, and PM2
- clone this repo to `/root/tg-video`
- prompt for `BOT_TOKEN`, `API_ID`, `API_HASH`, and `ALLOWED_USERS`
- create `/root/tg-video-downloads`
- start the bot with PM2 and enable auto-start on boot

The bot uses **MTProto polling** — no inbound port, no domain, no SSL needed.

## Daily commands

```bash
pm2 logs tg-video               # follow logs
pm2 restart tg-video            # restart
pm2 stop tg-video               # stop
bash /root/tg-video/update.sh   # pull latest code and restart
bash /root/tg-video/uninstall.sh
```

## Usage

1. Open a private chat with your bot in Telegram.
2. Send any video URL (YouTube, etc.).
3. Pick a quality from the inline keyboard.
4. Wait for the bot to download, upload, and clean up.

If the source requires login or is age/region restricted, the bot will ask for cookies:

1. Install the **Get cookies.txt LOCALLY** browser extension.
2. Log in to the site, open the page, and export cookies.
3. Paste the full file contents (text) to the bot.
4. Resend the URL.

Bot commands:

| Command | Action |
| --- | --- |
| `/start`, `/help` | Show help |
| `/cancel` | Reset current state |
| `/clearcookies` | Delete saved cookies for your account |

## Troubleshooting

**Bot does not respond.** Check `pm2 logs tg-video`. Make sure your user id is in `ALLOWED_USERS` inside `/root/tg-video/.env`.

**`File too large`.** MTProto upload limit is ~2 GB. Pick a lower quality, or lower `MAX_UPLOAD_MB` in `/root/tg-video/.env` and restart.

**`Sign in to confirm you're not a bot` / age-restricted / private.** Send fresh cookies via the *Get cookies.txt LOCALLY* extension as a text message and retry.

**`yt-dlp` errors after a while.** Run `bash /root/tg-video/update.sh` — this also refreshes yt-dlp on the next install. To update yt-dlp alone: `yt-dlp -U`.

**Forgot your config.** Edit `/root/tg-video/.env` (chmod 600) and `pm2 restart tg-video`.

**Start over.** `bash /root/tg-video/uninstall.sh`, then run the one-line installer again.
