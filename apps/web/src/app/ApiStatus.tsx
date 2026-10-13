import { Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../shared/api';

/** Shows whether the API can reach its database (`GET /health`). */
export function ApiStatus() {
  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, refetchInterval: 30_000 });

  if (health.isPending) return <Chip label="API: checking…" variant="outlined" color="default" />;
  if (health.isError) return <Chip label="API: unavailable" color="error" role="status" />;
  return <Chip label={`API: ${health.data.status}`} color="success" role="status" />;
}
