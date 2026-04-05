import { useState, useCallback, useRef, useMemo } from 'react';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  Progress,
  Link,
} from '@backstage/core-components';
import { kubernetesApiRef } from '@backstage/plugin-kubernetes';
import { useApi } from '@backstage/core-plugin-api';
import { useAsync } from 'react-use';
import {
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Button,
} from '@material-ui/core';
import { makeStyles, createStyles, Theme } from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import StorageIcon from '@material-ui/icons/Storage';
import CloudIcon from '@material-ui/icons/Cloud';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import DnsIcon from '@material-ui/icons/Dns';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import { TroubleshootingPanel } from './TroubleshootingPanel';
import { categorizeError } from './troubleshootingGuides';
import type { ErrorCategory } from './troubleshootingGuides';

const CLOUD_COLORS = {
  GCP: { bg: '#e8f0fe', color: '#1a73e8', border: '#4285F4' },
  AWS: { bg: '#fff3e0', color: '#e65100', border: '#FF9900' },
  Azure: { bg: '#e8f5e9', color: '#2e7d32', border: '#43a047' },
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    summaryCard: {
      padding: theme.spacing(2),
      textAlign: 'center',
      borderRadius: theme.shape.borderRadius,
      border: `1px solid ${theme.palette.divider}`,
    },
    summaryCount: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1,
    },
    summaryLabel: {
      color: theme.palette.text.secondary,
      marginTop: theme.spacing(0.5),
    },
    cloudCard: {
      padding: theme.spacing(1.5),
      textAlign: 'center',
      borderRadius: theme.shape.borderRadius,
      borderTop: '3px solid',
    },
    cloudCount: {
      fontSize: '1.8rem',
      fontWeight: 700,
      lineHeight: 1,
    },
    cloudLabel: {
      fontSize: '0.85rem',
      fontWeight: 600,
      marginTop: theme.spacing(0.5),
    },
    tableContainer: {
      marginTop: theme.spacing(2),
    },
    chip: {
      fontWeight: 600,
      minWidth: 120,
    },
    chipReady: {
      backgroundColor: '#e8f5e9',
      color: '#2e7d32',
    },
    chipPending: {
      backgroundColor: '#fff8e1',
      color: '#e65100',
    },
    chipError: {
      backgroundColor: '#fce4ec',
      color: '#c62828',
    },
    chipUnknown: {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.secondary,
    },
    refreshBtn: {
      marginLeft: theme.spacing(1),
    },
    tabs: {
      marginBottom: theme.spacing(2),
      borderBottom: `1px solid ${theme.palette.divider}`,
    },
    emptyState: {
      padding: theme.spacing(6),
      textAlign: 'center',
      color: theme.palette.text.secondary,
    },
    kindChip: {
      fontSize: '0.7rem',
    },
    errorRow: {
      backgroundColor: '#333333',
      '& td, & td *': {
        color: '#ffffff',
      },
    },
    troubleshootBtn: {
      color: '#c62828',
      borderColor: '#ef9a9a',
      fontSize: '0.75rem',
    },
    sectionTitle: {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: theme.palette.text.secondary,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      marginBottom: theme.spacing(1),
      marginTop: theme.spacing(2),
    },
  }),
);

const RESOURCE_TYPES = [
  // GCP
  { plural: 'webapps',      kind: 'WebApp',          label: 'Web앱',    cloud: 'GCP',   icon: <CloudIcon fontSize="small" /> },
  { plural: 'gcpinstances', kind: 'GCPInstance',      label: 'GCP VM',   cloud: 'GCP',   icon: <DnsIcon fontSize="small" /> },
  { plural: 'buckets',      kind: 'Bucket',           label: 'GCS',      cloud: 'GCP',   icon: <StorageIcon fontSize="small" /> },
  { plural: 'clusters',     kind: 'Cluster',          label: 'GKE',      cloud: 'GCP',   icon: <AccountTreeIcon fontSize="small" /> },
  { plural: 'databases',    kind: 'Database',         label: 'Cloud SQL', cloud: 'GCP',  icon: <StorageIcon fontSize="small" /> },
  { plural: 'pubsubs',      kind: 'PubSub',           label: 'PubSub',   cloud: 'GCP',   icon: <CloudIcon fontSize="small" /> },
  { plural: 'caches',       kind: 'Cache',            label: 'Cache',    cloud: 'GCP',   icon: <StorageIcon fontSize="small" /> },
  // AWS
  { plural: 'ec2instances',  kind: 'EC2Instance',     label: 'EC2',      cloud: 'AWS',   icon: <DnsIcon fontSize="small" /> },
  { plural: 's3buckets',     kind: 'S3Bucket',        label: 'S3',       cloud: 'AWS',   icon: <StorageIcon fontSize="small" /> },
  { plural: 'eksclusters',   kind: 'EKSCluster',      label: 'EKS',      cloud: 'AWS',   icon: <AccountTreeIcon fontSize="small" /> },
  { plural: 'rdsdatabases',  kind: 'RDSDatabase',     label: 'RDS',      cloud: 'AWS',   icon: <StorageIcon fontSize="small" /> },
  // Azure
  { plural: 'azurevms',          kind: 'AzureVM',         label: 'Azure VM',  cloud: 'Azure', icon: <DnsIcon fontSize="small" /> },
  { plural: 'azureblobstorages', kind: 'AzureBlobStorage', label: 'Blob',     cloud: 'Azure', icon: <StorageIcon fontSize="small" /> },
  { plural: 'aksclusters',       kind: 'AKSCluster',      label: 'AKS',       cloud: 'Azure', icon: <AccountTreeIcon fontSize="small" /> },
  { plural: 'azuredatabases',    kind: 'AzureDatabase',   label: 'Azure DB',  cloud: 'Azure', icon: <StorageIcon fontSize="small" /> },
] as const;

type CloudProvider = 'GCP' | 'AWS' | 'Azure';

const API_GROUP = 'k8s-idp.example.org';
const API_VERSION = 'v1alpha1';
const CLUSTER_NAME = 'k8s-idp';

interface K8sCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

interface CrossplaneResource {
  metadata: {
    name: string;
    namespace?: string;
    creationTimestamp: string;
    uid: string;
  };
  spec: Record<string, any>;
  status?: {
    conditions?: K8sCondition[];
    atProvider?: Record<string, any>;
  };
  kind: string;
  kindLabel: string;
  cloud: CloudProvider;
}

type StatusClass = 'chipReady' | 'chipPending' | 'chipError' | 'chipUnknown';

function getStatus(conditions?: K8sCondition[]): {
  label: string;
  cls: StatusClass;
  emoji: string;
  isError: boolean;
} {
  if (!conditions || conditions.length === 0) {
    return { label: '대기 중', cls: 'chipUnknown', emoji: '⏸', isError: false };
  }
  const ready = conditions.find(c => c.type === 'Ready');
  if (!ready) {
    return { label: '준비 중', cls: 'chipPending', emoji: '⏳', isError: false };
  }
  if (ready.status === 'True') {
    return { label: '완료', cls: 'chipReady', emoji: '✅', isError: false };
  }
  const pendingReasons = ['Creating', 'Reconciling', 'ReconcileSuccess', 'WaitingForExternalResource'];
  if (ready.reason && pendingReasons.includes(ready.reason)) {
    return { label: '프로비저닝 중', cls: 'chipPending', emoji: '⏳', isError: false };
  }
  return { label: '오류', cls: 'chipError', emoji: '❌', isError: true };
}

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}초 경과`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 경과`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

const StatusChip = ({
  conditions,
  classes,
}: {
  conditions?: K8sCondition[];
  classes: ReturnType<typeof useStyles>;
}) => {
  const status = getStatus(conditions);
  return (
    <Chip
      label={`${status.emoji} ${status.label}`}
      size="small"
      className={`${classes.chip} ${classes[status.cls]}`}
    />
  );
};

const CloudChip = ({ cloud }: { cloud: CloudProvider }) => {
  const colors = CLOUD_COLORS[cloud];
  return (
    <Chip
      label={cloud}
      size="small"
      style={{
        backgroundColor: colors.bg,
        color: colors.color,
        fontWeight: 700,
        fontSize: '0.7rem',
        border: `1px solid ${colors.border}`,
      }}
    />
  );
};

interface TroubleshootState {
  open: boolean;
  resourceName: string;
  errorCategory: ErrorCategory | null;
  rawMessage?: string;
  cloud: CloudProvider;
}

const ResourceTable = ({
  resources,
  classes,
  onTroubleshoot,
}: {
  resources: CrossplaneResource[];
  classes: ReturnType<typeof useStyles>;
  onTroubleshoot: (name: string, category: ErrorCategory | null, cloud: CloudProvider, msg?: string) => void;
}) => {
  if (resources.length === 0) {
    return (
      <Box className={classes.emptyState}>
        <Typography variant="body1">프로비저닝된 리소스가 없습니다.</Typography>
        <Typography variant="body2">
          <Link to="/create">템플릿</Link>을 사용하여 리소스를 생성하세요.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} className={classes.tableContainer}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>리소스 이름</TableCell>
            <TableCell>클라우드</TableCell>
            <TableCell>종류</TableCell>
            <TableCell>네임스페이스</TableCell>
            <TableCell>상태</TableCell>
            <TableCell>경과 시간</TableCell>
            <TableCell>액션</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {resources.map(resource => {
            const status = getStatus(resource.status?.conditions);
            const failedCondition = resource.status?.conditions?.find(
              c => c.type === 'Ready' && c.status === 'False',
            );
            return (
              <TableRow
                key={resource.metadata.uid}
                hover
                className={status.isError ? classes.errorRow : undefined}
              >
                <TableCell>
                  <Typography variant="body2" style={{ fontWeight: 600 }}>
                    {resource.metadata.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <CloudChip cloud={resource.cloud} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={resource.kindLabel}
                    size="small"
                    variant="outlined"
                    className={classes.kindChip}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="textSecondary">
                    {resource.metadata.namespace || 'default'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <StatusChip
                    conditions={resource.status?.conditions}
                    classes={classes}
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="textSecondary">
                    {timeAgo(resource.metadata.creationTimestamp)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {status.isError ? (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<HelpOutlineIcon fontSize="small" />}
                      className={classes.troubleshootBtn}
                      onClick={() =>
                        onTroubleshoot(
                          resource.metadata.name,
                          categorizeError(resource.status?.conditions),
                          resource.cloud,
                          failedCondition?.message,
                        )
                      }
                    >
                      원인 분석
                    </Button>
                  ) : (
                    <Link
                      to={`/catalog/default/resource/${resource.metadata.name}`}
                    >
                      카탈로그 →
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export const ProvisioningDashboard = () => {
  const classes = useStyles();
  const kubernetesApi = useApi(kubernetesApiRef);
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [troubleshoot, setTroubleshoot] = useState<TroubleshootState>({
    open: false,
    resourceName: '',
    errorCategory: null,
    cloud: 'GCP',
  });

  const CLOUD_TABS: { label: string; cloud?: CloudProvider }[] = [
    { label: '전체' },
    { label: 'GCP',   cloud: 'GCP' },
    { label: 'AWS',   cloud: 'AWS' },
    { label: 'Azure', cloud: 'Azure' },
  ];

  // 탭별 lazy loading: 활성 탭의 리소스만 fetch
  const typesToFetch = useMemo(() => {
    const tab = CLOUD_TABS[activeTab];
    return tab?.cloud
      ? RESOURCE_TYPES.filter(rt => rt.cloud === tab.cloud)
      : [...RESOURCE_TYPES];
  }, [activeTab]);

  // 탭별 캐시: refreshKey 변경 시 전체 무효화
  const cacheRef = useRef<{ key: number; data: Map<number, CrossplaneResource[]> }>({ key: -1, data: new Map() });
  if (cacheRef.current.key !== refreshKey) {
    cacheRef.current = { key: refreshKey, data: new Map() };
  }

  const { value: fetchedResources, loading, error } = useAsync(async () => {
    const cached = cacheRef.current.data.get(activeTab);
    if (cached) return cached;

    const results: CrossplaneResource[] = [];
    await Promise.allSettled(
      typesToFetch.map(async rt => {
        try {
          const response = await kubernetesApi.proxy({
            clusterName: CLUSTER_NAME,
            path: `/apis/${API_GROUP}/${API_VERSION}/${rt.plural}`,
            init: { method: 'GET' },
          });
          const data = await response.json();
          if (data.items) {
            for (const item of data.items) {
              results.push({ ...item, kindLabel: rt.label, cloud: rt.cloud as CloudProvider });
            }
          }
        } catch (_e) {
          // 리소스 타입이 없거나 접근 불가인 경우 무시
        }
      }),
    );
    cacheRef.current.data.set(activeTab, results);
    return results;
  }, [refreshKey, activeTab]);

  const allResources = fetchedResources || [];

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const handleTroubleshoot = useCallback(
    (name: string, category: ErrorCategory | null, cloud: CloudProvider, msg?: string) => {
      setTroubleshoot({ open: true, resourceName: name, errorCategory: category, cloud, rawMessage: msg });
    },
    [],
  );

  const handleCloseTroubleshoot = useCallback(() => {
    setTroubleshoot(prev => ({ ...prev, open: false }));
  }, []);

  const filteredResources = allResources;

  const total   = allResources.length;
  const ready   = allResources.filter(r => getStatus(r.status?.conditions).cls === 'chipReady').length;
  const pending = allResources.filter(r => getStatus(r.status?.conditions).cls === 'chipPending').length;
  const errored = allResources.filter(r => getStatus(r.status?.conditions).isError).length;

  const cloudCounts: Record<CloudProvider, number> = {
    GCP:   allResources.filter(r => r.cloud === 'GCP').length,
    AWS:   allResources.filter(r => r.cloud === 'AWS').length,
    Azure: allResources.filter(r => r.cloud === 'Azure').length,
  };

  return (
    <Page themeId="tool">
      <Header
        title="프로비저닝 현황"
        subtitle="멀티 클라우드 (GCP / AWS / Azure) 리소스 상태"
      />
      <Content>
        <ContentHeader title="리소스 현황">
          <Tooltip title="새로고침">
            <IconButton onClick={handleRefresh} size="small" className={classes.refreshBtn}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </ContentHeader>

        {/* 상태별 요약 카드 */}
        <Grid container spacing={2} style={{ marginBottom: 8 }}>
          {[
            { label: '전체', count: total,   color: '#1565c0' },
            { label: '✅ 완료', count: ready,   color: '#2e7d32' },
            { label: '⏳ 프로비저닝 중', count: pending, color: '#e65100' },
            { label: '❌ 오류', count: errored, color: '#b71c1c' },
          ].map(item => (
            <Grid item xs={6} md={3} key={item.label}>
              <Box className={classes.summaryCard}>
                <Typography className={classes.summaryCount} style={{ color: item.color }}>
                  {item.count}
                </Typography>
                <Typography variant="body2" className={classes.summaryLabel}>
                  {item.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* 클라우드별 요약 카드 */}
        <Typography className={classes.sectionTitle}>클라우드별 현황</Typography>
        <Grid container spacing={2} style={{ marginBottom: 24 }}>
          {(Object.keys(CLOUD_COLORS) as CloudProvider[]).map(cloud => {
            const colors = CLOUD_COLORS[cloud];
            return (
              <Grid item xs={4} key={cloud}>
                <Box
                  className={classes.cloudCard}
                  style={{
                    backgroundColor: colors.bg,
                    borderTopColor: colors.border,
                    border: `1px solid ${colors.border}`,
                    borderTop: `3px solid ${colors.border}`,
                  }}
                >
                  <Typography className={classes.cloudCount} style={{ color: colors.color }}>
                    {cloudCounts[cloud]}
                  </Typography>
                  <Typography className={classes.cloudLabel} style={{ color: colors.color }}>
                    {cloud}
                  </Typography>
                </Box>
              </Grid>
            );
          })}
        </Grid>

        {loading && <Progress />}
        {error && (
          <Typography color="error">
            리소스 조회 실패: {error.message}
          </Typography>
        )}

        {!loading && (
          <>
            {/* 클라우드 프로바이더 탭 */}
            <Tabs
              value={activeTab}
              onChange={(_e, v) => setActiveTab(v)}
              className={classes.tabs}
            >
              {CLOUD_TABS.map((tab, i) => {
                const count = i === 0
                  ? total
                  : cloudCounts[tab.cloud as CloudProvider] ?? 0;
                return (
                  <Tab
                    key={tab.label}
                    label={`${tab.label} (${count})`}
                  />
                );
              })}
            </Tabs>

            <ResourceTable
              resources={filteredResources}
              classes={classes}
              onTroubleshoot={handleTroubleshoot}
            />
          </>
        )}
      </Content>

      <TroubleshootingPanel
        open={troubleshoot.open}
        onClose={handleCloseTroubleshoot}
        resourceName={troubleshoot.resourceName}
        errorCategory={troubleshoot.errorCategory}
        rawErrorMessage={troubleshoot.rawMessage}
        cloud={troubleshoot.cloud}
      />
    </Page>
  );
};
