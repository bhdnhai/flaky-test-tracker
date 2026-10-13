import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router';

// Placeholder until ticket 04 implements the Flaky Tests list and Test search (FR-27, FR-28).
// For now this route exists only so Projects → Reports navigation works (AC-26).
export function FlakyTestsPage() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Flaky Tests
      </Typography>
      <Typography sx={{ mb: 2 }}>Coming soon.</Typography>
      <Button component={RouterLink} to={`/projects/${projectId}/reports`} variant="outlined">
        View Reports
      </Button>
    </Box>
  );
}
