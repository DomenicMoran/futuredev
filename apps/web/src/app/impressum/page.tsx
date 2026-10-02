import Link from 'next/link';

export default function Impressum() {
  return (
    <main className="legal">
      <Link href="/">&larr; Zurück</Link>
      <h1>Impressum</h1>
      <h2>Angaben nach § 5 DDG</h2>
      <p>
        Domenic Moran<br />
        Heidelberger Straße 36<br />
        12059 Berlin<br />
        Deutschland
      </p>
      <p>E-Mail: <a href="mailto:kontakt@domenicmoran.de">kontakt@domenicmoran.de</a></p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>Domenic Moran, Anschrift wie oben.</p>
      <h2>Urheberrecht</h2>
      <p>
        Die durch den Seitenbetreiber erstellten Inhalte und Werke unterliegen dem deutschen
        Urheberrecht. Der Programmcode steht unter der MIT-Lizenz, die Lerninhalte unter CC BY-NC-SA 4.0.
      </p>
      <h2>Audio</h2>
      <p>Die Audio-Inhalte der FutureDev-App wurden mit KI-generierten Stimmen erzeugt.</p>
    </main>
  );
}
