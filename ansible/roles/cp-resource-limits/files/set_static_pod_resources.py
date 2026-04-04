#!/usr/bin/env python3
"""Static pod manifest에 리소스 제한을 설정하는 스크립트.

Usage: set_static_pod_resources.py <component-name> '<resources-json>'
Example: set_static_pod_resources.py kube-apiserver '{"limits":{"memory":"6Gi"},"requests":{"cpu":"250m","memory":"512Mi"}}'
"""
import json
import sys
import yaml

component = sys.argv[1]
resources = json.loads(sys.argv[2])
manifest_path = f"/etc/kubernetes/manifests/{component}.yaml"

with open(manifest_path) as f:
    doc = yaml.safe_load(f)

changed = False
for container in doc["spec"]["containers"]:
    if container["name"] == component:
        current = container.get("resources", {})
        if current != resources:
            container["resources"] = resources
            changed = True
        break

if changed:
    with open(manifest_path, "w") as f:
        yaml.dump(doc, f, default_flow_style=False)
    print("CHANGED")
else:
    print("OK")
