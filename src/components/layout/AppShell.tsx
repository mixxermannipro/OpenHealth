import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
  Activity,
  Moon,
  Utensils,
  MoreHorizontal,
  Wind,
  NotebookPen,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { PrimaryTab } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { useScrollVisibility } from '../../hooks/useScrollDirection';
import { triggerHaptic } from '../../utils/haptics';
import { de } from '../../i18n/de';
import { useI18n } from '../../i18n/useI18n';

interface AppShellProps {
  children: React.ReactNode;
  onOpenJournal: () => void;
  onOpenBreathwork: () => void;
}

const TAB_ORDER: PrimaryTab[] = ['today', 'activity', 'sleep', 'nutrition', 'more'];

export const AppShell: React.FC<AppShellProps> = ({
  children,
  onOpenJournal,
  onOpenBreathwork,
}) => {
  const { activeTab, detailView, setActiveTab, setDetailView, toast, dismissToast, profile } =
    useHealthStore(
      useShallow((s) => ({
        activeTab: s.activeTab,
        detailView: s.detailView,
        setActiveTab: s.setActiveTab,
        setDetailView: s.setDetailView,
        toast: s.toast,
        dismissToast: s.dismissToast,
        profile: s.profile,
      }))
    );
  const { t } = useI18n();

  const navItems: {
    id: PrimaryTab;
    label: string;
    icon: React.FC<{ className?: string; strokeWidth?: number }>;
  }[] = [
    { id: 'today', label: t.nav.today, icon: Home },
    { id: 'activity', label: t.nav.activity, icon: Activity },
    { id: 'sleep', label: t.nav.sleep, icon: Moon },
    { id: 'nutrition', label: t.nav.nutrition, icon: Utensils },
    { id: 'more', label: t.nav.more, icon: MoreHorizontal },
  ];

  const viewKey = `${activeTab}:${detailView}`;
  const navVisible = useScrollVisibility({
    hideDelta: 16,
    showDelta: 8,
    topPinOffset: 48,
    resetKey: viewKey,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [viewKey]);

  // Conflict-free horizontal swipe gesture for tabs & detail back navigation
  const touchStartRef = useRef<{ x: number; y: number; time: number; blocked: boolean } | null>(
    null
  );

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) return;
    const target = e.target as HTMLElement | null;
    const blocked = Boolean(
      target?.closest('input, textarea, select, [data-no-tab-swipe="true"], .recharts-wrapper')
    );
    const t = e.touches[0];
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      time: Date.now(),
      blocked,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || start.blocked || e.changedTouches.length !== 1) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const elapsed = Date.now() - start.time;

    if (elapsed > 650 || Math.abs(dx) < 62 || Math.abs(dx) < Math.abs(dy) * 1.45) {
      return;
    }

    if (detailView !== 'none') {
      // Native iOS-style swipe right to go back from any detail view
      if (dx > 62) {
        triggerHaptic('selection');
        setDetailView('none');
      }
      return;
    }

    const idx = TAB_ORDER.indexOf(activeTab);
    if (dx < -62 && idx < TAB_ORDER.length - 1) {
      triggerHaptic('selection');
      setActiveTab(TAB_ORDER[idx + 1]);
    } else if (dx > 62 && idx > 0) {
      triggerHaptic('selection');
      setActiveTab(TAB_ORDER[idx - 1]);
    }
  };

  const handleSelectTab = (tab: PrimaryTab) => {
    if (tab !== activeTab || detailView !== 'none') {
      triggerHaptic('selection');
    }
    setActiveTab(tab);
  };

  // Map active detail views to the visually highlighted bottom pill icon
  const highlightedTab: PrimaryTab =
    detailView === 'sources' || detailView === 'aiPrivacy' || detailView === 'healthTrends'
      ? 'more'
      : detailView === 'recovery' || detailView === 'fitnessAge'
        ? 'today'
        : activeTab;

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] flex">
      {/* Desktop Obsidian Liquid Glass Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 bg-[var(--bg-surface)]/85 backdrop-blur-2xl border-r border-[var(--border-hairline)] z-30">
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[var(--accent-recovery)]/15 border border-[var(--accent-recovery)]/30 flex items-center justify-center">
              <Activity className="w-4 h-4 text-[var(--accent-recovery)]" />
            </div>
            <div>
              <p className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] leading-none">
                {de.brandName}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-none">
                {t.nav.localOnDevice}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = highlightedTab === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => handleSelectTab(item.id)}
                className={`relative w-full min-h-[44px] flex items-center gap-3 px-3.5 rounded-2xl text-[14px] font-medium transition-colors ${
                  isActive
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)]/60'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="desktopNavPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-hairline)]"
                  />
                )}
                <Icon className="relative z-10 w-[18px] h-[18px]" strokeWidth={isActive ? 2.2 : 1.8} />
                <span className="relative z-10">{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        <div className="px-3 pb-6 pt-4 border-t border-[var(--border-hairline)] space-y-2">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              triggerHaptic('light');
              onOpenBreathwork();
            }}
            className="w-full min-h-[42px] flex items-center gap-2.5 px-3.5 rounded-2xl bg-[var(--accent-recovery)]/10 text-[var(--accent-recovery)] hover:bg-[var(--accent-recovery)]/15 text-[13px] font-medium transition-colors"
          >
            <Wind className="w-4 h-4 shrink-0" />
            <span>{t.nav.breathworkAction}</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              triggerHaptic('light');
              onOpenJournal();
            }}
            className="w-full min-h-[42px] flex items-center gap-2.5 px-3.5 rounded-2xl bg-[var(--bg-well)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[13px] font-medium transition-colors"
          >
            <NotebookPen className="w-4 h-4 shrink-0" />
            <span>{t.nav.checkInAction}</span>
          </motion.button>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('selection');
              setActiveTab('more');
              setDetailView('none');
            }}
            className="w-full pt-2 px-2 flex items-center gap-2.5 text-left group"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-hairline)] flex items-center justify-center text-xs font-semibold text-[var(--text-primary)]">
              {(profile.displayName || 'M').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {profile.displayName}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">{t.nav.localOnDevice}</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Area (supports natural horizontal swipe between tabs & swipe-back) */}
      <main
        className="flex-1 lg:pl-64 min-w-0 overflow-x-clip"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="mx-auto w-full max-w-[540px] lg:max-w-[1040px] px-4 sm:px-6 lg:px-10 pt-5 sm:pt-7 pb-28 lg:pb-12">
          {children}
        </div>
      </main>

      {/* Mobile Floating Liquid Glass 5-Icon Bottom Pill — Dynamically hides on scroll down, springs back on scroll up */}
      <motion.div
        initial={false}
        animate={{
          y: navVisible ? 0 : 104,
          opacity: navVisible ? 1 : 0,
          scale: navVisible ? 1 : 0.92,
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 pointer-events-none flex justify-center px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))]"
      >
        <nav
          aria-label="Mobile Navigation"
          data-nav-visible={navVisible ? 'true' : 'false'}
          className={`${
            navVisible ? 'pointer-events-auto' : 'pointer-events-none'
          } liquid-glass rounded-full p-1.5 w-full max-w-[366px] grid grid-cols-5 items-center`}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = highlightedTab === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.88 }}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => handleSelectTab(item.id)}
                className={`relative h-[46px] flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-recovery)] ${
                  isActive
                    ? 'text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobileLiquidPill"
                    transition={{ type: 'spring', stiffness: 480, damping: 32 }}
                    className="absolute inset-0.5 rounded-full bg-black/[0.08] dark:bg-white/[0.13] border border-black/[0.05] dark:border-white/[0.12] shadow-sm"
                  />
                )}
                <Icon
                  className="relative z-10 w-[21px] h-[21px]"
                  strokeWidth={isActive ? 2.25 : 1.75}
                />
              </motion.button>
            );
          })}
        </nav>
      </motion.div>

      {/* Liquid Glass Floating Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 420, damping: 30 }}
            className="fixed top-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 liquid-glass rounded-2xl px-4 py-3 flex items-center gap-3"
            role="status"
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--accent-recovery)] shrink-0" />
            ) : toast.tone === 'warning' ? (
              <AlertTriangle className="w-4 h-4 text-[var(--accent-calories)] shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-[var(--accent-hrv)] shrink-0" />
            )}
            <p className="text-xs font-medium text-[var(--text-primary)] flex-1 leading-snug">
              {toast.text}
            </p>
            <button
              type="button"
              onClick={dismissToast}
              aria-label={t.common.close}
              className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
