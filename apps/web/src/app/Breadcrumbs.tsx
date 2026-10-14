import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink, useMatch } from 'react-router';
import { getProjects, getTestDetail } from '../shared/api';

/** The path back from any page: Projects › Project › Reports or Test. Reuses the pages' query
 *  keys, so it adds no requests. Renders as a <nav>, outside the page content, so the verdict
 *  stays the first element of Test detail (AC-25). */
export function Breadcrumbs() {
  const projectMatch = useMatch('/projects/:projectId/*');
  const reportsMatch = useMatch('/projects/:projectId/reports');
  const testMatch = useMatch('/projects/:projectId/tests/:testId');
  const projectId = projectMatch?.params.projectId ?? '';
  const testId = testMatch?.params.testId ?? '';

  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
    enabled: projectId !== '',
  });
  const testQuery = useQuery({
    queryKey: ['projects', projectId, 'tests', testId],
    queryFn: () => getTestDetail(projectId, testId),
    enabled: projectId !== '' && testId !== '',
  });

  if (projectId === '') return null;

  const projectName =
    projectsQuery.data?.items.find((project) => project.id === projectId)?.name ?? 'Project';
  const current = reportsMatch ? 'Reports' : testMatch ? (testQuery.data?.name ?? 'Test') : null;

  return (
    <MuiBreadcrumbs aria-label="Breadcrumb" sx={{ mb: 2 }}>
      <Link component={RouterLink} to="/">
        Projects
      </Link>
      {current === null ? (
        <Typography color="text.primary" aria-current="page">
          {projectName}
        </Typography>
      ) : (
        <Link component={RouterLink} to={`/projects/${projectId}`}>
          {projectName}
        </Link>
      )}
      {current !== null && (
        <Typography color="text.primary" aria-current="page">
          {current}
        </Typography>
      )}
    </MuiBreadcrumbs>
  );
}
