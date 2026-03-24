const k8s = require("@kubernetes/client-node");

const kc = new k8s.KubeConfig();

try {
  if (process.env.KUBERNETES_SERVICE_HOST) {
    console.log("[k8s] in-cluster config 사용");
    kc.loadFromCluster();
  } else {
    console.log("[k8s] local kubeconfig 사용");
    kc.loadFromDefault();
  }
} catch (error) {
  console.error("KubeConfig 로드 실패:", error.message);
}

const coreApi = kc.makeApiClient(k8s.CoreV1Api);

function normalizeName(value) {
  return String(value || "").toLowerCase().trim();
}

function getContainerIssueStatus(containerStatuses = []) {
  for (const container of containerStatuses) {
    if (container.state?.waiting?.reason) {
      return container.state.waiting.reason;
    }

    if (container.state?.terminated?.reason) {
      return container.state.terminated.reason;
    }
  }

  return null;
}

function mapPodSummary(pod) {
  const namespace = pod.metadata?.namespace || "unknown";
  const name = pod.metadata?.name || "unknown";
  const phase = pod.status?.phase || "Unknown";
  const podIP = pod.status?.podIP || "-";
  const nodeName = pod.spec?.nodeName || "-";
  const containerStatuses = pod.status?.containerStatuses || [];
  const issue = getContainerIssueStatus(containerStatuses);
  const restartCount = containerStatuses.reduce(
    (sum, container) => sum + (container.restartCount || 0),
    0
  );

  return {
    namespace,
    name,
    phase,
    issue,
    displayStatus: issue || phase,
    restarts: restartCount,
    podIP,
    nodeName,
    raw: pod,
  };
}

function isProblemPod(podSummary) {
  const phase = String(podSummary.phase || "");
  const displayStatus = String(podSummary.displayStatus || "").toLowerCase();

  if (phase === "Succeeded") {
    return false;
  }

  if (phase !== "Running") {
    return true;
  }

  const problemKeywords = [
    "crashloopbackoff",
    "error",
    "imagepullbackoff",
    "errimagepull",
    "createcontainerconfigerror",
    "createcontainererror",
    "oomkilled",
    "pending",
    "containerstatusunknown",
    "runcontainererror",
  ];

  return problemKeywords.some((keyword) => displayStatus.includes(keyword));
}

async function listAllPodsRaw() {
  try {
    const response = await coreApi.listPodForAllNamespaces();
    return response.body?.items || response.items || [];
  } catch (error) {
    console.error("listAllPodsRaw 실패:", error.message);
    return [];
  }
}

async function getAllPods() {
  try {
    const pods = await listAllPodsRaw();

    return pods
      .map(mapPodSummary)
      .sort((a, b) => {
        if (a.namespace !== b.namespace) {
          return a.namespace.localeCompare(b.namespace);
        }
        return a.name.localeCompare(b.name);
      });
  } catch (error) {
    console.error("getAllPods 실패:", error.message);
    return [];
  }
}

async function getProblemPods() {
  try {
    const allPods = (await getAllPods()) || [];
    return allPods.filter(isProblemPod);
  } catch (error) {
    console.error("getProblemPods 실패:", error.message);
    return [];
  }
}

async function getNamespaces() {
  try {
    const response = await coreApi.listNamespace();
    const namespaces = response.body?.items || response.items || [];

    return namespaces
      .map((ns) => ns.metadata?.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error("getNamespaces 실패:", error.message);
    return [];
  }
}

async function getPodsByNamespace(namespace) {
  try {
    const safeNamespace = String(namespace || "").trim();
    if (!safeNamespace) return [];

    const allPods = (await getAllPods()) || [];

    return allPods
      .filter((p) => p.namespace === safeNamespace)
      .map((p) => ({
        name: p.name,
        phase: p.displayStatus || p.phase || "Unknown",
      }));
  } catch (error) {
    console.error("getPodsByNamespace 실패:", error.message);
    return [];
  }
}

function cleanCandidateTerm(term) {
  let value = String(term || "").toLowerCase().trim();

  if (!value) return "";

  const suffixes = [
    "이랑",
    "랑",
    "와",
    "과",
    "으로",
    "로",
    "에서",
    "은",
    "는",
    "이",
    "가",
    "을",
    "를",
    "도",
    "만",
    "좀",
    "요",
    "야",
  ];

  let changed = true;

  while (changed && value.length >= 2) {
    changed = false;

    for (const suffix of suffixes) {
      if (value.endsWith(suffix) && value.length > suffix.length) {
        value = value.slice(0, -suffix.length).trim();
        changed = true;
        break;
      }
    }
  }

  return value;
}

function extractCandidateTerms(text) {
  const rawTerms = String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .map((x) => cleanCandidateTerm(x))
    .filter((x) => x.length >= 2);

  return Array.from(new Set(rawTerms));
}

async function findMentionedServicesFromText(text) {
  try {
    const allPods = (await getAllPods()) || [];
    if (allPods.length === 0) return [];

    const terms = extractCandidateTerms(text);

    const ignored = new Set([
      "namespace",
      "네임스페이스",
      "연결",
      "연동",
      "상태",
      "로그",
      "분석",
      "파드",
      "pod",
      "클러스터",
      "어디",
      "어디있어",
      "보여줘",
      "왜",
      "오류났어",
      "죽어",
      "확인",
      "설정",
      "config",
      "values",
      "있어",
      "되어있어",
      "되어있음",
      "연결되어있음",
      "뭐야",
      "두",
      "그",
      "방금",
      "문제",
    ]);

    const matched = new Set();

    for (const term of terms) {
      if (ignored.has(term)) continue;

      const hasMatchingPod = allPods.some((pod) =>
        String(pod.name || "").toLowerCase().includes(term)
      );

      if (hasMatchingPod) {
        matched.add(term);
      }
    }

    return Array.from(matched);
  } catch (error) {
    console.error("텍스트 기반 서비스 추출 실패:", error.message);
    return [];
  }
}

async function checkServiceConnectionBasic(serviceA, serviceB) {
  try {
    const pods = (await getAllPods()) || [];

    const normalizedA = normalizeName(serviceA);
    const normalizedB = normalizeName(serviceB);

    const podsA = pods.filter((p) =>
      String(p.name || "").toLowerCase().includes(normalizedA)
    );

    const podsB = pods.filter((p) =>
      String(p.name || "").toLowerCase().includes(normalizedB)
    );

    const namespacesA = Array.from(new Set(podsA.map((p) => p.namespace))).sort(
      (a, b) => a.localeCompare(b)
    );

    const namespacesB = Array.from(new Set(podsB.map((p) => p.namespace))).sort(
      (a, b) => a.localeCompare(b)
    );

    const sameNamespace = namespacesA.filter((ns) => namespacesB.includes(ns));

    return {
      existsA: podsA.length > 0,
      existsB: podsB.length > 0,
      podsA,
      podsB,
      namespacesA,
      namespacesB,
      sameNamespace,
    };
  } catch (error) {
    console.error("서비스 연결 여부 확인 실패:", error.message);
    return {
      existsA: false,
      existsB: false,
      podsA: [],
      podsB: [],
      namespacesA: [],
      namespacesB: [],
      sameNamespace: [],
    };
  }
}

async function findPodsByService(serviceName) {
  try {
    const safeName = normalizeName(serviceName);
    if (!safeName) return [];

    const allPods = (await getAllPods()) || [];
    return allPods.filter((p) =>
      String(p.name || "").toLowerCase().includes(safeName)
    );
  } catch (error) {
    console.error("findPodsByService 실패:", error.message);
    return [];
  }
}

function extractConfigRefsFromPodRaw(rawPod) {
  const spec = rawPod?.spec || {};
  const containers = spec.containers || [];
  const volumes = spec.volumes || [];

  const configMaps = new Set();
  const secrets = new Set();
  const envVars = [];

  for (const volume of volumes) {
    if (volume.configMap?.name) {
      configMaps.add(volume.configMap.name);
    }
    if (volume.secret?.secretName) {
      secrets.add(volume.secret.secretName);
    }
  }

  for (const container of containers) {
    for (const envFrom of container.envFrom || []) {
      if (envFrom.configMapRef?.name) {
        configMaps.add(envFrom.configMapRef.name);
      }
      if (envFrom.secretRef?.name) {
        secrets.add(envFrom.secretRef.name);
      }
    }

    for (const env of container.env || []) {
      if (env.valueFrom?.configMapKeyRef?.name) {
        configMaps.add(env.valueFrom.configMapKeyRef.name);
      }
      if (env.valueFrom?.secretKeyRef?.name) {
        secrets.add(env.valueFrom.secretKeyRef.name);
      }

      envVars.push({
        container: container.name || "unknown",
        name: env.name || "unknown",
      });
    }
  }

  return {
    configMaps: Array.from(configMaps).sort((a, b) => a.localeCompare(b)),
    secrets: Array.from(secrets).sort((a, b) => a.localeCompare(b)),
    envVars,
  };
}

async function getServiceConfigSummary(serviceName) {
  try {
    const pods = await findPodsByService(serviceName);

    if (!pods || pods.length === 0) {
      return {
        found: false,
        serviceName,
        pods: [],
        namespaces: [],
        configMaps: [],
        secrets: [],
        envVars: [],
        statusSummary: [],
      };
    }

    const namespaces = Array.from(new Set(pods.map((p) => p.namespace))).sort(
      (a, b) => a.localeCompare(b)
    );

    const configMapSet = new Set();
    const secretSet = new Set();
    const envVars = [];
    const statusSummary = [];

    for (const pod of pods) {
      statusSummary.push({
        namespace: pod.namespace,
        name: pod.name,
        status: pod.displayStatus || pod.phase || "Unknown",
      });

      const refs = extractConfigRefsFromPodRaw(pod.raw);
      refs.configMaps.forEach((x) => configMapSet.add(x));
      refs.secrets.forEach((x) => secretSet.add(x));
      envVars.push(...refs.envVars);
    }

    return {
      found: true,
      serviceName,
      pods,
      namespaces,
      configMaps: Array.from(configMapSet).sort((a, b) => a.localeCompare(b)),
      secrets: Array.from(secretSet).sort((a, b) => a.localeCompare(b)),
      envVars,
      statusSummary,
    };
  } catch (error) {
    console.error("getServiceConfigSummary 실패:", error);
    return {
      found: false,
      serviceName,
      pods: [],
      namespaces: [],
      configMaps: [],
      secrets: [],
      envVars: [],
      statusSummary: [],
    };
  }
}

module.exports = {
  getAllPods,
  getProblemPods,
  getNamespaces,
  getPodsByNamespace,
  findMentionedServicesFromText,
  checkServiceConnectionBasic,
  findPodsByService,
  getServiceConfigSummary,
};