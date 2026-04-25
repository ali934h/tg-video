const fs = require("fs");
const path = require("path");
const config = require("./config");

function cookiesPathFor(userId) {
  return path.join(config.cookiesDir, `${userId}.txt`);
}

function getCookiesPath(userId) {
  const p = cookiesPathFor(userId);
  return fs.existsSync(p) ? p : null;
}

function isValidCookiesText(text) {
  if (!text || typeof text !== "string") return false;
  const lines = text.split(/\r?\n/);
  const dataLines = lines.filter((l) => l.trim() && !l.trim().startsWith("#"));
  if (dataLines.length === 0) return false;
  return dataLines.some((l) => l.split("\t").length >= 6);
}

function saveCookies(userId, text) {
  const p = cookiesPathFor(userId);
  fs.writeFileSync(p, text, { mode: 0o600 });
  return p;
}

function deleteCookies(userId) {
  const p = cookiesPathFor(userId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = {
  getCookiesPath,
  saveCookies,
  deleteCookies,
  isValidCookiesText,
};
