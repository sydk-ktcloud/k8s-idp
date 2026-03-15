# Service Communication Matrix
# ============================
# This document maps all inter-service communication for Zero Trust NetworkPolicy design
#
# NAMESPACE: auth
# ---------------
# dex (5556) <- all namespaces (OIDC callbacks)
#
# NAMESPACE: gitops
# -----------------
# argocd-server -> argocd-redis (6379)
# argocd-server -> argocd-repo-server (8081)
# argocd-server -> dex.auth.svc (5556) [OIDC]
# argocd-application-controller -> argocd-repo-server (8081)
# argocd-repo-server -> (egress to git repos)
#
# NAMESPACE: monitoring
# ---------------------
# prometheus -> * (all namespaces, metrics endpoints 9090, 8080, etc.)
# grafana -> prometheus (9090)
# grafana -> dex.auth.svc (5556) [OIDC]
#
# NAMESPACE: backstage
# --------------------
# backstage-frontend -> backstage-backend (7000)
# backstage-backend -> backstage-postgresql (5432)
# backstage-backend -> dex.auth.svc (5556) [OIDC]
#
# NAMESPACE: kubecost
# -------------------
# oauth2-proxy-kubecost -> dex.auth.svc (5556) [OIDC]
# oauth2-proxy-kubecost -> kubecost-frontend (9090)
# kubecost-aggregator -> prometheus.monitoring (9090)
#
# NAMESPACE: longhorn-system
# --------------------------
# oauth2-proxy-longhorn -> dex.auth.svc (5556) [OIDC]
# oauth2-proxy-longhorn -> longhorn-frontend (80)
# longhorn-manager -> (disk operations)
#
# NAMESPACE: kube-system
# ----------------------
# hubble-relay -> cilium-agent (4244)
# prometheus -> cilium-agent (9090 metrics)
#
# NAMESPACE: crossplane-system
# ----------------------------
# crossplane -> (cloud APIs egress)
#
# NAMESPACE: minio-storage (default)
# ----------------------------------
# minio -> (internal S3 API)
