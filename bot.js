require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
} = require("discord.js");

const { routeChatMessage } = require("./services/chatRouter");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once("ready", async () => {
  console.log(`봇 로그인 성공: ${client.user.tag}`);
  console.log(`CLIENT_ID 자동 확인: ${client.user.id}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.content) return;

    await message.channel.sendTyping();

    const answer = await routeChatMessage(message.content, {
      guildId: message.guild?.id,
      channelId: message.channel?.id,
      userId: message.author.id,
    });

    if (answer) {
      await message.reply(answer);
    }
  } catch (err) {
    console.error("챗봇 채널 처리 오류:", err);
    await message.reply(`처리 중 오류가 발생했습니다: ${err.message}`);
  }
});

client.login(process.env.DISCORD_TOKEN);