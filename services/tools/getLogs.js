const { getLogs } = require("../logs");
const { findPodsByService } = require("../k8s");

function pickBestPodForLogs(pods = []) {
  if (!Array.isArray(pods) || pods.length === 0) return null;

  const scorePod = (p) => {
    const status = String(p.displayStatus || p.phase || "");
    const restarts = Number(p.restarts || 0);

    let score = 0;

    if (/CrashLoopBackOff|Error|BackOff|OOMKilled/i.test(status)) score += 100;
    if (/Pending|ContainerCreating|StartError|Unknown/i.test(status)) score += 20;

    score += restarts * 5;

    return score;
  };

  return [...pods].sort((a, b) => scorePod(b) - scorePod(a))[0];
}

module.exports = async function getLogsTool(args = {}) {
  let { pod, service, namespace, tailLines = 100 } = args;

  if (!pod && service) {
    const pods = await findPodsByService(service);
    const picked = pickBestPodForLogs(pods) || pods?.[0];

    if (picked) {
      pod = picked.name;
      namespace = namespace || picked.namespace;
    }
  }

  if (!pod || !namespace) {
    return {
      ok: false,
      summary: "로그를 조회할 pod 또는 namespace를 찾지 못했습니다.",
      memory: {},
    };
  }

  const logs = await getLogs(pod, namespace, tailLines);

  if (!logs || !logs.trim()) {
    return {
      ok: true,
      summary: `로그가 비어 있습니다.\nNamespace: ${namespace}\nPod: ${pod}`,
      raw: { logs: "", pod, namespace, service },
      memory: {
        lastPod: pod,
        lastNamespace: namespace,
        lastService: service || null,
        lastIntent: "logs",
      },
    };
  }

  const trimmed = logs.slice(-1600);

  return {
    ok: true,
    summary: ` ${namespace}/${pod} 로그\n\`\`\`\n${trimmed}\n\`\`\``,
    raw: { logs, pod, namespace, service },
    memory: {
      lastPod: pod,
      lastNamespace: namespace,
      lastService: service || null,
      lastIntent: "logs",
    },
  };
};