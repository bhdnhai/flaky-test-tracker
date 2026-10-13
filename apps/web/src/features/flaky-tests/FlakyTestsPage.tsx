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
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import { getFlakyTests, searchTests } from '../../shared/api';

const SEARCH_MIN_LENGTH = 2;

/** The Flaky Tests page: a Project's Flaky Tests ranked by Flakes in the window (FR-27),
 *  plus Test search over every Test in the Project (FR-24, FR-28). */
export function FlakyTestsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [search, setSearch] = useState('');
  const flakyTestsQuery = useQuery({
    queryKey: ['projects', projectId, 'flaky-tests'],
    queryFn: () => getFlakyTests(projectId),
    enabled: projectId !== '',
  });
  const searchQuery = useQuery({
    queryKey: ['projects', projectId, 'tests', 'search', search],
    queryFn: () => searchTests(projectId, search),
    enabled: projectId !== '' && search.length >= SEARCH_MIN_LENGTH,
  });
  const isSearching = search.length >= SEARCH_MIN_LENGTH;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Flaky Tests
      </Typography>
      <TextField
        label="Search Tests"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 2 }}
        fullWidth
      />
      {isSearching ? (
        searchQuery.isPending ? (
          <CircularProgress aria-label="Searching tests" />
        ) : searchQuery.isError ? (
          <Typography color="error">Could not search Tests.</Typography>
        ) : searchQuery.data.items.length === 0 ? (
          <Typography sx={{ mb: 2 }}>No Tests match “{search}”.</Typography>
        ) : (
          <TableContainer sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Classname</TableCell>
                  <TableCell>Total Flakes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {searchQuery.data.items.map((item) => (
                  <TableRow key={item.testId}>
                    <TableCell>
                      <Link
                        component={RouterLink}
                        to={`/projects/${projectId}/tests/${item.testId}`}
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>{item.classname}</TableCell>
                    <TableCell>{item.totalFlakes}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      ) : flakyTestsQuery.isPending ? (
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
