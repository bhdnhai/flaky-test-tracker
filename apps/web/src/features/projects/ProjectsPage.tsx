import {
  Box,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import { getProjects } from '../../shared/api';

/** The Projects page: every Project, linking to its Flaky Tests page (FR-26). */
export function ProjectsPage() {
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: getProjects });

  if (projectsQuery.isPending) {
    return <CircularProgress aria-label="Loading projects" />;
  }
  if (projectsQuery.isError) {
    return <Typography color="error">Could not load Projects.</Typography>;
  }

  const { items } = projectsQuery.data;

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Projects
      </Typography>
      {items.length === 0 ? (
        <Typography>No Projects yet.</Typography>
      ) : (
        <List>
          {items.map((project) => (
            <ListItemButton key={project.id} component={RouterLink} to={`/projects/${project.id}`}>
              <ListItemText primary={project.name} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
