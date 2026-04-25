const config = require("./config");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[config.logLevel] ?? LEVELS.info;

function ts() {
  return new Date().toISOString();
}

function redact(args) {
  return args.map((a) => {
    if (typeof a === "string") {
      let out = a;
      if (config.botToken) out = out.split(config.botToken).join("[REDACTED]");
      if (config.apiHash) out = out.split(config.apiHash).join("[REDACTED]");
      return out;
    }
    return a;
  });
}

function make(level, label) {
  return (...args) => {
    if (LEVELS[level] > current) return;
    const safe = redact(args);
    const line = `[${ts()}] ${label}`;
    if (level === "error") console.error(line, ...safe);
    else if (level === "warn") console.warn(line, ...safe);
    else console.log(line, ...safe);
  };
}

module.exports = {
  error: make("error", "ERROR"),
  warn: make("warn", "WARN "),
  info: make("info", "INFO "),
  debug: make("debug", "DEBUG"),
};
