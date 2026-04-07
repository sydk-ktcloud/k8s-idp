const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { deleteClaimResource } = require("../services/k8s");

const ALLOWED_ROLES = ["platform"];

module.exports = {
  name: "delete-resource",
  description: "Claim 리소스 삭제 (platform 팀만 가능, 확인 버튼 포함)",

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // 권한 확인
      const memberRoles = interaction.member?.roles?.cache;
      const hasPermission = memberRoles
        ? memberRoles.some((role) =>
            ALLOWED_ROLES.some((allowed) =>
              role.name.toLowerCase().includes(allowed)
            )
          )
        : false;

      if (!hasPermission) {
        return await interaction.editReply(
          "❌ 이 명령은 **platform** 팀만 사용할 수 있습니다."
        );
      }

      const kind = interaction.options?.getString("kind");
      const name = interaction.options?.getString("name");
      const ns = interaction.options?.getString("namespace");

      if (!kind || !name || !ns) {
        return await interaction.editReply(
          "❌ 사용법: `/delete-resource <kind> <name> <namespace>` (예: `/delete-resource Cluster my-cluster default`)"
        );
      }

      // 확인 버튼 표시
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirm-delete|${kind}|${ns}|${name}`)
          .setLabel(`삭제 확인: ${kind}/${ns}/${name}`)
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("cancel-delete")
          .setLabel("취소")
          .setStyle(ButtonStyle.Secondary)
      );

      await interaction.editReply({
        content:
          `⚠️ **정말 삭제하시겠습니까?**\n\n` +
          `- Kind: \`${kind}\`\n` +
          `- Name: \`${name}\`\n` +
          `- Namespace: \`${ns}\`\n\n` +
          `삭제 시 Crossplane이 클라우드 리소스도 함께 제거합니다.`,
        components: [row],
      });
    } catch (error) {
      console.error("delete-resource 실패:", error.message);
      await interaction.editReply("❌ 삭제 요청 실패: " + error.message);
    }
  },

  // 확인 버튼 핸들러 (bot.js에서 interactionCreate 이벤트로 호출)
  async handleButton(interaction) {
    const [action, kind, ns, name] = interaction.customId.split("|");

    if (action === "cancel-delete") {
      return await interaction.update({ content: "취소되었습니다.", components: [] });
    }

    if (action === "confirm-delete") {
      await interaction.update({ content: "🗑️ 삭제 중...", components: [] });
      try {
        await deleteClaimResource(kind, ns, name);
        await interaction.editReply(
          `✅ \`${kind}/${ns}/${name}\` 삭제 완료. Crossplane이 클라우드 리소스를 정리합니다.`
        );
      } catch (error) {
        await interaction.editReply("❌ 삭제 실패: " + error.message);
      }
    }
  },
};
