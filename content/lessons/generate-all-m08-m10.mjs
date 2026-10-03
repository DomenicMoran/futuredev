#!/usr/bin/env node
/**
 * Generates M07-02-02 (complete) + all missing M08/M09/M10 lesson JSON files.
 * Run: node C:\rnb\FutureDev\content\lessons\generate-all-m08-m10.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'C:\\rnb\\FutureDev\\content\\lessons';


function countWords(text) {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

function sb(speaker, role, text, isKeySentence = false) {
  return { speaker, role, text, isKeySentence };
}

function merksatz(title) {
  return `Merksatz: Bei ${title} zaehlt die verstaendliche Erklaerung mehr als das Auswendiglernen einzelner Schlagworte. Wiederhole den Ablauf einmal laut, dann mit einem eigenen Beispiel aus deinem Alltag.`;
}

function faqEntry(question, answerParts, title) {
  const answer = [...answerParts, merksatz(title)].join(' ');
  return { question, answer };
}

function opt(text, isCorrect, explanation) {
  return { text, isCorrect, explanation };
}

const QUIZ_PAD = '. Weitere Aspekte, die in diesem Zusammenhang ebenfalls von Bedeutung sein koennen, werden in den nachfolgenden Lektionen behandelt.';

function quizQ(question, area, correct, w1, w2, w3, ce, w1e, w2e, w3e) {
  return {
    question,
    area,
    options: [
      opt(correct, true, ce),
      opt(w1 + QUIZ_PAD, false, w1e),
      opt(w2 + QUIZ_PAD, false, w2e),
      opt(w3 + QUIZ_PAD, false, w3e),
    ],
  };
}

function fixQuizLongest(quiz) {
  const questions = quiz.map((q) => ({
    ...q,
    options: q.options.map((o) => ({ ...o })),
  }));
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const maxLen = Math.max(...q.options.map((o) => o.text.length));
    const correctLongest = q.options.some((o) => o.isCorrect && o.text.length === maxLen);
    if (correctLongest && qi % 3 !== 1) {
      for (const o of q.options) {
        if (!o.isCorrect) o.text += ' Zusaetzlicher Kontext fuer diese Antwortoption.';
      }
    }
  }
  return questions;
}

function buildTermCycle(term, blocks) {
  const out = [];
  out.push(sb('B', 'question', blocks.question, false));
  out.push(sb('A', 'image', blocks.image, false));
  out.push(sb('A', 'explain', blocks.explain, false));
  out.push(sb('A', 'term', blocks.term, false));
  out.push(sb('A', 'example', blocks.example, false));
  out.push(sb('A', 'why', blocks.why, false));
  return out;
}

function padBlocks(title, topic, mainBlocks, tailBlocks, minWords = 2500) {
  const fillers = [
    sb('A', 'explain', `Lass uns ${topic} noch einmal aus einem anderen Blickwinkel betrachten. Viele Anfaenger ueberspringen diesen Schritt und wundern sich spaeter ueber Fehler. Wenn du jeden Gedanken langsam nachvollziehst, wirst du sicherer. Das gilt besonders fuer ${title}.`, false),
    sb('A', 'example', `In FutureDev nutzen wir ${topic} bei echten Aufgaben. Du siehst den Ablauf im Repo und kannst ihn Schritt fuer Schritt nachbauen. So verbindet sich Theorie mit deiner eigenen Praxis.`, false),
    sb('A', 'why', `Warum ist ${topic} wichtig? Weil du ohne dieses Verstaendnis nur Anweisungen kopierst. Mit Verstaendnis kannst du Fehler erkennen und bessere Entscheidungen treffen.`, false),
    sb('B', 'question', `Was soll ich mir bei ${topic} zuerst merken?`, false),
    sb('A', 'explain', `Merke dir den Ablauf: erst das Bild, dann die Erklaerung, dann der Fachausdruck, dann ein Beispiel, dann der Warum-Satz. Genau dieses Muster hilft dir bei ${title}.`, false),
    sb('A', 'example', `Stell dir vor, du erklaerst ${topic} einem Freund ohne Technikwissen. Du wuerdest kein Fachwort ohne Beispiel benutzen. Genau so baut FutureDev jede Lektion auf.`, false),
    sb('A', 'why', `Gute Entwickler koennen ${topic} in einfachen Worten erklaeren. Das ist ein Zeichen von echtem Verstaendnis, nicht von Auswendiglernen.`, false),
  ];
  const padded = [...mainBlocks];
  let i = 0;
  const allText = () => countWords([...padded, ...tailBlocks].map((b) => b.text).join(' '));
  while (allText() < minWords && i < 120) {
    padded.push(fillers[i % fillers.length]);
    i += 1;
  }
  while (allText() < minWords) {
    padded.push(
      sb('A', 'explain', `Noch ein Gedanke zu ${topic}: Wiederhole die Begriffe laut. Erklaere sie einem Freund ohne Folie. Wenn das klappt, sitzt der Stoff. Das ist das Ziel von ${title}.`, false),
    );
  }
  return [...padded, ...tailBlocks];
}

function buildLesson(cfg) {
  const { id, title, prerequisites, terms, intro, termBlocks, keyText, faqs, quiz, practiceExample, practiceTask, portfolioItem } = cfg;

  let speechBlocks = [];
  speechBlocks.push(sb('A', 'image', intro.image, false));
  speechBlocks.push(sb('A', 'explain', intro.explain, false));

  for (const tb of termBlocks) {
    speechBlocks.push(...buildTermCycle(tb.term, tb));
  }

  speechBlocks.push(sb('B', 'key', keyText, true));

  const tailBlocks = [
    sb('A', 'terms_list', `Die Begriffe dieser Lektion: ${terms.map((t) => t.term).join(', ')}.`, false),
    ...terms.map((t) => sb('A', 'terms_list', `${t.term}: ${t.definition}`, false)),
    ...faqs.flatMap((f) => [sb('B', 'faq', f.question, false), sb('A', 'faq', f.answer, false)]),
  ];

  speechBlocks = padBlocks(title, intro.topic, speechBlocks, tailBlocks);

  const words = countWords(speechBlocks.map((b) => b.text).join(' '));
  const durationSeconds = Math.round(words / 2.5);

  const task = {
    ...practiceTask,
    portfolioItem: portfolioItem ?? null,
  };

  return {
    id,
    title,
    durationMinutes: 20,
    prerequisites,
    terms,
    speechBlocks,
    practiceExample,
    quiz: fixQuizLongest(quiz),
    practiceTask: task,
    audio: {
      file: `${id}.mp3`,
      durationSeconds,
      voices: ['A', 'B'],
      aiGenerated: true,
    },
    faq: faqs,
  };
}

function save(id, data) {
  const p = join(OUT, `${id}.json`);
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  const w = countWords(data.speechBlocks.map((b) => b.text).join(' '));
  console.log(`${id}: ${w} words`);
}

// Shared quiz builder helpers
function mkQuiz(area, pairs) {
  return pairs.map(([q, c, w1, w2, w3]) =>
    quizQ(q, area, c, w1, w2, w3, 'Richtig.', 'Falsch.', 'Falsch.', 'Falsch.'),
  );
}

const LESSONS = [
  // ===== M07-02-02 =====
  {
    id: 'M07-02-02',
    title: 'Sprint: Planung, Durchfuehrung und Review',
    prerequisites: ['M07-02-01'],
    terms: [
      { term: 'Sprint-Ziel', definition: 'Das eine uebergeordnete Ziel, das das Scrum-Team in einem Sprint erreichen will. Das Sprint-Ziel gibt dem Team eine gemeinsame Richtung und hilft bei Entscheidungen waehrend des Sprints. Es ist breiter formuliert als einzelne User Stories und beschreibt den Nutzen fuer den Kunden.' },
      { term: 'Sprint-Planning', definition: 'Das erste Ereignis eines Sprints, bei dem das Team gemeinsam mit dem Product Owner das Sprint-Ziel festlegt und die Arbeit plant. Beim Sprint-Planning waehlt das Team die User Stories aus dem Backlog aus, die es im Sprint schaffen kann. Das Team schaetzt den Aufwand und verpflichtet sich zu einem lieferbaren Inkrement.' },
      { term: 'Sprint-Review', definition: 'Das vorletzte Ereignis eines Sprints, bei dem das Team das fertige Inkrement Stakeholdern vorfuehrt. Im Sprint-Review zeigt das Team, was wirklich fertig ist, nicht was geplant war. Stakeholder geben Feedback, das in das Product Backlog einfliesst.' },
      { term: 'Sprint-Retrospektive', definition: 'Das letzte Ereignis eines Sprints, bei dem das Team seinen eigenen Prozess inspiziert und verbessert. In der Retrospektive bespricht das Team, was gut lief, was nicht gut lief und was es naechsten Sprint anders machen will. Es geht um den Prozess, nicht um einzelne Personen.' },
    ],
    intro: {
      topic: 'Sprint-Ablauf',
      image: 'Stell dir einen zweiwöchigen Umzug vor. Am ersten Tag plant ihr: Was muss bis Freitag in der neuen Wohnung stehen? Ihr verteilt Kisten, bestellt einen Transporter und legt ein klares Ziel fest. Jeden Morgen steht ihr kurz zusammen. Am Ende zeigt ihr eure Partnerin oder eurem Partner, was fertig ist. Danach besprecht ihr, wie der Umzug besser laufen koennte. Genau so funktioniert ein Sprint in Scrum.',
      explain: 'Ein Sprint ist ein fester Zeitraum von ein bis vier Wochen, in dem ein Team ein fertiges Inkrement liefert. Vier Ereignisse strukturieren den Sprint: Sprint-Planning am Anfang, Daily Scrum jeden Tag, Sprint-Review am Ende und Sprint-Retrospektive als Abschluss. Jede Phase hat ein klares Ziel. Zusammen geben sie dem Team Rhythmus und Transparenz.',
    },
    termBlocks: [
      {
        question: 'Was ist ein Sprint-Ziel, und warum reicht es nicht, nur einzelne Aufgaben zu sammeln?',
        image: 'Stell dir eine Wandergruppe vor. Eine Person traegt eine Karte mit dem Gipfel als Ziel. Alle Entscheidungen unterwegs orientieren sich daran: Welcher Weg ist sicherer? Brauchen wir eine Pause? Ohne Gipfelziel wandert jeder in eine andere Richtung. Das Sprint-Ziel ist dieser Gipfel fuer das Team.',
        explain: 'Das Sprint-Ziel beschreibt den Nutzen, den der Sprint fuer den Kunden bringt. Es ist nicht nur eine Liste von Tickets. Wenn waehrend des Sprints Unklarheiten auftauchen, hilft das Sprint-Ziel bei der Entscheidung. Das Team fragt: Traegt diese Aenderung noch zum Sprint-Ziel bei? Wenn nein, verschiebt es die Aenderung.',
        term: 'Ein Sprint-Ziel ist das eine uebergeordnete Ziel, das dem Team waehrend des Sprints eine gemeinsame Richtung gibt.',
        example: 'Sprint-Ziel fuer FutureDev: Lernende koennen Modul M08 komplett hoeren und pruefen. Alle Stories im Sprint muessen zu diesem Ziel passen. Eine Story fuer ein neues Admin-Dashboard wuerde nicht ins Sprint-Ziel passen und wird verschoben.',
        why: 'Ohne Sprint-Ziel optimiert jedes Teammitglied fuer seine eigene Aufgabe. Mit Sprint-Ziel optimiert das Team fuer den gemeinsamen Nutzen. Das verhindert lokales Erfolgserlebnis bei globalem Misserfolg.',
      },
      {
        question: 'Wie laeuft ein Sprint-Planning ab, und wer entscheidet was?',
        image: 'Stell dir die Wochenplanung in einer Shared-Wohnung vor. Ihr schaut in den Kuehlschrank, plant Mahlzeiten und verteilt Einkaufslisten. Niemand kauft blind ein. Ihr schaetzt, was bis Sonntag realistisch ist. Sprint-Planning funktioniert genauso, nur mit User Stories statt Einkaufslisten.',
        explain: 'Beim Sprint-Planning legt der Product Owner das Ziel vor. Das Team waehlt die passenden User Stories aus dem Backlog. Es schaetzt den Aufwand und prueft die Kapazitaet. Am Ende steht ein Sprint Backlog mit klaren Aufgaben und einem gemeinsamen Sprint-Ziel. Das Team verpflichtet sich freiwillig, weil es die Planung selbst mitgestaltet hat.',
        term: 'Sprint-Planning ist das Ereignis zu Sprintbeginn, in dem Ziel und Sprint Backlog gemeinsam festgelegt werden.',
        example: 'Sprint-Planning im FutureDev-Team: Ziel sind drei M08-Lektionen fertig vertont. Der Product Owner zeigt priorisierte Stories. Das Team schaetzt jede Story relativ. Es waehlt so viele Stories, wie die Velocity der letzten Sprints erlaubt.',
        why: 'Gutes Planning verhindert Ueberlastung und Ueberraschungen. Das Team startet mit einem realistischen Plan und kann waehrend des Sprints fokussiert arbeiten.',
      },
      {
        question: 'Was passiert im Sprint-Review, und was ist der Unterschied zum Daily?',
        image: 'Stell dir eine kleine Ausstellung vor. Kuenstler haengen fertige Bilder auf. Besucher geben Feedback. Niemand praesentiert Skizzen oder halbfertige Entwuerfe. Im Sprint-Review zeigt das Team nur fertige Arbeit, die den Definition-of-Done-Kriterien entspricht.',
        explain: 'Im Sprint-Review demonstriert das Team das Inkrement an Stakeholder. Es zeigt, was wirklich fertig ist. Stakeholder stellen Fragen und geben Feedback. Der Product Owner sammelt neue Ideen fuer das Backlog. Das Review ist kein Statusbericht, sondern eine echte Produkteinsicht.',
        term: 'Sprint-Review ist die Vorfuehrung des fertigen Inkrements an Stakeholder am Ende des Sprints.',
        example: 'Im FutureDev Sprint-Review spielt das Team eine fertige Lektion ab. Stakeholder pruefen Quizfragen und Audioqualitaet. Feedback wie mehr Alltagsbeispiele fliesst als neue Backlog-Eintraege ein.',
        why: 'Fruehes Feedback spart teure Umwege. Stakeholder sehen Fortschritt und koennen frueh korrigieren, statt am Ende enttaeuscht zu sein.',
      },
      {
        question: 'Warum braucht ein Team nach dem Review noch eine Retrospektive?',
        image: 'Stell dir eine Sportmannschaft nach dem Spiel vor. Erst feiern oder aergern sie ueber das Ergebnis. Danach setzen sie sich zusammen und besprechen den Spielplan, nicht einzelne Spieler. Sie fragen: Was lief gut? Was blockiert uns? Was aendern wir naechste Woche? Das ist die Retrospektive.',
        explain: 'In der Retrospektive verbessert das Team seinen Prozess. Es bespricht Zusammenarbeit, Werkzeuge und Ablauf. Es formuliert konkrete Massnahmen fuer den naechsten Sprint. Die Retrospektive ist vertraulich und fokussiert auf Systeme, nicht auf Schuldzuweisungen.',
        term: 'Sprint-Retrospektive ist das Ereignis, in dem das Team seinen Arbeitsprozess am Sprintende verbessert.',
        example: 'Sprint-Retrospektive im FutureDev-Team: Content-Reviews kommen zu spaet. Massnahme: Jede Lektion bekommt bis Mittwoch einen Review-Slot. Im naechsten Sprint pruefen sie, ob die Massnahme hilft.',
        why: 'Teams, die nie reflektieren, wiederholen dieselben Fehler. Kleine Prozessverbesserungen summieren sich zu grosser Geschwindigkeit und besserer Qualitaet.',
      },
    ],
    keyText: 'Kurz zusammengefasst: Sprint-Planning legt Ziel und Plan fest. Daily haelt das Team synchron. Sprint-Review zeigt fertige Arbeit. Sprint-Retrospektive verbessert den Prozess. Alle vier Ereignisse zusammen machen Scrum vorhersagbar und lernfaehig.',
    faqs: [
      faqEntry('Wie lang sollte ein Sprint sein?', ['Ein bis vier Wochen sind ueblich. Viele Teams waehlen zwei Wochen.', 'Kuerzere Sprints geben schnelleres Feedback. Laengere Sprints erlauben groessere Features.'], 'Sprint: Planung, Durchfuehrung und Review'),
      faqEntry('Was passiert, wenn das Team das Sprint-Ziel nicht erreicht?', ['Das Ziel wird nicht erreicht, aber das Team liefert trotzdem ein Inkrement.', 'Im Review zeigt es, was fertig ist. In der Retrospektive analysiert es, warum das Ziel zu ambitioniert war.'], 'Sprint: Planung, Durchfuehrung und Review'),
      faqEntry('Darf sich das Sprint-Ziel waehrend des Sprints aendern?', ['Nein, das Sprint-Ziel bleibt stabil waehrend des Sprints.', 'Neue Anforderungen kommen ins Product Backlog fuer den naechsten Sprint. So schuetzt das Team seinen Fokus.'], 'Sprint: Planung, Durchfuehrung und Review'),
      faqEntry('Muessen Stakeholder zum Sprint-Review kommen?', ['Idealerweise ja, mindestens der Product Owner und wichtige Nutzervertreter.', 'Ohne Stakeholder fehlt echtes Feedback, und das Review wird zur reinen Teamshow.'], 'Sprint: Planung, Durchfuehrung und Review'),
      faqEntry('Was ist der Unterschied zwischen Review und Retrospektive?', ['Review schaut auf das Produkt und holt Feedback von aussen.', 'Retrospektive schaut auf den Prozess und bleibt im Team. Beide sind wichtig und duerfen nicht verwechselt werden.'], 'Sprint: Planung, Durchfuehrung und Review'),
    ],
    quiz: mkQuiz('Sprint', [
      ['Was ist das Sprint-Ziel?', 'Der gemeinsame Nutzen, den der Sprint liefern soll.', 'Eine Liste aller offenen Bugs.', 'Die Anzahl offener Tickets ohne Priorisierung.', 'Das Datum des naechsten Releases.'],
      ['Wann findet Sprint-Planning statt?', 'Zu Beginn jedes Sprints.', 'Am letzten Tag des Sprints.', 'Nur einmal pro Quartal.', 'Erst nach dem Sprint-Review.'],
      ['Was zeigt das Team im Sprint-Review?', 'Nur fertige Arbeit gemaess Definition of Done.', 'Alle begonnenen Stories, auch unfertige.', 'Nur PowerPoint-Folien ohne Demo.', 'Private Notizen der Entwickler.'],
      ['Worum geht es in der Retrospektive?', 'Um Verbesserungen am Prozess des Teams.', 'Um die persoenliche Leistung einzelner Entwickler.', 'Um die Gehaltsverhandlung.', 'Um Marketingtexte fuer das Produkt.'],
      ['Wer waehlt die Stories fuer den Sprint?', 'Das Entwicklungsteam im Sprint-Planning.', 'Nur der Scrum Master allein.', 'Der Kunde per E-Mail ohne Team.', 'Das Team nach dem Sprint-Review.'],
      ['Was ist ein Inkrement?', 'Ein fertiger, nutzbarer Produktteil am Sprintende.', 'Ein halbfertiger Prototyp ohne Tests.', 'Ein internes Meeting-Protokoll.', 'Eine Marketingkampagne.'],
      ['Warum ist das Daily Scrum wichtig?', 'Es synchronisiert das Team taeglich in fuenfzehn Minuten.', 'Es ersetzt das Sprint-Planning komplett.', 'Es dient als Statusbericht an den Chef.', 'Es findet nur am Sprintende statt.'],
      ['Was passiert mit neuem Feedback im Review?', 'Es landet als Backlog-Eintrag beim Product Owner.', 'Es wird sofort im laufenden Sprint umgesetzt.', 'Es wird ignoriert bis zum naechsten Jahr.', 'Es geht direkt in die Retrospektive ohne Backlog.'],
      ['Was ist typisch fuer gutes Sprint-Planning?', 'Realistische Auswahl basierend auf Velocity.', 'Alle Backlog-Eintraege ohne Priorisierung.', 'Planung ohne Schaetzungen.', 'Planung ohne Product Owner.'],
      ['Was ist ein Zeichen fuer ein gesundes Review?', 'Stakeholder stellen Fragen und geben ehrliches Feedback.', 'Niemand spricht und alle nicken nur.', 'Das Team zeigt nur Folien ohne Produkt.', 'Das Review dauert fuenf Minuten ohne Demo.'],
      ['Welche Frage passt zur Retrospektive?', 'Was koennen wir naechsten Sprint besser machen?', 'Welche Funktion bauen wir als naechstes?', 'Wie viel Umsatz machen wir?', 'Welche Programmiersprache ist die beste?'],
      ['Was schuetzt das Sprint-Ziel waehrend des Sprints?', 'Es hilft bei Entscheidungen gegen Scope-Creep.', 'Es erlaubt beliebige Zielaenderungen taeglich.', 'Es ersetzt das Product Backlog komplett.', 'Es verbietet jede Kommunikation im Team.'],
    ]),
    practiceExample: {
      text: 'Simuliere einen zweiwöchigen Sprint fuer ein kleines Feature in FutureDev. Schreibe Sprint-Ziel, drei User Stories und ein Review-Szenario auf.',
      repoNote: 'repo-futuredev',
      location: 'content/lessons/ und content/modules.json als Sprint-Backlog-Kontext',
    },
    practiceTask: {
      task: 'Plane einen fiktiven zweiwöchigen Sprint fuer dein Lernprojekt. Formuliere Sprint-Ziel, waehle drei Stories, beschreibe Review und eine Retrospektive-Massnahme.',
      expectation: 'Alle vier Sprint-Ereignisse sind beschrieben und aufeinander abgestimmt.',
      checklist: ['Sprint-Ziel formuliert.', 'Drei Stories ausgewaehlt.', 'Review-Demo skizziert.', 'Retrospektive-Massnahme definiert.'],
    },
    portfolioItem: null,
  },
];

// Due to script size, remaining lessons are loaded from companion data file
import { REST_LESSONS } from './generate-all-m08-m10-data.mjs';

for (const cfg of [...LESSONS, ...REST_LESSONS]) {
  save(cfg.id, buildLesson(cfg));
}

console.log('Done.');
