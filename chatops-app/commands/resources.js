const { listProvisionedClaims } = require("../services/k8s");

module.exports = {
  name: "resources",
  description: "팀별 프로비저닝된 클라우드 리소스 목록 조회",

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const claims = await listProvisionedClaims();

      if (!claims || claims.length === 0) {
        return await interaction.editReply("프로비저닝된 리소스가 없습니다.");
      }

      // 팀별로 그룹화
      const byTeam = {};
      for (const claim of claims) {
        const labels = claim.metadata?.labels || {};
        const team = labels["team"] || "unknown";
        const owner = labels["owner"] || "unknown";
        const tier = labels["lifecycle-tier"] || "?";
        const expiresAt = labels["expires-at"] || "?";
        const ns = claim.metadata?.namespace || "default";
        const name = claim.metadata?.name || "unknown";
        const kind = claim.kind || "?";

        if (!byTeam[team]) byTeam[team] = [];
        byTeam[team].push({ kind, ns, name, tier, expiresAt, owner });
      }

      const lines = [];
      for (const [team, resources] of Object.entries(byTeam).sort()) {
        lines.push(`**[${team}]** (${resources.length}개)`);
        for (const r of resources) {
          lines.push(`  \`${r.kind}\` ${r.ns}/${r.name} | ${r.tier} | 만료: ${r.expiresAt} | 담당: ${r.owner}`);
        }
      }

      const content = `📦 **프로비저닝된 리소스 목록** — 총 ${claims.length}개\n\`\`\`\n${lines.join("\n").slice(0, 1800)}\n\`\`\``;
      await interaction.editReply(content);
    } catch (error) {
      console.error("resources 조회 실패:", error.message);
      await interaction.editReply("리소스 목록 조회 실패: " + error.message);
    }
  },
};
