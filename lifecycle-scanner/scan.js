#!/usr/bin/env node
// lifecycle-scanner/scan.js
// k8s-idp.example.org Claim CR의 expires-at 레이블을 확인하여
// 만료 임박/만료된 리소스를 Discord로 알림하고, 만료된 것은 자동 삭제합니다.

const k8s = require('@kubernetes/client-node');
const https = require('https');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const DRY_RUN = process.env.DRY_RUN === 'true';

const IDP_GROUP = 'k8s-idp.example.org';
const IDP_VERSION = 'v1alpha1';

// 모든 CRD kind → plural 매핑
const RESOURCE_KINDS = [
  { kind: 'Cluster',         plural: 'clusters' },
  { kind: 'Database',        plural: 'databases' },
  { kind: 'Bucket',          plural: 'buckets' },
  { kind: 'GCPInstance',     plural: 'gcpinstances' },
  { kind: 'EC2Instance',     plural: 'ec2instances' },
  { kind: 'S3Bucket',        plural: 's3buckets' },
  { kind: 'EKSCluster',      plural: 'eksclusters' },
  { kind: 'RDSDatabase',     plural: 'rdsdatabases' },
  { kind: 'AzureVM',         plural: 'azurevms' },
  { kind: 'AzureBlobStorage',plural: 'azureblobstorages' },
  { kind: 'AKSCluster',      plural: 'aksclusters' },
  { kind: 'AzureDatabase',   plural: 'azuredatabases' },
  { kind: 'WebApp',          plural: 'webapps' },
  { kind: 'PubSub',          plural: 'pubsubs' },
];

const kc = new k8s.KubeConfig();
kc.loadFromDefault();
const customObjectsApi = kc.makeApiClient(k8s.CustomObjectsApi);

function daysUntil(dateStr) {
  if (!dateStr || dateStr === '9999-12-31') return Infinity;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - now) / (1000 * 60 * 60 * 24));
}

async function sendDiscordMessage(content) {
  if (!DISCORD_WEBHOOK_URL) {
    console.log('[Discord 미설정] 메시지:', content);
    return;
  }

  const body = JSON.stringify({ content });
  const url = new URL(DISCORD_WEBHOOK_URL);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      res.resume();
      resolve();
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function listAllClaims() {
  const allClaims = [];

  for (const { kind, plural } of RESOURCE_KINDS) {
    try {
      const response = await customObjectsApi.listClusterCustomObject(
        IDP_GROUP,
        IDP_VERSION,
        plural
      );
      const items = response.body?.items || [];
      for (const item of items) {
        allClaims.push({ kind, ...item });
      }
    } catch (err) {
      // CRD가 없는 경우 정상 스킵
      if (err.statusCode !== 404) {
        console.warn(`[경고] ${kind} 조회 실패:`, err.message || err.statusCode);
      }
    }
  }

  return allClaims;
}

async function deleteClaim(kind, plural, namespace, name) {
  if (DRY_RUN) {
    console.log(`[DRY_RUN] 삭제 건너뜀: ${kind}/${namespace}/${name}`);
    return;
  }

  await customObjectsApi.deleteNamespacedCustomObject(
    IDP_GROUP,
    IDP_VERSION,
    namespace,
    plural,
    name
  );
  console.log(`[삭제] ${kind}/${namespace}/${name}`);
}

async function main() {
  console.log(`[Lifecycle Scanner] 시작 - ${new Date().toISOString()} (DRY_RUN=${DRY_RUN})`);

  const claims = await listAllClaims();
  console.log(`[스캔] 총 ${claims.length}개 Claim 발견`);

  const warnings3days = [];  // 3일 이내 만료
  const warningsToday = [];  // 오늘 만료
  const expired = [];        // 이미 만료

  for (const claim of claims) {
    const labels = claim.metadata?.labels || {};
    const expiresAt = labels['expires-at'];
    const days = daysUntil(expiresAt);
    const ns = claim.metadata?.namespace || 'default';
    const name = claim.metadata?.name || 'unknown';
    const owner = labels['owner'] || 'unknown';
    const team = labels['team'] || 'unknown';
    const plural = RESOURCE_KINDS.find(r => r.kind === claim.kind)?.plural;

    if (days < 0) {
      expired.push({ kind: claim.kind, plural, ns, name, expiresAt, owner, team, days });
    } else if (days === 0) {
      warningsToday.push({ kind: claim.kind, ns, name, expiresAt, owner, team });
    } else if (days <= 3) {
      warnings3days.push({ kind: claim.kind, ns, name, expiresAt, owner, team, days });
    }
  }

  // 3일 이내 만료 경고
  if (warnings3days.length > 0) {
    const lines = warnings3days.map(r =>
      `  - \`${r.kind}/${r.ns}/${r.name}\` — ${r.days}일 후 만료 (담당: ${r.owner}, 팀: ${r.team})`
    ).join('\n');
    await sendDiscordMessage(
      `⚠️ **만료 임박 리소스 (3일 이내)** — ${warnings3days.length}개\n${lines}\n` +
      `\`/extend <name> <ns> <date>\` 명령으로 만료일을 연장할 수 있습니다.`
    );
  }

  // 오늘 만료 최종 경고
  if (warningsToday.length > 0) {
    const lines = warningsToday.map(r =>
      `  - \`${r.kind}/${r.ns}/${r.name}\` — 오늘(${r.expiresAt}) 만료 (담당: ${r.owner})`
    ).join('\n');
    await sendDiscordMessage(
      `🚨 **오늘 만료 리소스** — ${warningsToday.length}개\n${lines}\n` +
      `오늘 자정 이후 자동 삭제됩니다. 연장이 필요하면 즉시 \`/extend\`를 사용하세요.`
    );
  }

  // 만료된 리소스 삭제
  const deleteResults = [];
  for (const r of expired) {
    if (!r.plural) {
      console.warn(`[경고] ${r.kind}의 plural 매핑 없음, 삭제 건너뜀`);
      continue;
    }
    try {
      await deleteClaim(r.kind, r.plural, r.ns, r.name);
      deleteResults.push(`  - ✅ \`${r.kind}/${r.ns}/${r.name}\` 삭제 완료 (만료: ${r.expiresAt})`);
    } catch (err) {
      deleteResults.push(`  - ❌ \`${r.kind}/${r.ns}/${r.name}\` 삭제 실패: ${err.message}`);
      console.error(`[삭제 실패] ${r.kind}/${r.ns}/${r.name}:`, err.message);
    }
  }

  if (deleteResults.length > 0) {
    await sendDiscordMessage(
      `🗑️ **만료 리소스 자동 삭제** — ${expired.length}개 처리\n` +
      deleteResults.join('\n')
    );
  }

  if (warnings3days.length === 0 && warningsToday.length === 0 && expired.length === 0) {
    console.log('[스캔 완료] 만료 임박 또는 만료된 리소스 없음');
  }

  console.log(`[Lifecycle Scanner] 완료 - 경고: ${warnings3days.length + warningsToday.length}개, 삭제: ${expired.length}개`);
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
