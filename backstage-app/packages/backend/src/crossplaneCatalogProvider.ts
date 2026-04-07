import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node/alpha';
import {
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Entity } from '@backstage/catalog-model';
import * as https from 'https';
import * as http from 'http';
import { readFileSync, existsSync } from 'fs';

// ─── Crossplane Claim 타입 정의 ────────────────────────────────
const API_GROUP = 'k8s-idp.example.org';
const API_VERSION = 'v1alpha1';

type CloudProvider = 'GCP' | 'AWS' | 'Azure';
type ResourceCategory = 'database' | 'storage' | 'vm' | 'cluster' | 'webapp' | 'messaging' | 'cache';

interface ClaimType {
  plural: string;
  kind: string;
  cloud: CloudProvider;
  category: ResourceCategory;
}

const CLAIM_TYPES: ClaimType[] = [
  { plural: 'gcpinstances', kind: 'GCPInstance', cloud: 'GCP', category: 'vm' },
  { plural: 'buckets', kind: 'Bucket', cloud: 'GCP', category: 'storage' },
  { plural: 'clusters', kind: 'Cluster', cloud: 'GCP', category: 'cluster' },
  { plural: 'databases', kind: 'Database', cloud: 'GCP', category: 'database' },
  { plural: 'webapps', kind: 'WebApp', cloud: 'GCP', category: 'webapp' },
  { plural: 'pubsubs', kind: 'PubSub', cloud: 'GCP', category: 'messaging' },
  { plural: 'caches', kind: 'Cache', cloud: 'GCP', category: 'cache' },
  { plural: 'ec2instances', kind: 'EC2Instance', cloud: 'AWS', category: 'vm' },
  { plural: 's3buckets', kind: 'S3Bucket', cloud: 'AWS', category: 'storage' },
  { plural: 'eksclusters', kind: 'EKSCluster', cloud: 'AWS', category: 'cluster' },
  { plural: 'rdsdatabases', kind: 'RDSDatabase', cloud: 'AWS', category: 'database' },
  { plural: 'azurevms', kind: 'AzureVM', cloud: 'Azure', category: 'vm' },
  { plural: 'azureblobstorages', kind: 'AzureBlobStorage', cloud: 'Azure', category: 'storage' },
  { plural: 'aksclusters', kind: 'AKSCluster', cloud: 'Azure', category: 'cluster' },
  { plural: 'azuredatabases', kind: 'AzureDatabase', cloud: 'Azure', category: 'database' },
];

// ─── atProvider 접속 정보 추출 헬퍼 ───────────────────────────────
interface ConnectionInfo {
  endpoint: string;
  ipAddress: string;
}

function extractConnectionInfo(item: any, category: ResourceCategory): ConnectionInfo {
  const atProvider = item.status?.atProvider || {};

  let endpoint = '';
  let ipAddress = '';

  switch (category) {
    case 'database': {
      // GCP Cloud SQL: connectionName, AWS RDS: endpoint/address, Azure: fullyQualifiedDomainName
      endpoint =
        atProvider.connectionName ||
        atProvider.endpoint?.address ||
        atProvider.endpoint ||
        atProvider.fullyQualifiedDomainName ||
        '';
      ipAddress = atProvider.publicIpAddress || atProvider.ipAddress || '';
      break;
    }
    case 'vm': {
      // GCP: networkInterfaces[0].accessConfigs[0].natIp, AWS EC2: publicIpAddress, Azure: publicIpAddress
      ipAddress =
        atProvider.publicIpAddress ||
        atProvider.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIp ||
        atProvider.ipAddress ||
        '';
      endpoint = ipAddress;
      break;
    }
    case 'storage': {
      // GCP Bucket: selfLink/url, AWS S3: bucketRegionalDomainName, Azure Blob: primaryEndpoints.blob
      endpoint =
        atProvider.url ||
        atProvider.selfLink ||
        atProvider.bucketRegionalDomainName ||
        atProvider.primaryEndpoints?.blob ||
        '';
      break;
    }
    case 'cluster': {
      // GCP GKE: endpoint, AWS EKS: endpoint, Azure AKS: fqdn/privateClusterEndpoint
      endpoint =
        atProvider.endpoint ||
        atProvider.clusterEndpoint ||
        atProvider.fqdn ||
        atProvider.privateClusterEndpoint ||
        '';
      break;
    }
    case 'webapp': {
      endpoint =
        atProvider.defaultHostname ||
        atProvider.url ||
        atProvider.endpoint ||
        '';
      break;
    }
    case 'messaging':
    case 'cache':
    default: {
      endpoint = atProvider.endpoint || atProvider.host || '';
      ipAddress = atProvider.ipAddress || '';
      break;
    }
  }

  return { endpoint, ipAddress };
}

// ─── 클라우드 콘솔 딥링크 생성 헬퍼 ──────────────────────────────
interface ConsoleLink {
  url: string;
  title: string;
  icon: string;
}

function buildConsoleLink(
  cloud: CloudProvider,
  category: ResourceCategory,
  item: any,
): ConsoleLink | null {
  const name: string = item.metadata?.name || '';
  const spec = item.spec || {};
  const region: string = spec.region || spec.location || '';
  const project: string = spec.projectId || spec.project || '';
  const resourceGroup: string = spec.resourceGroupName || spec.resourceGroup || '';
  const subscription: string = spec.subscriptionId || '';

  switch (cloud) {
    case 'GCP': {
      const projectPath = project ? `project=${project}&` : '';
      const links: Record<ResourceCategory, string> = {
        vm: `https://console.cloud.google.com/compute/instances?${projectPath}`,
        storage: `https://console.cloud.google.com/storage/browser/${name}?${projectPath}`,
        cluster: `https://console.cloud.google.com/kubernetes/list?${projectPath}`,
        database: `https://console.cloud.google.com/sql/instances/${name}/overview?${projectPath}`,
        webapp: `https://console.cloud.google.com/appengine?${projectPath}`,
        messaging: `https://console.cloud.google.com/cloudpubsub/topic/list?${projectPath}`,
        cache: `https://console.cloud.google.com/memorystore/redis/instances?${projectPath}`,
      };
      return { url: links[category] || `https://console.cloud.google.com/?${projectPath}`, title: 'GCP Console', icon: 'cloud' };
    }
    case 'AWS': {
      const regionPath = region ? `region=${region}` : '';
      const links: Record<ResourceCategory, string> = {
        vm: `https://console.aws.amazon.com/ec2/v2/home?${regionPath}#Instances`,
        storage: `https://console.aws.amazon.com/s3/buckets/${name}?${regionPath}`,
        cluster: `https://console.aws.amazon.com/eks/home?${regionPath}#/clusters/${name}`,
        database: `https://console.aws.amazon.com/rds/home?${regionPath}#databases:`,
        webapp: `https://console.aws.amazon.com/elasticbeanstalk/home?${regionPath}`,
        messaging: `https://console.aws.amazon.com/sns/v3/home?${regionPath}#/topics`,
        cache: `https://console.aws.amazon.com/elasticache/home?${regionPath}`,
      };
      return { url: links[category] || `https://console.aws.amazon.com/home?${regionPath}`, title: 'AWS Console', icon: 'cloud' };
    }
    case 'Azure': {
      const subPath = subscription ? `subscriptions/${subscription}/` : '';
      const rgPath = resourceGroup ? `resourceGroups/${resourceGroup}/` : '';
      const links: Record<ResourceCategory, string> = {
        vm: `https://portal.azure.com/#resource/${subPath}${rgPath}providers/Microsoft.Compute/virtualMachines/${name}`,
        storage: `https://portal.azure.com/#resource/${subPath}${rgPath}providers/Microsoft.Storage/storageAccounts/${name}`,
        cluster: `https://portal.azure.com/#resource/${subPath}${rgPath}providers/Microsoft.ContainerService/managedClusters/${name}`,
        database: `https://portal.azure.com/#resource/${subPath}${rgPath}providers/Microsoft.DBforPostgreSQL/flexibleServers/${name}`,
        webapp: `https://portal.azure.com/#resource/${subPath}${rgPath}providers/Microsoft.Web/sites/${name}`,
        messaging: `https://portal.azure.com/#resource/${subPath}${rgPath}providers/Microsoft.ServiceBus/namespaces/${name}`,
        cache: `https://portal.azure.com/#resource/${subPath}${rgPath}providers/Microsoft.Cache/Redis/${name}`,
      };
      return { url: links[category] || 'https://portal.azure.com/', title: 'Azure Portal', icon: 'cloud' };
    }
    default:
      return null;
  }
}

// ─── Discord 프로비저닝 완료 알림 ─────────────────────────────────
const DISCORD_WEBHOOK_URL =
  process.env.DISCORD_LIFECYCLE_WEBHOOK ||
  'https://discord.com/api/webhooks/1489274245438636132/00afuXc2i94ITdc3Bt1rKU1VdxzL2xhYd7alXlpRMYFrsDfzjXtwkLdwk1N0Cks3FzqT';

function sendDiscordNotification(
  name: string,
  cloud: CloudProvider,
  kind: string,
  category: ResourceCategory,
  owner: string,
  endpoint: string,
  consoleLink: ConsoleLink | null,
): Promise<void> {
  const cloudEmoji: Record<CloudProvider, string> = {
    GCP: '🟢',
    AWS: '🟠',
    Azure: '🔵',
  };

  const fields: Array<{ name: string; value: string; inline: boolean }> = [
    { name: '클라우드', value: `${cloudEmoji[cloud]} ${cloud}`, inline: true },
    { name: '리소스 종류', value: `${kind} (${category})`, inline: true },
    { name: '소유자', value: owner, inline: true },
  ];

  if (endpoint) {
    fields.push({ name: '접속 정보', value: `\`${endpoint}\``, inline: false });
  }

  if (consoleLink) {
    fields.push({ name: '클라우드 콘솔', value: `[${consoleLink.title}](${consoleLink.url})`, inline: false });
  }

  fields.push({
    name: '카탈로그',
    value: `[Backstage에서 보기](http://100.64.0.1:30070/catalog/default/resource/${name})`,
    inline: false,
  });

  const payload = JSON.stringify({
    embeds: [{
      title: `✅ 프로비저닝 완료 — ${name}`,
      description: `**${name}** 리소스가 성공적으로 프로비저닝되었습니다.`,
      color: 0x00c853,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: 'K8S-IDP 프로비저닝 알림' },
    }],
  });

  const url = new URL(DISCORD_WEBHOOK_URL);

  return new Promise((resolve) => {
    const mod = url.protocol === 'https:' ? https : http;
    const req = mod.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      () => resolve(),
    );
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });
}

// ─── K8s In-Cluster API 호출 ───────────────────────────────────
const SA_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const SA_CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

function k8sFetch(path: string): Promise<any> {
  const token = readFileSync(SA_TOKEN_PATH, 'utf8');
  const ca = existsSync(SA_CA_PATH)
    ? readFileSync(SA_CA_PATH)
    : undefined;
  const host = process.env.KUBERNETES_SERVICE_HOST || 'kubernetes.default.svc';
  const port = Number(process.env.KUBERNETES_SERVICE_PORT || '443');

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        port,
        path,
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
        ca,
        rejectUnauthorized: !!ca,
      },
      res => {
        let data = '';
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from K8s API: ${data.slice(0, 200)}`));
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ─── Entity Provider ───────────────────────────────────────────
class CrossplaneEntityProvider implements EntityProvider {
  private connection?: EntityProviderConnection;
  private readonly logger: { info: (msg: string) => void; warn: (msg: string) => void };
  private readonly notifiedResources = new Set<string>();

  constructor(logger: { info: (msg: string) => void; warn: (msg: string) => void }) {
    this.logger = logger;
  }

  getProviderName(): string {
    return 'crossplane-claims';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async run(): Promise<void> {
    if (!this.connection) return;

    if (!existsSync(SA_TOKEN_PATH)) {
      this.logger.warn(
        'Crossplane catalog provider: not running in-cluster (no SA token), skipping',
      );
      return;
    }

    const entities: Entity[] = [];

    for (const ct of CLAIM_TYPES) {
      try {
        const data = await k8sFetch(
          `/apis/${API_GROUP}/${API_VERSION}/${ct.plural}`,
        );
        if (!data.items) continue;

        for (const item of data.items) {
          const conditions: Array<{ type: string; status: string }> =
            item.status?.conditions || [];
          const readyCond = conditions.find(c => c.type === 'Ready');
          const isReady = readyCond?.status === 'True';

          const owner =
            item.metadata?.labels?.owner || 'platform';
          const team =
            item.metadata?.labels?.team || 'platform';

          const { endpoint, ipAddress } = extractConnectionInfo(item, ct.category);
          const consoleLink = buildConsoleLink(ct.cloud, ct.category, item);

          const region: string = item.spec?.region || item.spec?.location || '';
          const secretName: string = item.spec?.writeConnectionSecretToRef?.name || '';

          let provisioningStatus: string;
          const syncCond = conditions.find(c => c.type === 'Synced');
          if (isReady) {
            provisioningStatus = 'Ready';
          } else if (syncCond?.status === 'False') {
            provisioningStatus = '오류';
          } else {
            provisioningStatus = '프로비저닝 중';
          }

          const annotations: Record<string, string> = {
            'backstage.io/managed-by-location': `crossplane:${ct.plural}/${item.metadata.name}`,
            'backstage.io/managed-by-origin-location': `crossplane:${ct.plural}/${item.metadata.name}`,
            'crossplane.io/claim-kind': ct.kind,
            'crossplane.io/cloud-provider': ct.cloud,
            'k8s-idp/provisioning-status': provisioningStatus,
            'k8s-idp/cloud-provider': ct.cloud,
            'k8s-idp/resource-type': ct.category,
          };

          if (region) annotations['k8s-idp/region'] = region;
          if (endpoint) annotations['k8s-idp/endpoint'] = endpoint;
          if (ipAddress) annotations['k8s-idp/ip-address'] = ipAddress;
          if (secretName) annotations['k8s-idp/secret-name'] = secretName;

          const links: Array<{ url: string; title: string; icon: string }> = [];
          if (consoleLink) links.push(consoleLink);

          // Discord 알림: Ready로 전환된 리소스에 대해 1회 발송
          const resourceKey = `${ct.plural}/${item.metadata.name}`;
          if (isReady && !this.notifiedResources.has(resourceKey)) {
            this.notifiedResources.add(resourceKey);
            sendDiscordNotification(
              item.metadata.name, ct.cloud, ct.kind, ct.category,
              owner, endpoint, consoleLink,
            ).then(() => {
              this.logger.info(`Discord 알림 발송: ${resourceKey}`);
            });
          }

          entities.push({
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Resource',
            metadata: {
              name: item.metadata.name,
              namespace: 'default',
              description: `${ct.cloud} ${ct.kind} — ${isReady ? '준비 완료' : '프로비저닝 중'}`,
              annotations,
              labels: {
                'crossplane.io/cloud': ct.cloud.toLowerCase(),
                'crossplane.io/ready': isReady ? 'true' : 'false',
              },
              links,
            },
            spec: {
              type: `crossplane-${ct.cloud.toLowerCase()}`,
              owner: `user:default/${owner}`,
              system: team,
              lifecycle: isReady ? 'production' : 'experimental',
            },
          });
        }
      } catch (e: any) {
        this.logger.warn(
          `Crossplane catalog provider: failed to list ${ct.plural}: ${e.message}`,
        );
      }
    }

    await this.connection.applyMutation({
      type: 'full',
      entities: entities.map(entity => ({
        entity,
        locationKey: 'crossplane-claims',
      })),
    });

    this.logger.info(
      `Crossplane catalog provider: synced ${entities.length} claims to catalog`,
    );
  }
}

// ─── Backend Module ────────────────────────────────────────────
export const catalogModuleCrossplaneProvider = createBackendModule({
  pluginId: 'catalog',
  moduleId: 'crossplane-entity-provider',
  register(reg) {
    reg.registerInit({
      deps: {
        catalog: catalogProcessingExtensionPoint,
        logger: coreServices.logger,
        scheduler: coreServices.scheduler,
      },
      async init({ catalog, logger, scheduler }) {
        const provider = new CrossplaneEntityProvider(logger);
        catalog.addEntityProvider(provider);

        await scheduler.scheduleTask({
          id: 'crossplane-catalog-sync',
          frequency: { seconds: 30 },
          timeout: { minutes: 1 },
          fn: () => provider.run(),
        });
      },
    });
  },
});

export default catalogModuleCrossplaneProvider;
