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
import { readFileSync, existsSync } from 'fs';

// ─── Crossplane Claim 타입 정의 ────────────────────────────────
const API_GROUP = 'k8s-idp.example.org';
const API_VERSION = 'v1alpha1';

type CloudProvider = 'GCP' | 'AWS' | 'Azure';

interface ClaimType {
  plural: string;
  kind: string;
  cloud: CloudProvider;
}

const CLAIM_TYPES: ClaimType[] = [
  { plural: 'gcpinstances', kind: 'GCPInstance', cloud: 'GCP' },
  { plural: 'buckets', kind: 'Bucket', cloud: 'GCP' },
  { plural: 'clusters', kind: 'Cluster', cloud: 'GCP' },
  { plural: 'databases', kind: 'Database', cloud: 'GCP' },
  { plural: 'webapps', kind: 'WebApp', cloud: 'GCP' },
  { plural: 'pubsubs', kind: 'PubSub', cloud: 'GCP' },
  { plural: 'caches', kind: 'Cache', cloud: 'GCP' },
  { plural: 'ec2instances', kind: 'EC2Instance', cloud: 'AWS' },
  { plural: 's3buckets', kind: 'S3Bucket', cloud: 'AWS' },
  { plural: 'eksclusters', kind: 'EKSCluster', cloud: 'AWS' },
  { plural: 'rdsdatabases', kind: 'RDSDatabase', cloud: 'AWS' },
  { plural: 'azurevms', kind: 'AzureVM', cloud: 'Azure' },
  { plural: 'azureblobstorages', kind: 'AzureBlobStorage', cloud: 'Azure' },
  { plural: 'aksclusters', kind: 'AKSCluster', cloud: 'Azure' },
  { plural: 'azuredatabases', kind: 'AzureDatabase', cloud: 'Azure' },
];

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

          entities.push({
            apiVersion: 'backstage.io/v1alpha1',
            kind: 'Resource',
            metadata: {
              name: item.metadata.name,
              namespace: 'default',
              description: `${ct.cloud} ${ct.kind} — ${isReady ? 'Ready' : 'Provisioning'}`,
              annotations: {
                'backstage.io/managed-by-location': `crossplane:${ct.plural}/${item.metadata.name}`,
                'backstage.io/managed-by-origin-location': `crossplane:${ct.plural}/${item.metadata.name}`,
                'crossplane.io/claim-kind': ct.kind,
                'crossplane.io/cloud-provider': ct.cloud,
              },
              labels: {
                'crossplane.io/cloud': ct.cloud.toLowerCase(),
                'crossplane.io/ready': isReady ? 'true' : 'false',
              },
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
