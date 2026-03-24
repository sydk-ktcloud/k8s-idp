const { queryPrometheus } = require("../services/prometheus");
const { getProblemPods, getAllPods } = require("../services/k8s");
const { getClusterResourceUsage } = require("../services/metrics");

module.exports = {
  name: "status",
  description: "서비스 상태 확인",

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const upResult = await queryPrometheus("up");
      const upCount = upResult.length;

      const allPods = await getAllPods();
      const problemPods = await getProblemPods();
      const runningPods = allPods.filter((p) => p.phase === "Running").length;

      let cpuText = "N/A";
      let memoryText = "N/A";

      try {
        const metrics = await getClusterResourceUsage();
        cpuText = `${metrics.totalCpuMillicores.toFixed(0)}m`;
        memoryText = `${metrics.totalMemoryMi.toFixed(1)} MiB`;
      } catch (metricsError) {
        console.error("Metrics error:", metricsError.message);
      }

      const message = [
        "Kubernetes Cluster Status",
        "",
        "🟢 Prometheus 연결: 정상",
        `🟢 Up 대상: ${upCount}`,
        `🟡 Running Pod: ${runningPods}`,
        `🔴 Problem Pod: ${problemPods.length}`,
        "",
        `클러스터 CPU 사용량: ${cpuText}`,
        `클러스터 Memory 사용량: ${memoryText}`,
      ].join("\n");

      await interaction.editReply(message);
    } catch (error) {
      console.error("Status error:", error.response?.data || error.message);

      await interaction.editReply(
        `상태 조회 실패\n원인: ${error.response?.data?.error || error.message}`
      );
    }
  },
};