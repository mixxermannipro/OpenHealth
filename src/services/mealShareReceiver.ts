/**
 * Local-First Incoming Share-Intent & Deep-Link Receiver.
 *
 * Handles:
 * 1. Android Web Share Target (`Intent.ACTION_SEND` with `text/plain`) via `/share-meal?title=...&text=...&url=...`
 *    on both cold start and running app (`singleTop` / `popstate` / custom event).
 * 2. Custom URL Schemes (`caltrack://log?name=...&kcal=...&p=...&c=...&f=...`,
 *    `web+caltrack://...`, `web+kadenz://...`) passed via `protocol_handlers` (`/?protocol=...`)
 *    or direct query params (`/?meal=...&kcal=...`).
 */

export interface IncomingSharePayload {
  rawText: string;
  origin: 'share_intent' | 'deeplink';
  receivedAt: number;
}

const SHARE_INTENT_EVENT = 'kadenz:share-intent';

/**
 * Extracts an incoming share payload from a URL (current window.location on cold start
 * or incoming navigation event while the app is already running).
 */
export function extractIncomingShareFromLocation(
  loc: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location
): IncomingSharePayload | null {
  try {
    const params = new URLSearchParams(loc.search);

    // 1. Registered Web Protocol Handler: /?protocol=web%2Bcaltrack%3A%2F%2Flog%3F...
    const protocolParam = params.get('protocol');
    if (protocolParam && protocolParam.trim().length > 0) {
      return {
        rawText: protocolParam.trim(),
        origin: 'deeplink',
        receivedAt: Date.now(),
      };
    }

    // 2. Android Web Share Target (ACTION_SEND text/plain -> /share-meal?title=...&text=...&url=...)
    const isShareRoute = loc.pathname.replace(/\/+$/, '').endsWith('/share-meal');
    const sharedText = params.get('text') || params.get('share') || params.get('payload');
    const sharedTitle = params.get('title') || '';
    const sharedUrl = params.get('url') || '';

    if (isShareRoute || sharedText) {
      const parts = [sharedTitle, sharedText ?? '', sharedUrl]
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (parts.length > 0) {
        return {
          rawText: parts.join('\n'),
          origin: 'share_intent',
          receivedAt: Date.now(),
        };
      }
    }

    // 3. Direct query-param deep link (/?name=...&kcal=...&p=...&c=...&f=...)
    if (params.get('kcal') || params.get('calories')) {
      return {
        rawText: `caltrack://log${loc.search}`,
        origin: 'deeplink',
        receivedAt: Date.now(),
      };
    }

    // 4. Hash-based deep link (#share=... or #caltrack://...)
    if (loc.hash && loc.hash.length > 2) {
      const hashBody = decodeURIComponent(loc.hash.slice(1));
      if (/^(?:web\+)?(?:caltrack|kadenz):\/\//i.test(hashBody)) {
        return {
          rawText: hashBody,
          origin: 'deeplink',
          receivedAt: Date.now(),
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cleans share query parameters from the browser address bar after consumption
 * so refreshing the page does not re-trigger the same import twice.
 */
export function clearConsumedShareUrl(): void {
  try {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    const url = new URL(window.location.href);
    const isShareRoute = url.pathname.replace(/\/+$/, '').endsWith('/share-meal');
    const keysToRemove = [
      'text',
      'title',
      'url',
      'share',
      'payload',
      'protocol',
      'name',
      'meal',
      'kcal',
      'calories',
      'p',
      'protein',
      'protein_g',
      'c',
      'carbs',
      'carbs_g',
      'f',
      'fat',
      'fat_g',
      'fiber',
      'category',
    ];
    let changed = isShareRoute;
    for (const k of keysToRemove) {
      if (url.searchParams.has(k)) {
        url.searchParams.delete(k);
        changed = true;
      }
    }
    if (isShareRoute) {
      url.pathname = '/';
    }
    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}`);
    }
  } catch {
    // ignore history API restrictions
  }
}

/**
 * Dispatches an in-app Share Intent event (used by BroadcastChannel / Capacitor onNewIntent bridge).
 */
export function dispatchIncomingShareIntent(payload: IncomingSharePayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<IncomingSharePayload>(SHARE_INTENT_EVENT, { detail: payload }));
}

import { subscribeToNativeIntents } from './androidBridge';

/**
 * Subscribes to both cold-start URL share payloads, native Android Intents
 * (`ACTION_SEND`, `caltrack://`, `kadenz://`, launcher shortcuts), and running-app
 * (`onNewIntent` / `popstate` / `hashchange` / `BroadcastChannel`) share payloads.
 */
export function subscribeToIncomingMealShares(
  onReceive: (payload: IncomingSharePayload) => void,
  onTabShortcut?: (tab: string) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const checkCurrentUrl = () => {
    const extracted = extractIncomingShareFromLocation(window.location);
    if (extracted) {
      clearConsumedShareUrl();
      onReceive(extracted);
    }
  };

  // Cold start check (web URL)
  checkCurrentUrl();

  // Native Android cold-start & warm onNewIntent bridge
  const unsubscribeNative = subscribeToNativeIntents((event) => {
    if (event.kind === 'tab_shortcut') {
      onTabShortcut?.(event.rawText);
      return;
    }
    onReceive({
      rawText: event.rawText,
      origin: event.kind === 'deeplink' ? 'deeplink' : 'share_intent',
      receivedAt: event.receivedAt,
    });
  });

  // Running app listeners (singleTop / hash / history / ServiceWorker BroadcastChannel)
  const handleCustomEvent = (e: Event) => {
    const custom = e as CustomEvent<IncomingSharePayload>;
    if (custom.detail?.rawText) {
      onReceive(custom.detail);
    }
  };

  window.addEventListener('popstate', checkCurrentUrl);
  window.addEventListener('hashchange', checkCurrentUrl);
  window.addEventListener(SHARE_INTENT_EVENT, handleCustomEvent);

  let channel: BroadcastChannel | null = null;
  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel('kadenz-share-target');
      channel.onmessage = (event) => {
        const data = event.data as IncomingSharePayload | undefined;
        if (data?.rawText) {
          onReceive(data);
        }
      };
    }
  } catch {
    // BroadcastChannel unavailable in restricted contexts
  }

  return () => {
    unsubscribeNative();
    window.removeEventListener('popstate', checkCurrentUrl);
    window.removeEventListener('hashchange', checkCurrentUrl);
    window.removeEventListener(SHARE_INTENT_EVENT, handleCustomEvent);
    channel?.close();
  };
}
