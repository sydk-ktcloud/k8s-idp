module.exports = async function explainTemplateTool(args = {}) {
  const { topic } = args;

  if (topic === "argocd_and_k8s") {
    return {
      ok: true,
      summary: [
        "ArgoCD 애플리케이션 템플릿과 Kubernetes 리소스 템플릿은 역할이 다릅니다.",
        "",
        "1) ArgoCD 애플리케이션 템플릿",
        "- Git 저장소와 배포 대상을 연결하는 정의입니다.",
        "- 어떤 repo/path/branch를 보고 어느 namespace에 배포할지 지정합니다.",
        "",
        "예시:",
        "```yaml",
        "apiVersion: argoproj.io/v1alpha1",
        "kind: Application",
        "metadata:",
        "  name: my-app",
        "spec:",
        "  source:",
        "    repoURL: https://github.com/my-org/my-repo.git",
        "    path: deploy/k8s",
        "    targetRevision: HEAD",
        "  destination:",
        "    server: https://kubernetes.default.svc",
        "    namespace: default",
        "  project: default",
        "```",
        "",
        "2) Kubernetes 리소스 템플릿",
        "- 실제 클러스터에 배포할 Deployment, Service, ConfigMap 같은 리소스 정의입니다.",
        "",
        "예시:",
        "```yaml",
        "apiVersion: apps/v1",
        "kind: Deployment",
        "metadata:",
        "  name: my-app",
        "spec:",
        "  replicas: 1",
        "  selector:",
        "    matchLabels:",
        "      app: my-app",
        "  template:",
        "    metadata:",
        "      labels:",
        "        app: my-app",
        "    spec:",
        "      containers:",
        "      - name: my-app",
        "        image: my-app:latest",
        "```",
        "",
        "정리하면, ArgoCD 템플릿은 배포 연결 정의이고 Kubernetes 템플릿은 실제 리소스 정의입니다.",
      ].join("\n"),
      memory: {
        lastIntent: "template_explain",
      },
    };
  }

  return {
    ok: true,
    summary:
      "어떤 템플릿인지 구체적으로 말씀해주시면 설명드릴 수 있습니다. 예: ArgoCD Application 템플릿, Kubernetes Deployment 템플릿, Backstage 템플릿",
    memory: {
      lastIntent: "template_explain",
    },
  };
};