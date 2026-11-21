import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unerwarteter Darstellungsfehler.',
    };
  }

  componentDidCatch(error: Error) {
    // Keep silent in UI; log cleanly for diagnostics
    console.error('KADENZ ErrorBoundary:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-dvh bg-[#090A0C] text-[#F5F6F8] flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-[28px] bg-[#141518] border border-white/[0.09] p-6 space-y-4 text-center shadow-2xl">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FB7B6B]/15 text-[#FB7B6B] flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold tracking-tight">KADENZ wurde kurz unterbrochen</h1>
            <p className="text-sm text-[#A1A4AE] leading-relaxed">
              Deine lokalen Gesundheitsdaten in IndexedDB sind sicher gespeichert. Lade die Ansicht
              einfach neu.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full min-h-[46px] rounded-full bg-white text-[#090A0C] text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            App neu laden
          </button>
        </div>
      </div>
    );
  }
}
