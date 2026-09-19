// Alle sichtbaren Texte des Gerüsts an einer Stelle, damit spätere Übersetzung
// möglich bleibt (Technikvorgabe 11). Bezeichner Englisch, Werte Deutsch.
export const de = {
  tabs: {
    start: 'Start',
    lernen: 'Lernen',
    hoeren: 'Hören',
    ueben: 'Üben',
    ich: 'Ich',
  },
  start: {
    title: 'Start',
    emptyTitle: 'Willkommen bei FutureDev',
    emptyBody: 'Noch kein Fortschritt vorhanden. Beginne mit der ersten Lektion.',
    emptyAction: 'Erstes Modul öffnen',
  },
  lernen: {
    title: 'Lernen',
    emptyTitle: 'Der Lehrplan wird geladen',
    emptyBody: 'Zehn Module, von den Grundlagen bis zur Jobreife.',
    emptyAction: 'Erstes Modul öffnen',
    inPreparation: 'in Vorbereitung',
    plannedLessons: (count: number) => `${count} geplante Lektion${count === 1 ? '' : 'en'}`,
  },
  hoeren: {
    title: 'Hören',
    emptyTitle: 'Noch nichts ausgewählt',
    emptyBody: 'Öffne eine Lektion, um mit dem Hören zu beginnen.',
  },
  ueben: {
    title: 'Üben',
    emptyTitle: 'Nichts fällig',
    emptyBody: 'Nächste Wiederholung morgen. Lerne in der Zwischenzeit eine neue Lektion.',
  },
  ich: {
    title: 'Ich',
    emptyTitle: 'Noch kein Fortschritt',
    emptyBody: 'Dein Lernstand, deine Jobreife und deine Einstellungen erscheinen hier, sobald du losgelegt hast.',
    readinessDisclaimer: 'Diese Anzeige zeigt Vorbereitung, keine Zusage eines Arbeitgebers.',
    settingsTitle: 'Einstellungen',
    legalTitle: 'Impressum, Datenschutz, Lizenzen',
  },
  onboarding: {
    step1Title: 'Wofür lernst du?',
    step1Body: 'Das hilft uns, dir passende Inhalte vorzuschlagen. Rein informativ, keine Sperre.',
    step1OptionCareer: 'Berufswechsel',
    step1OptionInterest: 'Freies Interesse',
    step2Title: 'Lesen oder Hören zuerst?',
    step2Body: 'Änderbar in den Einstellungen.',
    step2OptionRead: 'Lesen',
    step2OptionListen: 'Hören',
    step3Title: 'Wie viel Zeit hast du täglich?',
    step3Body: 'Ein sinnvoller Vorschlag, jederzeit änderbar.',
    step3OptionShort: '10 Minuten',
    step3OptionMedium: '20 Minuten',
    step3OptionLong: '40 Minuten',
    next: 'Weiter',
    finish: 'Los geht’s',
  },
  lesson: {
    loadingTitle: 'Lektion wird geladen',
    loadingBody: 'Diese Ansicht wird durch den Lektionsbildschirm ersetzt, sobald der Inhalt geladen ist.',
  },
  common: {
    offlineBanner: 'Offline. Zuletzt aktualisiert am',
  },
} as const;
