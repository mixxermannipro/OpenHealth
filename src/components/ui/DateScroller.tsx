import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDaysToKey, formatGermanDayChip, formatGermanShortDate } from '../../utils/formatters';

interface DateScrollerProps {
  selectedDate: string;
  todayKey: string;
  onSelectDate: (dateKey: string) => void;
}

export const DateScroller: React.FC<DateScrollerProps> = ({
  selectedDate,
  todayKey,
  onSelectDate,
}) => {
  const windowEnd =
    selectedDate > addDaysToKey(todayKey, -3) ? todayKey : addDaysToKey(selectedDate, 3);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(windowEnd, i - 6));
  const minDate = addDaysToKey(todayKey, -179);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={() => {
          const prev = addDaysToKey(selectedDate, -1);
          if (prev >= minDate) onSelectDate(prev);
        }}
        disabled={selectedDate <= minDate}
        aria-label="Vorheriger Tag"
        className="min-h-[44px] min-w-[38px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] disabled:opacity-30 transition-colors shrink-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div
        className="flex-1 grid grid-cols-7 gap-1 sm:gap-1.5 rounded-2xl bg-[var(--bg-surface)] shadow-[var(--surface-shadow)] p-1.5"
        role="group"
        aria-label="Datumsauswahl"
      >
        {days.map((dk) => {
          const { weekday, day } = formatGermanDayChip(dk);
          const isSelected = dk === selectedDate;
          const isToday = dk === todayKey;
          return (
            <button
              key={dk}
              type="button"
              onClick={() => onSelectDate(dk)}
              aria-pressed={isSelected}
              aria-label={`${weekday} ${formatGermanShortDate(dk)}${isToday ? ' (Heute)' : ''}`}
              className={`min-h-[46px] flex flex-col items-center justify-center rounded-xl text-center transition-colors ${
                isSelected
                  ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-well)]/70'
              }`}
            >
              <span className="text-[10px] leading-none opacity-75">{weekday}</span>
              <span className="mt-1 text-xs sm:text-sm tabular-nums leading-none">{day}</span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          const next = addDaysToKey(selectedDate, 1);
          if (next <= todayKey) onSelectDate(next);
        }}
        disabled={selectedDate >= todayKey}
        aria-label="Nächster Tag"
        className="min-h-[44px] min-w-[38px] flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-well)] disabled:opacity-30 transition-colors shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      <label
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-[var(--bg-surface)] shadow-[var(--surface-shadow)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer shrink-0 transition-colors"
        title="Datum im Kalender wählen"
      >
        <Calendar className="w-4 h-4" aria-hidden="true" />
        <input
          type="date"
          aria-label="Datum direkt auswählen"
          min={minDate}
          max={todayKey}
          value={selectedDate}
          onChange={(e) => {
            if (e.target.value) onSelectDate(e.target.value);
          }}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>
    </div>
  );
};
