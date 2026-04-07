const { patchClaimExpiresAt } = require("../services/k8s");

const ALLOWED_ROLES = ["platform", "sre"];

module.exports = {
  name: "extend",
  description: "리소스 만료일 연장 (platform/sre 팀만 가능)",

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      // 권한 확인 — Discord 역할 이름으로 체크
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
          "❌ 이 명령은 **platform** 또는 **sre** 팀만 사용할 수 있습니다."
        );
      }

      const kind = interaction.options?.getString("kind");
      const name = interaction.options?.getString("name");
      const ns = interaction.options?.getString("namespace");
      const newDate = interaction.options?.getString("date");

      if (!kind || !name || !ns || !newDate) {
        return await interaction.editReply(
          "❌ 사용법: `/extend <kind> <name> <namespace> <date>` (예: `/extend Cluster my-cluster default 2026-06-30`)"
        );
      }

      // 날짜 형식 검증
      if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
        return await interaction.editReply("❌ 날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력하세요.");
      }

      await patchClaimExpiresAt(kind, ns, name, newDate);

      await interaction.editReply(
        `✅ \`${kind}/${ns}/${name}\`의 만료일을 **${newDate}**로 연장했습니다.`
      );

      // lifecycle 채널에도 알림
      if (interaction.client?.sendToLifecycleChannel) {
        await interaction.client.sendToLifecycleChannel(
          `📅 **만료일 연장** — \`${kind}/${ns}/${name}\`\n` +
          `새 만료일: **${newDate}** | 연장자: ${interaction.user?.tag || "unknown"}`
        );
      }
    } catch (error) {
      console.error("extend 실패:", error.message);
      await interaction.editReply("❌ 만료일 연장 실패: " + error.message);
    }
  },
};
