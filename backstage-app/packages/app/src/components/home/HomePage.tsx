import { makeStyles, createStyles, Theme } from '@material-ui/core';
import {
  Header,
  Page,
  Content,
  ContentHeader,
  SupportButton,
  InfoCard,
  Progress,
  Link,
} from '@backstage/core-components';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { useAsync } from 'react-use';
import { Entity } from '@backstage/catalog-model';
import {
  Grid,
  Card,
  CardHeader,
  CardContent,
  CardActionArea,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Box,
} from '@material-ui/core';
import StorageIcon from '@material-ui/icons/Storage';
import CloudIcon from '@material-ui/icons/Cloud';
import BuildIcon from '@material-ui/icons/Build';
import LaunchIcon from '@material-ui/icons/Launch';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import FlashOnIcon from '@material-ui/icons/FlashOn';
import AutoFixHighIcon from '@material-ui/icons/Stars';

const CLOUD_ACCENT: Record<string, string> = {
  gcp:   '#4285F4',
  aws:   '#FF9900',
  azure: '#0078D4',
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    card: {
      height: '100%',
    },
    cardAction: {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    },
    cardContent: {
      flexGrow: 1,
    },
    quickLinkCard: {
      marginBottom: theme.spacing(2),
    },
    wizardCard: {
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      borderTop: '3px solid transparent',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: theme.shadows[4],
      },
    },
    templateCard: {
      cursor: 'pointer',
      transition: 'transform 0.15s, box-shadow 0.15s',
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: theme.shadows[2],
      },
    },
    chip: {
      margin: theme.spacing(0.5),
    },
    linkExternal: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    },
    sectionLabel: {
      fontSize: '0.72rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: theme.palette.text.secondary,
      marginBottom: theme.spacing(1),
    },
  }),
);

const QuickLinksCard = () => {
  const classes = useStyles();

  const links = [
    { title: 'ArgoCD',   url: 'http://100.64.0.1:30081', icon: <AccountTreeIcon /> },
    { title: 'Grafana',  url: 'http://100.64.0.1:30080', icon: <BuildIcon /> },
    { title: 'Kubecost', url: 'http://100.64.0.1:30091', icon: <CloudIcon /> },
    { title: 'GitHub',   url: 'https://github.com/sydk-ktcloud/k8s-idp', icon: <LaunchIcon /> },
  ];

  return (
    <InfoCard title="빠른 링크">
      <List dense>
        {links.map(link => (
          <ListItem
            key={link.title}
            button
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ListItemIcon>{link.icon}</ListItemIcon>
            <ListItemText
              primary={
                <span className={classes.linkExternal}>
                  {link.title}
                  <LaunchIcon fontSize="small" />
                </span>
              }
            />
          </ListItem>
        ))}
      </List>
    </InfoCard>
  );
};

const CloudWizardCards = () => {
  const classes = useStyles();

  const wizards = [
    {
      cloud: 'gcp',
      title: 'GCP 서비스 마법사',
      description: '2가지 질문으로 GCP 인프라를 자동 결정합니다. (VM, GKE, Cloud SQL, GCS)',
      url: '/create/templates/default/service-wizard',
      icon: <AutoFixHighIcon />,
      tags: ['wizard', 'recommended', 'gcp'],
    },
    {
      cloud: 'aws',
      title: 'AWS 서비스 마법사',
      description: '3가지 질문으로 AWS 인프라를 자동 결정합니다. (EC2, S3, EKS, RDS)',
      url: '/create/templates/default/aws-service-wizard',
      icon: <AutoFixHighIcon />,
      tags: ['wizard', 'recommended', 'aws'],
    },
    {
      cloud: 'azure',
      title: 'Azure 서비스 마법사',
      description: '3가지 질문으로 Azure 인프라를 자동 결정합니다. (VM, Blob, AKS, PostgreSQL)',
      url: '/create/templates/default/azure-service-wizard',
      icon: <AutoFixHighIcon />,
      tags: ['wizard', 'recommended', 'azure'],
    },
  ];

  return (
    <InfoCard title="클라우드 인프라 마법사">
      <Typography className={classes.sectionLabel}>
        인프라 지식 없이 3가지 질문만으로 프로비저닝
      </Typography>
      <Grid container spacing={2}>
        {wizards.map(w => (
          <Grid item xs={12} md={4} key={w.cloud}>
            <Card
              className={classes.wizardCard}
              style={{ borderTopColor: CLOUD_ACCENT[w.cloud] }}
            >
              <CardActionArea
                component={Link}
                to={w.url}
                className={classes.cardAction}
              >
                <CardHeader
                  avatar={w.icon}
                  title={w.title}
                  titleTypographyProps={{ variant: 'subtitle1', style: { fontWeight: 600 } }}
                  style={{ paddingBottom: 0 }}
                />
                <CardContent className={classes.cardContent}>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {w.description}
                  </Typography>
                  <Box>
                    {w.tags.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        className={classes.chip}
                        style={
                          tag === w.cloud
                            ? { backgroundColor: CLOUD_ACCENT[w.cloud], color: '#fff' }
                            : undefined
                        }
                      />
                    ))}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </InfoCard>
  );
};

const OtherTemplateCards = () => {
  const classes = useStyles();

  const templates = [
    {
      title: '서버 빠른 시작',
      description: '3가지 선택만으로 GCP 서버를 즉시 생성합니다',
      url: '/create/templates/default/simple-server-template',
      icon: <FlashOnIcon />,
      tags: ['beginner', 'quick-start', 'gcp'],
    },
    {
      title: 'GCP 인프라 프로비저닝',
      description: 'GCP 리소스(VM, GCS, GKE, Cloud SQL)를 직접 구성합니다',
      url: '/create/templates/default/infrastructure-only-template',
      icon: <CloudIcon />,
      tags: ['infrastructure', 'gcp'],
    },
    {
      title: 'AWS 인프라 프로비저닝',
      description: 'AWS 리소스(EC2, S3, EKS, RDS)를 직접 구성합니다',
      url: '/create/templates/default/aws-infrastructure',
      icon: <CloudIcon />,
      tags: ['infrastructure', 'aws'],
    },
    {
      title: 'Azure 인프라 프로비저닝',
      description: 'Azure 리소스(VM, Blob, AKS, Database)를 직접 구성합니다',
      url: '/create/templates/default/azure-infrastructure',
      icon: <CloudIcon />,
      tags: ['infrastructure', 'azure'],
    },
    {
      title: '서비스 생성',
      description: '새로운 서비스를 생성합니다 (Node.js, Python, Go 지원)',
      url: '/create/templates/default/service-template',
      icon: <BuildIcon />,
      tags: ['service', 'recommended'],
    },
    {
      title: '서비스 + 인프라 묶음',
      description: '서비스와 GCP 인프라를 한 번에 생성합니다',
      url: '/create/templates/default/service-with-infra',
      icon: <StorageIcon />,
      tags: ['service', 'infrastructure', 'gcp'],
    },
  ];

  return (
    <InfoCard title="기타 템플릿">
      <Grid container spacing={2}>
        {templates.map(t => (
          <Grid item xs={12} md={4} key={t.title}>
            <Card className={classes.templateCard}>
              <CardActionArea
                component={Link}
                to={t.url}
                className={classes.cardAction}
              >
                <CardHeader
                  avatar={t.icon}
                  title={t.title}
                  titleTypographyProps={{ variant: 'subtitle2' }}
                  style={{ paddingBottom: 0 }}
                />
                <CardContent className={classes.cardContent}>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {t.description}
                  </Typography>
                  <Box>
                    {t.tags.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        className={classes.chip}
                        style={
                          CLOUD_ACCENT[tag]
                            ? { backgroundColor: CLOUD_ACCENT[tag], color: '#fff' }
                            : undefined
                        }
                      />
                    ))}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </InfoCard>
  );
};

const MyServicesCard = () => {
  const catalogApi = useApi(catalogApiRef);

  const { value: entities, loading, error } = useAsync(async () => {
    const response = await catalogApi.getEntities({ filter: { kind: 'component' } });
    return response.items;
  }, []);

  if (loading) {
    return <InfoCard title="내 서비스"><Progress /></InfoCard>;
  }

  if (error) {
    return (
      <InfoCard title="내 서비스">
        <Typography color="error">서비스 목록을 불러오는데 실패했습니다</Typography>
      </InfoCard>
    );
  }

  const services = entities?.slice(0, 10) || [];

  return (
    <InfoCard title="내 서비스">
      {services.length === 0 ? (
        <Typography color="textSecondary">
          등록된 서비스가 없습니다. 위 마법사를 사용하여 새 서비스를 생성하세요.
        </Typography>
      ) : (
        <List dense>
          {services.map((service: Entity) => (
            <ListItem
              key={service.metadata.name}
              button
              component={Link}
              to={`/catalog/${service.metadata.namespace || 'default'}/${service.kind}/${service.metadata.name}`}
            >
              <ListItemIcon><StorageIcon /></ListItemIcon>
              <ListItemText
                primary={service.metadata.title || service.metadata.name}
                secondary={service.spec?.type as string || 'service'}
              />
            </ListItem>
          ))}
        </List>
      )}
    </InfoCard>
  );
};

export const HomePage = () => {
  return (
    <Page themeId="home">
      <Header
        title="K8S-IDP 개발자 포털"
        subtitle="GCP · AWS · Azure 셀프서비스 인프라 플랫폼"
      />
      <Content>
        <ContentHeader title="대시보드">
          <SupportButton>
            이 포털은 개발자가 인프라 지식 없이 GCP / AWS / Azure 리소스를 프로비저닝할 수 있도록
            도와줍니다. 문의사항은 관리자에게 연락하세요.
          </SupportButton>
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <QuickLinksCard />
          </Grid>
          <Grid item xs={12} md={9}>
            <CloudWizardCards />
          </Grid>
          <Grid item xs={12}>
            <OtherTemplateCards />
          </Grid>
          <Grid item xs={12}>
            <MyServicesCard />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
