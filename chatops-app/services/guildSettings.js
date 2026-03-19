const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "..", "data", "guildSettings.json");

function ensureFile() {
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "{}", "utf-8");
  }
}

function loadSettings() {
  ensureFile();
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function saveSettings(data) {
  ensureFile();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getGuildSetting(guildId) {
  const settings = loadSettings();
  return settings[guildId] || null;
}

function setGuildChatChannel(guildId, channelId) {
  const settings = loadSettings();

  settings[guildId] = {
    ...(settings[guildId] || {}),
    chatChannelId: channelId,
  };

  saveSettings(settings);
}

module.exports = {
  loadSettings,
  saveSettings,
  getGuildSetting,
  setGuildChatChannel,
};