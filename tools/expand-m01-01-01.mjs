#!/usr/bin/env node
/** Erweitert M01-01-01 auf ≥2500 Wörter (Hörbuch-Standard), thematisch passend. */
import fs from 'node:fs';
import path from 'node:path';

const LESSON_PATH = path.resolve('content/lessons/M01-01-01.json');

const EXTRA_BLOCKS = [
  {
    speaker: 'B',
    text: 'Du hast eben von Hardware und Software gesprochen. Gehört der Bildschirm zur CPU, oder ist das etwas anderes?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Der Bildschirm gehört zur Hardware, aber nicht zur CPU. Die CPU sitzt meist unsichtbar auf dem Mainboard, dem großen Plattenkörper im Gehäuse.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Tastatur, Maus, Bildschirm, Lautsprecher und Mikrofon nennt man oft Ein- und Ausgabegeräte. Sie sind Hardware, weil man sie anfassen kann, aber sie rechnen nicht selbst.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Stell dir vor, die CPU ist die Köchin, der Arbeitsspeicher die Werkbank und die Festplatte der Schrank. Ein- und Ausgabegeräte sind dann Fenster und Briefkasten: du gibst etwas hinein oder bekommst etwas heraus.',
    isKeySentence: false,
    role: 'image',
  },
  {
    speaker: 'B',
    text: 'Was passiert eigentlich, wenn ich eine Taste auf der Tastatur drücke?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Die Tastatur meldet an den Computer, welche Taste gedrückt wurde. Diese Meldung landet zuerst im Arbeitsspeicher, damit die CPU sie verarbeiten kann.',
    isKeySentence: false,
    role: 'example',
  },
  {
    speaker: 'A',
    text: 'Die CPU entscheidet dann anhand der Software, was der Tastendruck bedeutet. In einem Textprogramm erscheint ein Buchstabe, in einem Spiel vielleicht ein Sprung.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'B',
    text: 'Rechnet die CPU wirklich nur mit Zahlen, obwohl ich Buchstaben sehe?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Ja. Für die CPU sind Buchstaben, Farben und Töne am Ende Zahlen, meist in Form von Nullen und Einsen. Das klingt abstrakt, aber genau deshalb kann dieselbe CPU so viele verschiedene Programme bedienen.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Software übersetzt unsere Welt in solche Zahlen und zurück. Deshalb ist Software die Anleitung, Hardware die ausführende Werkstatt.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Mein Handy fühlt sich manchmal langsamer an als mein Laptop, obwohl beides ein Computer ist. Liegt das an der CPU oder am Speicher?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Oft an beiden, aber nicht immer gleich stark. Ein schwächerer Arbeitsspeicher macht sich bemerkbar, wenn viele Apps gleichzeitig offen sind. Eine langsamere Festplatte merkst du beim Öffnen großer Dateien oder beim Starten von Programmen.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Die CPU selbst kann auf dem Handy durchaus leistungsfähig sein, trotzdem wirkt das Gerät träge, wenn die Werkbank voll ist oder der Schrank fast voll und das System zusätzlich aufräumen muss.',
    isKeySentence: false,
    role: 'example',
  },
  {
    speaker: 'B',
    text: 'Was ist mit Cloud-Speicher? Ist das eine vierte Art von Festplatte in meinem Zimmer?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Cloud-Speicher ist kein extra Kästchen bei dir zu Hause. Deine Dateien liegen auf Festplatten in Rechenzentren, also bei anderen Computern, auf die du über das Internet zugreifst.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Für dich fühlt es sich an wie ein Ordner im Netz, technisch bleibt es Speicher auf fremder Hardware. Dein lokaler Arbeitsspeicher und deine lokale Festplatte arbeiten trotzdem weiter wie besprochen.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Kann ich einen Computer reparieren, indem ich nur Software tausche?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Manchmal ja. Ein fehlerhaftes Programm kann den Rechner einfrieren lassen, und eine Neuinstallation der Software hilft. Wenn die Hardware defekt ist, etwa der Arbeitsspeicher oder die Festplatte, reicht Software allein nicht.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Deshalb lohnt es sich, Symptome zu unterscheiden: hängt alles nur in einem Programm, ist Software wahrscheinlicher. Hängt der ganze Rechner und es knistert mechanisch aus dem Gehäuse, ist Hardware wahrscheinlicher.',
    isKeySentence: false,
    role: 'example',
  },
  {
    speaker: 'B',
    text: 'Du hast das Werkzeugbild benutzt. Gibt es noch ein Bild, das mir hilft, die Geschwindigkeit der CPU zu verstehen?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Stell dir einen Metronom vor, der unvorstellbar schnell tickt. Jeder Tick ist ein Rechenschritt. Moderne CPUs schaffen Milliarden solcher Schritte pro Sekunde, deshalb wirkt ein einfacher Klick für uns sofort.',
    isKeySentence: false,
    role: 'image',
  },
  {
    speaker: 'A',
    text: 'Trotzdem bleibt die Regel: ein Schritt nach dem anderen. Mehrere Kerne in einer CPU sind wie mehrere Köchinnen in einer Küche, die parallel arbeiten, jede aber weiterhin Schritt für Schritt in ihrem Bereich.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'B',
    text: 'Wenn ich den Rechner neu starte, was passiert dann mit den drei Teilen?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Beim Neustart wird der Arbeitsspeicher geleert. Programme, die liefen, müssen neu geladen werden. Die Festplatte behält alle gespeicherten Dateien, und die CPU fängt mit frischen Anweisungen aus der Software an.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Ein Neustart ist deshalb oft ein guter erster Schritt bei Hängern: er räumt die Werkbank leer, ohne den Schrank anzutasten.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Welche Fehler machen Anfänger am häufigsten, wenn sie CPU, RAM und Festplatte verwechseln?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Viele glauben, mehr Speicherplatz auf der Festplatte mache den Rechner automatisch schneller beim Arbeiten. Tatsächlich hilft mehr Arbeitsspeicher dabei, nicht mehr Festplattenplatz.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Ein anderer Fehler ist zu denken, die CPU speichere Fotos. Sie rechnet nur. Speichern ist Aufgabe von Arbeitsspeicher und Festplatte, und zwar in unterschiedlicher Dauer.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Wenn du diese drei Rollen trennst, verstehst du später leichter, warum ein Update hängt, warum ein Spiel ruckelt oder warum ein Download die Festplatte füllt, ohne dass die CPU schuld ist.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Gibt es noch andere Hardware-Teile, die ich kennen sollte, oder reichen CPU, Arbeitsspeicher und Festplatte für den Anfang?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Es gibt noch Grafikkarte, Netzteil, Mainboard und mehr. Für dein Grundverständnis reichen aber die drei Teile von heute, weil fast jede Aufgabe über sie läuft.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'In den nächsten Lektionen siehst du, wie Software diese Hardware steuert und wie Programme in Dateien auf der Festplatte organisiert sind. Heute legst du das Fundament.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Kann ich mir merken: CPU denkt, RAM merkt kurz, Festplatte merkt lang?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Das ist eine gute Eselsbrücke, solange du dabei bleibst, dass die CPU nicht wirklich denkt, sondern rechnet. RAM merkt nur während der Arbeit, Festplatte merkt dauerhaft.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Wenn du das Bild im Kopf behältst, wirst du bei Fehlermeldungen und Kaufentscheidungen nicht mehr ratlos vor drei fremden Wörtern stehen.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Was passiert, wenn ich während ein Programm läuft das Netzkabel ziehe oder der Akku leer ist?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Ohne Strom stoppt die CPU sofort, der Arbeitsspeicher verliert seinen Inhalt und offene Arbeit geht verloren, wenn sie nicht gespeichert wurde. Gespeicherte Dateien auf der Festplatte bleiben erhalten.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Deshalb speichern Programme wichtige Änderungen regelmäßig auf die Festplatte. Der Speichern-Knopf ist genau diese Brücke vom flüchtigen RAM in den dauerhaften Schrank.',
    isKeySentence: false,
    role: 'example',
  },
  {
    speaker: 'B',
    text: 'Okay, ich glaube, ich kann die drei Teile jetzt in einem Satz erklären.',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Versuch es laut, bevor wir zur Kernsatz-Zusammenfassung kommen. Wenn du Hardware, Software, CPU, Arbeitsspeicher und Festplatte in einem Atemzug benennen kannst, bist du bereit für die Praxisaufgabe.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Und wenn ich später lese, dass ein Prozessor vier Kerne hat, bezieht sich das immer auf die CPU?',
    isKeySentence: false,
    role: 'question',
  },
  {
    speaker: 'A',
    text: 'Ja. Kerne sind parallele Recheneinheiten innerhalb der CPU. Mehr Kerne helfen vor allem, wenn mehrere Programme gleichzeitig arbeiten, ändern aber nichts daran, dass jeder Kern weiterhin Schritt für Schritt rechnet.',
    isKeySentence: false,
    role: 'explain',
  },
  {
    speaker: 'A',
    text: 'Zum Schluss noch ein Blick auf die Praxisaufgabe: Wenn du Arbeitsspeicher und Festplatte getrennt abliest, trainierst du genau die Unterscheidung, die heute im Mittelpunkt stand. Notiere dir die Zahlen wörtlich, ohne sie zu verwechseln.',
    isKeySentence: false,
    role: 'why',
  },
  {
    speaker: 'B',
    text: 'Danach mache ich die Praxisaufgabe direkt am Gerät.',
    isKeySentence: false,
    role: 'explain',
  },
];

function countWords(lesson) {
  return lesson.speechBlocks.reduce((s, b) => s + b.text.trim().split(/\s+/).filter(Boolean).length, 0);
}

const lesson = JSON.parse(fs.readFileSync(LESSON_PATH, 'utf8'));
const keyIdx = lesson.speechBlocks.findIndex((b) => b.isKeySentence);
const insertAt = keyIdx >= 0 ? keyIdx : lesson.speechBlocks.length - 8;

let words = countWords(lesson);
if (words < 2500) {
  lesson.speechBlocks.splice(insertAt, 0, ...EXTRA_BLOCKS);
  words = countWords(lesson);
}

if (words < 2500) {
  console.error(`expand-m01-01-01: nur ${words} Wörter nach Einfügen, Ziel 2500`);
  process.exit(1);
}

fs.writeFileSync(LESSON_PATH, JSON.stringify(lesson, null, 2) + '\n');
console.log(`expand-m01-01-01: ${words} Wörter, ${EXTRA_BLOCKS.length} Blöcke eingefügt.`);
