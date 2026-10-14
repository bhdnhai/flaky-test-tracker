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
import { getTestDetail } from '../../shared/api';

const EMPTY_CELL = '—';

/** The Test detail page: the verdict first, then history by Commit (FR-29). The verdict and
 *  history come entirely from the API; no Flake rules are duplicated here (design §4). */
export function TestDetailPage() {
  const { projectId = '', testId = '' } = useParams<{ projectId: string; testId: string }>();
  const detailQuery = useQuery({
    queryKey: ['projects', projectId, 'tests', testId],
    queryFn: () => getTestDetail(projectId, testId),
    enabled: projectId !== '' && testId !== '',
  });

  if (detailQuery.isPending) {
    return <CircularProgress aria-label="Loading test detail" />;
  }
  if (detailQuery.isError) {
    return <Typography color="error">Could not load Test detail.</Typography>;
  }

  const { classname, name, verdict, history } = detailQuery.data;

  return (
    <Box>
      {/* AC-25: the verdict is the first element on the page. */}
      <Typography variant="h6" component="p" gutterBottom>
        {verdict.flaky
          ? `Flaky: ${verdict.totalFlakes} Flakes (${verdict.flakesInWindow} in the last ${verdict.windowDays} days)`
          : 'No Flakes recorded'}
      </Typography>
      <Typography variant="h4" component="h1" gutterBottom>
        {classname} &gt; {name}
      </Typography>
      {history.length === 0 ? (
        <Typography>No Commit history yet.</Typography>
      ) : (
        history.map((commit) => (
          <TableContainer key={commit.commitSha} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" component="h2">
              Commit {commit.commitSha.slice(0, 7)} {commit.isFlake ? '(Flake)' : ''} —{' '}
              {commit.passed} passed, {commit.failed} failed, {commit.skipped} skipped
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Result</TableCell>
                  <TableCell>Failure message</TableCell>
                  <TableCell>Branch</TableCell>
                  <TableCell>CI run</TableCell>
                  <TableCell>Job</TableCell>
                  <TableCell>Received</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {commit.outcomes.map((outcome, index) => (
                  <TableRow key={index}>
                    <TableCell>{outcome.result}</TableCell>
                    <TableCell>{outcome.failureMessage ?? EMPTY_CELL}</TableCell>
                    <TableCell>{outcome.branch ?? EMPTY_CELL}</TableCell>
                    <TableCell>
                      {outcome.runId ?? EMPTY_CELL}
                      {outcome.runAttempt !== null ? ` (attempt ${outcome.runAttempt})` : ''}
                    </TableCell>
                    <TableCell>{outcome.job ?? EMPTY_CELL}</TableCell>
                    <TableCell>{new Date(outcome.receivedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ))
      )}
    </Box>
  );
}
