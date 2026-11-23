import React from 'react';
import { BottomSheet } from './BottomSheet';
import { ExplanationTopic } from '../../i18n/de';
import { getExplanation } from '../../i18n/translations';
import { useI18n } from '../../i18n/useI18n';

export type { ExplanationTopic };

interface ExplanationSheetProps {
  topic: ExplanationTopic | null;
  onClose: () => void;
}

export const ExplanationSheet: React.FC<ExplanationSheetProps> = ({ topic, onClose }) => {
  const { t, locale } = useI18n();
  const data = topic ? getExplanation(topic, locale) : null;

  return (
    <BottomSheet
      open={Boolean(topic)}
      onClose={onClose}
      title={data?.title || t.explanation.defaultTitle}
      subtitle={t.explanation.subtitle}
    >
      {data && (
        <div className="space-y-6 text-sm text-[var(--text-secondary)] leading-relaxed">
          {/* Calm editorial summary without nested box */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-[var(--text-muted)]">
              {t.explanation.shortSummary}
            </h3>
            <p className="font-editorial text-[16px] leading-relaxed text-[var(--text-primary)]">
              {data.whatItMeans}
            </p>
          </div>

          {/* Apple grouped calculation list */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--text-muted)]">
              {t.explanation.howCalculated}
            </h3>
            <ul className="rounded-2xl bg-[var(--bg-canvas)]/80 dark:bg-[var(--bg-elevated)]/65 divide-y divide-[var(--border-hairline)] overflow-hidden">
              {data.howCalculated.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 px-4 py-3.5 text-xs sm:text-sm text-[var(--text-primary)]"
                >
                  <span className="text-xs font-semibold tabular-nums text-[var(--accent-sleep)] mt-0.5 shrink-0">
                    {idx + 1}.
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Practical takeaway */}
          <div className="rounded-2xl bg-[var(--accent-recovery)]/10 px-4 py-3.5 text-xs sm:text-sm">
            <span className="font-semibold text-[var(--accent-recovery)] block mb-1">
              {t.explanation.whatItMeansForYou}
            </span>
            <span className="text-[var(--text-primary)]">{data.whatToDo}</span>
          </div>

          {/* Quiet technical note for the curious */}
          <div className="pt-3 border-t border-[var(--border-hairline)] text-xs text-[var(--text-muted)] leading-relaxed">
            <span className="font-medium text-[var(--text-secondary)]">
              {t.explanation.technicalLabel}:{' '}
            </span>
            {data.technicalNote}
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
