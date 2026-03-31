const { getAllPods, getProblemPods } = require("../k8s");
const { queryPrometheus } = require("../prometheus");
const { getClusterResourceUsage } = require("../metrics");

module.exports = async function clusterStatusTool() {
  let upCount = "N/A";
  let cpuText = "N/A";
  let memoryText = "N/A";

  try {
    const upResult = await queryPrometheus("up");
    upCount = Array.isArray(upResult) ? upResult.length : "N/A";
  } catch (_) {}

  const allPods = (await getAllPods()) || [];
  const problemPods = (await getProblemPods()) || [];
  const runningPods = allPods.filter((p) => p.phase === "Running").length;

  try {
    const metrics = await getClusterResourceUsage();
    cpuText = `${metrics.totalCpuMillicores.toFixed(0)}m`;
    memoryText = `${metrics.totalMemoryMi.toFixed(1)} MiB`;
  } catch (_) {}

  return {
    ok: true,
    summary: [
      "Kubernetes Cluster Status",
      "",
      `Up 대상: ${upCount}`,
      `Running Pod: ${runningPods}`,
      `Problem Pod: ${problemPods.length}`,
      "",
      `클러스터 CPU 사용량: ${cpuText}`,
      `클러스터 Memory 사용량: ${memoryText}`,
    ].join("\n"),
    memory: {
      lastIntent: "status",
    },
  };
};