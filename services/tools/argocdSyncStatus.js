const { execSync } = require("child_process");

module.exports = async function argocdSyncStatusTool() {
  try {
    const raw = execSync("kubectl get applications -A -o json", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    const parsed = JSON.parse(raw);
    const items = parsed.items || [];

    if (items.length === 0) {
      return {
        ok: true,
        summary:
          "현재 클러스터에서 조회 가능한 ArgoCD Application 리소스가 없습니다. ArgoCD CR이 없거나, 현재 계정 권한에서 보이지 않는 상태일 수 있습니다.",
        memory: {
          lastIntent: "argocd_sync_status",
        },
      };
    }

    const lines = items.map((app) => {
      const ns = app.metadata?.namespace || "unknown";
      const name = app.metadata?.name || "unknown";
      const sync = app.status?.sync?.status || "Unknown";
      const health = app.status?.health?.status || "Unknown";
      return `- ${ns}/${name} | Sync: ${sync} | Health: ${health}`;
    });

    return {
      ok: true,
      summary: ["ArgoCD 애플리케이션 동기화 상태", "", ...lines].join("\n"),
      memory: {
        lastIntent: "argocd_sync_status",
      },
    };
  } catch (error) {
    return {
      ok: true,
      summary:
        "ArgoCD Application 상태를 직접 조회하지 못했습니다. 현재 클러스터에 Application CR이 없거나 kubectl 조회 권한이 부족할 수 있습니다.",
      memory: {
        lastIntent: "argocd_sync_status",
      },
    };
  }
};