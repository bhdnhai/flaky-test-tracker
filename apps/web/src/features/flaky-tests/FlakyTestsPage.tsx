import {
  Box,
  Button,
  CircularProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useParams } from 'react-router';
import { getFlakyTests } from '../../shared/api';

/** The Flaky Tests page: a Project's Flaky Tests ranked by Flakes in the window (FR-27). */
export function FlakyTestsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const flakyTestsQuery = useQuery({
    queryKey: ['projects', projectId, 'flaky-tests'],
    queryFn: () => getFlakyTests(projectId),
    enabled: projectId !== '',
  });

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Flaky Tests
      </Typography>
      {flakyTestsQuery.isPending ? (
        <CircularProgress aria-label="Loading flaky tests" />
      ) : flakyTestsQuery.isError ? (
        <Typography color="error">Could not load Flaky Tests.</Typography>
      ) : flakyTestsQuery.data.items.length === 0 ? (
        <Typography sx={{ mb: 2 }}>No Flaky Tests in the last {flakyTestsQuery.data.windowDays} days.</Typography>
      ) : (
        <TableContainer sx={{ mb: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Classname</TableCell>
                <TableCell>Flakes (last {flakyTestsQuery.data.windowDays} days)</TableCell>
                <TableCell>Most recent Flake</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {flakyTestsQuery.data.items.map((item) => (
                <TableRow key={item.testId}>
                  <TableCell>
                    <Link component={RouterLink} to={`/projects/${projectId}/tests/${item.testId}`}>
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell>{item.classname}</TableCell>
                  <TableCell>{item.flakeCount}</TableCell>
                  <TableCell>{new Date(item.lastFlakeAt).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Button component={RouterLink} to={`/projects/${projectId}/reports`} variant="outlined">
        View Reports
      </Button>
    </Box>
  );
}
