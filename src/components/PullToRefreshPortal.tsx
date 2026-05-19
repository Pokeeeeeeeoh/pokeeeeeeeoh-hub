import { usePullToRefresh, PullToRefreshIndicator } from "@/hooks/usePullToRefresh";

interface Props {
  onRefresh: () => Promise<unknown> | unknown;
  disabled?: boolean;
}

/**
 * Drop-in pull-to-refresh for full-page admin views.
 * Just render it once near the top of the page component.
 */
export function PullToRefreshPortal({ onRefresh, disabled }: Props) {
  const { pullDistance, refreshing, threshold } = usePullToRefresh({ onRefresh, disabled });
  return (
    <PullToRefreshIndicator
      pullDistance={pullDistance}
      refreshing={refreshing}
      threshold={threshold}
    />
  );
}
