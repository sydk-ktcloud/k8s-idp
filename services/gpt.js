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
- Kubernetes, Pod, 로그, 에러, 상태, ArgoCD, Backstage, Vault, ESO 관련 질문에 답변
- 운영자가 이해하기 쉽게 짧고 명확하게 설명
- 실제 조회가 필요한 운영 질문은 추측하지 말고 tool 사용을 우선해야 합니다
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
- "pods"
- "allPods"
- "status"
- "serviceStatus"
- "findService"
- "logs"
- "analyze"
- "chat"
- "unclear"

Extraction rules:
- "pod": exact or likely pod name if mentioned, else null
- "namespace": namespace if mentioned, else null
- "service": service/app/component name if mentioned, else null
- "confidence": one of "high", "medium", "low"
- "reason": short english_snake_case style string

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

async function routeToolWithAI({
  userMessage,
  memoryContext = {},
  recentMessages = [],
}) {
  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_MODEL,
    messages: [
      {
        role: "system",
        content: `
You are a Kubernetes ChatOps tool router.

Your job is to select one tool and arguments.
Return ONLY valid JSON.
Do not use markdown.

Available tools:
- "get_problem_pods"
  args: {}

- "get_all_pods"
  args: {}

- "get_service_pods"
  args: { "service": string }

- "get_logs"
  args: { "pod"?: string, "service"?: string, "namespace"?: string, "tailLines"?: number }

- "analyze_logs"
  args: { "pod"?: string, "service"?: string, "namespace"?: string, "tailLines"?: number }

- "cluster_status"
  args: {}

- "service_metrics"
  args: { "service": string, "namespace"?: string }

- "find_namespace"
  args: { "service": string }

- "explain_template"
  args: { "topic"?: string }

- "argocd_sync_status"
  args: {}

- "check_eso_secret_status"
  args: {}

- "general_chat"
  args: { "message": string }

Memory context:
${JSON.stringify(memoryContext)}

Rules:
- If user says "그거", "걔", "그 pod", "그 서비스", "로그 보여줘", "분석해줘", use memoryContext.
- Prefer tool use for Kubernetes state, pod, logs, metrics, failures, health.
- If user mentions a specific service name and asks about pods or state, prefer "get_service_pods".
- If user uses Korean words like "관련", "서비스", "해당", "상태", "pod 보여줘" with a service, prefer "get_service_pods".
- If user asks "메트릭", "metric", "사용량", "CPU", "메모리" and memoryContext has lastService, use "service_metrics".
- If user asks about "템플릿", "template", "ArgoCD 애플리케이션 템플릿", "Kubernetes 리소스 템플릿", use "explain_template".
- If user asks about ArgoCD sync/synced/동기화 상태, use "argocd_sync_status".
- If user asks about secret and eso integration/status/연동 상태, use "check_eso_secret_status".
- Do not answer operational status questions from general knowledge when a tool should be used.
- If no cluster/tool action is needed, use "general_chat".

Return JSON shape:
{
  "tool": "tool_name",
  "arguments": {},
  "reason": "short_reason"
}
        `.trim(),
      },
      ...recentMessages,
      {
        role: "user",
        content: userMessage,
      },
    ],
    temperature: 0.1,
    max_tokens: 350,
    response_format: { type: "json_object" },
  });

  try {
    const content = response.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      tool: parsed.tool || "general_chat",
      arguments: parsed.arguments || { message: userMessage },
      reason: parsed.reason || "",
    };
  } catch (error) {
    return {
      tool: "general_chat",
      arguments: { message: userMessage },
      reason: "tool_router_parse_failed",
    };
  }
}

module.exports = {
  analyzeLogs,
  chatWithAI,
  parseUserRequestWithAI,
  routeToolWithAI,
};