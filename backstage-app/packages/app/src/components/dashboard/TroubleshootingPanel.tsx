import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Chip,
  Paper,
} from '@material-ui/core';
import { makeStyles, createStyles, Theme } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import WarningIcon from '@material-ui/icons/Warning';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import ContactSupportIcon from '@material-ui/icons/ContactSupport';
import OpenInNewIcon from '@material-ui/icons/OpenInNew';
import { Link } from '@backstage/core-components';
import { GUIDES, TroubleshootingGuide } from './troubleshootingGuides';
import type { ErrorCategory } from './troubleshootingGuides';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    dialogTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      paddingBottom: theme.spacing(1),
    },
    errorBanner: {
      backgroundColor: '#fce4ec',
      border: '1px solid #ef9a9a',
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    causeBox: {
      backgroundColor: theme.palette.action.hover,
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    causeLabel: {
      fontWeight: 700,
      marginBottom: theme.spacing(0.5),
    },
    codeBlock: {
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(2),
      fontFamily: 'monospace',
      fontSize: '0.82rem',
      overflowX: 'auto',
      whiteSpace: 'pre',
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    noteBox: {
      backgroundColor: '#e3f2fd',
      border: '1px solid #90caf9',
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(1.5),
      marginTop: theme.spacing(1),
    },
    actionBtn: {
      marginRight: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    actionBtnPrimary: {
      backgroundColor: theme.palette.primary.main,
      color: '#fff',
      '&:hover': { backgroundColor: theme.palette.primary.dark },
    },
    actionBtnContact: {
      backgroundColor: '#e8f5e9',
      color: '#2e7d32',
      border: '1px solid #a5d6a7',
    },
    stepTitle: {
      fontWeight: 600,
    },
    rawMessage: {
      backgroundColor: '#fafafa',
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
      padding: theme.spacing(1.5),
      fontFamily: 'monospace',
      fontSize: '0.8rem',
      wordBreak: 'break-all',
    },
    categoryChip: {
      marginLeft: theme.spacing(1),
      fontWeight: 600,
    },
  }),
);

interface Props {
  open: boolean;
  onClose: () => void;
  resourceName: string;
  errorCategory: ErrorCategory | null;
  rawErrorMessage?: string;
}

export const TroubleshootingPanel = ({
  open,
  onClose,
  resourceName,
  errorCategory,
  rawErrorMessage,
}: Props) => {
  const classes = useStyles();
  const guide: TroubleshootingGuide = errorCategory
    ? GUIDES[errorCategory]
    : GUIDES['UNKNOWN'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle disableTypography className={classes.dialogTitle}>
        <WarningIcon style={{ color: '#c62828' }} />
        <Typography variant="h6" style={{ flexGrow: 1 }}>
          오류 분석 – {resourceName}
        </Typography>
        <Chip
          label={guide.title}
          size="small"
          style={{ backgroundColor: '#fce4ec', color: '#c62828', fontWeight: 600 }}
          className={classes.categoryChip}
        />
      </DialogTitle>

      <DialogContent dividers>
        {/* 요약 배너 */}
        <Box className={classes.errorBanner}>
          <Typography variant="body1" style={{ fontWeight: 600, color: '#c62828' }}>
            ❌ {guide.summary}
          </Typography>
        </Box>

        {/* 원인 */}
        <Box className={classes.causeBox}>
          <Typography variant="body2" className={classes.causeLabel}>
            📋 원인 분석
          </Typography>
          <Typography variant="body2">{guide.cause}</Typography>
        </Box>

        {/* 원시 에러 메시지 (있는 경우) */}
        {rawErrorMessage && (
          <Box mb={2}>
            <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 4 }}>
              🔍 GCP 에러 메시지
            </Typography>
            <Paper className={classes.rawMessage}>{rawErrorMessage}</Paper>
          </Box>
        )}

        <Divider style={{ margin: '16px 0' }} />

        {/* 즉각 해결 액션 */}
        <Box mb={2}>
          <Typography variant="subtitle1" style={{ fontWeight: 700, marginBottom: 8 }}>
            🚀 빠른 해결 방법
          </Typography>
          <Box display="flex" flexWrap="wrap">
            {guide.actions.map(action => {
              const isExternal = action.url.startsWith('http');
              const btnClass = `${classes.actionBtn} ${
                action.variant === 'primary'
                  ? classes.actionBtnPrimary
                  : action.variant === 'contact'
                  ? classes.actionBtnContact
                  : ''
              }`;
              const icon =
                action.variant === 'contact' ? (
                  <ContactSupportIcon />
                ) : isExternal ? (
                  <OpenInNewIcon />
                ) : (
                  <CheckCircleOutlineIcon />
                );
              if (isExternal) {
                return (
                  <Button
                    key={action.label}
                    component="a"
                    href={action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    variant="contained"
                    startIcon={icon}
                    className={btnClass}
                  >
                    {action.label}
                  </Button>
                );
              }
              return (
                <Button
                  key={action.label}
                  component={Link}
                  to={action.url}
                  size="small"
                  variant="contained"
                  startIcon={icon}
                  className={btnClass}
                >
                  {action.label}
                </Button>
              );
            })}
          </Box>
        </Box>

        <Divider style={{ margin: '16px 0' }} />

        {/* 단계별 가이드 */}
        <Typography variant="subtitle1" style={{ fontWeight: 700, marginBottom: 8 }}>
          📖 단계별 해결 가이드
        </Typography>
        {guide.steps.map((step, idx) => (
          <Accordion key={idx} defaultExpanded={idx === 0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography className={classes.stepTitle}>{step.title}</Typography>
            </AccordionSummary>
            <AccordionDetails style={{ flexDirection: 'column' }}>
              <Typography variant="body2" style={{ marginBottom: step.code ? 8 : 0 }}>
                {step.description}
              </Typography>
              {step.code && (
                <Box className={classes.codeBlock}>{step.code}</Box>
              )}
              {step.note && (
                <Box className={classes.noteBox}>
                  <Typography variant="body2">
                    💡 <strong>참고:</strong> {step.note}
                  </Typography>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>
        ))}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="primary">
          닫기
        </Button>
      </DialogActions>
    </Dialog>
  );
};
