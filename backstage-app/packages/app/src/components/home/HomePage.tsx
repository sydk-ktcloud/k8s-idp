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
import { useState, useEffect } from 'react';
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
    templateCard: {
      cursor: 'pointer',
      transition: 'transform 0.2s, box-shadow 0.2s',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: theme.shadows[4],
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
  }),
);

const QuickLinksCard = () => {
  const classes = useStyles();

  const links = [
    { title: 'ArgoCD', url: 'https://argocd.k8s-idp.local', icon: <AccountTreeIcon /> },
    { title: 'Grafana', url: '/grafana', icon: <BuildIcon /> },
    { title: 'Kubecost', url: '/kubecost', icon: <CloudIcon /> },
    { title: 'GitHub', url: 'https://github.com/sydk-ktcloud/k8s-idp', icon: <LaunchIcon /> },
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
            target={link.url.startsWith('http') ? '_blank' : undefined}
            rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            <ListItemIcon>{link.icon}</ListItemIcon>
            <ListItemText
              primary={
                <span className={classes.linkExternal}>
                  {link.title}
                  {link.url.startsWith('http') && <LaunchIcon fontSize="small" />}
                </span>
              }
            />
          </ListItem>
        ))}
      </List>
    </InfoCard>
  );
};

const TemplateCards = () => {
  const classes = useStyles();

  const templates = [
    {
      title: '인프라 프로비저닝',
      description: 'GCP 리소스(VM, GCS, GKE, Cloud SQL)를 프로비저닝합니다',
      url: '/create/templates/infrastructure-only',
      icon: <CloudIcon />,
      tags: ['infrastructure', 'gcp'],
    },
    {
      title: '서비스 생성',
      description: '새로운 서비스를 생성합니다 (Node.js, Python, Go 지원)',
      url: '/create/templates/service-template',
      icon: <BuildIcon />,
      tags: ['service', 'recommended'],
    },
    {
      title: '서비스 + 인프라 묶음',
      description: '서비스와 필요한 인프라를 한 번에 생성합니다',
      url: '/create/templates/service-with-infra',
      icon: <StorageIcon />,
      tags: ['service', 'infrastructure', 'recommended'],
    },
  ];

  return (
    <InfoCard title="프로비저닝 바로가기">
      <Grid container spacing={2}>
        {templates.map(template => (
          <Grid item xs={12} md={4} key={template.title}>
            <Card className={classes.templateCard}>
              <CardActionArea
                component={Link}
                to={template.url}
                className={classes.cardAction}
              >
                <CardHeader
                  avatar={template.icon}
                  title={template.title}
                  titleTypographyProps={{ variant: 'subtitle1' }}
                />
                <CardContent className={classes.cardContent}>
                  <Typography variant="body2" color="textSecondary" paragraph>
                    {template.description}
                  </Typography>
                  <Box>
                    {template.tags.map(tag => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        className={classes.chip}
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

  const {
    value: entities,
    loading,
    error,
  } = useAsync(async () => {
    const response = await catalogApi.getEntities({
      filter: { kind: 'component' },
    });
    return response.items;
  }, []);

  if (loading) {
    return (
      <InfoCard title="내 서비스">
        <Progress />
      </InfoCard>
    );
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
          등록된 서비스가 없습니다. 템플릿을 사용하여 새 서비스를 생성하세요.
        </Typography>
      ) : (
        <List dense>
          {services.map(service => (
            <ListItem
              key={service.metadata.name}
              button
              component={Link}
              to={`/catalog/${service.metadata.namespace || 'default'}/${service.kind}/${service.metadata.name}`}
            >
              <ListItemIcon>
                <StorageIcon />
              </ListItemIcon>
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
      <Header title="K8S-IDP 개발자 포털" subtitle="Self-Service Infrastructure Platform" />
      <Content>
        <ContentHeader title="대시보드">
          <SupportButton>
            이 포털은 개발자가 인프라 지식 없이 GCP 리소스를 프로비저닝할 수 있도록
            도와줍니다. 문의사항은 관리자에게 연락하세요.
          </SupportButton>
        </ContentHeader>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <QuickLinksCard />
          </Grid>
          <Grid item xs={12} md={9}>
            <TemplateCards />
          </Grid>
          <Grid item xs={12}>
            <MyServicesCard />
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
