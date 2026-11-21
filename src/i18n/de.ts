import { DeviceProviderId, GoalOption, SportType } from '../types/health';

export type ExplanationTopic =
  | 'recovery'
  | 'sleep'
  | 'trainingLoad'
  | 'fitnessAge'
  | 'hrv'
  | 'rhr'
  | 'steps'
  | 'cardioFitness'
  | 'recommendation'
  | 'recoveryFactors'
  | 'recoveryTrend'
  | 'recoveryVsLoad'
  | 'sleepVsRecovery'
  | 'sleepStages'
  | 'sleepTrend'
  | 'hrZones'
  | 'loadBalance'
  | 'simulator'
  | 'biometrics'
  | 'correlations'
  | 'nutrition'
  | 'strain21'
  | 'breathwork';

export interface ExplanationEntry {
  title: string;
  whatItMeans: string;
  howCalculated: string[];
  whatToDo: string;
  technicalNote: string;
}

export const de = {
  brandName: 'KADENZ',
  brandSubtitle: 'Local-First Health & Performance',
  nav: {
    today: 'Heute',
    activity: 'Belastung',
    sleep: 'Schlaf',
    nutrition: 'Essen',
    more: 'Mehr',
    recovery: 'Erholung',
    health: 'Körper',
  },
  sports: {
    running: 'Laufen',
    walking: 'Spazieren & Gehen',
    cycling: 'Radfahren',
    strength: 'Krafttraining',
    calisthenics: 'Eigengewicht-Training',
    swimming: 'Schwimmen',
    hiking: 'Wandern',
    football: 'Fußball',
    other: 'Sonstiges',
  } as Record<SportType, string>,
  goals: {
    cardiovascular: 'Herz & Kreislauf stärken',
    run_faster: 'Schneller laufen',
    improve_recovery: 'Besser erholen',
    improve_sleep: 'Erholsamer schlafen',
    increase_strength: 'Mehr Kraft aufbauen',
    build_muscle: 'Muskeln aufbauen',
    improve_endurance: 'Länger durchhalten',
    reduce_fatigue: 'Erschöpfung abbauen',
    long_term_health: 'Langfristig gesund bleiben',
    general_fitness: 'Allgemein fit bleiben',
  } as Record<GoalOption, string>,
  providers: {
    garmin: 'Garmin',
    coros: 'COROS',
    polar: 'Polar',
    suunto: 'Suunto',
    apple_health: 'Apple Health',
    health_connect: 'Health Connect',
    samsung_health: 'Samsung Health',
    fitbit: 'Fitbit',
    amazfit: 'Amazfit / Zepp',
    withings: 'Withings',
    oura: 'Oura',
    other: 'Weitere Quelle',
  } as Record<DeviceProviderId, string>,
  scenarios: {
    balanced: {
      label: 'Ausgeglichener Alltag',
      description: 'Regelmäßiges Laufen, ruhiger Schlaf, passende Anstrengung und frische Energie.',
    },
    fatigued: {
      label: 'Erschöpft & überlastet',
      description: 'Mehrere harte Tage hintereinander, zu wenig Schlaf, hoher Morgenpuls und Schon-Hinweis.',
    },
    recovering: {
      label: 'Auf dem Weg zurück',
      description: 'Ruhigere Tage, wieder konstanter Schlaf und langsam steigende Frische.',
    },
  },
  confidence: {
    good: 'Verlässliche Daten',
    limited: 'Teilweise Daten',
    insufficient: 'Zu wenig Daten',
  },
  provenance: {
    measured: 'Direkt gemessen',
    wearable_estimate: 'Uhr-/Ring-Schätzung',
    app_estimate: 'Aus deinen Daten berechnet',
    missing: 'Kein Wert vorhanden',
  },
  explanations: {
    recovery: {
      title: 'Wie wird dein Erholungswert berechnet?',
      whatItMeans:
        'Der Erholungswert (0–100 %) kombiniert deine objektiven Körperwerte mit deinem persönlichen Tagesgefühl — für ein ehrliches Bild deiner Tagesform.',
      howCalculated: [
        '27 % Nerven-Erholung (HRV): Wie ruhig und flexibel dein Herzschlag nachts zwischen den Schlägen war — verglichen mit deinem eigenen 4-Wochen-Schnitt.',
        '23 % Schlaf & Schlafkonto: Schlafdauer, Effizienz, Gleichmäßigkeit sowie dein subjektives Schlafgefühl.',
        '18 % Dein Gefühl heute: Wie energiegeladen du dich fühlst, wie erholsam sich dein Schlaf angefühlt hat plus Müdigkeit, Muskelkater & Stress.',
        '17 % Morgenpuls in Ruhe: Ein niedrigerer Ruhepuls spricht für Erholung; ein deutlich erhöhter Puls deutet oft auf Stress oder Infekte hin.',
        '15 % Letzte Anstrengung: Wie fordernd gestern und die letzten 7 Tage im Verhältnis zum Monat waren.',
      ],
      whatToDo:
        'Hast du den täglichen Check-in noch nicht ausgefüllt, werden keine Werte erfunden — die objektiven Messwerte teilen sich dann anteilig die 100 %. Bei geringer Energie oder Krankheitssymptomen wird dein Belastungsziel bewusst gedrosselt.',
      technicalNote:
        'Fachgrundlage: lnRMSSD Z-Score (Plews et al., 2013), Ruhepuls (RHR), EWMA-Last und subjektive Wohlbefindens-Gewichtung nach Saw, Main & Gastin (2016, Br J Sports Med). Keine medizinische Diagnose.',
    },
    sleep: {
      title: 'Wie wird dein Schlafwert berechnet?',
      whatItMeans:
        'Der Schlafwert (0–100 Punkte) verbindet deine gemessenen Schlafdaten (82 %) mit deinem eigenen Gefühl nach dem Aufwachen (18 %).',
      howCalculated: [
        '82 % Objektive Schlafdaten: Schlafdauer im Verhältnis zum Ziel (45 %), ruhige Schlafeffizienz (20 %), Gleichmäßigkeit der Einschlafzeit (20 %) und Tief-/Traumschlaf (15 %).',
        '18 % Dein gefühlter Schlaf: Wenn du im Tages-Check-in angibst, wie gut du geschlafen hast, fließt dieser Eindruck gezielt ein — ideal, wenn sich eine Nacht anders anfühlt, als die Uhr misst.',
        'Schlaf-Check noch offen? Dann zählt der Schlafwert zu 100 % aus deinen objektiven Schlafdaten.',
      ],
      whatToDo:
        'Regelmäßige Zubettgehzeiten und ein rechtzeitiger Koffein-Stopp (ca. 9 Stunden vor dem Schlafen) stärken sowohl Tiefschlaf als auch das morgendliche Gefühl.',
      technicalNote:
        'Fachbegriffe dahinter: Schlafeffizienz (%), zirkadiane Regelmäßigkeit, Tief-/REM-Anteile und subjektive Schlafqualität (82/18-Hybridmodell).',
    },
    trainingLoad: {
      title: 'Wie wird deine Anstrengung (0–100) berechnet?',
      whatItMeans:
        'Dieser Wert zeigt, wie stark eine einzelne Einheit oder dein ganzer Tag deinen Körper gefordert hat — von 0 (Ruhetag) bis 100 (sehr harte Belastung).',
      howCalculated: [
        'Dauer & Pulshöhe: Je länger und je höher dein Puls im Verhältnis zu deinem eigenen Bereich liegt, desto mehr Anstrengung entsteht.',
        'Sportart & Gefühl: Bei Krafttraining steigt der Puls oft weniger stark — deshalb fließt dort zusätzlich ein, wie hart sich die Einheit für dich angefühlt hat.',
        'Glatte Skala (0–100): Die rohe Tagesanstrengung wird so umgerechnet, dass leichte Einheiten schnell sichtbar sind, extrem lange Tage aber sauber bei maximal 100 bleiben.',
      ],
      whatToDo:
        'Abwechslung zwischen anstrengenden Tagen (über 55) und ruhigen Tagen (unter 30) hilft dem Körper, stärker zu werden.',
      technicalNote:
        'Fachbegriffe dahinter: TRIMP-ähnliche Rohbelastung aus Herzfrequenzreserve (HRR), RPE (subjektive Anstrengung 1–10) und logarithmischer Tages-Skalierung.',
    },
    fitnessAge: {
      title: 'Wie wird dein Fitnessalter berechnet?',
      whatItMeans:
        'Das Fitnessalter schätzt anhand deiner letzten 4–12 Wochen, ob dein Herz-Kreislauf-System und deine Erholung jünger oder älter wirken als dein chronologisches Alter.',
      howCalculated: [
        'Herzfrequenzvariabilität (lnRMSSD): Vergleicht deine 28-Tage-HRV mit altersnormativen Referenzwerten.',
        'Ruhepuls: Ein niedrigerer 28-Tage-Ruhepuls senkt das geschätzte Fitnessalter spürbar.',
        'Schlaf: Konstante Schlafdauer über 7+ Stunden verbessert den Wert langfristig.',
        'VO2max-Schätzung (HUNT-Studie): Vergleicht deine Ausdauerleistung mit der Alters- und Geschlechtsnorm nach Nes et al. (2014).',
      ],
      whatToDo:
        'Ein einzelnes Training ändert das Fitnessalter kaum — entscheidend sind konstante Schlaf-, Ausdauer- und Kraftgewohnheiten über mehrere Wochen.',
      technicalNote:
        'Wissenschaftliche Grundlage: HUNT Fitness Study (Nes et al., Med Sci Sports Exerc 2014) erweitert um lnRMSSD-HRV-Normwerte (Shaffer & Ginsberg 2017) und Schlafkonsistenz.',
    },
    hrv: {
      title: 'Was bedeutet Nerven-Erholung?',
      whatItMeans:
        'Dein Herz schlägt nicht wie ein Metronom exakt im selben Takt — kleine Pausen-Unterschiede zwischen den Schlägen zeigen, wie entspannt dein Nervensystem nachts war.',
      howCalculated: [
        'Gemessen wird der durchschnittliche Unterschied zwischen aufeinanderfolgenden Herzschlägen im Schlaf (in Millisekunden, ms).',
        'Dieser Wert wird mit deinem eigenen Durchschnitt der letzten 4 Wochen verglichen — nicht mit fremden Personen.',
        'Leicht höhere Werte sprechen meist für gute Erholung; sehr plötzliche Ausschläge werden vorsichtig abgefedert.',
      ],
      whatToDo:
        'Wichtiger als die absolute Zahl ist der Vergleich zu deiner eigenen Basis: Fällt der Wert mehrere Tage deutlich ab, tut ein ruhigerer Tag gut.',
      technicalNote: 'Fachbegriff: Herzfrequenzvariabilität (HRV, Messwert RMSSD in ms).',
    },
    rhr: {
      title: 'Was sagt dein Morgenpuls in Ruhe aus?',
      whatItMeans:
        'Dein Morgenpuls zeigt, wie oft dein Herz pro Minute schlägt, wenn du nachts oder direkt nach dem Aufwachen völlig entspannt bist.',
      howCalculated: [
        'Erfasst wird der niedrigste ruhige Pulswert während der Nacht oder am Morgen (in Schlägen pro Minute).',
        'Wir vergleichen ihn mit deinem eigenen 4-Wochen-Durchschnitt.',
      ],
      whatToDo:
        'Sinkt dein Ruhewert über Wochen um 2–3 Schläge, wird dein Herz oft kräftiger. Ist er plötzlich deutlich höher, braucht dein Körper vielleicht mehr Schlaf oder Ruhe.',
      technicalNote: 'Fachbegriff: Ruhepuls (RHR in bpm).',
    },
    steps: {
      title: 'Schritte & aktive Bewegung',
      whatItMeans:
        'Zeigt deine gesamte Alltagsbewegung — vom Spaziergang über Treppensteigen bis zum Sport.',
      howCalculated: [
        'Deine Uhr oder dein Smartphone zählt Schritte und rechnet Minuten zusammen, in denen du spürbar in Bewegung warst.',
        'Daraus wird auch der ungefähre gesamte Energieverbrauch des Tages geschätzt.',
      ],
      whatToDo:
        'Auch an Tagen ohne Sport halten ruhige Alltags-Schritte den Kreislauf in Schwung, ohne dich zusätzlich zu ermüden.',
      technicalNote: 'Fachbegriffe: Schrittzahl, aktive Minuten und geschätzter Gesamtenergieumsatz (kcal).',
    },
    cardioFitness: {
      title: 'Was ist deine Ausdauer-Fitness?',
      whatItMeans:
        'Diese Zahl beschreibt, wie gut dein Körper bei Bewegung Sauerstoff aufnehmen und bis in die Muskeln transportieren kann.',
      howCalculated: [
        'Deine Sportuhr schätzt diesen Wert aus dem Verhältnis von Lauftempo und Herzfrequenz.',
        'Je schneller du bei gleichem Puls laufen kannst, desto höher steigt die Schätzung.',
      ],
      whatToDo:
        'Regelmäßiges ruhiges Grundlagentraining plus gelegentliche flotte Läufe heben diesen Wert über Monate langsam an.',
      technicalNote: 'Fachbegriff: Geschätzte VO₂max in ml/kg/min (Wearable-Schätzwert).',
    },
    recommendation: {
      title: 'Wie entsteht die heutige Empfehlung?',
      whatItMeans:
        'Die App prüft jeden Morgen mehrere Signale zusammen und schlägt eine passende Intensität für heute vor.',
      howCalculated: [
        'Prüfung deiner heutigen Erholung und der letzten Schlafnacht.',
        'Blick auf die letzten 3–7 Tage: Gab es schon viele harte Einheiten hintereinander?',
        'Sicherheits-Check mit deinem Tagebuch: Bei starkem Muskelkater, großer Müdigkeit oder Krankheitssymptomen wird automatisch zu Schonung geraten.',
      ],
      whatToDo:
        'Sieh den Vorschlag als freundlichen Kompass — wenn sich deine Beine beim Loslaufen deutlich schwerer anfühlen als gedacht, nimm einfach Tempo raus.',
      technicalNote:
        'Deterministisches Regelwerk ohne Cloud-KI; berücksichtigt persönliche Ziele, Datenverfügbarkeit und konservative Schutzregeln.',
    },
    recoveryFactors: {
      title: 'Wie teilen sich die Einflussfaktoren auf?',
      whatItMeans:
        'Jeder Balken zeigt dir, wie gut ein einzelner Bereich heute abgeschnitten hat und wie stark er in deinen gesamten Erholungswert eingeflossen ist.',
      howCalculated: [
        'Vollständige Daten: Nerven-Erholung 27 %, Schlaf 23 %, Dein Gefühl heute 18 %, Morgenpuls 17 %, Letzte Anstrengung 15 %.',
        'Fehlt z. B. der tägliche Gefühls-Check-in, teilen sich die übrigen Messwerte die 100 % anteilig neu auf.',
      ],
      whatToDo:
        'So erkennst du sofort den Grund für einen niedrigeren Wert — ob es kurzer Schlaf, harte Belastung oder dein eigenes Energiegefühl war.',
      technicalNote: 'Adaptive Re-Gewichtung bei fehlenden Signalen ohne künstliche Imputation; subjektive Gewichtung nach Saw et al. (2016).',
    },
    recoveryTrend: {
      title: 'Verlauf deiner Erholung',
      whatItMeans:
        'Die Kurve zeigt, wie stark sich dein Körper in den letzten 7 oder 30 Tagen von Tag zu Tag erholen konnte.',
      howCalculated: [
        'Für jeden einzelnen Tag der Vergangenheit wird der Erholungswert nach derselben Formel aus den damaligen Werten berechnet.',
      ],
      whatToDo:
        'Einzelne tiefere Tage nach hartem Sport sind normal — wichtig ist, dass die Kurve nach 1–2 ruhigeren Tagen wieder nach oben klettert.',
      technicalNote: 'Historische Tagesberechnung gegen das jeweils vorangehende 28-Tage-Fenster.',
    },
    recoveryVsLoad: {
      title: 'Erholung im Vergleich zur Anstrengung',
      whatItMeans:
        'Hier siehst du gemeinsam, wie anstrengend ein Tag war (Bernstein) und wie deine Erholung (Grün) darauf reagiert hat.',
      howCalculated: [
        'Grün zeigt deinen Erholungswert am jeweiligen Morgen (0–100 %).',
        'Bernstein zeigt die Tagesanstrengung (0–100), die am selben Tag dazukam.',
      ],
      whatToDo:
        'Achte auf das Muster: Oft sinkt die Erholung am Tag nach einer hohen Anstrengung leicht ab und steigt danach wieder.',
      technicalNote: 'Zwei-Achsen-Darstellung von Readiness-Score und normalisiertem Daily Load.',
    },
    sleepVsRecovery: {
      title: 'Schlaf im Vergleich zur Erholung',
      whatItMeans:
        'Vergleicht deinen Schlafwert (Blau) mit deinem Erholungswert am nächsten Morgen (Grün).',
      howCalculated: [
        'Beide Werte laufen auf einer Skala von 0 bis 100.',
      ],
      whatToDo:
        'Wenn beide Linien oft gemeinsam steigen und fallen, reagiert dein Körper besonders deutlich auf gute oder kurze Nächte.',
      technicalNote: 'Visueller Vergleich aus Sleep Score und Recovery Score ohne automatische Kausalitätsbehauptung.',
    },
    sleepStages: {
      title: 'Was bedeuten die Schlafphasen?',
      whatItMeans:
        'Während der Nacht durchläuft dein Körper mehrere etwa 90-minütige Zyklen aus leichtem Schlaf, Tiefschlaf und Traumschlaf.',
      howCalculated: [
        'Tiefschlaf findet meist verstärkt in der ersten Nachthälfte statt und unterstützt die körperliche Erholung.',
        'Traumschlaf (REM) nimmt gegen Morgen zu und hilft dem Kopf beim Verarbeiten und Lernen.',
        'Kurze Wachmomente zwischendurch sind völlig normal.',
      ],
      whatToDo:
        'Tippe einzelne Blöcke im Diagramm an, um die genaue Uhrzeit und Dauer zu sehen. Fehlen Phasendaten, zeigen wir ehrlich nur die Gesamtdauer.',
      technicalNote: 'Fachbegriffe: Ultradiane Schlafzyklen (Wach, REM, Leichtschlaf, Tiefschlaf) aus Wearable-Schätzungen.',
    },
    sleepTrend: {
      title: 'Schlafdauer & Schlafwert über die Zeit',
      whatItMeans:
        'Zeigt dir über 7, 30 oder 90 Tage, wie konstant du dein persönliches Schlafziel erreichst.',
      howCalculated: [
        'Die gestrichelte Linie markiert dein eingestelltes Schlafziel.',
        'Du kannst oben zwischen Stunden im Schlaf und dem gesamten Schlafwert wechseln.',
      ],
      whatToDo:
        'Mehrere Tage deutlich unter der Ziellinie summieren sich zu fehlendem Schlaf in der Wochenbilanz.',
      technicalNote: 'Tagesgenaue Zeitreihe aus Schlafsitzungen über Mitternacht.',
    },
    hrZones: {
      title: 'Wie funktionieren die 5 Pulsbereiche?',
      whatItMeans:
        'Die fünf Bereiche teilen deinen Puls von ganz locker bis Vollgas ein — so siehst du, ob du ruhig oder sehr intensiv trainiert hast.',
      howCalculated: [
        'Bereich 1–2: Locker bis angenehm (du kannst dich noch gut unterhalten) — ideal für Ausdauer und Erholung.',
        'Bereich 3: Zügig und spürbar fordernd.',
        'Bereich 4–5: Schnell und intensiv — sollte nur einen kleineren Teil der Woche ausmachen.',
        'Du kannst oben wählen, ob dein persönlicher Ruhepuls mit einbezogen wird oder nur dein Maximalpuls zählt.',
      ],
      whatToDo:
        'Für dauerhafte Fitness verbringen viele Läufer den Großteil ihrer Wochenminuten in Bereich 2.',
      technicalNote: 'Fachbegriffe: 5 Herzfrequenzzonen nach Karvonen-Reserve (HRR) oder % HFmax.',
    },
    loadBalance: {
      title: 'Anstrengung: Woche vs. Monat',
      whatItMeans:
        'Vergleicht deine durchschnittliche Anstrengung der letzten 7 Tage mit deinem gewohnten Monatsniveau der letzten 4 Wochen.',
      howCalculated: [
        'Liegen beide Werte nah beieinander (Verhältnis ca. 0,8 bis 1,2), passt die aktuelle Woche gut zu dem, was dein Körper gewohnt ist.',
        'Steigt die 7-Tage-Linie plötzlich weit über die Monatslinie, war der Sprung sehr groß.',
      ],
      whatToDo:
        'Nutze das Gleichgewicht als grobe Orientierung gegen zu schnelle Steigerungen — es ist keine medizinische Verletzungsvorhersage.',
      technicalNote: 'Fachbegriff: Akut-Chronisch-Verhältnis (ACWR) aus 7-Tage- und 28-Tage-Rohbelastung.',
    },
    simulator: {
      title: 'Wie funktioniert die Trainings-Vorschau?',
      whatItMeans:
        'Hier kannst du ausprobieren, wie sich ein geplanter Lauf oder ein Workout heute auf deine Tagesanstrengung und das morgige Training auswirken würde.',
      howCalculated: [
        'Aus Sportart, Dauer, Strecke, Durchschnittspuls und Gefühl berechnet genau dieselbe Logik wie bei echten Einheiten den Anstrengungs-Zuwachs.',
        'Daraus zeigt die Vorschau das Vorher/Nachher für heute und eine grobe Einschätzung für morgen.',
      ],
      whatToDo:
        'Über „Vorschau übernehmen“ landet die Einheit testweise in deinem Verlauf — mit „Zurücksetzen“ verschwindet sie wieder.',
      technicalNote:
        'Illustrative Modell-Simulation; die morgige Erholungsspanne ist eine unsichere Schätzung, weil Schlaf und Stress der kommenden Nacht noch nicht feststehen.',
    },
    biometrics: {
      title: 'Woher kommen deine Körperwerte?',
      whatItMeans:
        'Jede Kachel zeigt auf einen Blick, ob ein Wert direkt von einem Sensor gemessen, von der Uhr geschätzt oder von der App berechnet wurde.',
      howCalculated: [
        'Direkt gemessen: z. B. Schritte, Gewicht oder aufgezeichnete Pulswerte.',
        'Uhr-/Ring-Schätzung: z. B. Ausdauer-Fitness (VO₂max) oder Schlafphasen.',
        'Kein Wert vorhanden: Fehlende Messungen (z. B. Blutsauerstoff) werden niemals aus anderen Zahlen geraten.',
      ],
      whatToDo:
        'Tippe auf eine beliebige Kachel, um den Verlauf der letzten 30 Tage anzuschauen.',
      technicalNote: 'Provenienz-Modell zur klaren Trennung von Rohmessung, Wearable-Schätzer und App-Heuristik.',
    },
    correlations: {
      title: 'Zusammenhänge richtig lesen',
      whatItMeans:
        'Hier liegen zwei Messwerte übereinander, damit du Muster erkennst — etwa ob bessere Nächte bei dir mit besserer Erholung zusammenfallen.',
      howCalculated: [
        'Beide Kurven zeigen deine echten Tageswerte aus dem gewählten Zeitraum (7 Tage bis 6 Monate).',
      ],
      whatToDo:
        'Wichtig: Wenn zwei Dinge oft gleichzeitig passieren, heißt das noch nicht automatisch, dass das eine allein die Ursache für das andere ist.',
      technicalNote: 'Dual-Achsen-Trendvergleich; Korrelation bedeutet keine automatische Kausalität.',
    },
    nutrition: {
      title: 'Wie werden Kalorienziel & Makros berechnet?',
      whatItMeans:
        'Dein tägliches Kalorienziel passt sich automatisch an deinen Grundumsatz, deine Alltagsbewegung und deine heutigen aktiven Sportkalorien an.',
      howCalculated: [
        'Grundumsatz (Mifflin-St Jeor, 1990): Goldstandard-Formel aus Gewicht, Größe, Alter und biologischem Geschlecht.',
        'Aktivitäts-Bonus: Deine Schritte und heutigen Workouts erhöhen das Tagesbudget dynamisch.',
        'Protein (1,8–2,1 g/kg): Orientiert an den ISSN-Empfehlungen für Muskelerhalt und Regeneration.',
        'Ballaststoffe (14 g / 1.000 kcal): Nach DGE- und IOM-Richtlinien für Darmgesundheit und Sättigung.',
      ],
      whatToDo:
        'Tracke Mahlzeiten per KI-Foto (eigener API-Key), Spracheingabe, Barcode-Scanner oder Open Food Facts Suche — alles bleibt lokal auf deinem Gerät.',
      technicalNote:
        'Formeln: Mifflin-St Jeor (Am J Clin Nutr 1990), ISSN Protein Position Stand (Jäger et al., 2017), DGE Ballaststoff-Referenzwerte.',
    },
    strain21: {
      title: 'Wie funktioniert die Belastungsskala (0–21)?',
      whatItMeans:
        'Wie bei professionellen Sport-Trackern misst die logarithmische 0–21-Skala deine Herz-Kreislauf- und Muskelbelastung des gesamten Tages.',
      howCalculated: [
        'Exponentieller Banister-TRIMP: Jede Minute in höheren Herzfrequenzzonen zählt überproportional stärker als lockere Bewegung.',
        'Logarithmische 0–21-Kurve: Von 0 auf 10 zu kommen geht relativ schnell — von 16 auf 19 erfordert deutlich mehr Einsatz.',
        'EWMA-Belastungsbalance: Vergleicht deine 7-Tage-Last exponentiell gewichtet mit deinem 28-Tage-Niveau (Williams et al., 2017).',
      ],
      whatToDo:
        'Orientiere dich an deiner grünen Zielzone auf dem Startbildschirm — an Tagen mit hoher Erholung darfst du gezielt in Richtung 14–16 gehen.',
      technicalNote:
        'Fachbegriffe: Geschlechtsspezifischer Banister-TRIMP (k = 1,92 / 1,67), Karvonen-HRR-Zonen, Foster Session-RPE und EWMA-ACWR.',
    },
    breathwork: {
      title: 'Warum hebt Resonanzatmung deine HRV?',
      whatItMeans:
        'Langsames Atmen im Rhythmus von etwa 5,5 Sekunden Ein- und 5,5 Sekunden Ausatmen synchronisiert Herzschlag und Blutdruckwellen.',
      howCalculated: [
        'Resonanzfrequenz (~0,1 Hz ≈ 5,5 Atemzüge/Min.) aktiviert den Vagusnerv maximal.',
        'Schon 3–5 Minuten vor dem Schlafen senken den Ruhepuls und fördern tiefere Erholung.',
      ],
      whatToDo:
        'Nutze die geführte Atemübung nach stressigen Tagen oder vor dem Schlafengehen.',
      technicalNote:
        'Lehrer & Gevirtz (2014): Heart Rate Variability Biofeedback — Resonance Frequency Breathing.',
    },
  } as Record<ExplanationTopic, ExplanationEntry>,
};
