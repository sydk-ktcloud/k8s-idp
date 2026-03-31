module.exports = {
  get_problem_pods: require("./getProblemPods"),
  get_all_pods: require("./getAllPods"),
  get_service_pods: require("./getServicePods"),
  get_logs: require("./getLogs"),
  analyze_logs: require("./analyzeLogs"),
  cluster_status: require("./clusterStatus"),
  service_metrics: require("./serviceMetrics"),
  find_namespace: require("./findNamespace"),
  explain_template: require("./explainTemplate"),
  argocd_sync_status: require("./argocdSyncStatus"),
  check_eso_secret_status: require("./checkEsoSecretStatus"),
  general_chat: require("./generalChat"),
};