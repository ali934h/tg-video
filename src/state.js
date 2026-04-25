const userStates = new Map();

function get(userId) {
  let s = userStates.get(userId);
  if (!s) {
    s = {
      pendingUrl: null,
      pendingFormats: null,
      waitingForCookies: false,
      activeJob: false,
    };
    userStates.set(userId, s);
  }
  return s;
}

function reset(userId) {
  userStates.delete(userId);
}

module.exports = { get, reset };
