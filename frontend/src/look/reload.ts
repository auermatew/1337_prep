import type { Look } from './look';

// Reload the page straight into a look. A browser caches a failed module
// fetch for the page's life, so a failed Moonrise chunk can only be fetched
// again by a reload (which also picks up a deploy's new chunk names).
export function reloadInto(look: Look): void {
  const url = new URL(window.location.href);
  url.searchParams.set('look', look);
  window.location.assign(url.toString());
}
