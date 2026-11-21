import { useEffect, useRef, useState } from 'react';

interface ScrollDirectionOptions {
  /** Minimum downward delta (px) before hiding */
  hideDelta?: number;
  /** Minimum upward delta (px) before revealing */
  showDelta?: number;
  /** Always stay visible above this scrollY offset (px) */
  topPinOffset?: number;
  /** Changing this key resets visibility to true (e.g. tab/view change) */
  resetKey?: string;
}

/**
 * Passive, RAF-throttled scroll visibility hook for dynamic iOS-style floating navigation.
 * Hides smoothly when scrolling down into content, reveals immediately when scrolling up
 * or near the top/bottom edges.
 */
export function useScrollVisibility(options: ScrollDirectionOptions = {}): boolean {
  const {
    hideDelta = 16,
    showDelta = 8,
    topPinOffset = 48,
    resetKey = '',
  } = options;

  const [visible, setVisible] = useState(true);
  const lastYRef = useRef(0);
  const anchorYRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setVisible(true);
    const currentY = typeof window !== 'undefined' ? window.scrollY : 0;
    lastYRef.current = currentY;
    anchorYRef.current = currentY;
  }, [resetKey]);

  useEffect(() => {
    const evaluate = () => {
      rafRef.current = null;
      const y = Math.max(0, window.scrollY);
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );

      // Always visible near top or if page barely scrolls
      if (y <= topPinOffset || maxScroll <= 64) {
        setVisible(true);
        lastYRef.current = y;
        anchorYRef.current = y;
        return;
      }

      const deltaFromLast = y - lastYRef.current;
      // Reset anchor when direction reverses
      if (
        (deltaFromLast > 0 && anchorYRef.current > lastYRef.current) ||
        (deltaFromLast < 0 && anchorYRef.current < lastYRef.current)
      ) {
        anchorYRef.current = lastYRef.current;
      }

      const netDelta = y - anchorYRef.current;

      if (netDelta >= hideDelta) {
        setVisible(false);
        anchorYRef.current = y;
      } else if (netDelta <= -showDelta) {
        setVisible(true);
        anchorYRef.current = y;
      }

      lastYRef.current = y;
    };

    const onScroll = () => {
      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(evaluate);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, [hideDelta, showDelta, topPinOffset]);

  return visible;
}
