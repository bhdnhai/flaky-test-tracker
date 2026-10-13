import { AppBar, Container, CssBaseline, Toolbar, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
import { FlakyTestsPage } from '../features/flaky-tests';
import { ProjectsPage } from '../features/projects';
import { ReportsPage } from '../features/reports';
import { TestDetailPage } from '../features/test-detail';
import { ApiStatus } from './ApiStatus';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CssBaseline />
      <BrowserRouter>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="span" sx={{ flexGrow: 1 }}>
              Flaky Test Tracker
            </Typography>
            <ApiStatus />
          </Toolbar>
        </AppBar>
        <Container component="main" sx={{ py: 3 }}>
          <Routes>
            <Route path="/" element={<ProjectsPage />} />
            <Route path="/projects/:projectId" element={<FlakyTestsPage />} />
            <Route path="/projects/:projectId/reports" element={<ReportsPage />} />
            <Route path="/projects/:projectId/tests/:testId" element={<TestDetailPage />} />
          </Routes>
        </Container>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
