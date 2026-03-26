const { exec } = require("child_process");

function parseCpuToMillicores(cpu) {
  if (!cpu) return 0;

  if (cpu.endsWith("m")) {
    return Number(cpu.replace("m", "")) || 0;
  }

  const cores = Number(cpu);
  if (Number.isFinite(cores)) {
    return cores * 1000;
  }

  return 0;
}

function parseMemoryToMi(memory) {
  if (!memory) return 0;

  if (memory.endsWith("Ki")) {
    return (Number(memory.replace("Ki", "")) || 0) / 1024;
  }

  if (memory.endsWith("Mi")) {
    return Number(memory.replace("Mi", "")) || 0;
  }

  if (memory.endsWith("Gi")) {
    return (Number(memory.replace("Gi", "")) || 0) * 1024;
  }

  if (memory.endsWith("Ti")) {
    return (Number(memory.replace("Ti", "")) || 0) * 1024 * 1024;
  }

  return 0;
}

async function getClusterResourceUsage() {
  return new Promise((resolve, reject) => {
    exec("kubectl top pods -A --no-headers", (error, stdout, stderr) => {
      if (error) {
        return reject(
          new Error(stderr || error.message || "kubectl top 실행 실패")
        );
      }

      const lines = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      let totalCpuMillicores = 0;
      let totalMemoryMi = 0;

      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 4) continue;

        totalCpuMillicores += parseCpuToMillicores(parts[2]);
        totalMemoryMi += parseMemoryToMi(parts[3]);
      }

      resolve({
        totalCpuMillicores,
        totalMemoryMi,
        podMetricCount: lines.length,
      });
    });
  });
}

module.exports = {
  getClusterResourceUsage,
};