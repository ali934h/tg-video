const fs = require("fs");
const path = require("path");
const { Api } = require("telegram");
const { NewMessage } = require("telegram/events");
const { CallbackQuery } = require("telegram/events/CallbackQuery");
const { Button } = require("telegram/tl/custom/button");

const config = require("./config");
const logger = require("./logger");
const auth = require("./auth");
const state = require("./state");
const ytdlp = require("./ytdlp");
const cookies = require("./cookies");
const { buildMenu } = require("./format-menu");

const URL_REGEX = /(https?:\/\/[^\s]+)/i;

function buildButtons(rows) {
  return rows.map((row) =>
    row.map((b) => Button.inline(b.label, Buffer.from(b.data))),
  );
}

function humanSize(bytes) {
  if (!bytes && bytes !== 0) return "?";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

class Bot {
  constructor(client) {
    this.client = client;
  }

  start() {
    this.client.addEventHandler(
      (e) => this.safeHandle(() => this.onMessage(e)),
      new NewMessage({ incoming: true }),
    );
    this.client.addEventHandler(
      (e) => this.safeHandle(() => this.onCallback(e)),
      new CallbackQuery({}),
    );
    logger.info("Event handlers registered");
  }

  async safeHandle(fn) {
    try {
      await fn();
    } catch (err) {
      logger.error("Handler error:", err && err.stack ? err.stack : err);
    }
  }

  async onMessage(event) {
    const msg = event.message;
    if (!msg || !msg.isPrivate) return;
    const senderId = msg.senderId ? Number(msg.senderId.toString()) : null;
    if (!senderId) return;

    if (!auth.isAllowed(senderId)) {
      await msg.reply({
        message: `⛔ You are not authorized to use this bot.\nYour user ID: <code>${senderId}</code>`,
        parseMode: "html",
      });
      logger.warn(`Unauthorized access from user ${senderId}`);
      return;
    }

    const text = (msg.message || "").trim();
    const userState = state.get(senderId);

    if (text.startsWith("/start") || text.startsWith("/help")) {
      await this.sendHelp(msg);
      return;
    }

    if (text.startsWith("/cancel")) {
      state.reset(senderId);
      await msg.reply({ message: "✅ State reset. Send a new link." });
      return;
    }

    if (text.startsWith("/clearcookies")) {
      cookies.deleteCookies(senderId);
      await msg.reply({ message: "🗑 Cookies cleared." });
      return;
    }

    if (userState.waitingForCookies) {
      if (cookies.isValidCookiesText(text)) {
        cookies.saveCookies(senderId, text);
        userState.waitingForCookies = false;
        await msg.reply({
          message:
            "✅ Cookies saved. Now send the link again to retry the download.",
        });
      } else {
        await msg.reply({
          message:
            "❌ This does not look like a valid Netscape cookies.txt file.\n" +
            "Use the *Get cookies.txt LOCALLY* extension and paste the full file contents as text.",
          parseMode: "markdown",
        });
      }
      return;
    }

    const urlMatch = text.match(URL_REGEX);
    if (!urlMatch) {
      await msg.reply({
        message:
          "Send me a video URL (YouTube, etc.) and I will offer download options.\n" +
          "Type /help for more info.",
      });
      return;
    }

    const url = urlMatch[1];
    if (userState.activeJob) {
      await msg.reply({
        message: "⏳ Another download is in progress. Please wait.",
      });
      return;
    }

    await this.handleUrl(msg, senderId, url);
  }

  async sendHelp(msg) {
    const help =
      "🎬 *tg-video bot*\n\n" +
      "Send a video URL (YouTube, etc.) and pick a quality.\n\n" +
      "*Commands:*\n" +
      "/start, /help — this message\n" +
      "/cancel — reset state\n" +
      "/clearcookies — delete saved cookies\n\n" +
      "*Cookies:* If a site requires login, install the *Get cookies.txt LOCALLY* " +
      "browser extension, export your cookies, and paste the file contents to me " +
      "when prompted.";
    await msg.reply({ message: help, parseMode: "markdown" });
  }

  async handleUrl(msg, senderId, url) {
    const userState = state.get(senderId);
    const cookiesPath = cookies.getCookiesPath(senderId);

    const status = await msg.reply({ message: "🔍 Fetching video info..." });
    let info;
    try {
      info = await ytdlp.probe(url, cookiesPath);
    } catch (err) {
      logger.warn(`Probe failed for ${senderId}: ${err.message}`);
      if (err.cookieIssue || ytdlp.looksLikeCookieIssue(err.stderr || err.message)) {
        userState.waitingForCookies = true;
        userState.pendingUrl = url;
        await this.client.editMessage(msg.chatId, {
          message: status.id,
          text:
            "🔒 This URL seems to require cookies (login/age/region).\n\n" +
            "Please:\n" +
            "1. Install the *Get cookies.txt LOCALLY* extension in your browser.\n" +
            "2. Open the site and log in.\n" +
            "3. Export cookies for that domain.\n" +
            "4. Paste the cookies.txt content as a text message here.\n\n" +
            "Then send the link again to retry.",
          parseMode: "markdown",
        });
      } else {
        await this.client.editMessage(msg.chatId, {
          message: status.id,
          text: `❌ Could not fetch info:\n\`\`\`\n${truncate(err.message, 400)}\n\`\`\``,
          parseMode: "markdown",
        });
      }
      return;
    }

    if (info.isLive) {
      await this.client.editMessage(msg.chatId, {
        message: status.id,
        text: "❌ Live streams are not supported.",
      });
      return;
    }

    userState.pendingUrl = url;
    const rows = buildMenu(info);
    const buttons = buildButtons(rows);

    const durationStr = info.duration
      ? `⏱ ${formatDuration(info.duration)}\n`
      : "";

    await this.client.editMessage(msg.chatId, {
      message: status.id,
      text:
        `🎬 *${escapeMd(info.title)}*\n` +
        durationStr +
        `\nChoose quality:`,
      parseMode: "markdown",
      buttons,
    });
  }

  async onCallback(event) {
    const senderId = event.userId ? Number(event.userId.toString()) : null;
    if (!senderId || !auth.isAllowed(senderId)) {
      await event.answer({ message: "⛔ Not authorized.", alert: true });
      return;
    }

    const data = event.data ? event.data.toString() : "";
    const userState = state.get(senderId);

    if (data === "cancel") {
      userState.pendingUrl = null;
      await event.edit({ text: "❌ Cancelled.", buttons: [] });
      await event.answer({ message: "Cancelled" });
      return;
    }

    if (!userState.pendingUrl) {
      await event.answer({
        message: "Session expired. Send the link again.",
        alert: true,
      });
      return;
    }

    if (userState.activeJob) {
      await event.answer({
        message: "Another download is already running.",
        alert: true,
      });
      return;
    }

    const [kind, value] = data.split(":");
    if (kind !== "a" && kind !== "v") {
      await event.answer({ message: "Unknown action.", alert: true });
      return;
    }

    userState.activeJob = true;
    const url = userState.pendingUrl;
    userState.pendingUrl = null;

    try {
      await event.answer({ message: "Starting..." });
      await this.runJob(event, senderId, url, kind, value);
    } catch (err) {
      logger.error(`Job failed for ${senderId}:`, err.message);
      await this.notifyJobError(event, senderId, err);
    } finally {
      userState.activeJob = false;
    }
  }

  async runJob(event, senderId, url, kind, value) {
    const chatId = event.chatId;
    const messageId = event.messageId;
    const cookiesPath = cookies.getCookiesPath(senderId);
    const jobDir = path.join(
      config.downloadDir,
      String(senderId),
      Date.now().toString(),
    );

    const labelLine =
      kind === "a" ? "🎵 Audio (MP3)" : `🎬 ${value}p`;

    let lastEdit = 0;
    const editStatus = async (text) => {
      const now = Date.now();
      if (now - lastEdit < 3000) return;
      lastEdit = now;
      try {
        await this.client.editMessage(chatId, {
          message: messageId,
          text,
          buttons: [],
        });
      } catch (e) {
        // Ignore "message not modified" / flood errors
      }
    };

    await editStatus(`${labelLine}\n⬇️ Downloading... 0%`);

    try {
      let outputFile;
      if (kind === "a") {
        outputFile = await ytdlp.downloadAudio({
          url,
          jobDir,
          cookiesPath,
          onProgress: (p) =>
            editStatus(`${labelLine}\n⬇️ Downloading... ${p.toFixed(1)}%`),
        });
      } else {
        outputFile = await ytdlp.downloadVideo({
          url,
          jobDir,
          maxHeight: Number(value),
          cookiesPath,
          onProgress: (p) =>
            editStatus(`${labelLine}\n⬇️ Downloading... ${p.toFixed(1)}%`),
        });
      }

      const stat = fs.statSync(outputFile);
      if (stat.size > config.maxUploadBytes) {
        throw new Error(
          `File too large (${humanSize(stat.size)} > ${humanSize(config.maxUploadBytes)}). ` +
            `Try a lower quality.`,
        );
      }

      await this.client.editMessage(chatId, {
        message: messageId,
        text: `${labelLine}\n📤 Uploading ${humanSize(stat.size)}...`,
        buttons: [],
      });

      const isAudio = kind === "a";
      const fileName = path.basename(outputFile);
      const attributes = isAudio
        ? [
            new Api.DocumentAttributeAudio({
              duration: 0,
              title: stripExt(fileName),
            }),
          ]
        : undefined;

      let lastUploadEdit = 0;
      await this.client.sendFile(chatId, {
        file: outputFile,
        caption: stripExt(fileName),
        supportsStreaming: !isAudio,
        attributes,
        progressCallback: (uploaded, total) => {
          const now = Date.now();
          if (now - lastUploadEdit < 4000) return;
          lastUploadEdit = now;
          if (!total) return;
          const pct = ((Number(uploaded) / Number(total)) * 100).toFixed(1);
          this.client
            .editMessage(chatId, {
              message: messageId,
              text: `${labelLine}\n📤 Uploading... ${pct}%`,
              buttons: [],
            })
            .catch(() => {});
        },
      });

      await this.client.editMessage(chatId, {
        message: messageId,
        text: `${labelLine}\n✅ Done.`,
        buttons: [],
      });
    } finally {
      cleanupDir(jobDir);
    }
  }

  async notifyJobError(event, senderId, err) {
    const userState = state.get(senderId);
    if (err.cookieIssue || ytdlp.looksLikeCookieIssue(err.stderr || err.message)) {
      userState.waitingForCookies = true;
      try {
        await this.client.editMessage(event.chatId, {
          message: event.messageId,
          text:
            "🔒 Cookies are required for this content.\n\n" +
            "Use the *Get cookies.txt LOCALLY* extension, export the cookies " +
            "for that site, and paste the file contents to me as a text message. " +
            "Then send the link again.",
          parseMode: "markdown",
          buttons: [],
        });
      } catch (e) {
        // ignore
      }
      return;
    }

    try {
      await this.client.editMessage(event.chatId, {
        message: event.messageId,
        text: `❌ Failed:\n\`\`\`\n${truncate(err.message, 400)}\n\`\`\``,
        parseMode: "markdown",
        buttons: [],
      });
    } catch (e) {
      // ignore
    }
  }
}

function cleanupDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    const parent = path.dirname(dir);
    if (
      parent.startsWith(config.downloadDir) &&
      parent !== config.downloadDir
    ) {
      const remaining = fs.readdirSync(parent);
      if (remaining.length === 0) fs.rmdirSync(parent);
    }
  } catch (e) {
    logger.warn(`Cleanup failed for ${dir}: ${e.message}`);
  }
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, "");
}

function escapeMd(text) {
  return String(text).replace(/([_*`\[\]])/g, "\\$1");
}

function truncate(s, n) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "..." : s;
}

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  return `${m}m ${s}s`;
}

module.exports = { Bot };
