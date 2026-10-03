/**
 * Part 2: M08-04 through M10-08 lesson configs
 */

function L(id, title, prereqs, terms, topic, introImage, introExplain, keyText, repo, location, taskText, checklist, portfolioItem, faqs, quizPairs) {
  const termBlocks = terms.map((t, i) => ({
    question: `Was bedeutet ${t.term}, und wo triffst du es in der Praxis?`,
    image: t.image || `Stell dir ${topic} wie ein Werkzeug vor. ${t.term} ist Werkzeug Nummer ${i + 1} in dieser Lektion.`,
    explain: t.explain || `${t.term} gehoert zu ${title}. Wir erklaeren es Schritt fuer Schritt in einfachen Worten.`,
    term: `${t.term} ist: ${t.definition.split('.')[0]}.`,
    example: t.example || `Beispiel: In ${repo} findest du eine Stelle, an der ${t.term} relevant ist. Erklaere sie in drei Saetzen.`,
    why: t.why || `Ohne ${t.term} wirst du bei ${topic} unsicher. Mit Verstaendnis erkennst du Fehler frueh.`,
  }));

  return {
    id,
    title,
    prerequisites: prereqs,
    terms: terms.map((t) => ({ term: t.term, definition: t.definition })),
    intro: { topic, image: introImage, explain: introExplain },
    termBlocks,
    keyText,
    faqs,
    quiz: quizPairs.map(([q, c, w1, w2, w3]) => ({
      question: q,
      area: topic,
      options: [
        { text: c, isCorrect: true, explanation: 'Richtig.' },
        { text: w1, isCorrect: false, explanation: 'Falsch.' },
        { text: w2, isCorrect: false, explanation: 'Falsch.' },
        { text: w3, isCorrect: false, explanation: 'Falsch.' },
      ],
    })),
    practiceExample: { text: `Erkunde ${topic} im Repo.`, repoNote: repo, location },
    practiceTask: { task: taskText, expectation: `Du kannst ${topic} erklaeren.`, checklist },
    portfolioItem: portfolioItem ?? null,
  };
}

function faq(title, pairs) {
  return pairs.map(([q, a1, a2]) => ({
    question: q,
    answer: `${a1} ${a2} Merksatz: Bei ${title} zaehlt die verstaendliche Erklaerung mehr als das Auswendiglernen einzelner Schlagworte. Wiederhole den Ablauf einmal laut, dann mit einem eigenen Beispiel aus deinem Alltag.`,
  }));
}

function batch(entries) {
  return entries.map((e) => L(...e));
}

export const REST_LESSONS_PART2 = batch([
  // M08-04 Whisper / ElevenLabs
  ['M08-04-01', 'Wie Whisper Sprache in Text verwandelt', ['M08-03-03'], [
    { term: 'Speech-to-Text-Pipeline', definition: 'Die Kette aus Audio-Aufnahme, Vorverarbeitung, Modell-Inferenz und Textausgabe. Eine Speech-to-Text-Pipeline wandelt gesprochene Sprache in maschinenlesbaren Text um.' },
    { term: 'Audio-Segment', definition: 'Ein kurzer Abschnitt einer Audiodatei, der einzeln an das Modell gegeben wird. Audio-Segmente muessen zur Sample-Rate und zum Format des Modells passen.' },
    { term: 'Whisper-Modellgroesse', definition: 'Die Groessenvariante des Whisper-Modells von klein bis gross. Groessere Whisper-Modellgroessen sind genauer, aber langsamer und speicherhungriger.' },
  ], 'Whisper', 'Stell dir einen Geheimdienst-Mitarbeiter vor, der eine Kassette abhoert und mitschreibt. Whisper ist dieser Mitarbeiter fuer deine Audiodateien.', 'Whisper ist OpenAIs Speech-to-Text-Modell. Die Speech-to-Text-Pipeline nimmt Audio-Segmente entgegen und liefert Text. Die Whisper-Modellgroesse waehlst du nach Genauigkeit und Geraet.', 'Audio rein, Text raus. Modellgroesse bewusst waehlen.', 'repo-whisper-ggml-header', 'repo-whisper-ggml-header: Header-Parsing und Modell-Laden', 'Transkribiere 30 Sekunden Audio und dokumentiere Format und Modellgroesse.', ['Audio vorbereitet.', 'Transkript erstellt.', 'Fehlerquelle notiert.'], 'P04',
    faq('Wie Whisper Sprache in Text verwandelt', [
      ['Welche Audioformate?', 'WAV und MP3 sind ueblich, Konvertierung oft noetig.', 'Pruefe Sample-Rate und Mono oder Stereo.'],
      ['Lokal oder API?', 'Beides moeglich, lokal braucht GPU oder Geduld.', 'API kostet pro Minute.'],
      ['Warum kaputte Transkripte?', 'Schlechtes Mikro, Hintergrundgeraeusche, falsches Modell.', 'Immer Stichprobe hoeren.'],
      ['Whisper und Datenschutz?', 'Lokale Inferenz schuetzt sensible Inhalte.', 'Cloud nur mit Vertrag.'],
      ['Fehler wie in FutureDev?', 'Falscher Dateiheader kann Modell-Laden brechen.', 'Siehe repo-whisper-ggml-header.'],
    ]),
    [
      ['Speech-to-Text-Pipeline?', 'Audio zu Text Kette.', 'Text zu Bild Kette.', 'DNS zu HTTP.', 'CSS zu HTML.'],
      ['Audio-Segment?', 'Kurzer Audio-Abschnitt fuer Modell.', 'Ganze Festplatte.', 'Git Commit.', 'npm Paket.'],
      ['Whisper-Modellgroesse?', 'Accuracy vs Geschwindigkeit Trade-off.', 'Immer gleich schnell.', 'Nur fuer Bilder.', 'Ersetzt TypeScript.'],
      ['Typischer Input?', 'Audiodatei oder Mikrofon-Stream.', 'Nur PDF.', 'Nur SQL.', 'Nur JSON Schema.'],
      ['Output?', 'Transkript-Text.', 'PNG Bild.', 'Docker Image.', 'SSL Zertifikat.'],
      ['Fehlerdiagnose?', 'Format, Header, Modellpfad pruefen.', 'Ignorieren.', 'Neu kaufen.', 'DNS aendern.'],
      ['Lokaler Vorteil?', 'Daten bleiben auf Geraet.', 'Immer langsamer ohne Nutzen.', 'Kein Setup.', 'Verboten.'],
      ['API Vorteil?', 'Kein schweres Modell lokal.', 'Immer gratis.', 'Keine Latenz.', 'Kein Limit.'],
      ['Qualitaet verbessern?', 'Besseres Mikro, weniger Laerm.', 'Modell verkleinern always.', 'Mehr Hall.', 'Kein Test.'],
      ['FutureDev Link?', 'Whisper-Header Bug Beispiel.', 'Nicht relevant.', 'Nur CSS.', 'Nur Stripe.'],
      ['Segmentierung warum?', 'Lange Dateien in Stuecke.', 'Nur fuer Spass.', 'Verhindert Text.', 'Ersetzt Git.'],
      ['Produktionsregel?', 'Transkript stichprobenartig pruefen.', 'Blind vertrauen.', 'Kein Fallback.', 'Kein Logging.'],
    ]],

  ['M08-04-02', 'Wie ElevenLabs Text in Sprache verwandelt', ['M08-04-01'], [
    { term: 'Text-to-Speech-Stimme', definition: 'Eine konfigurierte kuenstliche Stimme mit festem Klangprofil. Die Text-to-Speech-Stimme bestimmt, wie Woerter klingen, unabhaengig vom Textinhalt.' },
    { term: 'Prosodie-Steuerung', definition: 'Die Beeinflussung von Rhythmus, Betonung und Pausen in der generierten Sprache. Prosodie-Steuerung macht Robotersprache hoerbar natuerlicher.' },
    { term: 'Voice-ID', definition: 'Die eindeutige Kennung einer Stimme beim Anbieter. Mit Voice-ID waehlst du in API-Aufrufen, welche Text-to-Speech-Stimme sprechen soll.' },
  ], 'ElevenLabs', 'Stell dir einen Synchronsprecher vor, der deinen Text vorliest. ElevenLabs ist das Studio, Voice-ID ist der Sprecher, Prosodie-Steuerung ist die Regie.', 'ElevenLabs wandelt Text in natuerlich klingende Sprache. Text-to-Speech-Stimme und Voice-ID waehlen den Klang. Prosodie-Steuerung feinjustiert Tempo und Betonung.', 'Stimme waehlen, Prosodie justieren, API aufrufen.', 'repo-futuredev', 'tools/audio/ Vertonungs-Pipeline', 'Generiere zwei Saetze mit zwei Voice-IDs und vergleiche Klang.', ['Zwei Voice-IDs getestet.', 'Prosodie beobachtet.', 'Kosten notiert.'], 'P04',
    faq('Wie ElevenLabs Text in Sprache verwandelt', [
      ['Brauche ich ElevenLabs fuer FutureDev?', 'Es ist ein moeglicher Anbieter fuer Vertonung.', 'KI-Stimmen muessen gekennzeichnet werden.'],
      ['Kosten?', 'Pro Zeichen oder pro Minute je Tarif.', 'Budget fuer ganze Lektionen planen.'],
      ['Zwei Stimmen warum?', 'Dialogformat A und B wirkt lebendiger.', 'Monoton ist schwerer zu hoeren.'],
      ['Rechte an Stimmen?', 'Nur lizenzierte Stimmen produktiv nutzen.', 'Stimmen klonen hat rechtliche Grenzen.'],
      ['Fehler bei langen Texten?', 'In Bloecke teilen und neu zusammensetzen.', 'Abbruchfeste Pipeline einplanen.'],
    ]),
    [
      ['Text-to-Speech-Stimme?', 'Kuenstliches Sprecherprofil.', 'Datenbank-Tabelle.', 'Git Branch.', 'HTTP Methode.'],
      ['Voice-ID?', 'Anbieter-Kennung der Stimme.', 'Passwort.', 'Domain.', 'Port.'],
      ['Prosodie-Steuerung?', 'Rhythmus und Betonung steuern.', 'SQL Query.', 'CSS Grid.', 'Docker Volume.'],
      ['ElevenLabs Input?', 'Text plus Voice-ID.', 'Nur Bild.', 'Nur Video.', 'Nur Binaries ohne Text.'],
      ['Output?', 'Audiodatei oder Stream.', 'HTML Seite.', 'PDF only.', 'SSH Key.'],
      ['Zwei Stimmen?', 'Fuer Dialog A und B.', 'Verboten.', 'Nur fuer Video.', 'Nur fuer Games.'],
      ['KI-Kennzeichnung?', 'Pflicht in FutureDev Inhalten.', 'Optional.', 'Nur bei Bildern.', 'Nur in USA.'],
      ['Kosten sparen?', 'Text kuerzen, Stimme testen, cachen.', 'Unendlich regenerieren.', 'Groesstes Modell always.', 'Kein Monitoring.'],
      ['Blockweise warum?', 'API-Limits und Abbruch-Schutz.', 'Nur Langeweile.', 'Ersetzt Whisper.', 'Ersetzt Git.'],
      ['Qualitaet pruefen?', 'Hoeren und Stichproben.', 'Nur Dateigroesse.', 'Nur JSON.', 'Gar nicht.'],
      ['FutureDev Pipeline?', 'tools/audio fuer Vertonung.', 'Existiert nicht.', 'Nur manuell.', 'Nur extern.'],
      ['Produktionsregel?', 'Gekennzeichnete KI-Stimme plus QA.', 'Blind veroeffentlichen.', 'Keine Logs.', 'Keys im Repo.'],
    ]],

  ['M08-04-03', 'Zwei Stimmen fuer einen Podcast waehlen', ['M08-04-02'], [
    { term: 'Dialog-Vertonung', definition: 'Das abwechselnde Einsprechen zweier Rollen in einem Audioformat. Dialog-Vertonung macht Lernstoff hoerbar wie ein Gespraech statt wie einen Vortrag.' },
    { term: 'Sprecher-Rotation', definition: 'Die feste Regel, welche Rolle welche Stimme spricht. Sprecher-Rotation muss ueber alle Lektionen konsistent bleiben, damit Hoerer sich orientieren.' },
    { term: 'Stimm-Kontrast', definition: 'Der hoerbare Unterschied zwischen zwei Stimmen in Tonlage und Tempo. Guter Stimm-Kontrast verhindert, dass A und B sich akustisch verwechseln lassen.' },
  ], 'Podcast-Stimmen', 'Stell dir ein Radiogespraech vor. Zwei Moderatoren unterscheiden sich in Klang und Rolle. Genau so waehlst du Stimmen fuer FutureDev.', 'Fuer Podcast-Format brauchst du Dialog-Vertonung mit klarer Sprecher-Rotation. Stimm-Kontrast hilft beim Zuhoeren. Waehle Stimmen, die langfristig angenehm bleiben.', 'Zwei Rollen, zwei Stimmen, klarer Kontrast.', 'repo-futuredev', 'tools/audio/src/ Stimmen-Konfiguration', 'Definiere Stimme A und B mit Voice-ID und Begruendung in drei Saetzen.', ['Voice A gewaehlt.', 'Voice B gewaehlt.', 'Kontrast begruendet.'], 'P04',
    faq('Zwei Stimmen fuer einen Podcast waehlen', [
      ['Muessen Stimmen stark unterschiedlich sein?', 'Ja, genug Kontrast fuer Orientierung.', 'Aber beide angenehm auf Dauer.'],
      ['Wechsel mitten in Lektion?', 'Rotation A/B laut Skript, nicht zufaellig.', 'Konsistenz ist wichtig.'],
      ['Tempo anpassen?', 'Prosodie kann Tempo je Stimme justieren.', 'Zu schnell erschlafft Lerner.'],
      ['Barrierefreiheit?', 'Klare Artikulation wichtiger als Effekte.', 'Transkript parallel anbieten.'],
      ['Test mit Nutzern?', 'Kurze Hoerprobe vor Massenproduktion.', 'Feedback zu Ermuedung einholen.'],
    ]),
    [
      ['Dialog-Vertonung?', 'Zwei Rollen im Wechsel.', 'Eine Stimme monolog.', 'Nur Musik.', 'Nur Stille.'],
      ['Sprecher-Rotation?', 'Feste Zuordnung A und B.', 'Zufaellig pro Satz.', 'Nur am Ende.', 'Nur in Quiz.'],
      ['Stimm-Kontrast?', 'Hoerbar unterscheidbare Stimmen.', 'Identische Stimmen bevorzugt.', 'Kontrast egal.', 'Nur Text zaehlt.'],
      ['Warum zwei Stimmen?', 'Wiederholung und Fragen wirken lebendiger.', 'Nur Kosten.', 'Nur Mode.', 'Verboten.'],
      ['Kernsatz wiederholen?', 'B wiederholt wichtigen Satz.', 'Niemals wiederholen.', 'Nur in FAQ.', 'Nur schriftlich.'],
      ['Ermuedung vermeiden?', 'Angenehme Stimmen waehlen.', 'Schreien lassen.', 'Max Speed.', 'Kein Test.'],
      ['Skript Regel?', 'Klare Sprecher-Tags je Block.', 'Ohne Tags improvisieren.', 'Nur Emojis.', 'Nur Code.'],
      ['FutureDev Vorbild?', 'BitDojo Zwei-Stimmen-Prinzip.', 'Gibt es nicht.', 'Nur eine Stimme always.', 'Nur Roboter.'],
      ['Audio QA?', 'Stichproben hoeren.', 'Nie anhoeren.', 'Nur Dateiname.', 'Nur Groesse.'],
      ['Kosten zwei Stimmen?', 'Doppelte Zeichen roughly.', 'Immer gratis.', 'Unabhaengig von Laenge.', 'Kein Budget.'],
      ['Wechsel Frequenz?', 'Regelmaessig aber nicht hektisch.', 'Jedes Wort wechseln.', 'Nur einmal pro Stunde.', 'Gar nicht.'],
      ['Produktionsregel?', 'Rotation dokumentieren und testen.', 'Jede Lektion neue Stimmen.', 'Keine Docs.', 'Kein Konsistenzcheck.'],
    ]],

  // M08-05 Ollama / Bildgenerierung
  ['M08-05-01', 'Was Ollama ist und wann ein lokales Modell sinnvoll ist', ['M08-04-03'], [
    { term: 'Lokales LLM', definition: 'Ein Sprachmodell, das auf deinem eigenen Rechner laeuft, ohne Cloud-API. Ein lokales LLM schuetzt Daten und funktioniert offline, kostet aber Hardware und Wartung.' },
    { term: 'Ollama-Runtime', definition: 'Die lokale Laufzeitumgebung, die Modelle laedt und inferiert. Ollama-Runtime vereinfacht Download, Start und Wechsel zwischen Modellen auf dem Entwicklerrechner.' },
    { term: 'Offline-Inferenz', definition: 'Die Ausfuehrung des Modells ohne Internetverbindung zur Cloud. Offline-Inferenz ist wichtig bei sensiblen Daten oder instabiler Verbindung.' },
  ], 'Ollama', 'Stell dir eine Bibliothek in deinem Keller vor. Du musst nicht jedes Mal in die Stadt fahren. Ollama bringt das Modell zu dir nach Hause.', 'Ollama macht lokale LLMs einfach. Lokales LLM schuetzt Privatsphaere. Ollama-Runtime verwaltet Modelle. Offline-Inferenz hilft bei sensiblen oder offline Szenarien.', 'Lokal wenn Datenschutz, Offline oder Kosten wichtig sind.', 'repo-futuredev', 'Lokale Dev-Umgebung mit Ollama', 'Starte ein kleines Modell lokal und stelle drei Fragen ohne Internet.', ['Modell gestartet.', 'Drei Antworten.', 'Vergleich Cloud notiert.'], null,
    faq('Was Ollama ist und wann ein lokales Modell sinnvoll ist', [
      ['Brauche ich GPU?', 'Hilft stark, kleine Modelle gehen auch auf CPU.', 'Erwartungen an Geschwindigkeit anpassen.'],
      ['Wann Cloud besser?', 'Wenn groesstes Modell oder Skalierung noetig.', 'Team-Zugriff zentral einfacher.'],
      ['Updates?', 'Modelle regelmaessig aktualisieren.', 'Sicherheitspatches nicht ignorieren.'],
      ['RAM Bedarf?', 'Kleinere Modelle brauchen weniger.', 'Groesse vor Download pruefen.'],
      ['Produktion lokal?', 'Selten fuer Consumer-Apps at scale.', 'Eher Dev, Prototyp, interne Tools.'],
    ]),
    [
      ['Lokales LLM?', 'Modell auf eigenem Rechner.', 'Nur in der Cloud.', 'Nur auf Papier.', 'Nur in DNS.'],
      ['Ollama-Runtime?', 'Verwaltet lokale Modelle.', 'Ein CSS Framework.', 'Ein Mailserver.', 'Ein CDN.'],
      ['Offline-Inferenz?', 'Ohne Cloud-Verbindung.', 'Immer online Pflicht.', 'Nur mit Stripe.', 'Nur mit GitHub.'],
      ['Vorteil lokal?', 'Datenschutz und Offline.', 'Immer beste Qualitaet.', 'Kein RAM noetig.', 'Kein Setup.'],
      ['Nachteil lokal?', 'Hardware und Wartung.', 'Immer gratis unlimited.', 'Immer schneller.', 'Keine Limits.'],
      ['GPU?', 'Beschleunigt Inferenz.', 'Unnoetig always.', 'Ersetzt CPU komplett.', 'Nur fuer Audio.'],
      ['Use Case intern?', 'Prototypen mit sensiblen Docs.', 'Oeffentliche Homepage.', 'Nur Marketing.', 'Nur DNS.'],
      ['Modell waehlen?', 'Groesse vs Qualitaet abwaegen.', 'Immer groesstes.', 'Zufaellig.', 'Gar nicht.'],
      ['Ollama Befehle?', 'pull, run, list typisch.', 'Nur git push.', 'Nur docker build.', 'Nur npm publish.'],
      ['Cloud Vergleich?', 'Cloud skaliert einfacher.', 'Cloud immer verboten.', 'Lokal immer besser.', 'Kein Unterschied.'],
      ['FutureDev Nutzung?', 'Optional fuer Autoren-Tools.', 'Pflicht fuer Lerner.', 'Ersetzt Lektionen.', 'Nur Bilder.'],
      ['Produktionsregel?', 'Lokal fuer Dev, Cloud fuer Scale bewusst waehlen.', 'Alles lokal always.', 'Alles cloud blind.', 'Keine Docs.'],
    ]],

  ['M08-05-02', 'Bildgenerierung einfach erklaert', ['M08-05-01'], [
    { term: 'Diffusions-Modell', definition: 'Ein KI-Modell, das Bilder schrittweise aus Rauschen formt. Diffusions-Modelle lernen Muster aus Trainingsbildern und erzeugen neue Bilder aus Textbeschreibungen.' },
    { term: 'Bild-Prompt', definition: 'Die Textbeschreibung, die das gewuenschte Bild steuert. Ein praeziser Bild-Prompt nennt Motiv, Stil, Licht und Ausschnitt statt nur ein einzelnes Wort.' },
    { term: 'Seed-Wert', definition: 'Eine Zahl, die den Startpunkt des Zufalls im Generierungsprozess festlegt. Gleicher Seed plus gleicher Bild-Prompt ergibt reproduzierbare Ergebnisse.' },
  ], 'Bildgenerierung', 'Stell dir einen Maler vor, der aus Nebel nach und nach Formen herausarbeitet. Diffusions-Modelle malen so aus Rauschen. Bild-Prompt ist dein Auftrag, Seed-Wert ist der Zufallsschlüssel.', 'Bildgenerierung nutzt Diffusions-Modelle. Bild-Prompt steuert Inhalt und Stil. Seed-Wert macht Ergebnisse wiederholbar oder variabel.', 'Prompt praezise, Seed dokumentieren, Ergebnis pruefen.', 'repo-futuredev', 'Marketing-Assets und Lektions-Illustrationen', 'Erzeuge zwei Bilder mit gleichem Prompt und unterschiedlichem Seed.', ['Zwei Seeds getestet.', 'Prompt dokumentiert.', 'Urheberrecht beachtet.'], null,
    faq('Bildgenerierung einfach erklärt', [
      ['Darf ich alles generieren?', 'Nein, Rechte und Marken beachten.', 'Keine fremden Logos ohne Erlaubnis.'],
      ['Commercial use?', 'Anbieter-Lizenz lesen.', 'Manche Bilder brauchen Attribution.'],
      ['Warum Seed?', 'Reproduzierbarkeit fuer CI und Tests.', 'Variationen bewusst steuern.'],
      ['Qualitaet verbessern?', 'Prompt mit Stil und Negativliste.', 'Mehr Iterationen statt ein Wort.'],
      ['In Apps einbinden?', 'API plus Kosten plus Moderation.', 'Keine ungefilterten User-Prompts.'],
    ]),
    [
      ['Diffusions-Modell?', 'Bild aus Rauschen schrittweise.', 'Nur Text ohne Bild.', 'Nur Audio.', 'Nur SQL.'],
      ['Bild-Prompt?', 'Textsteuerung des Motivs.', 'Passwort.', 'API Key.', 'Git SHA.'],
      ['Seed-Wert?', 'Reproduzierbarer Zufallsstart.', 'Domain Name.', 'Port Nummer.', 'HTTP Code.'],
      ['Typischer Fehler?', 'Zu vager Prompt.', 'Zu praeziser Prompt.', 'Seed dokumentieren.', 'Rechte pruefen.'],
      ['Stil angeben?', 'Ja, Licht und Perspektive.', 'Nur ein Wort reicht always.', 'Stil verboten.', 'Nur Emoji.'],
      ['Negative Prompts?', 'Unerwuenschtes ausschliessen.', 'Immer unnoetig.', 'Ersetzt Copyright.', 'Ersetzt Tests.'],
      ['API Kosten?', 'Pro Bild oder pro GPU-Zeit.', 'Immer gratis.', 'Unabhaengig von Groesse.', 'Nur Flatrate.'],
      ['Moderation?', 'User Input filtern in Apps.', 'Alles erlauben.', 'Kein Logging.', 'Kein Review.'],
      ['FutureDev Bilder?', 'Optional fuer Marketing.', 'Ersetzt alle Texte.', 'Pflicht in jedem Quiz.', 'Verboten.'],
      ['Speichern?', 'Metadaten Prompt und Seed.', 'Nur PNG ohne Info.', 'Nur in Chat.', 'Loeschen sofort.'],
      ['Variationen?', 'Seed aendern bei gleichem Prompt.', 'Nur Prompt nie aendern.', 'Immer gleiches Bild.', 'Zufaellig ohne Log.'],
      ['Produktionsregel?', 'Lizenz plus Prompt-Dokumentation.', 'Blind nutzen.', 'Keine Attribution.', 'Fremdlogos OK.'],
    ]],

  // M08-06 Automation
  ['M08-06-01', 'Was n8n tut', ['M08-05-02'], [
    { term: 'Workflow-Automatisierung', definition: 'Die Verkettung von Schritten, die ohne manuelles Klicken ablaufen. Workflow-Automatisierung verbindet Trigger, Aktionen und Bedingungen zu einem Ablauf.' },
    { term: 'n8n-Node', definition: 'Ein einzelner Baustein in n8n, der eine Aufgabe ausfuehrt, zum Beispiel HTTP, E-Mail oder Datenbank. Jeder n8n-Node hat Input, Output und Konfiguration.' },
    { term: 'Trigger-Kette', definition: 'Die Abfolge, die einen Workflow startet und durch Nodes fuehrt. Eine Trigger-Kette beginnt bei einem Ereignis wie Webhook oder Zeitplan.' },
  ], 'n8n', 'Stell dir eine Dominokette vor. Ein Stein faellt und loest den naechsten aus. n8n baut solche Ketten aus Software-Bausteinen.', 'n8n ist ein visuelles Werkzeug fuer Workflow-Automatisierung. n8n-Nodes sind Bausteine. Trigger-Kette startet und verzweigt Ablaeufe.', 'Trigger waehlen, Nodes verbinden, Fehlerpfade planen.', 'repo-cron-last-due', 'repo-cron-last-due: Zeitplan-Logik als Code-Vorbild', 'Skizziere einen n8n-Workflow mit Trigger, HTTP-Node und E-Mail-Node.', ['Trigger definiert.', 'Drei Nodes skizziert.', 'Fehlerpfad notiert.'], null,
    faq('Was n8n tut', [
      ['n8n vs Code?', 'n8n schneller fuer Standard-Integrationen.', 'Code besser fuer komplexe Logik.'],
      ['Self-hosted?', 'Moeglich, Wartung beachten.', 'Cloud-Variante einfacher fuer Start.'],
      ['Secrets?', 'Credentials in n8n sichern.', 'Nie im Klartext in Nodes.'],
      ['Fehler?', 'Retry und Alert-Nodes einplanen.', 'Stille Fehler vermeiden.'],
      ['Wann nicht n8n?', 'Wenn starke Tests und Versionierung wie Code noetig.', 'Dann lieber repo-cron-last-due Pattern.'],
    ]),
    [
      ['Workflow-Automatisierung?', 'Schritte ohne manuelles Klicken.', 'Nur manuelle Klicks.', 'Nur Meetings.', 'Nur Design.'],
      ['n8n-Node?', 'Einzelner Automatisierungs-Baustein.', 'Git Commit.', 'DNS Record.', 'CSS Klasse.'],
      ['Trigger-Kette?', 'Start und Ablauf des Workflows.', 'Nur Endlosschleife.', 'Nur CSS.', 'Nur HTML.'],
      ['Typischer Trigger?', 'Webhook oder Schedule.', 'Nur Mausklick.', 'Nur Sonne.', 'Nur Zufall.'],
      ['HTTP Node?', 'Ruft APIs auf.', 'Speichert nur lokal.', 'Ersetzt DNS.', 'Ersetzt Auth.'],
      ['Fehler Handling?', 'Retry und Benachrichtigung.', 'Ignorieren.', 'Workflow loeschen.', 'Server formatieren.'],
      ['Self-host Vorteil?', 'Kontrolle ueber Daten.', 'Immer teurer ohne Nutzen.', 'Kein Setup.', 'Kein Backup.'],
      ['vs Cron Code?', 'n8n visuell, Code testbarer.', 'Identisch always.', 'Cron verboten.', 'n8n verboten.'],
      ['Credentials?', 'Sicher im Tool speichern.', 'In Node Text.', 'In Git.', 'In Quiz.'],
      ['FutureDev Use?', 'Content-Pipeline denkbar.', 'Ersetzt TypeScript.', 'Nur fuer Mobile.', 'Unmoeglich.'],
      ['Versionierung?', 'Workflow exportieren.', 'Nie sichern.', 'Nur Screenshot.', 'Nur muendlich.'],
      ['Produktionsregel?', 'Monitoring plus Alerts.', 'Blind laufen lassen.', 'Keine Logs.', 'Kein Retry.'],
    ]],

  ['M08-06-02', 'Ein eigener Cron-Job und wann Automatisierung sich lohnt', ['M08-06-01'], [
    { term: 'Cron-Ausdruck', definition: 'Eine Zeitsyntax, die festlegt, wann ein Job laeuft. Ein Cron-Ausdruck wie taeglich um drei Uhr nachts steuert wiederkehrende Aufgaben auf Servern.' },
    { term: 'Zeitplan-Job', definition: 'Eine Aufgabe, die nach Zeitplan automatisch startet. Ein Zeitplan-Job kann Daten sichern, Reports senden oder Cache leeren.' },
    { term: 'Automatisierungs-ROI', definition: 'Der Vergleich zwischen Einsparung und Aufwand einer Automatisierung. Automatisierungs-ROI ist positiv, wenn wiederholte manuelle Arbeit dauerhaft entfaellt.' },
  ], 'Cron', 'Stell dir einen Wecker ein, der nicht nur klingelt, sondern auch Kaffee kocht. Cron-Ausdruck ist die Weckzeit. Zeitplan-Job ist die Kaffeemaschine.', 'Cron-Jobs führen Aufgaben zeitgesteuert aus. Cron-Ausdruck definiert den Rhythmus. Automatisierungs-ROI zeigt, ob sich der Aufwand lohnt.', 'Nur automatisieren, was oft wiederholt wird und klar definiert ist.', 'repo-cron-last-due', 'repo-cron-last-due: Cron-Parsing und Tests', 'Schreibe einen Cron-Ausdruck fuer woechentlichen Job und skizziere Aufgabe.', ['Cron notiert.', 'Job beschrieben.', 'ROI geschaetzt.'], 'P02',
    faq('Ein eigener Cron-Job und wann Automatisierung sich lohnt', [
      ['Cron auf Vercel?', 'Serverless Cron oder externe Trigger.', 'Nicht wie klassischer Linux-Cron everywhere.'],
      ['Zeitzonen?', 'Immer Zeitzone explizit setzen.', 'UTC vs Lokal dokumentieren.'],
      ['Doppelte Laeufe?', 'Locks oder Idempotenz einplanen.', 'Zwei parallele Runs vermeiden.'],
      ['Wann nicht automatisieren?', 'Einmalige, unklare Aufgaben.', 'Erst Prozess stabilisieren.'],
      ['Monitoring?', 'Job-Erfolg loggen und alerten.', 'Stille Fehler sind teuer.'],
    ]),
    [
      ['Cron-Ausdruck?', 'Syntax fuer Zeitplan.', 'CSS Selektor.', 'SQL Join.', 'HTTP Header.'],
      ['Zeitplan-Job?', 'Automatisch zeitgestartete Aufgabe.', 'Manueller Klick only.', 'Nur UI Event.', 'Nur Keyboard.'],
      ['Automatisierungs-ROI?', 'Nutzen vs Aufwand.', 'Immer negativ.', 'Unmessbar always.', 'Nur Design.'],
      ['taeglich 3 Uhr?', 'Typisches Wartungsfenster.', 'Unmoeglich.', 'Verboten.', 'Nur Sonntag Pflicht.'],
      ['Idempotenz?', 'Mehrfachlauf ohne Schaden.', 'Immer doppelt schreiben.', 'Daten korrupt OK.', 'Kein Log.'],
      ['Lock?', 'Verhindert parallele Runs.', 'Unnoetig always.', 'Ersetzt Cron.', 'Ersetzt DNS.'],
      ['Timezone UTC?', 'Haeufig auf Servern.', 'Nie verwenden.', 'Nur fuer Mail.', 'Nur fuer CSS.'],
      ['Vercel Cron?', 'Platform-spezifische Option.', 'Identisch Linux always.', 'Existiert nicht.', 'Ersetzt Git.'],
      ['repo-cron-last-due?', 'Beispiel fuer getestete Cron-Logik.', 'Irrelevant.', 'Nur Bilder.', 'Nur Audio.'],
      ['Alert bei Fail?', 'Ja, sonst merkst du es spaet.', 'Nein, egal.', 'Nur jaehrlich pruefen.', 'Gar nicht.'],
      ['Einmalige Aufgabe?', 'Nicht cron automatisieren.', 'Immer cron.', 'Immer n8n.', 'Immer Agent.'],
      ['Produktionsregel?', 'Zeitplan plus Monitor plus Idempotenz.', 'Cron ohne Test.', 'Keine Logs.', 'Kein Retry.'],
    ]],

  // M08-07 Code Auditing
  ['M08-07-01', 'Woran man einen KI-Fehler erkennt', ['M08-06-02'], [
    { term: 'KI-Code-Smell', definition: 'Ein Muster in KI-generiertem Code, das auf typische Fehler hindeutet, zum Beispiel ungenutzte Imports oder falsche API-Versionen. KI-Code-Smell ist kein Beweis, aber ein Warnsignal.' },
    { term: 'Plausibilitaets-Check', definition: 'Die schnelle Pruefung, ob Code und Kommentare zur Realitaet passen. Ein Plausibilitaets-Check findet erfundene Funktionen oder falsche Paketnamen.' },
    { term: 'Halluzinations-Spur', definition: 'Hinweise, dass das Modell Fakten erfunden hat, zum Beispiel nicht existierende URLs oder Methoden. Die Halluzinations-Spur fuehrt dich zur gezielten Gegenpruefung.' },
  ], 'KI-Fehler', 'Stell dir einen sehr ueberzeugenden Verkaeufer vor. Er klingt sicher, aber manche Produkte gibt es gar nicht. KI-Code kann genauso klingen.', 'KI-Fehler erkennst du an KI-Code-Smell, Plausibilitaets-Check und Halluzinations-Spur. Funktionierender Code kann trotzdem falsch sein.', 'Nicht blind mergen. Riechen, pruefen, gegen Realitaet testen.', 'repo-verified-done', 'repo-verified-done: verified-done Skill aus echtem Bug', 'Markiere in einem KI-Diff drei Stellen mit moeglichem KI-Code-Smell.', ['Drei Stellen markiert.', 'Plausibilitaet geprueft.', 'Test ergaenzt.'], 'P04',
    faq('Woran man einen KI-Fehler erkennt', [
      ['Reicht gruener Build?', 'Nein, Build beweist nicht korrekte Logik.', 'repo-verified-done erklaert den Unterschied.'],
      ['Typische Smells?', 'Tote Imports, falsche Versionen, zu viel Boilerplate.', 'Immer manuell stichproben.'],
      ['Halluzinierte APIs?', 'In Docs nachschlagen, nicht raten.', 'Autocomplete im IDE kann truegen.'],
      ['Agent vs Copilot?', 'Beide koennen halluzinieren.', 'Review bleibt Pflicht.'],
      ['Automatisch finden?', 'Lint und Tests helfen.', 'Ersetzen kein menschliches Verstehen.'],
    ]),
    [
      ['KI-Code-Smell?', 'Warnmuster in KI-Code.', 'Garantie fuer Bug.', 'Beweis fuer Sicherheit.', 'CSS Klasse.'],
      ['Plausibilitaets-Check?', 'Passt Code zur Realitaet?', 'Nur Geschwindigkeit messen.', 'Nur Farben pruefen.', 'Nur Git ignore.'],
      ['Halluzinations-Spur?', 'Hinweis auf erfundene Fakten.', 'Beweis fuer Qualitaet.', 'SSL Typ.', 'HTTP 200 only.'],
      ['Gruener Build?', 'Notwendig aber nicht hinreichend.', 'Alles beweisen.', 'Tests optional.', 'Lint optional.'],
      ['Typischer API-Fehler?', 'Nicht existierende Methode.', 'Perfekte Docs always.', 'Keine Versionen.', 'Kein npm.'],
      ['Review Fokus?', 'Randfaelle und Integration.', 'Nur Formatierung.', 'Nur Kommentare.', 'Gar nicht.'],
      ['verified-done?', 'Skill aus echtem Bug.', 'Marketing Begriff.', 'DNS Record.', 'Cookie Name.'],
      ['Tests ergaenzen?', 'Ja bei verdaechtigen Stellen.', 'Nie noetig.', 'Nur in Prod.', 'Nur manuell.'],
      ['Blind merge?', 'Gefaehrlich bei KI-Code.', 'Best Practice.', 'Schneller always.', 'Empfohlen.'],
      ['Lint hilft?', 'Ja bei Syntax und Imports.', 'Ersetzt Denken.', 'Verhindert Logikfehler all.', 'Unnoetig.'],
      ['FutureDev Regel?', 'Alles selbst erklaeren koennen.', 'Copy paste OK.', 'Kein Test.', 'Kein Review.'],
      ['Produktionsregel?', 'Smell plus Test plus Review.', 'Nur Agent.', 'Kein CI.', 'Kein Log.'],
    ]],

  ['M08-07-02', 'Schnelle Fehlerdiagnose', ['M08-07-01'], [
    { term: 'Fehler-Isolate', definition: 'Das Einengen des Fehlers auf die kleinste reproduzierbare Einheit. Fehler-Isolate verhindert, dass du das ganze System gleichzeitig debuggst.' },
    { term: 'Reproduktions-Schritt', definition: 'Die klare Abfolge, mit der ein Fehler zuverlaessig wieder auftritt. Ein Reproduktions-Schritt ist die Basis fuer jeden Fix und jeden Test.' },
    { term: 'Minimal-Fix', definition: 'Die kleinste Aenderung, die den Fehler behebt, ohne Nebenwirkungen. Minimal-Fix erleichtert Review und reduziert Regressionen.' },
  ], 'Fehlerdiagnose', 'Stell dir einen Arzt vor, der erst Symptome sammelt, dann Tests macht, dann gezielt behandelt. Fehlerdiagnose in Code funktioniert so.', 'Schnelle Fehlerdiagnose isoliert den Fehler, findet Reproduktions-Schritte und liefert Minimal-Fix statt grosser Refactorings.', 'Isolieren, reproduzieren, minimal fixen, testen.', 'repo-verified-done', 'repo-verified-done: Postmortem-Stil Analyse', 'Schreibe Reproduktions-Schritte fuer einen Bug aus deinem Lernprojekt.', ['Isolate beschrieben.', 'Repro-Schritte.', 'Minimal-Fix skizziert.'], 'P04',
    faq('Schnelle Fehlerdiagnose', [
      ['Erst loggen oder fixen?', 'Erst reproduzierbar machen.', 'Dann fixen mit Test.'],
      ['Bisection mit Git?', 'git bisect findet schlechten Commit.', 'Sehr effektiv bei Regressionen.'],
      ['Agent debuggen lassen?', 'Ja, aber du pruefst Hypothesen.', 'Agent kann falsche Spuren folgen.'],
      ['Minimal-Fix vs Refactor?', 'Fix jetzt, Refactor spaeter eigenes Ticket.', 'Nicht vermischen.'],
      ['Dokumentation?', 'Kurzes Postmortem bei schweren Bugs.', 'Hilft kuenftigen dir.'],
    ]),
    [
      ['Fehler-Isolate?', 'Kleinste reproduzierbare Einheit.', 'Ganzes System auf einmal.', 'Nur UI Farben.', 'Nur Marketing.'],
      ['Reproduktions-Schritt?', 'Klare Abfolge zum Fehler.', 'Zufaellig klicken.', 'Nur hoffen.', 'Nur deployen.'],
      ['Minimal-Fix?', 'Kleinste wirksame Aenderung.', 'Alles umschreiben.', 'Kein Test.', 'Kein Review.'],
      ['git bisect?', 'Findet Regression Commit.', 'Formatiert Code.', 'Deployed App.', 'Sendet Mail.'],
      ['Hypothese?', 'Erst raten dann beweisen.', 'Nur raten.', 'Nie testen.', 'Nie loggen.'],
      ['Test nach Fix?', 'Regression verhindern.', 'Optional.', 'Nur Prod.', 'Verboten.'],
      ['Agent Gefahr?', 'Kann falsche Fixes machen.', 'Immer perfekt.', 'Ersetzt Tests.', 'Ersetzt Git.'],
      ['Log ohne PII?', 'Ja in Produktion.', 'Alles loggen.', 'Keine Logs.', 'Keys loggen.'],
      ['Postmortem?', 'Lernen aus schwerem Bug.', 'Schuld suche.', 'Nur feuern.', 'Ignorieren.'],
      ['Scope creep?', 'Fix Ticket klein halten.', 'Alles in einem.', 'Kein Ticket.', 'Kein Review.'],
      ['FutureDev Beispiel?', 'verified-done aus echtem Bug.', 'Nur Theorie.', 'Nur Audio.', 'Nur CSS.'],
      ['Produktionsregel?', 'Repro plus Minimal-Fix plus Test.', 'Hotfix ohne Test.', 'Nur Agent.', 'Kein Monitor.'],
    ]],

  ['M08-07-03', 'Warum man alles selbst erklaeren koennen muss', ['M08-07-02'], [
    { term: 'Erklaer-Test', definition: 'Die Prüfung, ob du jeden Teil deines Projekts in einfachen Worten erklaeren kannst. Der Erklaer-Test ist Kern von M10-08 Jobreife.' },
    { term: 'Verstaendnis-Nachweis', definition: 'Der Beleg, dass du nicht nur Code kopiert hast, sondern Zusammenhaenge verstehst. Verstaendnis-Nachweis gelingt durch Erklaeren, Demo und Tests.' },
    { term: 'Verantwortungs-Prinzip', definition: 'Die Regel, dass du fuer deployed Code verantwortlich bist, auch wenn KI geholfen hat. Verantwortungs-Prinzip bedeutet: du musst es erklaeren und verteidigen koennen.' },
  ], 'Erklaerpflicht', 'Stell dir vor, du gibst jemandem dein Auto. Er fragt: Wie funktioniert die Bremse? Wenn du es nicht erklaeren kannst, solltest du nicht fahren.', 'In Interviews und im Betrieb musst du eigenen Code erklaeren. Erklaer-Test und Verstaendnis-Nachweis sichern Jobreife. Verantwortungs-Prinzip gilt immer, auch mit KI.', 'Wenn du es nicht erklaeren kannst, darfst du es nicht shippen.', 'repo-verified-done', 'repo-verified-done und M10-08 Erklaer-Modus', 'Nimm eine Funktion aus deinem Projekt und erklaere sie laut in zwei Minuten.', ['Funktion gewaehlt.', 'Erklaerung geuebt.', 'Luecke dokumentiert.'], 'P07',
    faq('Warum man alles selbst erklaeren koennen muss', [
      ['Reicht Copy Paste im Interview?', 'Nein, Tiefe-Fragen entlarven es.', 'Erklaer-Modus in M10-08 trainiert das.'],
      ['Team nutzt KI?', 'Trotzdem musst du mergen koennen.', 'Verantwortung bleibt beim Menschen.'],
      ['Dokumentation reicht?', 'Dokumentation ersetzt kein Verstehen.', 'Du musst Fragen live beantworten.'],
      ['Junior vs Senior?', 'Beide muessen erklaeren koennen.', 'Tiefe waechst mit Erfahrung.'],
      ['Wie ueben?', 'Laut erklaeren, Peer Review, Quiz zu eigenem Code.', 'Taeglich fuenf Minuten reichen.'],
    ]),
    [
      ['Erklaer-Test?', 'Erklaeren ohne Ablesen.', 'Nur Auswendiglernen.', 'Nur Git log.', 'Nur CSS.'],
      ['Verstaendnis-Nachweis?', 'Demo plus Erklaerung plus Tests.', 'Nur Stars auf GitHub.', 'Nur Logo.', 'Nur Domain.'],
      ['Verantwortungs-Prinzip?', 'Du bist verantwortlich fuer Shipped Code.', 'KI ist verantwortlich.', 'Niemand verantwortlich.', 'Nur HR verantwortlich.'],
      ['Interview Tiefe?', 'Warum und Was-wenn Fragen.', 'Nur Rechtschreibung.', 'Nur Hobbys.', 'Nur Gehalt.'],
      ['M10-08?', 'Erklaer-Fragen zu Portfolio.', 'Nur Multiple Choice fremd.', 'Kein Portfolio.', 'Nur LinkedIn.'],
      ['KI Hilfe OK?', 'Ja, wenn du Ergebnis verstehst.', 'Nein immer.', 'Ja ohne Pruefung.', 'Verboten always.'],
      ['Laut ueben?', 'Effektiv fuer Luecken finden.', 'Unnoetig.', 'Nur schreiben.', 'Nur hoeren.'],
      ['Peer Review?', 'Fremde Fragen stellen lassen.', 'Nur allein.', 'Nur Agent.', 'Nur ChatGPT.'],
      ['Luecke ok?', 'Ja, wenn du sie schliesst.', 'Ignorieren forever.', 'Verstecken.', 'Leugnen.'],
      ['Production Bug?', 'Du erklaerst Postmortem.', 'KI erklaert.', 'Niemand erklaert.', 'Nur Marketing.'],
      ['verified-done Link?', 'Echter Bug hinter Skill.', 'Fiktion.', 'Nur Design.', 'Nur Audio.'],
      ['Produktionsregel?', 'Erklaeren koennen vor Merge.', 'Merge blind.', 'Kein Test.', 'Kein Review.'],
    ]],
]);

// M09 and M10 in part 3
import { REST_LESSONS_PART3 } from './generate-all-m08-m10-data-part3.mjs';
REST_LESSONS_PART2.push(...REST_LESSONS_PART3);
