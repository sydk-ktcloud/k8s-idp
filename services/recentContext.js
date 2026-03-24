const recentContextMap = new Map();

function makeKey({ guildId, channelId }) {
  return `${guildId || "dm"}:${channelId || "default"}`;
}

function setRecentContext(scope, data) {
  const key = makeKey(scope);
  recentContextMap.set(key, {
    ...data,
    savedAt: Date.now(),
  });
}

function getRecentContext(scope) {
  const key = makeKey(scope);
  return recentContextMap.get(key) || null;
}

function clearRecentContext(scope) {
  const key = makeKey(scope);
  recentContextMap.delete(key);
}

module.exports = {
  setRecentContext,
  getRecentContext,
  clearRecentContext,
};