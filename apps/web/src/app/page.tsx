import Link from "next/link";

const MODULES = [
  "Grundlagen der Informatik",
  "Web-Fundament & Versionskontrolle",
  "Fullstack & Datenbanken",
  "Software Engineering & Betrieb",
  "Mobile Entwicklung",
  "Sicherheit, Datenschutz & Recht",
  "Produktdenken & Agile",
  "KI-Engineering",
  "Werkzeuge & Anbieter",
  "Karriere & Bewerbung",
];

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </svg>
    ),
    title: "Text + Audio",
    description:
      "Jede Lektion gibt es als Text und als Hörbuch – derselbe Umfang, dieselbe Tiefe. Lerne beim Pendeln, beim Sport oder am Bildschirm.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    title: "Quiz & Prüfungen",
    description:
      "Nach jeder Lektion ein Quiz mit 12 Fragen. Modulprüfungen und eine Gesamtprüfung zeigen dir, wie jobreif du bist.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
    title: "Praxisaufgaben",
    description:
      "Jede Lektion enthält eine echte Aufgabe mit Selbstprüfliste. Du baust Projekte, die in dein Portfolio wandern.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    title: "Wiederholung mit System",
    description:
      "Das Leitner-System sorgt dafür, dass du nichts vergisst. Die App weiß, was heute zur Wiederholung ansteht – du bestimmst das Tempo.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    title: "Portfolio-Begleitung",
    description:
      "Dein Portfolio wächst mit. Am Ende hast du echte Projekte, eine Portfolio-Website, deinen Lebenslauf und weißt, wie du dich bewirbst.",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    ),
    title: "Alles aus der Praxis",
    description:
      "Jedes Konzept wird an echten Open-Source-Projekten erklärt. Du siehst, wie Profis Code schreiben, testen und betreiben.",
  },
];

export default function Home() {
  return (
    <>
      <main>
        {/* ========== HERO ========== */}
        <section className="hero">
          <span className="badge animate-fade-in">Kostenlos & werbefrei</span>
          <h1 className="animate-fade-in-up stagger-1">
            Vom Quereinsteiger zum Product Engineer
          </h1>
          <p className="animate-fade-in-up stagger-2">
            FutureDev bringt dich ohne Vorwissen bis zur Jobreife. Lerne mit Text
            und Audio im exakt gleichen Umfang, Quiz, Praxisaufgaben und deinem
            eigenen Portfolio – neben dem Beruf, in deinem Tempo.
          </p>
          <div className="actions animate-fade-in-up stagger-3">
            <a
              href="https://github.com/DomenicMoran/futuredev/releases/latest"
              className="btn btn-primary btn-lg"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              APK herunterladen
            </a>
            <a
              href="https://github.com/DomenicMoran/futuredev"
              className="btn btn-outline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Quellcode auf GitHub
            </a>
          </div>

          {/* App Mockup Placeholder */}
          <div className="hero-mockup animate-fade-in-up stagger-4">
            <div className="hero-mockup-inner">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                <rect x="20" y="30" width="80" height="60" rx="12" stroke="currentColor" strokeWidth="2" />
                <circle cx="45" cy="55" r="8" stroke="currentColor" strokeWidth="2" />
                <rect x="60" y="48" width="35" height="6" rx="3" fill="currentColor" />
                <rect x="60" y="58" width="25" height="4" rx="2" fill="currentColor" opacity="0.5" />
                <rect x="25" y="72" width="70" height="4" rx="2" fill="currentColor" opacity="0.3" />
                <rect x="25" y="80" width="55" height="4" rx="2" fill="currentColor" opacity="0.3" />
              </svg>
            </div>
          </div>
        </section>

        {/* ========== FEATURES ========== */}
        <section className="container features">
          {FEATURES.map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </section>

        {/* ========== MODULES ========== */}
        <section className="container modules">
          <h2>Was du lernst</h2>
          <p className="modules-subtitle">
            10 Module – strukturiert, praxisnah, im eigenen Tempo
          </p>
          <div className="module-grid">
            {MODULES.map((m, i) => (
              <div key={m} className="module-chip">
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.75rem", display: "block", marginBottom: "0.25rem" }}>
                  Modul {i + 1}
                </span>
                {m}
              </div>
            ))}
          </div>
        </section>

        {/* ========== CTA ========== */}
        <section className="cta">
          <h2>Bereit für den Einstieg?</h2>
          <p>
            Lade die App herunter und starte noch heute mit Modul 1 – kostenlos
            und ohne Registrierung.
          </p>
          <a
            href="https://github.com/DomenicMoran/futuredev/releases/latest"
            className="btn btn-primary btn-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Jetzt APK herunterladen
          </a>
        </section>
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="footer">
        <div className="footer-links">
          <Link href="/impressum">Impressum</Link>
          <Link href="/datenschutz">Datenschutz</Link>
          <a href="https://github.com/DomenicMoran/futuredev" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
        <p className="footer-copy">
          &copy; {new Date().getFullYear()} Domenic Moran. Die Audio-Inhalte wurden
          mit KI-generierten Stimmen erzeugt (EU AI Act Art.&nbsp;50).
        </p>
      </footer>
    </>
  );
}