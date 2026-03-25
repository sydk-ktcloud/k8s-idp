const { execSync } = require("child_process");

function runJson(cmd) {
  const raw = execSync(cmd, {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  return JSON.parse(raw);
}

module.exports = async function checkEsoSecretStatusTool() {
  try {
    let esoPods = [];
    let externalSecrets = [];
    let secretStores = [];
    let clusterSecretStores = [];

    try {
      esoPods = runJson("kubectl get pods -n external-secrets -o json").items || [];
    } catch (_) {}

    try {
      externalSecrets = runJson("kubectl get externalsecret -A -o json").items || [];
    } catch (_) {}

    try {
      secretStores = runJson("kubectl get secretstore -A -o json").items || [];
    } catch (_) {}

    try {
      clusterSecretStores = runJson("kubectl get clustersecretstore -A -o json").items || [];
    } catch (_) {}

    const runningEsoPods = esoPods.filter(
      (p) => p.status?.phase === "Running"
    ).length;

    const lines = [
      "Secret / ESO 연동 상태 요약",
      "",
      `ESO Pod Running: ${runningEsoPods}/${esoPods.length}`,
      `ExternalSecret 개수: ${externalSecrets.length}`,
      `SecretStore 개수: ${secretStores.length}`,
      `ClusterSecretStore 개수: ${clusterSecretStores.length}`,
      "",
    ];

    if (externalSecrets.length === 0) {
      lines.push("현재 ExternalSecret 리소스가 없어 Secret 자동 동기화는 아직 구성되지 않았을 가능성이 높습니다.");
    }

    if (secretStores.length === 0 && clusterSecretStores.length === 0) {
      lines.push("현재 SecretStore/ClusterSecretStore가 없어 ESO가 외부 시크릿 백엔드와 연결되지 않았을 가능성이 높습니다.");
    }

    if (externalSecrets.length > 0) {
      lines.push("ExternalSecret 목록:");
      externalSecrets.slice(0, 10).forEach((item) => {
        const ns = item.metadata?.namespace || "unknown";
        const name = item.metadata?.name || "unknown";
        const readyCond = (item.status?.conditions || []).find(
          (c) => c.type === "Ready"
        );
        const ready = readyCond?.status || "Unknown";
        lines.push(`- ${ns}/${name} | Ready: ${ready}`);
      });
    }

    return {
      ok: true,
      summary: lines.join("\n"),
      memory: {
        lastIntent: "eso_secret_status",
      },
    };
  } catch (error) {
    return {
      ok: false,
      summary: `ESO/Secret 상태 조회 중 오류가 발생했습니다: ${error.message}`,
      memory: {
        lastIntent: "eso_secret_status",
      },
    };
  }
};