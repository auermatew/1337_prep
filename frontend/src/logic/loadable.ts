// Something fetched for display: still loading, failed, or here.
export type Loadable<T> =
  { status: 'loading' } | { status: 'failed' } | { status: 'ready'; value: T };
