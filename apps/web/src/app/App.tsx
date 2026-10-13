import { AppBar, Box, Container, CssBaseline, Toolbar, Typography } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router';
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
            <Route path="/" element={<Home />} />
          </Routes>
        </Container>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

// Placeholder until the Projects page (ticket 02) takes over this route.
function Home() {
  return (
    <Box>
      <Typography variant="h4" component="h1">
        Flaky Test Tracker
      </Typography>
    </Box>
  );
}
