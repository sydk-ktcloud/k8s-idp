const { parseUserRequestWithAI, routeToolWithAI } = require("./gpt");
const { executeTool } = require("./toolExecutor");
const {
  getMemory,
  addMessage,
  updateContext,
  getRecentMessagesForLLM,
} = require("../memory/conversation");

function normalizeInput(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    // alloy상태 -> alloy 상태
    .replace(/([a-z0-9])([가-힣])/g, "$1 $2")
    // 상태alloy -> 상태 alloy
    .replace(/([가-힣])([a-z0-9])/g, "$1 $2")
    .replace(/promethous/g, "prometheus")
    .replace(/머게/g, "뭐야")
    .replace(/머임/g, "뭐야")
    .replace(/뭐게/g, "뭐야")
    .replace(/머야/g, "뭐야")
    .replace(/머냐/g, "뭐야")
    .replace(/어딨냐/g, "어디있어")
    .replace(/어딨음/g, "어디있어")
    .replace(/namespace/g, "네임스페이스")
    .replace(/\s+/g, " ")
    .trim();
}

function mapLegacyIntentToTool(parsed, originalText, memoryContext = {}) {
  const directServiceMatch = String(originalText || "")
    .toLowerCase()
    .match(/\b([a-z0-9-]+)\b/);

  const service =
    parsed.service ||
    memoryContext.lastService ||
    directServiceMatch?.[1] ||
    null;

  const pod = parsed.pod || memoryContext.lastPod || null;
  const namespace = parsed.namespace || memoryContext.lastNamespace || null;

  // 1) 템플릿 설명
  if (/템플릿|template/i.test(originalText)) {
    return {
      tool: "explain_template",
      arguments: {
        topic: /argocd|kubernetes|리소스/i.test(originalText)
          ? "argocd_and_k8s"
          : undefined,
      },
    };
  }

  // 2) ArgoCD sync 상태
  if (/argocd/i.test(originalText) && /sync|synced|동기화/i.test(originalText)) {
    return {
      tool: "argocd_sync_status",
      arguments: {},
    };
  }

  // 3) ESO / Secret 연동 상태
  if (
    /secret|시크릿/i.test(originalText) &&
    /eso|external secret|연동/i.test(originalText)
  ) {
    return {
      tool: "check_eso_secret_status",
      arguments: {},
    };
  }

  // 4) memory 기반 메트릭 fallback
  if (
    /메트릭|metric|사용량|cpu|메모리/i.test(originalText) &&
    memoryContext?.lastService
  ) {
    return {
      tool: "service_metrics",
      arguments: {
        service: memoryContext.lastService,
        namespace: memoryContext.lastNamespace || undefined,
      },
    };
  }

  // 5) memory 기반 상태 fallback
  if (
    /그거|해당|이거|그 서비스|그 pod|그 파드/i.test(originalText) &&
    /상태|pod|파드/i.test(originalText) &&
    memoryContext?.lastService
  ) {
    return {
      tool: "get_service_pods",
      arguments: {
        service: memoryContext.lastService,
      },
    };
  }

  // 6) memory 기반 로그 fallback
  if (
    /그거|해당|이거|그 서비스|그 pod|그 파드/i.test(originalText) &&
    /로그/i.test(originalText)
  ) {
    return {
      tool: "get_logs",
      arguments: {
        pod: memoryContext.lastPod || null,
        service: memoryContext.lastService || null,
        namespace: memoryContext.lastNamespace || undefined,
        tailLines: 100,
      },
    };
  }

  // 7) memory 기반 분석 fallback
  if (
    /그거|해당|이거|그 서비스|그 pod|그 파드/i.test(originalText) &&
    /분석|왜|원인/i.test(originalText)
  ) {
    return {
      tool: "analyze_logs",
      arguments: {
        pod: memoryContext.lastPod || null,
        service: memoryContext.lastService || null,
        namespace: memoryContext.lastNamespace || undefined,
        tailLines: 100,
      },
    };
  }

  // 8) 서비스 직접 언급 + 상태/관련 pod
  if (
    service &&
    /관련|service|서비스|상태|pod 보여|파드 보여|관련 pod|관련 파드/i.test(
      originalText
    )
  ) {
    return {
      tool: "get_service_pods",
      arguments: { service },
    };
  }

  switch (parsed.intent) {
    case "pods":
      return { tool: "get_problem_pods", arguments: {} };

    case "allPods":
      return { tool: "get_all_pods", arguments: {} };

    case "status":
      return { tool: "cluster_status", arguments: {} };

    case "serviceStatus":
    case "findService":
      if (service) {
        return { tool: "get_service_pods", arguments: { service } };
      }
      break;

    case "logs":
      return {
        tool: "get_logs",
        arguments: { pod, service, namespace, tailLines: 100 },
      };

    case "analyze":
      return {
        tool: "analyze_logs",
        arguments: { pod, service, namespace, tailLines: 100 },
      };

    case "chat":
    default:
      return { tool: "general_chat", arguments: { message: originalText } };
  }

  return { tool: "general_chat", arguments: { message: originalText } };
}

async function routeChatMessage(text, scope = {}) {
  try {
    const normalizedText = normalizeInput(text);

    const mem = getMemory(scope);
    addMessage(scope, "user", normalizedText);

    const recentMessages = getRecentMessagesForLLM(scope);

    let decision;
    try {
      decision = await routeToolWithAI({
        userMessage: normalizedText,
        memoryContext: mem.context,
        recentMessages,
      });
    } catch (routerError) {
      console.error("[chatRouter] routeToolWithAI 실패:", routerError);

      const parsed = await parseUserRequestWithAI(normalizedText);
      decision = mapLegacyIntentToTool(parsed, normalizedText, mem.context);
    }

    // general_chat 로 빠지거나 tool이 비어 있으면 fallback 보정
    const shouldFallback =
      !decision ||
      !decision.tool;

    if (shouldFallback) {
      const parsed = await parseUserRequestWithAI(normalizedText);
      decision = mapLegacyIntentToTool(parsed, normalizedText, mem.context);
    }

    console.log(
      "[chatRouter][tool decision]",
      decision,
      "| memory:",
      mem.context,
      "| input:",
      text
    );

    const result = await executeTool(decision.tool, decision.arguments || {});

    const summary =
      result?.summary || "요청은 처리했지만 표시할 결과가 없습니다.";

    const newContext = updateContext(scope, {
      ...(result?.memory || {}),
      lastTool: decision.tool,
    });

    console.log("[chatRouter][memory updated]", newContext);

    addMessage(scope, "assistant", summary);

    return summary;
  } catch (error) {
    console.error("chatRouter 처리 오류:", error);
    return "챗봇 처리 중 오류가 발생했습니다.";
  }
}

module.exports = {
  routeChatMessage,
};