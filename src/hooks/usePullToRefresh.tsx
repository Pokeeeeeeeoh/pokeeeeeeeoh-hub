import { useEffect, useRef, useState } from "react";

interface Options {
  /** Called when the user pulls past the threshold and releases. Should return a Promise so we can show the spinner until done. */
  onRefresh: () => Promise<unknown> | unknown;
  /** Pixels of pull required to trigger refresh. Default 70. */
  threshold?: number;
  /** Disable the gesture (e.g. while a dialog is open). */
  disabled?: boolean;
}

/**
 * Mobile pull-to-refresh. Attach the returned ref to the scrollable container
 * (or document body for full-page). Renders nothing — pair with <PullToRefreshIndicator />.
 *
 * Only activates when scrollTop is at 0 (top of page) and the user drags down with a touch.
 */
export function usePullToRefresh({ onRefresh, threshold = 70, disabled = false }: Options) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    if (disabled) return;

    const isAtTop = () =>
      (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      if (!isAtTop()) return;
      startY.current = e.touches[0].clientY;
      activeRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!activeRef.current || startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPullDistance(0);
        return;
      }
      // Resistance curve so it feels rubbery
      const damped = Math.min(dy * 0.5, threshold * 1.8);
      setPullDistance(damped);
      if (dy > 5 && e.cancelable) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      const triggered = pullDistance >= threshold;
      startY.current = null;
      if (triggered) {
        setRefreshing(true);
        setPullDistance(threshold);
        try {
          await onRefresh();
        } catch (e) {
          console.error("pull-to-refresh handler failed", e);
        } finally {
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, threshold, disabled, refreshing, pullDistance]);

  return { pullDistance, refreshing, threshold };
}

interface IndicatorProps {
  pullDistance: number;
  refreshing: boolean;
  threshold: number;
}

export function PullToRefreshIndicator({ pullDistance, refreshing, threshold }: IndicatorProps) {
  const visible = pullDistance > 0 || refreshing;
  const progress = Math.min(pullDistance / threshold, 1);
  const ready = progress >= 1;

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        transform: `translateY(${Math.max(pullDistance - 30, refreshing ? 20 : -40)}px)`,
        transition: refreshing || pullDistance === 0 ? "transform 200ms ease-out" : "none",
        opacity: visible ? 1 : 0,
      }}
    >
      <div className="mt-2 flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-md border border-border">
        <svg
          className={refreshing ? "animate-spin" : ""}
          style={{ transform: refreshing ? undefined : `rotate(${progress * 270}deg)` }}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path
            d="M21 12a9 9 0 1 1-3-6.7"
            className={ready || refreshing ? "text-primary" : "text-muted-foreground"}
          />
          <path
            d="M21 3v6h-6"
            className={ready || refreshing ? "text-primary" : "text-muted-foreground"}
          />
        </svg>
      </div>
    </div>
  );
}
