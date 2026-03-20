const { saveBotConfig } = require("../services/botConfig");

module.exports = {
  name: "setup",
  description: "현재 서버를 봇 기본 서버로 설정",
  options: [],

  async execute(interaction) {
    try {
      if (!interaction.guildId) {
        return interaction.reply({
          content: "이 명령어는 서버 안에서만 사용할 수 있습니다.",
          ephemeral: true,
        });
      }

      saveBotConfig({ guildId: interaction.guildId });

      await interaction.reply({
        content: `현재 서버가 기본 서버로 설정되었습니다.\nGUILD_ID: ${interaction.guildId}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("setup 명령 오류:", error);
      await interaction.reply({
        content: "setup 실행 중 오류가 발생했습니다.",
        ephemeral: true,
      });
    }
  },
};