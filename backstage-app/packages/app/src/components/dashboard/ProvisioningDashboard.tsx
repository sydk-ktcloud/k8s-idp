import { useState, useCallback } from 'react';
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
      backgroundColor: '#fff8f8',
    },
    troubleshootBtn: {
      color: '#c62828',
      borderColor: '#ef9a9a',
      fontSize: '0.75rem',
    },
  }),
);

const RESOURCE_TYPES = [
  { plural: 'webapps', kind: 'WebApp', label: 'Web앱', icon: <CloudIcon fontSize="small" /> },
  { plural: 'gcpinstances', kind: 'GCPInstance', label: 'GCP VM', icon: <DnsIcon fontSize="small" /> },
  { plural: 'buckets', kind: 'Bucket', label: 'Storage', icon: <StorageIcon fontSize="small" /> },
  { plural: 'clusters', kind: 'Cluster', label: 'GKE', icon: <AccountTreeIcon fontSize="small" /> },
  { plural: 'databases', kind: 'Database', label: 'Cloud SQL', icon: <StorageIcon fontSize="small" /> },
  { plural: 'pubsubs', kind: 'PubSub', label: 'PubSub', icon: <CloudIcon fontSize="small" /> },
  { plural: 'caches', kind: 'Cache', label: 'Cache', icon: <StorageIcon fontSize="small" /> },
];

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

interface TroubleshootState {
  open: boolean;
  resourceName: string;
  errorCategory: ErrorCategory | null;
  rawMessage?: string;
}

const ResourceTable = ({
  resources,
  classes,
  onTroubleshoot,
}: {
  resources: CrossplaneResource[];
  classes: ReturnType<typeof useStyles>;
  onTroubleshoot: (name: string, category: ErrorCategory | null, msg?: string) => void;
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
  });

  const { value: allResources, loading, error } = useAsync(async () => {
    const results: CrossplaneResource[] = [];
    await Promise.allSettled(
      RESOURCE_TYPES.map(async rt => {
        try {
          const response = await kubernetesApi.proxy({
            clusterName: CLUSTER_NAME,
            path: `/apis/${API_GROUP}/${API_VERSION}/${rt.plural}`,
            init: { method: 'GET' },
          });
          const data = await response.json();
          if (data.items) {
            for (const item of data.items) {
              results.push({ ...item, kindLabel: rt.label });
            }
          }
        } catch (_e) {
          // 리소스 타입이 없거나 접근 불가인 경우 무시
        }
      }),
    );
    return results;
  }, [refreshKey]);

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const handleTroubleshoot = useCallback(
    (name: string, category: ErrorCategory | null, msg?: string) => {
      setTroubleshoot({ open: true, resourceName: name, errorCategory: category, rawMessage: msg });
    },
    [],
  );

  const handleCloseTroubleshoot = useCallback(() => {
    setTroubleshoot(prev => ({ ...prev, open: false }));
  }, []);

  const tabs = [
    { label: '전체', filter: (_r: CrossplaneResource) => true },
    ...RESOURCE_TYPES.map(rt => ({
      label: rt.label,
      filter: (r: CrossplaneResource) => r.kindLabel === rt.label,
    })),
  ];

  const filteredResources = (allResources || []).filter(
    tabs[activeTab]?.filter ?? (() => true),
  );

  const total = allResources?.length ?? 0;
  const ready = allResources?.filter(r => getStatus(r.status?.conditions).cls === 'chipReady').length ?? 0;
  const pending = allResources?.filter(r => getStatus(r.status?.conditions).cls === 'chipPending').length ?? 0;
  const errored = allResources?.filter(r => getStatus(r.status?.conditions).isError).length ?? 0;

  return (
    <Page themeId="tool">
      <Header
        title="프로비저닝 현황"
        subtitle="Crossplane으로 프로비저닝된 GCP 리소스 상태"
      />
      <Content>
        <ContentHeader title="리소스 현황">
          <Tooltip title="새로고침">
            <IconButton onClick={handleRefresh} size="small" className={classes.refreshBtn}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </ContentHeader>

        {/* 요약 카드 */}
        <Grid container spacing={2} style={{ marginBottom: 24 }}>
          {[
            { label: '전체', count: total, color: '#1565c0' },
            { label: '✅ 완료', count: ready, color: '#2e7d32' },
            { label: '⏳ 프로비저닝 중', count: pending, color: '#e65100' },
            { label: '❌ 오류', count: errored, color: '#b71c1c' },
          ].map(item => (
            <Grid item xs={6} md={3} key={item.label}>
              <Box className={classes.summaryCard}>
                <Typography
                  className={classes.summaryCount}
                  style={{ color: item.color }}
                >
                  {item.count}
                </Typography>
                <Typography variant="body2" className={classes.summaryLabel}>
                  {item.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {loading && <Progress />}
        {error && (
          <Typography color="error">
            리소스 조회 실패: {error.message}
          </Typography>
        )}

        {!loading && (
          <>
            <Tabs
              value={activeTab}
              onChange={(_e, v) => setActiveTab(v)}
              className={classes.tabs}
              variant="scrollable"
              scrollButtons="auto"
            >
              {tabs.map((tab, i) => (
                <Tab
                  key={tab.label}
                  label={`${tab.label}${i === 0 ? ` (${total})` : ''}`}
                />
              ))}
            </Tabs>

            <ResourceTable
              resources={filteredResources}
              classes={classes}
              onTroubleshoot={handleTroubleshoot}
            />
          </>
        )}
      </Content>

      {/* 트러블슈팅 다이얼로그 */}
      <TroubleshootingPanel
        open={troubleshoot.open}
        onClose={handleCloseTroubleshoot}
        resourceName={troubleshoot.resourceName}
        errorCategory={troubleshoot.errorCategory}
        rawErrorMessage={troubleshoot.rawMessage}
      />
    </Page>
  );
};
