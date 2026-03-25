const { saveBotConfig } = require("../services/botConfig");

module.exports = {
  name: "setchat",
  description: "현재 채널을 챗봇 채널로 설정",
  options: [],

  async execute(interaction) {
    try {
      saveBotConfig({ chatChannelId: interaction.channelId });

      await interaction.reply({
        content: `현재 채널이 챗봇 채널로 설정되었습니다.\nCHANNEL_ID: ${interaction.channelId}`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("setchat 명령 오류:", error);
      await interaction.reply({
        content: "setchat 실행 중 오류가 발생했습니다.",
        ephemeral: true,
      });
    }
  },
};