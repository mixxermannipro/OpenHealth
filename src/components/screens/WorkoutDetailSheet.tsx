import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { BottomSheet } from '../ui/BottomSheet';
import { WorkoutSession } from '../../types/health';
import { useHealthStore } from '../../store/useHealthStore';
import { getHRZones } from '../../engine/calculations';
import { de } from '../../i18n/de';
import {
  formatClockFromIso,
  formatGermanFullDate,
  formatNumberDE,
  formatPace,
} from '../../utils/formatters';
import { WorkoutPaceHRChart } from '../charts/WorkoutPaceHRChart';
import { HRZonesChart } from '../charts/HRZonesChart';
import { haptics } from '../../utils/haptics';

interface WorkoutDetailSheetProps {
  workout: WorkoutSession | null;
  onClose: () => void;
}

function formatDurationMmSs(minutes: number): string {
  const whole = Math.floor(Math.max(0, minutes));
  const secs = Math.round((Math.max(0, minutes) - whole) * 60);
  if (secs === 60) return `${whole + 1}:00 Min.`;
  return `${whole}:${String(secs).padStart(2, '0')} Min.`;
}

export const WorkoutDetailSheet: React.FC<WorkoutDetailSheetProps> = ({ workout, onClose }) => {
  const { profile, workouts, deleteWorkout } = useHealthStore(
    useShallow((s) => ({
      profile: s.profile,
      workouts: s.workouts,
      deleteWorkout: s.deleteWorkout,
    }))
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [workout?.id]);

  const zones = useMemo(
    () => getHRZones(profile, profile.restingHrBaselineManual ?? 55),
    [profile]
  );

  const comparablePrev = useMemo(() => {
    if (!workout) return null;
    return workouts
      .filter((w) => w.id !== workout.id && w.sport === workout.sport && w.date < workout.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
  }, [workout, workouts]);

  const strengthVolumeKg = useMemo(() => {
    if (!workout?.exercises) return null;
    return workout.exercises.reduce(
      (sum, ex) => sum + (ex.weightKg ? ex.sets * ex.reps * ex.weightKg : 0),
      0
    );
  }, [workout]);

  return (
    <BottomSheet
      open={Boolean(workout)}
      onClose={onClose}
      title={workout?.title || 'Aktivitätsdetails'}
      subtitle={
        workout
          ? `${de.sports[workout.sport]} · ${formatGermanFullDate(workout.date)}, ${formatClockFromIso(
              workout.startTimeIso
            )} · ${de.providers[workout.sourceProvider]}`
          : undefined
      }
      maxWidthClass="sm:max-w-2xl"
    >
      {workout && (
        <div className="space-y-5">
          {/* Primary Stats Grid — Apple Clean Hairline Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-4 pb-4 border-b border-[var(--border-hairline)]">
            {workout.distanceKm !== undefined && (
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Distanz</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {formatNumberDE(workout.distanceKm, 2)} km
                </div>
              </div>
            )}
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">Dauer</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums">
                {formatDurationMmSs(workout.durationMinutes)}
              </div>
            </div>
            {workout.avgPaceSecPerKm !== undefined && (
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Ø Tempo</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {formatPace(workout.avgPaceSecPerKm)}
                </div>
              </div>
            )}
            {workout.avgHrBpm !== undefined && (
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Ø Puls</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {workout.avgHrBpm} /min
                </div>
              </div>
            )}
            {workout.maxHrBpm !== undefined && (
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Höchster Puls</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {workout.maxHrBpm} /min
                </div>
              </div>
            )}
            {workout.cadenceSpm !== undefined && (
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Schritte / Min.</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {workout.cadenceSpm}
                </div>
              </div>
            )}
            {workout.elevationGainM !== undefined && (
              <div>
                <div className="text-[11px] text-[var(--text-muted)]">Höhenmeter</div>
                <div className="mt-0.5 text-base font-semibold tabular-nums">
                  {workout.elevationGainM} m
                </div>
              </div>
            )}
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">Anstrengung</div>
              <div className="mt-0.5 text-base font-semibold tabular-nums text-[var(--accent-load)]">
                {workout.normalizedLoad} / 100
              </div>
            </div>
          </div>

          <p className="text-[11px] text-[var(--text-muted)]">
            Datenherkunft: {de.provenance[workout.provenance]} · Die Anstrengung berechnet die App aus Dauer, deinem Pulsbereich und der Sportart.
          </p>

          {/* Pace & HR Chart */}
          {workout.timeSeries && workout.timeSeries.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Puls- &amp; Tempo-Verlauf
              </h3>
              <WorkoutPaceHRChart points={workout.timeSeries} />
            </div>
          )}

          {/* HR Zones */}
          {workout.hrZoneMinutes && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                Pulsbereiche dieser Einheit
              </h3>
              <HRZonesChart zones={zones} zoneMinutes={workout.hrZoneMinutes} />
            </div>
          )}

          {/* Kilometer Splits */}
          {workout.splits && workout.splits.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[var(--text-primary)]">Abschnitte pro Kilometer</h3>
              <div className="rounded-2xl border border-[var(--border-hairline)] overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[var(--bg-elevated)]/65 text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-3 py-2 font-medium">km</th>
                      <th className="px-3 py-2 font-medium">Tempo</th>
                      <th className="px-3 py-2 font-medium">Ø Puls</th>
                      <th className="px-3 py-2 font-medium text-right">Höhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-hairline)] font-mono tabular-nums">
                    {workout.splits.map((s) => (
                      <tr key={s.km}>
                        <td className="px-3 py-2">{s.km}</td>
                        <td className="px-3 py-2">{formatPace(s.paceSecPerKm)}</td>
                        <td className="px-3 py-2">{s.avgHrBpm} /min</td>
                        <td className="px-3 py-2 text-right">
                          {s.elevationDiffM >= 0 ? '+' : ''}
                          {s.elevationDiffM} m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Strength Exercises (only when logged) */}
          {workout.sport === 'strength' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[var(--text-primary)]">
                  Krafttrainings-Details
                </h3>
                {strengthVolumeKg !== null && strengthVolumeKg > 0 && (
                  <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">
                    Gesamtgewicht ca. {formatNumberDE(strengthVolumeKg)} kg · Gefühl {workout.rpe ?? '—'}/10
                  </span>
                )}
              </div>

              {workout.hasDetailedExerciseLog && workout.exercises ? (
                <div className="rounded-2xl border border-[var(--border-hairline)] divide-y divide-[var(--border-hairline)]">
                  {workout.exercises.map((ex, i) => (
                    <div key={i} className="px-3.5 py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-[var(--text-primary)]">{ex.name}</span>
                      <span className="font-mono tabular-nums text-[var(--text-secondary)]">
                        {ex.sets} × {ex.reps}
                        {ex.weightKg ? ` · ${ex.weightKg} kg` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] rounded-xl bg-[var(--bg-elevated)]/50 p-3">
                  Für diese Einheit liegt nur eine Zusammenfassung vor; einzelne Übungen werden nicht künstlich ergänzt.
                </p>
              )}
            </div>
          )}

          {/* Comparable Workout */}
          {comparablePrev && (
            <div className="rounded-2xl bg-[var(--bg-elevated)]/55 border border-[var(--border-hairline)] p-3.5 text-xs space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">
                Vergleich mit vorheriger Einheit ({comparablePrev.title})
              </div>
              <div className="text-[var(--text-secondary)] font-mono tabular-nums">
                Dauer {formatDurationMmSs(comparablePrev.durationMinutes)}
                {comparablePrev.avgHrBpm ? ` · Ø Puls ${comparablePrev.avgHrBpm} /min` : ''} · Anstrengung{' '}
                {comparablePrev.normalizedLoad}/100
              </div>
            </div>
          )}

          {/* Delete Single Workout Action */}
          <div className="pt-2 border-t border-[var(--border-hairline)] flex items-center justify-end gap-2">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="min-h-[38px] rounded-full bg-[var(--bg-well)] px-3.5 text-xs font-medium text-[var(--text-secondary)]"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    haptics.light();
                    await deleteWorkout(workout.id);
                    onClose();
                  }}
                  className="min-h-[38px] rounded-full bg-[var(--accent-strain)] text-[#090A0C] px-4 text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Endgültig löschen</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  haptics.tick();
                  setConfirmDelete(true);
                }}
                className="min-h-[38px] rounded-full bg-[var(--bg-well)] hover:bg-[var(--accent-strain)]/15 hover:text-[var(--accent-strain)] px-3.5 text-xs font-medium text-[var(--text-secondary)] inline-flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Training löschen</span>
              </button>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
};
