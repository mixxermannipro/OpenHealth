import { getActiveBcp47, getActiveLocale, UI_TRANSLATIONS } from '../i18n/translations';

export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDaysToKey(dateKey: string, deltaDays: number): string {
  const dt = parseLocalDateKey(dateKey);
  dt.setDate(dt.getDate() + deltaDays);
  return toLocalDateKey(dt);
}

export function formatGermanFullDate(dateKey: string): string {
  const dt = parseLocalDateKey(dateKey);
  return new Intl.DateTimeFormat(getActiveBcp47(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(dt);
}

export function formatGermanShortDate(dateKey: string): string {
  const dt = parseLocalDateKey(dateKey);
  return new Intl.DateTimeFormat(getActiveBcp47(), {
    day: '2-digit',
    month: '2-digit',
  }).format(dt);
}

export function formatGermanDayChip(dateKey: string): { weekday: string; day: string } {
  const dt = parseLocalDateKey(dateKey);
  const weekday = new Intl.DateTimeFormat(getActiveBcp47(), { weekday: 'short' })
    .format(dt)
    .replace('.', '')
    .slice(0, 2);
  const day = String(dt.getDate());
  return { weekday, day };
}

export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  const locale = getActiveLocale();
  if (h === 0) return locale === 'de' ? `${m} Min.` : `${m} min`;
  return locale === 'de'
    ? `${h} Std. ${String(m).padStart(2, '0')} Min.`
    : `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatDurationCompact(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '—';
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatPace(secPerKm: number | null | undefined): string {
  if (!secPerKm || Number.isNaN(secPerKm)) return '—';
  const total = Math.round(secPerKm);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, '0')} min/km`;
}

export function formatClockFromIso(iso: string): string {
  const dt = new Date(iso);
  return new Intl.DateTimeFormat(getActiveBcp47(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(dt);
}

export function formatNumberDE(val: number | null | undefined, decimals = 0): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return new Intl.NumberFormat(getActiveBcp47(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function getDynamicGreeting(now: Date = new Date()): string {
  const g = UI_TRANSLATIONS[getActiveLocale()].greetings;
  const hour = now.getHours();
  if (hour < 11) return g.morning;
  if (hour < 17) return g.day;
  return g.evening;
}
