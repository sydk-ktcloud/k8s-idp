const { saveBotConfig, getBotConfig } = require("../services/botConfig");

module.exports = {
  name: "setlifecyclechannel",
  description: "현재 채널을 라이프사이클 알람 채널로 설정 (만료 경고, 자동 삭제 알림 등)",

  async execute(interaction) {
    try {
      saveBotConfig({ lifecycleChannelId: interaction.channelId });

      const config = getBotConfig();
      const chatChannelId = config.chatChannelId;
      const isSame = chatChannelId && chatChannelId === interaction.channelId;

      await interaction.reply({
        content:
          `✅ 이 채널이 **라이프사이클 알람 채널**로 설정되었습니다.\n` +
          `CHANNEL_ID: \`${interaction.channelId}\`\n\n` +
          (isSame
            ? `⚠️ 현재 챗봇 채널과 동일합니다. 알람 분리를 원하면 다른 채널에서 실행하세요.`
            : `기존 챗봇 채널(\`${chatChannelId || "미설정"}\`)과 분리되었습니다.`),
        ephemeral: true,
      });
    } catch (error) {
      console.error("setlifecyclechannel 오류:", error);
      await interaction.reply({
        content: "채널 설정 중 오류가 발생했습니다.",
        ephemeral: true,
      });
    }
  },
};
