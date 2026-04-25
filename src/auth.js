const config = require("./config");

function isAllowed(userId) {
  if (userId == null) return false;
  return config.allowedUsers.has(Number(userId));
}

module.exports = { isAllowed };
