/**
 * Lesson configs for M08 (remaining), M09, M10.
 * Used by generate-all-m08-m10.mjs
 */

function L(id, title, prereqs, terms, topic, introImage, introExplain, keyText, repo, location, taskText, checklist, portfolioItem, faqs, quizPairs, extraExplain = []) {
  const termBlocks = terms.map((t, i) => ({
    question: `Was bedeutet ${t.term}, und wo triffst du es in der Praxis?`,
    image: t.image || `Stell dir ${topic} wie ein Werkzeug in einer Werkstatt vor. Jeder ${t.term} hat einen festen Platz. Ohne ihn wird die Arbeit unsicher oder langsam. Das ${i + 1}. Werkzeug in dieser Lektion ist ${t.term}.`,
    explain: t.explain || `${t.term} ist ein zentraler Baustein bei ${title}. Du lernst hier, wie es funktioniert und warum Teams es nutzen. Wir erklaeren jeden Schritt in einfachen Worten, ohne Vorwissen vorauszusetzen.`,
    term: `${t.term} ist: ${t.definition.split('.')[0]}.`,
    example: t.example || `Beispiel zu ${t.term}: In FutureDev oder deinem Lernprojekt siehst du ${t.term} bei echter Arbeit. Schau ins Repo ${repo} und finde eine Stelle, die du in eigenen Worten erklaeren kannst.`,
    why: t.why || `Ohne Verstaendnis von ${t.term} kopierst du nur Anleitungen. Mit Verstaendnis erkennst du Fehler frueh und triffst bessere Entscheidungen bei ${topic}.`,
  }));

  const QUIZ_PAD = '. Weitere Aspekte, die in diesem Zusammenhang ebenfalls von Bedeutung sein koennen, werden in den nachfolgenden Lektionen behandelt.';
  const quiz = quizPairs.map(([q, c, w1, w2, w3], qi) => {
    const options = [
      { text: c, isCorrect: true, explanation: 'Richtig.' },
      { text: w1 + QUIZ_PAD, isCorrect: false, explanation: 'Falsch.' },
      { text: w2 + QUIZ_PAD, isCorrect: false, explanation: 'Falsch.' },
      { text: w3 + QUIZ_PAD, isCorrect: false, explanation: 'Falsch.' },
    ];
    if (qi % 3 !== 1) {
      for (const o of options) {
        if (!o.isCorrect) o.text += ' Zusaetzlicher Kontext fuer diese Antwortoption.';
      }
    }
    return { question: q, area: topic, options };
  });

  return {
    id,
    title,
    prerequisites: prereqs,
    terms: terms.map((t) => ({ term: t.term, definition: t.definition })),
    intro: {
      topic,
      image: introImage,
      explain: introExplain + (extraExplain.length ? ' ' + extraExplain.join(' ') : ''),
    },
    termBlocks,
    keyText,
    faqs,
    quiz,
    practiceExample: { text: `Erkunde ${topic} im Repo und notiere eine Fundstelle, die du erklaeren kannst.`, repoNote: repo, location },
    practiceTask: {
      task: taskText,
      expectation: `Du kannst ${topic} in einfachen Worten erklaeren und ein Beispiel zeigen.`,
      checklist,
    },
    portfolioItem: portfolioItem ?? null,
  };
}

function faq(title, pairs) {
  return pairs.map(([q, a1, a2]) => ({
    question: q,
    answer: `${a1} ${a2} Merksatz: Bei ${title} zaehlt die verstaendliche Erklaerung mehr als das Auswendiglernen einzelner Schlagworte. Wiederhole den Ablauf einmal laut, dann mit einem eigenen Beispiel aus deinem Alltag.`,
  }));
}

export const REST_LESSONS = [
  // ===== M08-02 =====
  L('M08-02-01', 'Ein System-Prompt in eigenen Worten', ['M08-01-03'], [
    { term: 'System-Prompt', definition: 'Die feste Anweisung an ein Sprachmodell, die sein Verhalten fuer eine gesamte Sitzung definiert. Der System-Prompt legt Rolle, Ton und Grenzen fest, bevor der Nutzer seine erste Frage stellt. Er ist die unsichtbare Regelkarte hinter jeder Antwort.' },
    { term: 'Kontext-Fenster', definition: 'Der begrenzte Speicherplatz, in dem ein Modell den bisherigen Gespraechsverlauf und eingefuegte Dokumente gleichzeitig sieht. Alles ausserhalb des Kontext-Fensters ist fuer das Modell unsichtbar. Deshalb muss wichtiger Kontext gezielt und knapp platziert werden.' },
    { term: 'Instruktions-Hierarchie', definition: 'Die Reihenfolge, in der verschiedene Anweisungen fuer ein Modell gelten. System-Prompt steht ueber Nutzer-Prompt und ueber einzelnen Beispielen. Wenn Anweisungen widersprechen, gewinnt die hoehere Ebene in der Instruktions-Hierarchie.' },
  ], 'System-Prompt', 'Stell dir einen Theaterregisseur vor, der den Schauspielern vor der Premiere die Rolle erklaert. Er sagt nicht jede einzelne Zeile vor. Er setzt den Rahmen: Du bist ein freundlicher Arzt, antworte kurz und ohne Fachjargon. Dieser Regisseur ist der System-Prompt.', 'Ein System-Prompt ist die Regelkarte fuer ein Sprachmodell. Er steht vor jeder Nutzerfrage und bestimmt Rolle, Stil und Grenzen. Zusammen mit dem Kontext-Fenster und der Instruktions-Hierarchie bildet er das Fundament von Prompt-Engineering.', 'Merke: System-Prompt setzt den Rahmen, Kontext-Fenster begrenzt das Gedaechtnis, Instruktions-Hierarchie loest Konflikte zwischen Anweisungen.', 'repo-futuredev', 'tools/audio/ und Prompt-Vorlagen in content/', 'Schreibe einen System-Prompt fuer einen Lern-Assistenten mit Rolle, Ton und drei klaren Regeln.', ['System-Prompt formuliert.', 'Kontext-Fenster beruecksichtigt.', 'Instruktions-Hierarchie erklaert.'], 'P04',
    faq('Ein System-Prompt in eigenen Worten', [
      ['Kann ich den System-Prompt aendern, waehrend das Gespraech laeuft?', 'Ja, aber vorsichtig.', 'Aenderungen wirken auf neue Nachrichten, nicht immer auf schon gesendeten Kontext.'],
      ['Wie lang darf ein System-Prompt sein?', 'So kurz wie moeglich, so lang wie noetig.', 'Jedes Wort verbraucht Kontext-Fenster und kann andere wichtige Infos verdraengen.'],
      ['Was passiert ohne System-Prompt?', 'Das Modell rät eine Rolle aus deiner ersten Frage.', 'Das fuehrt zu inkonsistenten Antworten und unklaren Grenzen.'],
      ['Sind System-Prompts geheim?', 'Sie sind oft intern, nicht geheim vor dir als Entwickler.', 'Du solltest sie versionieren wie Code und Aenderungen testen.'],
      ['Wie teste ich einen System-Prompt?', 'Mit festen Testfragen und erwarteten Antwortmustern.', 'Vergleiche mehrere Laeufe und messe Konsistenz und Qualitaet.'],
    ]),
    [
      ['Was ist ein System-Prompt?', 'Die feste Rollen- und Regelanweisung vor dem Gespraech.', 'Eine zufaellige Nutzerfrage.', 'Ein Datenbank-Backup.', 'Ein CSS-Stylesheet.'],
      ['Was ist das Kontext-Fenster?', 'Der begrenzte sichtbare Gespraechs- und Dokumentspeicher.', 'Die Festplatte deines Laptops.', 'Die Git-Historie.', 'Ein Browser-Cache ohne Limit.'],
      ['Was regelt die Instruktions-Hierarchie?', 'Welche Anweisung bei Konflikten gewinnt.', 'Die Reihenfolge von Git-Commits.', 'Die DNS-TTL.', 'Die npm-Version.'],
      ['Warum kurze System-Prompts?', 'Sie sparen Kontext-Fenster fuer Nutzerdaten.', 'Sie machen Antworten immer laenger.', 'Sie verbieten Tool-Calling.', 'Sie ersetzen Tests.'],
      ['Wo steht der System-Prompt in APIs?', 'Oft im messages-Array mit role system.', 'Nur im HTML-Title.', 'Im package-lock.json.', 'In der .env als Kommentar.'],
      ['Was gehoert in einen System-Prompt?', 'Rolle, Ton, Grenzen und Ausgabeformat.', 'Nur der Nutzername.', 'Nur der API-Key.', 'Nur Stacktrace-Daten.'],
      ['Was passiert bei vollem Kontext-Fenster?', 'Aeltere Teile fallen aus dem sichtbaren Bereich.', 'Das Modell wird kostenlos.', 'Git merge schlaegt fehl.', 'DNS stoppt.'],
      ['Wie pruefst du Prompt-Aenderungen?', 'Mit wiederholbaren Testfaellen.', 'Nur durch Bauchgefuehl.', 'Nur im Production-Deploy.', 'Gar nicht.'],
      ['Warum Hierarchie wichtig?', 'Sonst folgt das Modell widerspruechlichen Regeln.', 'Sonst wird CSS schneller.', 'Sonst entfaellt TypeScript.', 'Sonst wird Git optional.'],
      ['Typischer Fehler bei System-Prompts?', 'Zu vage Regeln ohne Grenzen.', 'Zu klare Rollenbeschreibung.', 'Explizite Ausgabeformate.', 'Testbare Beispiele.'],
      ['System-Prompt vs Nutzer-Prompt?', 'System setzt Rahmen, Nutzer stellt Aufgabe.', 'Beide sind identisch.', 'Nutzer steht immer ueber System.', 'System ist nur Dekoration.'],
      ['Gutes Zeichen fuer Prompt-Qualitaet?', 'Konsistente Antworten bei gleichen Tests.', 'Jede Antwort voellig zufaellig.', 'Nur lange Antworten ohne Struktur.', 'Keine Fehlerbehandlung moeglich.'],
    ]),

  L('M08-02-02', 'Was RAG bedeutet', ['M08-02-01'], [
    { term: 'RAG-Pipeline', definition: 'Retrieval Augmented Generation: Erst relevante Dokumente suchen, dann mit diesen Treffern antworten. Die RAG-Pipeline verbindet Wissensdatenbank und Sprachmodell. Sie reduziert Halluzinationen bei firmeneigenem Wissen.' },
    { term: 'Embedding-Vektor', definition: 'Eine numerische Repraesentation eines Textabschnitts im Vektorraum. Aehnliche Bedeutungen liegen im Embedding-Vektor-Raum nah beieinander. So findet die Suche semantisch passende Chunks, nicht nur exakte Woerter.' },
    { term: 'Wissens-Chunk', definition: 'Ein kleiner, zusammenhaengender Textabschnitt aus einer Wissensquelle, der einzeln indexiert wird. Gute Wissens-Chunks sind lang genug fuer Kontext und kurz genug fuer praezises Retrieval.' },
  ], 'RAG', 'Stell dir eine Bibliothek mit Karteikarten vor. Du fragst nach einem Rezept. Die Bibliothekarin holt nicht das ganze Buch, sondern die drei passendsten Karten. Erst dann formuliert sie die Antwort. RAG funktioniert genauso.', 'RAG bedeutet: zuerst suchen, dann antworten. Die RAG-Pipeline holt Wissens-Chunks per Embedding-Vektoren und gibt sie dem Modell als Kontext. So antwortet das Modell mit deinen Dokumenten, nicht nur mit Training.', 'RAG = Suche plus Generierung. Embedding-Vektoren finden Bedeutung. Wissens-Chunks liefern Belege.', 'repo-futuredev', 'content/lessons/ als Wissensbasis fuer Lern-Apps', 'Baue eine Mini-RAG-Pipeline: drei Chunks indexieren, eine Frage stellen, Treffer dokumentieren.', ['Drei Chunks definiert.', 'Frage gestellt.', 'Treffer erklaert.'], 'P04',
    faq('Was RAG bedeutet', [
      ['Brauche ich RAG fuer jede App?', 'Nein, nur wenn aktuelles eigenes Wissen wichtig ist.', 'Fuer reine Code-Hilfe reicht oft der Repo-Kontext im Agenten.'],
      ['Ersetzt RAG fein tuning?', 'Nein, es sind verschiedene Werkzeuge.', 'RAG bringt Wissen zur Laufzeit, Training aendert das Modell selbst.'],
      ['Was wenn Retrieval falsche Chunks liefert?', 'Die Antwort wird falsch oder halluziniert.', 'Deshalb sind Chunk-Groesse und Metadaten entscheidend.'],
      ['Ist RAG teuer?', 'Suche plus groesserer Prompt kosten extra.', 'Aber guenstiger als ständiges Modell-Nachtraining.'],
      ['Wie messe ich RAG-Qualitaet?', 'Mit Testfragen und erwarteten Quellen.', 'Pruefe Trefferquote und Antwortkorrektheit getrennt.'],
    ]),
    [
      ['Was bedeutet RAG?', 'Retrieval Augmented Generation.', 'Random Access Gateway.', 'Remote API Gateway.', 'Runtime Asset Generator.'],
      ['Wofuer Embedding-Vektoren?', 'Semantische Aehnlichkeitssuche.', 'Audio-Kompression.', 'CSS-Farbwerte.', 'Git-SHA Berechnung.'],
      ['Was ist ein Wissens-Chunk?', 'Ein indexierter Textabschnitt.', 'Ein npm-Paket.', 'Ein Docker-Layer.', 'Ein HTTP-Header.'],
      ['Erster Schritt in RAG?', 'Relevante Dokumente retrievalen.', 'Sofort antworten ohne Kontext.', 'Modell neu trainieren.', 'DNS aendern.'],
      ['Vorteil von RAG?', 'Antworten mit aktuellem eigenem Wissen.', 'Kein Internet noetig ever.', 'Ersetzt alle Tests.', 'Macht Prompts ueberfluessig.'],
      ['Typischer Fehler bei Chunks?', 'Zu grosse oder zu kleine Stuecke.', 'Perfekte Satzgrenzen immer.', 'Metadaten immer optional.', 'Keine Duplikatpruefung noetig.'],
      ['Was kommt in den Prompt?', 'Gefundene Chunks als Kontext.', 'Nur der API-Key.', 'Die ganze Datenbank roh.', 'Nur Emojis.'],
      ['Halluzination und RAG?', 'RAG reduziert, beseitigt aber nicht alles.', 'RAG garantiert 100 Prozent Wahrheit.', 'RAG verbietet Quellenangaben.', 'RAG ersetzt menschliche Pruefung.'],
      ['Embedding-Suche vs Keyword?', 'Embeddings finden Bedeutung, Keywords exakte Woerter.', 'Beide sind immer identisch.', 'Keywords sind immer besser.', 'Embeddings brauchen kein Modell.'],
      ['Metadaten an Chunks?', 'Helfen Filtern nach Quelle oder Datum.', 'Sind immer unnoetig.', 'Ersetzen Embeddings.', 'Verhindern jede Suche.'],
      ['RAG in FutureDev?', 'Lektionstexte als Wissensbasis denkbar.', 'Unmoeglich mit JSON-Dateien.', 'Nur fuer Bilder.', 'Nur ohne Audio.'],
      ['Qualitaetsmetrik?', 'Trefferquote plus Antwort-Check.', 'Nur Token-Anzahl.', 'Nur Latenz.', 'Nur Farbe des UI.'],
    ]),

  L('M08-02-03', 'Strukturierte JSON-Ausgaben erzwingen', ['M08-02-02'], [
    { term: 'JSON-Schema-Modus', definition: 'Ein API-Modus, der das Modell zwingt, Antworten in einem festen JSON-Schema zu liefern. Felder, Typen und Pflichtkeys sind vorher definiert. So wird aus Freitext maschinenlesbare Struktur.' },
    { term: 'Ausgabe-Parsing', definition: 'Das Auslesen und Validieren der Modellantwort als JSON in deinem Programm. Ausgabe-Parsing faengt Syntaxfehler und fehlende Felder ab, bevor die Daten weiterverarbeitet werden.' },
    { term: 'Validierungs-Fallback', definition: 'Ein definierter Plan B, wenn die Modell-Ausgabe das Schema nicht erfuellt. Validierungs-Fallback kann Retry, Reparatur-Prompt oder sichere Standardwerte bedeuten, statt stiller Fehler in Produktion.' },
  ], 'JSON-Ausgabe', 'Stell dir ein Formular mit festen Kaestchen vor. Name, Alter, Stadt. Wer ausserhalb der Kaestchen schreibt, faellt durchs Raster. JSON-Schema-Modus ist dieses Formular fuer KI-Antworten.', 'Strukturierte JSON-Ausgaben machen KI-Ergebnisse programmierbar. JSON-Schema-Modus definiert das Format. Ausgabe-Parsing prueft es. Validierungs-Fallback verhindert Crashes bei kaputten Antworten.', 'Schema erzwingen, parsen, Fallback planen. So wird KI-Ausgabe zuverlaessig.', 'repo-futuredev', 'packages/content-schema/src/lesson.ts als Schema-Vorbild', 'Lass ein Modell eine Lektions-Vorschau als JSON liefern und validiere mit Zod.', ['Schema definiert.', 'Antwort geparst.', 'Fallback dokumentiert.'], 'P04',
    faq('Strukturierte JSON-Ausgaben erzwingen', [
      ['Brauche ich immer JSON-Schema-Modus?', 'Nein, nur wenn dein Code strukturierte Felder braucht.', 'Fuer Brainstorming reicht Freitext.'],
      ['Was wenn JSON kaputt ist?', 'Nutze Validierungs-Fallback mit Retry oder Reparatur.', 'Nie blind in Produktion weiterverarbeiten.'],
      ['Reicht Regex auf Freitext?', 'Regex ist fragil bei natuerlicher Sprache.', 'Schema-Modus ist robuster fuer Maschinen.'],
      ['Wie teste ich Parsing?', 'Mit gueltigen und absichtlich kaputten Antworten.', 'Unit-Tests auf Parser und Fallback.'],
      ['Kann das Modell extra Felder erfinden?', 'Schema-Modus beschraenkt erlaubte Felder.', 'Trotzdem Parsing behalten als Sicherheitsnetz.'],
    ]),
    [
      ['Was ist JSON-Schema-Modus?', 'Erzwingt strukturierte Modellantworten.', 'Ein CSS-Framework.', 'Ein Git-Befehl.', 'Ein DNS-Record.'],
      ['Warum Ausgabe-Parsing?', 'Faengt kaputte JSON vor Weiterverarbeitung.', 'Macht Code langsamer ohne Nutzen.', 'Ersetzt TypeScript.', 'Verhindert Tests.'],
      ['Was ist Validierungs-Fallback?', 'Plan B bei Schema-Verletzung.', 'Ignorieren aller Fehler.', 'Loeschen der Datenbank.', 'Neustart des Servers.'],
      ['Typischer Anwendungsfall?', 'API die Felder title und duration braucht.', 'Reine Prosa ohne Struktur.', 'Bilder ohne Metadaten.', 'Audio ohne Transkript.'],
      ['Parser in TypeScript?', 'Zod oder JSON.parse plus Checks.', 'Nur alert().', 'Nur console.log ohne Pruefung.', 'Gar kein Parsing.'],
      ['Retry sinnvoll?', 'Ja, mit klarer Fehlermeldung ans Modell.', 'Unbegrenzt ohne Limit.', 'Nie, immer abbrechen.', 'Nur nachts.'],
      ['Feld fehlt?', 'Fallback oder Fehler an Nutzer.', 'Stille Null-Werte ueberall.', 'Zufaellige Defaults ohne Log.', 'Produktion crasht.'],
      ['Extra Felder?', 'Schema kann unbekannte Keys verbieten.', 'Immer alles akzeptieren.', 'Felder nie pruefen.', 'JSON optional.'],
      ['Zod Vorteil?', 'Typen und Validierung zusammen.', 'Nur Farben im UI.', 'Ersetzt Git.', 'Macht DNS schneller.'],
      ['Fehler loggen?', 'Ja, ohne Secrets und ohne PII.', 'Immer voller Prompt mit Keys.', 'Nie loggen.', 'Nur per E-Mail an alle.'],
      ['FutureDev Beispiel?', 'lessonSchema validiert Lektions-JSON.', 'Keine Validierung noetig.', 'Nur manuell lesen.', 'Nur Audio zaehlt.'],
      ['Produktionsregel?', 'Nie ungepruefte Modell-JSON trusten.', 'Modell ist immer korrekt.', 'Parser ist optional.', 'Fallback ist Luxus.'],
    ]),
];

// Append remaining lessons via compact batch generator
function batchLessons(entries) {
  return entries.map((e) => L(...e));
}

REST_LESSONS.push(
  ...batchLessons([
    // M08-03
    ['M08-03-01', 'Wie ein API-Aufruf an ein Sprachmodell aussieht', ['M08-02-03'], [
      { term: 'Chat-Completion-Endpunkt', definition: 'Die HTTP-Schnittstelle, ueber die du Nachrichten an ein Sprachmodell sendest und eine Antwort zurueckbekommst. Der Chat-Completion-Endpunkt erwartet typischerweise Rollen wie system, user und assistant in einem messages-Array.' },
      { term: 'Token-Budget', definition: 'Die maximale Anzahl an Tokens, die Eingabe und Ausgabe zusammen verbrauchen duerfen. Das Token-Budget begrenzt Kosten und verhindert abgeschnittene Antworten, wenn es zu knapp gewaehlt ist.' },
      { term: 'API-Payload', definition: 'Der JSON-Body eines API-Aufrufs mit Modellname, Nachrichten, Parametern und optionalen Tools. Ein sauberer API-Payload enthaelt nur noetige Felder und keine Geheimnisse im Klartext im Repo.' },
    ], 'LLM-API', 'Stell dir einen Briefumschlag vor. Absender, Empfaenger, Betreff und Inhalt muessen stimmen. Der Chat-Completion-Endpunkt ist der Briefkasten. Token-Budget ist das Gewichtslimit. API-Payload ist der Brief selbst.', 'Ein LLM-API-Aufruf sendet strukturierte Nachrichten an den Chat-Completion-Endpunkt. Du planst Token-Budget und baust einen sauberen API-Payload. So wird aus Prompt-Text eine technische Anfrage.', 'Endpunkt, Budget, Payload. Drei Bausteine fuer jeden LLM-Aufruf.', 'repo-futuredev', 'packages/ mit API-Beispielen', 'Schreibe einen Pseudocode-Aufruf mit system und user Message und schaetze Tokens.', ['Payload skizziert.', 'Token-Budget geschaetzt.', 'Rollen erklaert.'], 'P04',
      faq('Wie ein API-Aufruf an ein Sprachmodell aussieht', [
        ['Wo liegen API-Keys?', 'In Umgebungsvariablen, nie im Git-Repo.', 'Keys gehoeren nur auf den Server oder in lokale .env ohne Commit.'],
        ['Was ist ein Token ungefaehr?', 'Etwa ein Wortteil in vielen Sprachen.', 'Laenge variiert je Sprache und Modell.'],
        ['Kann ich streamen?', 'Ja, viele APIs unterstuetzen Streaming.', 'Streaming zeigt Antworten Stueck fuer Stueck.'],
        ['Was bei Rate Limits?', 'Backoff und Retry mit Limits einplanen.', 'Nicht unendlich sofort wiederholen.'],
        ['Brauche ich immer Tools?', 'Nein, nur wenn der Agent handeln soll.', 'Einfache Fragen brauchen kein Tool-Calling.'],
      ]),
      [
        ['Chat-Completion-Endpunkt?', 'HTTP-API fuer Modellantworten.', 'FTP-Server fuer Bilder.', 'SMTP fuer Mail.', 'DNS-Resolver.'],
        ['Token-Budget?', 'Limit fuer Input plus Output.', 'Festplattengroesse.', 'CPU-Kerne.', 'RAM-Takt.'],
        ['API-Payload?', 'JSON-Body der Anfrage.', 'HTML-Seite.', 'CSS-Datei.', 'Git-Branch.'],
        ['Typische Rollen?', 'system, user, assistant.', 'admin, guest nur.', 'root, wheel.', 'GET, POST.'],
        ['Key im Repo?', 'Niemals.', 'Immer in README.', 'In jedem Commit.', 'In Quiz-Optionen.'],
        ['Streaming Nutzen?', 'Fruehere sichtbare Antwortteile.', 'Guenstigere Tokens immer.', 'Kein Parsing noetig ever.', 'Ersetzt Validierung.'],
        ['Rate Limit Reaktion?', 'Warten und begrenzt retry.', 'Sofort tausend Requests.', 'Server neu installieren.', 'Keys oeffentlich posten.'],
        ['Modell waehlen wo?', 'Im Payload Feld model.', 'Im DNS TXT Record.', 'Im Cookie Banner.', 'Im Favicon.'],
        ['Temperature Parameter?', 'Steuert Zufaelligkeit der Antwort.', 'Festplatten-Temperatur.', 'CPU-Luefter.', 'Netzwerk-Latenz.'],
        ['Fehler 401 bedeutet?', 'Auth-Problem mit Key.', 'Erfolg.', 'Seite nicht gefunden.', 'Server voll automatisch OK.'],
        ['Messages Array?', 'Liste der Gespraechsrollen.', 'Array von Bildern only.', 'Nur ein String immer.', 'Optional und nutzlos.'],
        ['Produktionsregel?', 'Keys aus Env, Payload validieren.', 'Alles im Frontend hardcoden.', 'Keine Fehlerbehandlung.', 'Unbegrenzt teure Modelle.'],
      ]],

    ['M08-03-02', 'Anthropic und OpenAI im Vergleich', ['M08-03-01'], [
      { term: 'Claude-Modell-Familie', definition: 'Die Modellreihe von Anthropic, darunter Varianten fuer schnelle und fuer tiefe Aufgaben. Die Claude-Modell-Familie legt Wert auf laenge Kontexte und instruktionstreues Verhalten.' },
      { term: 'GPT-Modell-Familie', definition: 'Die Modellreihe von OpenAI mit verschiedenen Groessen und Faehigkeiten. Die GPT-Modell-Familie ist weit verbreitet und hat ein grosses Oekosystem an Tools und Integrationen.' },
      { term: 'Anbieter-Schnittstelle', definition: 'Das gemeinsame Muster aus Endpunkt, Auth-Header, messages-Format und Preismodell, das du beim Wechsel zwischen Anbietern abstrahieren solltest. Eine stabile Anbieter-Schnittstelle in deinem Code erleichtert Anbieterwechsel.' },
    ], 'LLM-Anbieter', 'Stell dir zwei Taxifirmen vor. Beide bringen dich ans Ziel, aber Fahrpreis, Komfort und Wartezeit unterscheiden sich. Claude-Modell-Familie und GPT-Modell-Familie sind solche Anbieter fuer KI-Aufgaben.', 'Anthropic und OpenAI bieten aehnliche APIs mit unterschiedlichen Staerken. Vergleiche Claude-Modell-Familie und GPT-Modell-Familie anhand deiner Aufgabe. Kapsle Unterschiede hinter einer Anbieter-Schnittstelle in deinem Code.', 'Waehle Anbieter nach Aufgabe, nicht nach Hype. Abstrahiere die Schnittstelle.', 'repo-futuredev', 'Dokumentation externer Anbieter plus eigene Adapter-Schicht', 'Schreibe eine Entscheidungsmatrix mit drei Kriterien fuer dein Projekt.', ['Kriterien definiert.', 'Zwei Anbieter verglichen.', 'Empfehlung begruendet.'], 'P04',
      faq('Anthropic und OpenAI im Vergleich', [
        ['Kann ich beide parallel nutzen?', 'Ja, mit Adapter-Schicht im Code.', 'Wechsle nicht pro Request wild ohne Grund.'],
        ['Was ist mit Datenschutz?', 'Pruefe DPA und Region pro Anbieter.', 'Keine Kundendaten ohne Vertrag in Prompts.'],
        ['Wechsel wegen Preis?', 'Moeglich, wenn Schnittstelle abstrahiert ist.', 'Messt Kosten pro erfolgreicher Aufgabe.'],
        ['Welches Modell fuer Code?', 'Haengt von Tests und Review ab.', 'Kein Modell ersetzt deine Pruefung.'],
        ['Vendor Lock-in vermeiden?', 'Eigene Adapter und keine exotischen Features.', 'Prompts an Standard messages koppeln.'],
      ]),
      [
        ['Claude-Modell-Familie?', 'Anthropic Modellreihe.', 'Google DNS Produkt.', 'Stripe Checkout.', 'Cloudflare Worker only.'],
        ['GPT-Modell-Familie?', 'OpenAI Modellreihe.', 'Linux Kernel.', 'React Hook.', 'PostgreSQL Index.'],
        ['Anbieter-Schnittstelle?', 'Abstraktion ueber konkrete APIs.', 'Hardcoded OpenAI only forever.', 'Kein Error Handling.', 'Nur Frontend Fetch.'],
        ['Vergleichskriterium?', 'Kosten, Kontext, Qualitaet, Datenschutz.', 'Logo-Farbe.', 'Groesse der Webseite.', 'Anzahl Mitarbeiter only.'],
        ['Lock-in Risiko?', 'Exotische proprietaere Felder.', 'Standard messages Array.', 'Env fuer Keys.', 'Tests fuer Adapter.'],
        ['EU-Daten?', 'Region und Vertrag pruefen.', 'Ignorieren.', 'Im Prompt posten.', 'Oeffentlich loggen.'],
        ['Multi-Anbieter?', 'Adapter Pattern im Backend.', 'Zwei Keys im Client.', 'Keys in Git.', 'Kein Monitoring.'],
        ['Qualitaet messen?', 'Feste Benchmark-Aufgaben.', 'Eine Demo reicht.', 'Nur Twitter Meinung.', 'Gar nicht.'],
        ['Kosten vergleichen?', 'Preis pro Million Tokens plus Erfolgsrate.', 'Nur Monatsabo.', 'Nur Gratis-Tier.', 'Ignorieren.'],
        ['Code-Aufgaben?', 'Modell plus Review plus Tests.', 'Modell allein reicht.', 'Kein Git noetig.', 'Kein Lint noetig.'],
        ['FutureDev Nutzung?', 'Vertonung und Content-Hilfe moeglich.', 'Ersetzt Autoren komplett.', 'Ohne Validierung.', 'Ohne Kostenblick.'],
        ['Empfehlung Anfaenger?', 'Ein Anbieter lernen, dann abstrahieren.', 'Alle gleichzeitig ohne Plan.', 'Nur lokale Modelle only.', 'Keine Docs lesen.'],
      ]],

    ['M08-03-03', 'Kosten pro Anfrage verstehen', ['M08-03-02'], [
      { term: 'Input-Token-Preis', definition: 'Der Preis pro Million oder tausend Tokens, die du an das Modell sendest. Input-Token-Preis umfasst System-Prompt, Kontext und Nutzernachrichten.' },
      { term: 'Output-Token-Preis', definition: 'Der Preis fuer vom Modell erzeugte Tokens in der Antwort. Output-Token-Preis ist oft hoeher als Input-Token-Preis und waechst bei langen Antworten schnell.' },
      { term: 'Kosten-Obergrenze', definition: 'Ein festes Limit fuer API-Kosten pro Tag, Nutzer oder Feature. Eine Kosten-Obergrenze stoppt teure Ueberraschungen durch Schleifen, Bugs oder Missbrauch.' },
    ], 'LLM-Kosten', 'Stell dir Stromzaehler vor. Einer misst, was du einspeist, einer misst, was verbraucht wird. Input-Token-Preis und Output-Token-Preis sind diese Zaehler. Kosten-Obergrenze ist die Sicherung im Sicherungskasten.', 'LLM-Nutzung kostet pro Token. Input-Token-Preis und Output-Token-Preis zusammen ergeben den Preis pro Anfrage. Setze Kosten-Obergrenzen und messe echte Nutzung, bevor du skalierst.', 'Messe Tokens, rechne Preise, setze Limits.', 'repo-futuredev', 'Kosten-Schaetzung in Projektdokumentation', 'Rechne Kosten fuer 1000 Nutzer-Anfragen mit kurzem und langem Prompt.', ['Input geschaetzt.', 'Output geschaetzt.', 'Obergrenze definiert.'], 'P04',
      faq('Kosten pro Anfrage verstehen', [
        ['Wie schaetze ich Tokens schnell?', 'Worte mal Faktor oder Tokenizer-Tool.', 'Lieber grozuegig schaetzen am Anfang.'],
        ['Warum Output oft teurer?', 'Generierung braucht mehr Rechenzeit.', 'Lange Antworten multiplizieren Kosten.'],
        ['Was bei Endlosschleifen im Agenten?', 'Kosten-Obergrenze und Max-Steps setzen.', 'Jeden Tool-Call zaehlen.'],
        ['Free Tier reicht?', 'Nur fuer Experimente.', 'Produktion braucht Budget und Monitoring.'],
        ['Kosten senken wie?', 'Kuerzere Prompts, kleinere Modelle, Caching.', 'Nicht blind das groesste Modell ueberall.'],
      ]),
      [
        ['Input-Token-Preis?', 'Kosten fuer gesendeten Text.', 'Kosten fuer Festplatte.', 'Kosten fuer Domain.', 'Kosten fuer SSL only.'],
        ['Output-Token-Preis?', 'Kosten fuer generierte Antwort.', 'Kosten fuer npm Download.', 'Kosten fuer Git Push.', 'Kosten fuer DNS Lookup.'],
        ['Kosten-Obergrenze?', 'Limit gegen Ueberraschungen.', 'Unbegrenzt immer OK.', 'Nur fuer Marketing.', 'Optional in Prod.'],
        ['Teuer bei Agenten?', 'Viele Schritte multiplizieren Tokens.', 'Agenten sind immer gratis.', 'Nur ein Request.', 'Kein Tool-Calling Kosten.'],
        ['Monitoring?', 'Tokens und Euro pro Feature tracken.', 'Ignorieren bis Rechnung.', 'Nur CPU messen.', 'Nur RAM messen.'],
        ['Caching hilft?', 'Ja bei wiederholten Kontexten.', 'Nie sinnvoll.', 'Ersetzt Auth.', 'Verhindert Tests.'],
        ['Kleineres Modell?', 'Oft guenstiger fuer einfache Tasks.', 'Immer schlechter.', 'Immer verboten.', 'Nur fuer Hobby.'],
        ['Budget Alert?', 'Warnung vor Limit-Ueberschreitung.', 'Erst nach 10k Euro.', 'Keine Alerts.', 'Nur Sonntags.'],
        ['Kosten pro Nutzer?', 'Wichtig fuer SaaS Preis.', 'Irrelevant immer.', 'Nur Designer interessiert.', 'Nur HR interessiert.'],
        ['Schleife erkennen?', 'Ploetzlich steigende Request-Zahl.', 'Konstante Kosten always.', 'Nur langsamer Code.', 'Nur CSS Fehler.'],
        ['FutureDev Beispiel?', 'Vertonung und Validierung kosten planbar.', 'Alles kostenlos unlimited.', 'Keine Abschaetzung.', 'Kein Limit noetig.'],
        ['Produktionsregel?', 'Limits plus Monitoring von Tag eins.', 'Erst nach Incident.', 'Keys oeffentlich.', 'Kein Logging.'],
      ]],
  ]),
);

// M08-04 through M10 - continue in part 2 file merge
import { REST_LESSONS_PART2 } from './generate-all-m08-m10-data-part2.mjs';
REST_LESSONS.push(...REST_LESSONS_PART2);
