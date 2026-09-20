/**
 * Stands in for the `server-only` package during tests.
 *
 * That package resolves to a module that throws unless the bundler is running
 * under React's `react-server` condition, which Vitest is not. The real thing
 * is a build-time guard for the app — in a Node test process there is no client
 * bundle for it to protect, so an empty module is the honest substitute.
 *
 * Aliased in vitest.config.ts.
 */
export {};
