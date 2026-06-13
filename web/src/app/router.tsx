import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppRoot } from './AppRoot';

const rootRoute = createRootRoute();
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (s: Record<string, unknown>) => ({
    id: s.id as string | undefined,
    view: s.view as string | undefined,
    'share-token': s['share-token'] as string | undefined,
    embed: s.embed !== undefined ? true : undefined,
    code: s.code as string | undefined,
    title: s.title as string | undefined,
    stickyOffset: s.stickyOffset !== undefined ? Number(s.stickyOffset) : undefined,
  }),
  component: AppRoot,
});

const routeTree = rootRoute.addChildren([indexRoute]);
export const router = createRouter({ routeTree });
export { indexRoute };

declare module '@tanstack/react-router' {
  interface Register { router: typeof router; }
}
