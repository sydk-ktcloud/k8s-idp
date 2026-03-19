const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "bot-config.json");

function ensureConfigFile() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          guildId: "",
          chatChannelId: "",
        },
        null,
        2
      ),
      "utf8"
    );
  }
}

function getBotConfig() {
  ensureConfigFile();
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw);
}

function saveBotConfig(newConfig) {
  ensureConfigFile();
  const current = getBotConfig();
  const updated = { ...current, ...newConfig };
  fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

module.exports = {
  getBotConfig,
  saveBotConfig,
};