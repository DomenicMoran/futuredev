import Link from 'next/link';

export default function Impressum() {
  return (
    <div className="legal">
      <Link href="/">&larr; Zurück</Link>
      <h1>Impressum</h1>
      <p><strong>Entwurf – vor Veröffentlichung von Domenic zu prüfen.</strong></p>
      <h2>Angaben gemäß § 5 TMG</h2>
      <p>
        Domenic Moran<br />
        MenuCloud Berlin<br />
        c/o Postadresse auf Anfrage<br />
        E-Mail: info@menucloud.de
      </p>
      <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
      <p>Domenic Moran (Anschrift wie oben)</p>
      <h2>Haftungsausschluss</h2>
      <p>
        Die Inhalte dieser Seiten wurden mit größter Sorgfalt erstellt. Für die
        Richtigkeit, Vollständigkeit und Aktualität der Inhalte kann jedoch keine
        Gewähr übernommen werden.
      </p>
      <h2>Urheberrecht</h2>
      <p>
        Die durch den Seitenbetreiber erstellten Inhalte und Werke auf diesen
        Seiten unterliegen dem deutschen Urheberrecht. Der Code steht unter der
        MIT-Lizenz, die Lehrinhalte unter CC BY-NC-SA 4.0.
      </p>
      <h2>KI-Kennzeichnung</h2>
      <p>
        Die Audio-Inhalte dieser Website und der FutureDev-App wurden mit
        KI-generierten Stimmen erzeugt (ElevenLabs und lokal Chatterbox).
        Diese Kennzeichnung erfolgt gemäß Art. 50 EU AI Act.
      </p>
    </div>
  );
}