import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { getProjectReports } from '../../shared/api';

const EMPTY_CELL = '—';

/** The Reports page: a Project's most recent Reports, newest first (FR-30). */
export function ReportsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const reportsQuery = useQuery({
    queryKey: ['projects', projectId, 'reports'],
    queryFn: () => getProjectReports(projectId),
    enabled: projectId !== '',
  });

  if (reportsQuery.isPending) {
    return <CircularProgress aria-label="Loading reports" />;
  }
  if (reportsQuery.isError) {
    return <Typography color="error">Could not load Reports.</Typography>;
  }

  const { items } = reportsQuery.data;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Reports
      </Typography>
      {items.length === 0 ? (
        <Typography>No Reports yet.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Received</TableCell>
                <TableCell>Commit</TableCell>
                <TableCell>Branch</TableCell>
                <TableCell>Run attempt</TableCell>
                <TableCell>Job</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Error</TableCell>
                <TableCell>Collisions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>{new Date(report.receivedAt).toLocaleString()}</TableCell>
                  <TableCell>{report.commitSha.slice(0, 7)}</TableCell>
                  <TableCell>{report.branch ?? EMPTY_CELL}</TableCell>
                  <TableCell>{report.runAttempt ?? EMPTY_CELL}</TableCell>
                  <TableCell>{report.job ?? EMPTY_CELL}</TableCell>
                  <TableCell>{report.processingState}</TableCell>
                  <TableCell>{report.error ?? EMPTY_CELL}</TableCell>
                  <TableCell>{report.collisionWarning ? 'Yes' : EMPTY_CELL}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
