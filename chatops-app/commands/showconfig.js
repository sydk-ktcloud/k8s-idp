const { getBotConfig } = require("../services/botConfig");

module.exports = {
  name: "showconfig",
  description: "현재 저장된 봇 설정 확인",
  options: [],

  async execute(interaction) {
    try {
      const config = getBotConfig();

      await interaction.reply({
        content: [
          "현재 저장된 설정",
          `GUILD_ID: ${config.guildId || "미설정"}`,
          `CHAT_CHANNEL_ID: ${config.chatChannelId || "미설정"}`,
        ].join("\n"),
        ephemeral: true,
      });
    } catch (error) {
      console.error("showconfig 명령 오류:", error);
      await interaction.reply({
        content: "설정 확인 중 오류가 발생했습니다.",
        ephemeral: true,
      });
    }
  },
};