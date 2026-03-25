const { AzureOpenAI } = require("openai");

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: "2024-12-01-preview",
});

async function analyzeLogs(logs) {
  if (!logs || typeof logs !== "string" || !logs.trim()) {
    throw new Error("GPT에 전달할 로그가 없습니다.");
  }

  const trimmedLogs = logs.slice(-6000);

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a Kubernetes troubleshooting expert. Analyze the pod logs in Korean. Answer in this format: 1) 문제 요약 2) 원인 3) 해결 방법 4) 추가 확인 사항",
      },
      {
        role: "user",
        content: trimmedLogs,
      },
    ],
    temperature: 0.2,
    max_tokens: 500,
  });

  return response.choices?.[0]?.message?.content || "분석 결과가 없습니다.";
}

async function chatWithAI(userMessage) {
  if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
    return "질문을 입력해주세요.";
  }

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: `
당신은 Kubernetes ChatOps 도우미입니다.
반드시 한국어로 답변하세요.

역할:
- Kubernetes, Pod, 로그, 에러, 상태, ArgoCD, Backstage 관련 질문에 답변
- 운영자가 이해하기 쉽게 짧고 명확하게 설명
- 필요한 경우 명령어 예시를 함께 제시
- 모르는 내용은 추측하지 말고 확인이 필요하다고 답변
        `.trim(),
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    temperature: 0.4,
    max_tokens: 700,
  });

  return response.choices?.[0]?.message?.content || "답변을 생성하지 못했습니다.";
}

async function parseUserRequestWithAI(userMessage) {
  if (!userMessage || typeof userMessage !== "string" || !userMessage.trim()) {
    return {
      intent: "unclear",
      pod: null,
      namespace: null,
      service: null,
      confidence: "low",
      reason: "empty_input",
    };
  }

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Kubernetes ChatOps request parser.

Your job is to classify the user's Korean request and extract structured fields.

Return ONLY valid JSON.
Do not include markdown.
Do not explain.
Do not add extra keys.

Allowed intents:
- "pods"          : problem pods / abnormal pods / broken pods
- "allPods"       : all pod list / full pod list
- "status"        : cluster-wide status / CPU / memory / resources
- "serviceStatus" : status of a specific service like loki, vault, grafana
- "findService"   : asking where a service is, what pod/service exists for it
- "logs"          : show logs of a pod
- "analyze"       : analyze why a pod failed / root cause / why it died
- "chat"          : general explanation question
- "unclear"       : ambiguous or impossible to classify confidently

Extraction rules:
- "pod": exact or likely pod name if mentioned, else null
- "namespace": namespace if mentioned, else null
- "service": service/app/component name if mentioned, else null
- "confidence": one of "high", "medium", "low"
- "reason": short english_snake_case style string

Important distinctions:
- "파드목록", "전체 파드", "모든 파드", "all pods" => allPods
- "문제 있는 파드", "비정상 파드", "이상한 파드" => pods
- "클러스터 상태", "cpu", "memory", "리소스" => status
- "loki 상태", "vault 상태", "grafana 상태" => serviceStatus
- "tempo 어디있어", "loki 어디있어", "vault 어디있어" => findService
- "vault-2 로그 보여줘" => logs
- "vault-2 왜 죽어", "원인 분석", "왜 안돼" => analyze
- "Kubernetes가 뭐야", "ArgoCD가 뭐야" => chat

Examples:
User: "전체 파드 보여줘"
JSON: {"intent":"allPods","pod":null,"namespace":null,"service":null,"confidence":"high","reason":"all_pods_request"}

User: "문제 있는 파드 뭐야?"
JSON: {"intent":"pods","pod":null,"namespace":null,"service":null,"confidence":"high","reason":"problem_pods_request"}

User: "클러스터 상태 어때?"
JSON: {"intent":"status","pod":null,"namespace":null,"service":null,"confidence":"high","reason":"cluster_status_request"}

User: "loki 상태 확인 좀"
JSON: {"intent":"serviceStatus","pod":null,"namespace":null,"service":"loki","confidence":"high","reason":"service_status_request"}

User: "tempo는 어디있어"
JSON: {"intent":"findService","pod":null,"namespace":null,"service":"tempo","confidence":"high","reason":"find_service_request"}

User: "vault-2 로그 보여줘"
JSON: {"intent":"logs","pod":"vault-2","namespace":null,"service":"vault","confidence":"high","reason":"logs_request"}

User: "vault-2 왜 죽어"
JSON: {"intent":"analyze","pod":"vault-2","namespace":null,"service":"vault","confidence":"high","reason":"analyze_pod_request"}

User: "Kubernetes가 뭐야?"
JSON: {"intent":"chat","pod":null,"namespace":null,"service":null,"confidence":"high","reason":"general_question"}

User: "vault 좀 봐줘"
JSON: {"intent":"unclear","pod":null,"namespace":null,"service":"vault","confidence":"low","reason":"ambiguous_request"}

Return JSON only.
        `.trim(),
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
    temperature: 0,
    max_tokens: 250,
    response_format: { type: "json_object" },
  });

  try {
    const content = response.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    const allowedIntents = new Set([
      "pods",
      "allPods",
      "status",
      "serviceStatus",
      "findService",
      "logs",
      "analyze",
      "chat",
      "unclear",
    ]);

    return {
      intent: allowedIntents.has(parsed.intent) ? parsed.intent : "unclear",
      pod: parsed.pod || null,
      namespace: parsed.namespace || null,
      service: parsed.service || null,
      confidence: ["high", "medium", "low"].includes(parsed.confidence)
        ? parsed.confidence
        : "low",
      reason: parsed.reason || "",
    };
  } catch (error) {
    return {
      intent: "unclear",
      pod: null,
      namespace: null,
      service: null,
      confidence: "low",
      reason: "json_parse_failed",
    };
  }
}

module.exports = {
  analyzeLogs,
  chatWithAI,
  parseUserRequestWithAI,
};