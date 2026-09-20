import Link from 'next/link';

const MODULES = [
  'Grundlagen der Informatik',
  'Web-Fundament & Versionskontrolle',
  'Fullstack & Datenbanken',
  'Software Engineering & Betrieb',
  'Mobile Entwicklung',
  'Sicherheit, Datenschutz & Recht',
  'Produktdenken & Agile',
  'KI-Engineering',
  'Werkzeuge & Anbieter',
  'Karriere & Bewerbung',
];

export default function Home() {
  return (
    <>
      <main>
        <section className="hero">
          <span className="badge">Kostenlos & werbefrei</span>
          <h1>Vom Quereinsteiger zum Product Engineer</h1>
          <p>
            FutureDev bringt dich ohne Vorwissen bis zur Jobreife. Lerne mit Text
            und Audio im exakt gleichen Umfang, Quiz, Praxisaufgaben und deinem
            eigenen Portfolio – neben dem Beruf, in deinem Tempo.
          </p>
          <div className="actions">
            <a
              href="https://github.com/DomenicMoran/futuredev/releases/latest"
              className="btn btn-primary"
            >
              APK herunterladen
            </a>
            <a
              href="https://github.com/DomenicMoran/futuredev"
              className="btn btn-outline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Quellcode auf GitHub
            </a>
          </div>
        </section>

        <section className="container features">
          <div className="feature-card">
            <h3>Text + Audio</h3>
            <p>
              Jede Lektion gibt es als Text und als Hörbuch – derselbe Umfang,
              dieselbe Tiefe. Lerne beim Pendeln, beim Sport oder am Bildschirm.
            </p>
          </div>
          <div className="feature-card">
            <h3>Quiz & Prüfungen</h3>
            <p>
              Nach jeder Lektion ein Quiz mit 12 Fragen. Modulprüfungen und eine
              Gesamtprüfung zeigen dir, wie jobreif du bist.
            </p>
          </div>
          <div className="feature-card">
            <h3>Praxisaufgaben</h3>
            <p>
              Jede Lektion enthält eine echte Aufgabe mit Selbstprüfliste. Du
              baust Projekte, die in dein Portfolio wandern.
            </p>
          </div>
          <div className="feature-card">
            <h3>Wiederholung mit System</h3>
            <p>
              Das Leitner-System sorgt dafür, dass du nichts vergisst. Die App
              weiß, was heute zur Wiederholung ansteht – du bestimmst das Tempo.
            </p>
          </div>
          <div className="feature-card">
            <h3>Portfolio-Begleitung</h3>
            <p>
              Dein Portfolio wächst mit. Am Ende hast du echte Projekte, eine
              Portfolio-Website, deinen Lebenslauf und weißt, wie du dich
              bewirbst.
            </p>
          </div>
          <div className="feature-card">
            <h3>Alles aus der Praxis</h3>
            <p>
              Jedes Konzept wird an echten Open-Source-Projekten erklärt. Du
              siehst, wie Profis Code schreiben, testen und betreiben.
            </p>
          </div>
        </section>

        <section className="container modules">
          <h2>Was du lernst</h2>
          <div className="module-grid">
            {MODULES.map((m) => (
              <div key={m} className="module-chip">
                {m}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <a href="https://github.com/DomenicMoran/futuredev" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
        <p style={{ marginTop: '1rem' }}>
          &copy; {new Date().getFullYear()} Domenic Moran. Die Audio-Inhalte wurden
          mit KI-Stimmen (ElevenLabs) erzeugt (EU AI Act Art.&nbsp;50).
        </p>
      </footer>
    </>
  );
}