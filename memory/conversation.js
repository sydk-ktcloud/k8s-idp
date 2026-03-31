const conversations = new Map();

const MAX_MESSAGES = 12;
const EXPIRE_MS = 1000 * 60 * 30; // 30분

function createInitialState() {
  return {
    messages: [],
    context: {
      lastService: null,
      lastPod: null,
      lastNamespace: null,
      lastIntent: null,
      lastTool: null,
      lastResultSummary: null,
    },
    updatedAt: Date.now(),
  };
}

function getConversationKey({ guildId, channelId, userId = "shared" }) {
  return `${guildId || "dm"}:${channelId || "unknown"}:${userId}`;
}

function getMemory(scope = {}) {
  const key = getConversationKey(scope);

  if (!conversations.has(key)) {
    conversations.set(key, createInitialState());
  }

  const mem = conversations.get(key);

  if (Date.now() - mem.updatedAt > EXPIRE_MS) {
    const reset = createInitialState();
    conversations.set(key, reset);
    return reset;
  }

  return mem;
}

function touchMemory(mem) {
  mem.updatedAt = Date.now();
}

function addMessage(scope, role, content) {
  const mem = getMemory(scope);

  mem.messages.push({
    role,
    content: String(content || ""),
    ts: Date.now(),
  });

  if (mem.messages.length > MAX_MESSAGES) {
    mem.messages = mem.messages.slice(-MAX_MESSAGES);
  }

  touchMemory(mem);
  return mem;
}

function updateContext(scope, patch = {}) {
  const mem = getMemory(scope);
  mem.context = {
    ...mem.context,
    ...patch,
  };
  touchMemory(mem);
  return mem.context;
}

function getRecentMessagesForLLM(scope) {
  const mem = getMemory(scope);
  return mem.messages.map(({ role, content }) => ({ role, content }));
}

function clearMemory(scope) {
  const key = getConversationKey(scope);
  conversations.set(key, createInitialState());
}

module.exports = {
  getMemory,
  addMessage,
  updateContext,
  getRecentMessagesForLLM,
  clearMemory,
};