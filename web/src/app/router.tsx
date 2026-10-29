import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppRoot } from './AppRoot';
import { parseAppSearch } from './urlParams';

const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: parseAppSearch,
  component: AppRoot,
});

const routeTree = rootRoute.addChildren([indexRoute]);
export const router = createRouter({ routeTree });
export { indexRoute };

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
