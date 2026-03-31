require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Collection,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const { getLogs } = require("./services/logs");
const { analyzeLogs } = require("./services/gpt");
const { getGuildSetting } = require("./services/guildSettings");
const { routeChatMessage } = require("./services/chatRouter");
const { getBotConfig } = require("./services/botConfig");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// lifecycle 채널로 메시지 전송하는 헬퍼
// /setlifecyclechannel 로 지정된 채널에 전송, 미지정 시 무시
async function sendToLifecycleChannel(content) {
  try {
    const config = getBotConfig();
    const channelId = config.lifecycleChannelId;
    if (!channelId) return;
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (channel?.isTextBased()) {
      await channel.send(String(content).slice(0, 2000));
    }
  } catch (err) {
    console.error("[lifecycle channel] 전송 실패:", err.message);
  }
}

client.sendToLifecycleChannel = sendToLifecycleChannel;

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  try {
    const command = require(path.join(commandsPath, file));

    if (!command?.name) {
      console.warn(`[commands] name 없음: ${file}`);
      continue;
    }

    client.commands.set(command.name, command);
    console.log(`[commands] 로드 완료: ${command.name}`);
  } catch (error) {
    console.error(`[commands] 로드 실패: ${file}`, error);
  }
}

client.once("clientReady", () => {
  console.log(`봇 로그인 성공: ${client.user.tag}`);
  console.log(`CLIENT_ID 자동 확인: ${client.user.id}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const content = message.content?.trim();
    if (!content) return;
    if (content.startsWith("/")) return;

    const guildSetting = getGuildSetting(message.guild.id);

    // 챗봇 채널이 지정되지 않았으면 무시
    if (!guildSetting || !guildSetting.chatChannelId) return;

    // 지정된 채널이 아니면 무시
    if (message.channel.id !== guildSetting.chatChannelId) return;

    await message.channel.sendTyping();

    const answer = await routeChatMessage(content, {
      guildId: message.guild.id,
      channelId: message.channel.id,
    });

    const safeAnswer =
      String(answer || "").length > 1900
        ? `${String(answer).slice(0, 1900)}...`
        : String(answer || "응답이 비어 있습니다.");

    await message.reply(safeAnswer);
  } catch (error) {
    console.error(
      "챗봇 채널 처리 오류:",
      error?.stack || error?.message || error
    );

    try {
      await message.reply("챗봇 처리 중 오류가 발생했습니다.");
    } catch (_) {}
  }
});

client.on("interactionCreate", async (interaction) => {
  try {
    // 1. 버튼 처리
    if (interaction.isButton()) {
      const [action, ...rest] = String(interaction.customId || "").split("|");

      // lifecycle: delete 확인/취소 버튼
      if (action === "confirm-delete" || action === "cancel-delete") {
        const deleteResourceCmd = client.commands.get("delete-resource");
        if (deleteResourceCmd?.handleButton) {
          await deleteResourceCmd.handleButton(interaction);
          if (action === "confirm-delete") {
            const [, kind, ns, name] = ["", ...rest];
            await sendToLifecycleChannel(
              `🗑️ **리소스 수동 삭제** — \`${kind}/${ns}/${name}\`\n` +
              `삭제 요청자: ${interaction.user?.tag || "unknown"}`
            );
          }
        }
        return;
      }

      const [namespace, pod] = rest;

      if (action === "analyze") {
        await interaction.deferReply();

        try {
          const logs = await getLogs(pod, namespace);

          if (!logs || !logs.trim()) {
            return await interaction.editReply(
              `로그가 비어 있습니다.\nNamespace: ${namespace}\nPod: ${pod}`
            );
          }

          const analysis = await analyzeLogs(logs);

          const reply = `**AI Analysis for ${pod}**
**Namespace:** ${namespace}

${analysis}`;

          await interaction.editReply(reply.slice(0, 1900));
        } catch (error) {
          console.error("버튼 분석 실행 오류:", error);
          await interaction.editReply(
            `분석 실패: ${String(error?.message || error).slice(0, 1800)}`
          );
        }
      }

      return;
    }

    // 2. 자동완성 처리
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);

      console.log(
        "[autocomplete]",
        "commandName:",
        interaction.commandName,
        "hasCommand:",
        !!command,
        "hasAutocomplete:",
        !!command?.autocomplete
      );

      if (!command || typeof command.autocomplete !== "function") {
        try {
          await interaction.respond([]);
        } catch (_) {}
        return;
      }

      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(
          `자동완성 처리 오류 (${interaction.commandName}):`,
          error?.stack || error?.message || error
        );

        try {
          await interaction.respond([]);
        } catch (_) {}
      }

      return;
    }

    // 3. 슬래시 명령 처리
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    console.log(
      "[slash]",
      "commandName:",
      interaction.commandName,
      "hasCommand:",
      !!command
    );

    if (!command || typeof command.execute !== "function") {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(
        `명령 실행 오류 (${interaction.commandName}):`,
        error?.stack || error?.message || error
      );

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply("명령 실행 중 오류가 발생했습니다.");
      } else {
        await interaction.reply({
          content: "명령 실행 중 오류가 발생했습니다.",
          ephemeral: true,
        });
      }
    }
  } catch (outerError) {
    console.error(
      "interactionCreate 처리 오류:",
      outerError?.stack || outerError?.message || outerError
    );

    try {
      if (interaction.isChatInputCommand()) {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply("명령 처리 중 오류가 발생했습니다.");
        } else {
          await interaction.reply({
            content: "명령 처리 중 오류가 발생했습니다.",
            ephemeral: true,
          });
        }
      } else if (interaction.isAutocomplete()) {
        await interaction.respond([]);
      }
    } catch (_) {}
  }
});

client.login(process.env.DISCORD_TOKEN);