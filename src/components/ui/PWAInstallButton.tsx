import React, { useState } from 'react';
import { Download, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../../hooks/usePWA';
import { BottomSheet } from './BottomSheet';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-full bg-[var(--text-primary)] text-[var(--bg-canvas)] px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        <Download className="w-4 h-4" />
        Als App installieren
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-full bg-[var(--bg-well)] px-4 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <Download className="w-4 h-4" />
          Auf iOS-Home-Bildschirm installieren
        </button>

        <BottomSheet
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="Auf iPhone / iPad installieren"
        >
          <ol className="space-y-3 text-sm text-[var(--text-secondary)] list-decimal pl-5">
            <li>
              Tippe in der Safari-Symbolleiste unten auf <strong className="text-[var(--text-primary)]">Teilen</strong>.
            </li>
            <li>
              Scrolle nach unten und wähle <strong className="text-[var(--text-primary)]">Zum Home-Bildschirm</strong>.
            </li>
            <li>
              Bestätige rechts oben mit <strong className="text-[var(--text-primary)]">Hinzufügen</strong>.
            </li>
          </ol>
        </BottomSheet>
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-24 lg:bottom-6 left-4 z-40 flex items-center gap-2 rounded-full bg-[var(--bg-glass)] backdrop-blur-2xl backdrop-saturate-150 border border-[var(--border-hairline)] px-3.5 py-2 text-xs font-medium text-[var(--text-primary)] shadow-lg"
    >
      <WifiOff className="w-3.5 h-3.5 text-[var(--accent-load)]" aria-hidden="true" />
      <span>Offline-Modus · Lokale Daten aktiv</span>
    </div>
  );
};
