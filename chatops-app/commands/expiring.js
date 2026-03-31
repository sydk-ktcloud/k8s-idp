const { listProvisionedClaims } = require("../services/k8s");

function daysUntil(dateStr) {
  if (!dateStr || dateStr === "9999-12-31") return Infinity;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

module.exports = {
  name: "expiring",
  description: "N일 이내 만료 리소스 목록 조회 (기본 7일)",

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const optionDays = interaction.options?.getInteger("days") ?? 7;
      const days = Math.min(Math.max(1, optionDays), 365);

      const claims = await listProvisionedClaims();

      const expiring = claims
        .map((claim) => {
          const labels = claim.metadata?.labels || {};
          const expiresAt = labels["expires-at"];
          const remaining = daysUntil(expiresAt);
          return {
            kind: claim.kind,
            ns: claim.metadata?.namespace || "default",
            name: claim.metadata?.name || "unknown",
            tier: labels["lifecycle-tier"] || "?",
            expiresAt: expiresAt || "?",
            owner: labels["owner"] || "unknown",
            team: labels["team"] || "unknown",
            remaining,
          };
        })
        .filter((r) => r.remaining <= days)
        .sort((a, b) => a.remaining - b.remaining);

      if (expiring.length === 0) {
        return await interaction.editReply(`✅ ${days}일 이내 만료 예정 리소스가 없습니다.`);
      }

      const lines = expiring.map((r) => {
        const icon = r.remaining < 0 ? "🔴" : r.remaining === 0 ? "🟠" : "🟡";
        const label = r.remaining < 0
          ? `${Math.abs(r.remaining)}일 경과`
          : r.remaining === 0
          ? "오늘 만료"
          : `${r.remaining}일 후`;
        return `${icon} \`${r.kind}\` ${r.ns}/${r.name} | ${label} (${r.expiresAt}) | ${r.tier} | 담당: ${r.owner}`;
      });

      const content =
        `⏰ **${days}일 이내 만료 리소스** — ${expiring.length}개\n` +
        `\`\`\`\n${lines.join("\n").slice(0, 1800)}\n\`\`\`\n` +
        `만료일 연장: \`/extend <kind> <name> <ns> <date>\``;

      await interaction.editReply(content);
    } catch (error) {
      console.error("expiring 조회 실패:", error.message);
      await interaction.editReply("만료 리소스 조회 실패: " + error.message);
    }
  },
};
