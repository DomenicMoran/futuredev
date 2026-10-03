/**
 * Part 3: M09 and M10 lesson configs
 */

function L(id, title, prereqs, terms, topic, introImage, introExplain, keyText, repo, location, taskText, checklist, portfolioItem, faqs, quizPairs) {
  const termBlocks = terms.map((t, i) => ({
    question: `Was bedeutet ${t.term}, und warum ist es wichtig?`,
    image: `Stell dir ${topic} wie eine Entscheidung im Supermarkt vor. ${t.term} ist Kriterium Nummer ${i + 1}.`,
    explain: `${t.term} hilft dir bei ${title}. Wir erklaeren es langsam und mit Beispielen aus echten Projekten.`,
    term: `${t.term}: ${t.definition.split('.')[0]}.`,
    example: `Beispiel: Schau in ${repo} nach einer Stelle, die ${t.term} illustriert, und erklaere sie laut.`,
    why: `Ohne ${t.term} triffst du teure Zufallsentscheidungen bei ${topic}.`,
  }));

  return {
    id, title, prerequisites: prereqs,
    terms: terms.map((t) => ({ term: t.term, definition: t.definition })),
    intro: { topic, image: introImage, explain: introExplain },
    termBlocks, keyText, faqs,
    quiz: quizPairs.map(([q, c, w1, w2, w3]) => ({
      question: q, area: topic,
      options: [
        { text: c, isCorrect: true, explanation: 'Richtig.' },
        { text: w1, isCorrect: false, explanation: 'Falsch.' },
        { text: w2, isCorrect: false, explanation: 'Falsch.' },
        { text: w3, isCorrect: false, explanation: 'Falsch.' },
      ],
    })),
    practiceExample: { text: `Erkunde ${topic} am Repo-Beispiel.`, repoNote: repo, location },
    practiceTask: { task: taskText, expectation: `Du kannst ${topic} begruenden.`, checklist },
    portfolioItem: portfolioItem ?? null,
  };
}

function faq(title, pairs) {
  return pairs.map(([q, a1, a2]) => ({
    question: q,
    answer: `${a1} ${a2} Merksatz: Bei ${title} zaehlt die verstaendliche Erklaerung mehr als das Auswendiglernen einzelner Schlagworte. Wiederhole den Ablauf einmal laut, dann mit einem eigenen Beispiel aus deinem Alltag.`,
  }));
}

function batch(entries) { return entries.map((e) => L(...e)); }

export const REST_LESSONS_PART3 = batch([
  // M09 Vercel
  ['M09-01-01', 'Was Vercel als Anbieter abnimmt', ['M04-05-01'], [
    { term: 'Vercel-Deploy-Pipeline', definition: 'Der automatische Weg vom Git-Push zur live geschalteten Web-App bei Vercel. Die Vercel-Deploy-Pipeline baut, testet optional und verteilt auf das Edge Network.' },
    { term: 'Serverless-Edge', definition: 'Rechenleistung nahe am Nutzer ohne eigenen Server zu betreiben. Serverless-Edge bei Vercel reduziert Latenz fuer statische und dynamische Inhalte.' },
    { term: 'Build-Hook', definition: 'Ein Webhook, der einen Deploy ausloest, zum Beispiel nach Git Push. Build-Hook verbindet Versionskontrolle und Hosting automatisch.' },
  ], 'Vercel-Anbieter', 'Stell dir ein Hotel vor, das Zimmer, Reinigung und Empfang uebernimmt. Du bringst nur deinen Koffer, also deinen Code. Vercel ist dieses Hotel fuer Web-Apps.', 'Vercel nimmt Build, Hosting und Skalierung ab. Vercel-Deploy-Pipeline verbindet Git mit Serverless-Edge. Build-Hook startet Deploys automatisch.', 'Push Code, Vercel liefert URL. Du kuemmerst dich um Produkt, nicht um Server-Racks.', 'repo-futuredev', '.github/workflows und Vercel-Projekt-Konfiguration', 'Liste drei Aufgaben, die Vercel fuer dich erledigt, und eine, die du selbst machst.', ['Drei Vercel-Aufgaben.', 'Eine eigene Aufgabe.', 'Beispiel-URL notiert.'], 'P01',
    faq('Was Vercel als Anbieter abnimmt', [
      ['Ist Vercel nur fuer Next.js?', 'Optimiert dafuer, hostet aber mehr.', 'Static Sites und API Routes gehen auch.'],
      ['Eigener Server noetig?', 'Nein fuer Standard-Web-Apps.', 'Vercel ist Managed Hosting.'],
      ['Kosten?', 'Free Tier fuer Lernen, beachte Limits.', 'Traffic und Builds koennen kosten.'],
      ['Datenbank auf Vercel?', 'Oft extern, zum Beispiel Supabase.', 'Vercel ist primaer Frontend und Functions.'],
      ['Wechsel moeglich?', 'Ja, Standard-Web-Apps sind portierbar.', 'Vendor Lock-in minimieren durch offene Standards.'],
    ]),
    [
      ['Vercel-Deploy-Pipeline?', 'Git Push bis live URL.', 'Nur lokaler Dev-Server.', 'Nur DNS.', 'Nur Mail.'],
      ['Serverless-Edge?', 'Rechenleistung nah am Nutzer.', 'Ein physischer Server in Keller.', 'Nur FTP.', 'Nur SSH always.'],
      ['Build-Hook?', 'Loest Build bei Ereignis aus.', 'Nur manueller Klick.', 'Nur CSS.', 'Nur PDF.'],
      ['Vercel staerke?', 'Schnelle Deploys fuer Web-Apps.', 'Mobile Native only.', 'Desktop only.', 'Games only.'],
      ['Du machst selbst?', 'Produktlogik und Tests.', 'Rack kaufen.', 'Kernel patchen.', 'Stromvertrag only.'],
      ['Next.js?', 'Eng integriert, nicht exklusiv.', 'Verboten auf Vercel.', 'Pflicht ueberall.', 'Ersetzt HTML.'],
      ['Preview Deploy?', 'Pro Branch URL.', 'Nur Production.', 'Nur localhost.', 'Nur FTP.'],
      ['Env Vars?', 'In Vercel Dashboard setzen.', 'In Git committen.', 'In README Keys.', 'In Quiz.'],
      ['FutureDev?', 'App deploybar auf Vercel.', 'Unmoeglich.', 'Nur Audio.', 'Nur Word.'],
      ['Lock-in vermeiden?', 'Standard HTTP und Git.', 'Proprietaer only.', 'Kein Open Source.', 'Kein Export.'],
      ['CI Verbindung?', 'GitHub Integration ueblich.', 'Nur USB Stick.', 'Nur E-Mail Patch.', 'Nur Fax.'],
      ['Produktionsregel?', 'Secrets in Env, Builds gruen.', 'Keys im Repo.', 'Kein HTTPS.', 'Kein Monitor.'],
    ]],

  ['M09-01-02', 'Deploys und Vorschau-Umgebungen', ['M09-01-01'], [
    { term: 'Preview-Deployment', definition: 'Eine temporaere Live-URL fuer einen Branch oder Pull Request. Preview-Deployment erlaubt Review, bevor Production sich aendert.' },
    { term: 'Produktions-Alias', definition: 'Die stabile Domain, die Nutzer sehen, zum Beispiel www oder Apex. Produktions-Alias zeigt auf das letzte erfolgreiche Production-Deployment.' },
    { term: 'Rollback-Schritt', definition: 'Das Zurueckschalten auf ein frueheres Deployment bei Fehlern. Rollback-Schritt ist schneller als Hotfix, wenn Production brennt.' },
  ], 'Vercel-Deploy', 'Stell dir Proben und Premiere im Theater vor. Preview ist Probe auf der Buehne. Produktions-Alias ist Premiere fuer Publikum. Rollback ist Notfall-Ablauf.', 'Jeder Branch kann eine Preview-Deployment URL bekommen. Produktions-Alias bleibt stabil. Rollback-Schritt rettet dich bei schiefem Release.', 'Erst Preview pruefen, dann Production promoten.', 'repo-futuredev', 'Vercel Deployments Dashboard und PR Checks', 'Oeffne eine Preview-URL eines PR und liste drei Checkpunkte.', ['Preview geoeffnet.', 'Drei Checks.', 'Rollback-Prozedur skizziert.'], 'P01',
    faq('Deploys und Vorschau-Umgebungen', [
      ['Preview fuer wen?', 'Team, Reviewer, Stakeholder.', 'Nicht fuer geheime Daten ohne Schutz.'],
      ['Production wann?', 'Nach gruenen Checks und Review.', 'Nie Freitag ohne Bereitschaft optional Regel.'],
      ['Rollback Dauer?', 'Oft Minuten bei Vercel.', 'Trotzdem Incident kommunizieren.'],
      ['Alias aendern?', 'DNS und Domain Einstellungen beachten.', 'SSL automatisch, trotzdem pruefen.'],
      ['Env pro Preview?', 'Koennen von Production abweichen.', 'Dummy-Daten in Preview nutzen.'],
    ]),
    [
      ['Preview-Deployment?', 'Temporaere URL je Branch.', 'Nur localhost.', 'Nur FTP.', 'Nur Mail.'],
      ['Produktions-Alias?', 'Stabile Nutzer-Domain.', 'Jede Preview gleich.', 'Nur IP.', 'Nur Port.'],
      ['Rollback-Schritt?', 'Frueheres Deployment aktivieren.', 'Server physisch tauschen.', 'DNS loeschen.', 'Git loeschen.'],
      ['Warum Preview?', 'Fehler vor Production finden.', 'Langsamer machen.', 'Kosten erhoehen always.', 'Verboten.'],
      ['PR Check?', 'Preview Link im PR.', 'Nur Kommentar.', 'Nur Emoji.', 'Nur Phone.'],
      ['Production Deploy?', 'Nach Merge main often.', 'Jeder Push sofort Prod.', 'Nur nachts verboten always.', 'Zufaellig.'],
      ['Fehler in Prod?', 'Rollback dann Fix.', 'Ignorieren.', 'Twitter only.', 'Neu domain.'],
      ['Env Preview?', 'Kann Test-Keys nutzen.', 'Prod Keys always.', 'Keys im Repo.', 'Keine Env.'],
      ['FutureDev Flow?', 'CI plus Preview plus Prod.', 'Nur manuell USB.', 'Kein Git.', 'Kein Test.'],
      ['Stakeholder?', 'Preview zum Abnehmen.', 'Nur Code lesen.', 'Nur Logs.', 'Nur PDF.'],
      ['SSL Preview?', 'Meist automatisch HTTPS.', 'Nur HTTP.', 'Nur SSH.', 'Nur Telnet.'],
      ['Produktionsregel?', 'Preview reviewed vor Prod.', 'Direct Prod always.', 'Kein Monitor.', 'Kein Rollback Plan.'],
    ]],

  // M09 Supabase provider
  ['M09-02-01', 'Warum Supabase statt eigener Datenbank', ['M03-04-01'], [
    { term: 'Managed-Postgres', definition: 'Eine von Supabase betriebene PostgreSQL-Instanz mit Backups und Updates. Managed-Postgres spart dir Server-Wartung und Patch-Management.' },
    { term: 'Supabase-Anbieter-Modell', definition: 'Das Paket aus Datenbank, Auth, Storage und APIs als Plattform. Supabase-Anbieter-Modell reduziert Integrationsaufwand gegenueber DIY Postgres.' },
    { term: 'EU-Rechenzentrum', definition: 'Ein Rechenzentrum in der EU-Region fuer Datenhaltung. EU-Rechenzentrum unterstuetzt DSGVO-Anforderungen bei der Standortwahl.' },
  ], 'Supabase-Anbieter', 'Stell dir Mietwohnung vs Hausbau vor. Supabase ist Mietwohnung mit Hausmeister. Eigener Server ist Hausbau mit allem Drum und Dran.', 'Supabase liefert Managed-Postgres plus Auth plus Storage. Supabase-Anbieter-Modell spart Zeit. EU-Rechenzentrum waehlst du fuer Datenschutz.', 'Managed wenn du schnell starten und wenig ops willst.', 'repo-lexipulse', 'LexiPulse Supabase Projekt als Architekturvorbild', 'Vergleiche drei Aufgaben: Supabase vs eigener Postgres-Server.', ['Drei Supabase-Vorteile.', 'Ein DIY-Nachteil.', 'Region notiert.'], 'P03',
    faq('Warum Supabase statt eigener Datenbank', [
      ['Wann eigener Server?', 'Sehr spezielle Compliance oder Team mit Ops.', 'Fuer Lern-Apps meist Overkill.'],
      ['Vendor Lock-in?', 'Postgres bleibt Standard-SQL portierbar.', 'Auth und Storage mehr bindend.'],
      ['Kosten Skalierung?', 'Free Tier lernen, dann Plan waehlen.', 'Connection Limits beachten.'],
      ['Backups?', 'Supabase bietet Backup-Optionen je Plan.', 'Restore testen in Staging.'],
      ['RLS trotzdem noetig?', 'Ja, immer auf Tabellen.', 'Anbieter ersetzt keine App-Security.'],
    ]),
    [
      ['Managed-Postgres?', 'Betriebene PostgreSQL Instanz.', 'Excel Tabelle.', 'JSON Datei only.', 'DNS only.'],
      ['Supabase-Anbieter-Modell?', 'DB plus Auth plus Storage Paket.', 'Nur Mail.', 'Nur CDN.', 'Nur DNS.'],
      ['EU-Rechenzentrum?', 'Daten in EU Region.', 'Immer USA Pflicht.', 'Egale Region.', 'Nur lokal PC.'],
      ['DIY Nachteil?', 'Ops Aufwand hoch.', 'Immer guenstiger.', 'Immer sicherer.', 'Kein Skill noetig.'],
      ['Portabilitaet?', 'SQL und Postgres Wissen hilft.', 'Zero portierbar.', 'Nur NoSQL.', 'Nur CSV.'],
      ['RLS?', 'Pflicht in App Tabellen.', 'Optional always.', 'Ersetzt Auth.', 'Ersetzt HTTPS.'],
      ['Backups?', 'Planen und testen.', 'Ignorieren.', 'Nur Git.', 'Nur Screenshots.'],
      ['Auth Supabase?', 'Eingebaut, trotzdem konfigurieren.', 'Unnoetig.', 'Ersetzt RLS.', 'Nur Magic.'],
      ['LexiPulse?', 'Beispiel Fullstack mit Supabase.', 'Nur Mobile.', 'Nur Static.', 'Nur Word.'],
      ['Free Tier?', 'Gut zum Lernen.', 'Unbegrenzt Prod always.', 'Verboten.', 'Nur Enterprise.'],
      ['Connection Pool?', 'Bei Skalierung wichtig.', 'Nie noetig.', 'Nur Frontend.', 'Nur CSS.'],
      ['Produktionsregel?', 'Region plus RLS plus Backups.', 'Public DB.', 'Keys im Repo.', 'Kein Monitor.'],
    ]],

  ['M09-02-02', 'Die EU-Region-Entscheidung', ['M09-02-01'], [
    { term: 'Daten-Residenz', definition: 'Der physische Standort, an dem personenbezogene Daten gespeichert und verarbeitet werden. Daten-Residenz ist zentral fuer DSGVO-konforme Architektur.' },
    { term: 'Region-Pinning', definition: 'Die feste Zuweisung eines Projekts zu einer Cloud-Region ohne stilles Wechseln. Region-Pinning verhindert ueberraschende Datenbewegungen.' },
    { term: 'DSGVO-Standort', definition: 'Ein Standort und Vertragsrahmen, der EU-Datenschutzanforderungen unterstuetzt. DSGVO-Standort allein ersetzt keine technischen Schutzmassnahmen wie RLS.' },
  ], 'EU-Region', 'Stell dir einen Tresor in Frankfurt vs New York vor. Daten-Residenz ist der Tresorstandort. Region-Pinning ist der Schluessel, der nicht reist.', 'Bei EU-Nutzern willst du Daten-Residenz in EU. Region-Pinning haelt Projekt in Supabase EU-Region. DSGVO-Standort ist Teil deiner Compliance-Story.', 'Region bei Projektstart waehlen, dokumentieren, nicht still aendern.', 'repo-lexipulse', 'Supabase Projekt-Region in Dashboard', 'Dokumentiere gewaehlte Region und begruende sie in drei Saetzen.', ['Region gewaehlt.', 'Begruendung geschrieben.', 'AVV/DPA Link notiert.'], 'P03',
    faq('Die EU-Region-Entscheidung', [
      ['Reicht EU Region allein?', 'Nein, RLS, Auth, Logging ohne PII trotzdem.', 'Recht und Technik zusammen.'],
      ['USA Nutzer?', 'Eigene Rechtsberatung bei international.', 'Nicht raten im Chat.'],
      ['Migration Region?', 'Aufwaendig, deshalb frueh entscheiden.', 'Backup und Plan noetig.'],
      ['Subprocessor Liste?', 'Anbieter-DPA lesen.', 'Fuer Audits bereithalten.'],
      ['Staging auch EU?', 'Idealerweise gleiche Region wie Prod.', 'Keine Prod-Daten in US Staging.'],
    ]),
    [
      ['Daten-Residenz?', 'Wo Daten physisch liegen.', 'Nur UI Sprache.', 'Nur Git Branch.', 'Nur npm.'],
      ['Region-Pinning?', 'Fest an Region binden.', 'Zufaellig wechseln.', 'Nur nachts.', 'Nur lokal.'],
      ['DSGVO-Standort?', 'EU Standort plus Vertraege.', 'Nur Checkbox.', 'Nur Cookie Banner.', 'Nur Logo.'],
      ['Reicht Region?', 'Nein, RLS und Minimierung auch.', 'Ja always.', 'Nur HTTPS.', 'Nur Passwort.'],
      ['DPA?', 'Auftragsverarbeitung pruefen.', 'Unnoetig.', 'Nur Marketing.', 'Nur Design.'],
      ['Prod vs Staging?', 'Gleiche Region empfohlen.', 'Staging egal always.', 'Prod lokal.', 'Staging offline.'],
      ['Migration spaet?', 'Teuer und riskant.', 'Trivial.', 'Unmoeglich.', 'Automagic.'],
      ['Logging PII?', 'Vermeiden trotz EU.', 'Alles loggen.', 'Keys loggen.', 'Passwoerter loggen.'],
      ['LexiPulse?', 'Beispiel EU Nutzer denken.', 'Nur US.', 'Nur Global blind.', 'Nur Offline.'],
      ['Dokumentation?', 'Region in README oder Vault.', 'Geheim.', 'Nur muendlich.', 'Nur Emoji.'],
      ['International?', 'Rechtsberatung einholen.', 'Ignorieren.', 'Nur Google.', 'Nur Forum.'],
      ['Produktionsregel?', 'Region plus RLS plus DPA.', 'Public tables.', 'Kein Backup.', 'Kein Audit.'],
    ]],

  // M09 GitHub
  ['M09-03-01', 'Ein Repository richtig anlegen', ['M02-05-02'], [
    { term: 'GitHub-Repository', definition: 'Der zentrale Speicherort fuer Code, Issues und Automationen auf GitHub. Ein GitHub-Repository kann oeffentlich oder privat sein und hat klare Sichtbarkeitsregeln.' },
    { term: 'README-Standard', definition: 'Die erwartete Startseite eines Repos mit Zweck, Setup und Lizenz. README-Standard hilft Recruitern und Mitentwicklern in Sekunden.' },
    { term: 'Sichtbarkeits-Einstellung', definition: 'Public oder Private des Repositories. Sichtbarkeits-Einstellung bestimmt, wer Code sehen und klonen darf.' },
  ], 'GitHub-Repo', 'Stell dir ein Schaufenster vor. README ist das Schild. Sichtbarkeits-Einstellung ist, ob Fenster offen oder geschlossen sind.', 'Ein starkes GitHub-Repository hat klares README-Standard und passende Sichtbarkeits-Einstellung. Es ist dein oeffentlicher Beweis deiner Arbeit.', 'README zuerst, dann Code, dann CI Badge.', 'repo-portfolio', 'repo-portfolio oeffentliche Repos', 'Erstelle oder verbessere README mit Setup, Lizenz und Screenshot.', ['README vorhanden.', 'Setup getestet.', 'Lizenz genannt.'], 'P06',
    faq('Ein Repository richtig anlegen', [
      ['Public wann?', 'Fuer Portfolio und Open Source Lernprojekte.', 'Secrets nie, auch nicht kurz.'],
      ['README Laenge?', 'Kurz starten, mit Nutzen und Setup.', 'Wall of Text vermeiden.'],
      ['License?', 'MIT haeufig fuer Code Lernprojekte.', 'Ohne Lizenz ist Rechtslage unklar.'],
      ['Default Branch?', 'main ueblich, schuetzen mit Rules.', 'Force push auf main verhindern.'],
      ['Template Repo?', 'Spart Setup bei wiederholten Projekten.', 'Issues und PR Template inkludieren.'],
    ]),
    [
      ['GitHub-Repository?', 'Code-Host auf GitHub.', 'Nur lokaler Ordner.', 'Nur Cloudflare.', 'Nur Vercel.'],
      ['README-Standard?', 'Zweck Setup Lizenz.', 'Leer ok.', 'Nur Emoji.', 'Nur Binary.'],
      ['Sichtbarkeits-Einstellung?', 'Public oder Private.', 'Immer secret impossible.', 'Nur FTP.', 'Nur SMTP.'],
      ['Public Vorteil?', 'Portfolio Sichtbarkeit.', 'Mehr Angriffsflaeche if secrets.', 'Langsamer Code.', 'Verboten.'],
      ['Secrets?', 'Nie ins Repo.', 'In README ok.', 'In History ok.', 'In Issues ok.'],
      ['Branch Protection?', 'Reviews und CI auf main.', 'Jeder force push.', 'Kein CI.', 'Kein Review.'],
      ['License MIT?', 'Haeufig fuer Lern-Code.', 'Immer GPL Pflicht.', 'Keine Lizenz fine.', 'Nur CC Bilder.'],
      ['portfolio repo?', 'Fallstudien und Projekte.', 'Nur private.', 'Nur leer.', 'Nur Fork fremd.'],
      ['Topics Tags?', 'Helfen Auffindbarkeit.', 'Unnoetig.', 'Nur Spam.', 'Verboten.'],
      ['First Commit?', 'README plus skeleton.', 'Alles auf einmal.', 'Nur node_modules.', 'Nur .env.'],
      ['Recruiter Blick?', 'Pinned Repos und README.', 'Nur Sterne zaehlen.', 'Nur Avatar.', 'Nur Bio.'],
      ['Produktionsregel?', 'Kein Secret im Git ever.', 'Keys committen.', 'Public DB dump.', 'Kein CI.'],
    ]],

  ['M09-03-02', 'Issues und Projektboards', ['M09-03-01'], [
    { term: 'GitHub-Issue', definition: 'Ein nachverfolgbarer Aufgaben- oder Bug-Eintrag im Repository. GitHub-Issue traegt Beschreibung, Labels, Assignee und Diskussion.' },
    { term: 'Project-Board', definition: 'Eine Kanban-artige Ansicht von Issues und Pull Requests. Project-Board macht Fortschritt fuer Team und Solo sichtbar.' },
    { term: 'Label-System', definition: 'Farbige Tags zur Kategorisierung von Issues. Ein Label-System mit wenigen klaren Labels skaliert besser als Chaos.' },
  ], 'GitHub-Planning', 'Stell dir eine Pinnwand mit Post-its vor. GitHub-Issue ist ein Zettel. Project-Board ist die Wand. Label-System ist die Farblegende.', 'Issues ersetzen Zettelwirtschaft. Project-Board zeigt Fluss. Label-System hilft filtern und priorisieren.', 'Jede Aufgabe bekommt Issue, Board und Label.', 'repo-futuredev', 'GitHub Issues und Projects im FutureDev Repo', 'Lege drei Issues mit Labels an und ordne sie einem Board zu.', ['Drei Issues.', 'Labels gesetzt.', 'Board Spalten genutzt.'], 'P06',
    faq('Issues und Projektboards', [
      ['Solo auch Board?', 'Ja, WIP Limit diszipliniert dich.', 'Visualisierung hilft auch allein.'],
      ['Issue vs PR?', 'Issue ist Aufgabe, PR ist Loesungsvorschlag.', 'Verknuepfen mit closes #123.'],
      ['Wie viele Labels?', 'Start mit fuenf bis sieben.', 'Zu viele Labels verwirren.'],
      ['Templates?', 'Bug und Feature Templates sparen Zeit.', 'Konsistente Qualitaet.'],
      ['Milestone?', 'Fuer Releases und Module sinnvoll.', 'M08 Abschluss als Meilenstein.'],
    ]),
    [
      ['GitHub-Issue?', 'Trackbarer Task oder Bug.', 'Nur Chat Nachricht.', 'Nur Email.', 'Nur Post-it real.'],
      ['Project-Board?', 'Kanban Sicht auf Arbeit.', 'Nur Kalender.', 'Nur Wiki.', 'Nur Gist.'],
      ['Label-System?', 'Kategorien fuer Issues.', 'Zufaellige Farben.', 'Eine Farbe only.', 'Keine Labels.'],
      ['closes Keyword?', 'PR schliesst Issue automatisch.', 'Nur manuell always.', 'Verboten.', 'Nur in Email.'],
      ['WIP Limit?', 'Begrenzt parallele Tasks.', 'Unbegrenzt always.', 'Nur fuer Teams.', 'Nur Jira.'],
      ['Bug Template?', 'Repro Schritte erzwingen.', 'Leere Issues ok.', 'Nur Titel.', 'Nur Screenshot.'],
      ['Assignee?', 'Klare Verantwortung.', 'Immer unassigned.', 'Zufaellig.', 'Nur Bot.'],
      ['FutureDev Meilenstein?', 'Modul M09 fertig.', 'Unmoeglich.', 'Nur Audio.', 'Nur Design.'],
      ['Filter Label?', 'Schneller Ueberblick.', 'Unnoetig.', 'Nur Graph.', 'Nur PDF.'],
      ['Discussions?', 'Fuer Fragen, Issues fuer Arbeit.', 'Alles in Issues.', 'Alles in Wiki.', 'Gar nicht.'],
      ['Roadmap?', 'Projects oder Milestones.', 'Nur in Kopf.', 'Nur Twitter.', 'Nur Slack.'],
      ['Produktionsregel?', 'Issue pro Aenderung tracken.', 'Silent fixes.', 'Kein Link PR.', 'Kein Review.'],
    ]],

  // M09 Cloudflare
  ['M09-04-01', 'DNS bei Cloudflare verwalten', ['M01-04-02'], [
    { term: 'Cloudflare-Nameserver', definition: 'Die Nameserver, auf die deine Domain zeigt, damit Cloudflare DNS verwaltet. Cloudflare-Nameserver aktivieren Proxy und Schutzfeatures.' },
    { term: 'DNS-Proxy', definition: 'Der Cloudflare-Schalter, der Traffic ueber das Cloudflare-Netz leitet. DNS-Proxy versteckt Origin-IP und ermoeglicht CDN-Funktionen.' },
    { term: 'TTL-Einstellung', definition: 'Die Lebensdauer eines DNS-Eintrags im Cache resolver. TTL-Einstellung balanciert Aenderungsgeschwindigkeit und Last.' },
  ], 'Cloudflare-DNS', 'Stell dir Cloudflare als Postverteiler mit Sicherheitsfilter vor. DNS-Proxy ist der Umweg ueber den Filter. TTL-Einstellung ist, wie lange Adressen gemerkt werden.', 'Cloudflare verwaltet DNS und kann proxen. Cloudflare-Nameserver verbinden Domain und Dashboard. DNS-Proxy und TTL-Einstellung steuerst du pro Record.', 'DNS Aenderungen langsam einfuehren, TTL vorher senken.', 'repo-portfolio', 'domenicmoran.de DNS bei Cloudflare', 'Erklaere A Record vs CNAME und wann Proxy orange ist.', ['A vs CNAME.', 'Proxy erklaert.', 'TTL notiert.'], 'P01',
    faq('DNS bei Cloudflare verwalten', [
      ['Orange Wolke an?', 'Fuer Web via Cloudflare CDN meist ja.', 'Mail MX oft DNS only grau.'],
      ['Propagation Dauer?', 'Minuten bis Stunden je TTL.', 'Geduld und dig testen.'],
      ['Subdomain?', 'Eigener Record pro Subdomain.', 'Wildcard vorsichtig nutzen.'],
      ['Fehler 525 SSL?', 'Origin Zertifikat pruefen.', 'Flexible vs Full SSL verstehen.'],
      ['Ohne Cloudflare?', 'DNS beim Registrar moeglich.', 'Cloudflare ist optional aber verbreitet.'],
    ]),
    [
      ['Cloudflare-Nameserver?', 'Delegation an Cloudflare DNS.', 'Nur Mailserver.', 'Nur DB.', 'Nur CDN only ohne DNS.'],
      ['DNS-Proxy?', 'Traffic via Cloudflare.', 'Nur statische Mail.', 'Blockiert HTTPS always.', 'Ersetzt Git.'],
      ['TTL-Einstellung?', 'Cache Dauer des Records.', 'SSL Modus.', 'HTTP Code.', 'npm Version.'],
      ['A Record?', 'Domain zu IPv4.', 'Nur Mail.', 'Nur Text.', 'Nur CDN Key.'],
      ['CNAME?', 'Alias auf anderen Namen.', 'Ersetzt immer A.', 'Nur fuer Mail.', 'Nur fuer DB.'],
      ['Orange vs Grau?', 'Proxied vs DNS only.', 'Gleich always.', 'Nur Farbe.', 'Nur UI Bug.'],
      ['MX Record?', 'Mail Routing oft DNS only.', 'Immer proxied.', 'Verboten.', 'Optional immer.'],
      ['Propagation?', 'Wartezeit global.', 'Sofort always.', 'Nur lokal.', 'Nur nachts.'],
      ['SSL Full?', 'Encrypt bis Origin.', 'Kein SSL.', 'Nur HTTP.', 'Nur FTP.'],
      ['portfolio Domain?', 'Beispiel live Site.', 'Nur localhost.', 'Nur IP.', 'Nur Telnet.'],
      ['dig Tool?', 'DNS testen von Terminal.', 'Nur Browser.', 'Nur Post.', 'Nur Fax.'],
      ['Produktionsregel?', 'Aenderungen dokumentieren und testen.', 'Blind klicken.', 'TTL 0 always.', 'Kein Backup DNS.'],
    ]],

  ['M09-04-02', 'E-Mail-Routing einfach erklaert', ['M09-04-01'], [
    { term: 'E-Mail-Weiterleitung', definition: 'Das Umleiten eingehender Mails von einer Adresse auf deiner Domain zu einem bestehenden Postfach. E-Mail-Weiterleitung ermoeglicht professionelle Adressen ohne eigenen Mailserver.' },
    { term: 'MX-Record', definition: 'Der DNS-Eintrag, der festlegt, welcher Server Mail fuer die Domain annimmt. MX-Record muss zu Cloudflare Email Routing passen.' },
    { term: 'Routing-Regel', definition: 'Eine Regel, die bestimmte Adressen oder Muster an Ziele weiterleitet. Routing-Regel kann catch-all oder einzelne Aliase abbilden.' },
  ], 'Email-Routing', 'Stell dir einen Empfang vor, der Briefe sortiert und in dein Home-Office legt. E-Mail-Weiterleitung macht das digital fuer deine Domain.', 'Cloudflare Email Routing leitet Mail weiter ohne Voll-Mailserver. MX-Record zeigt auf Cloudflare. Routing-Regel mappt Adressen auf dein Gmail oder anderes Postfach.', 'Professionelle Adresse, privates Postfach im Hintergrund.', 'repo-portfolio', 'Impressum Kontaktadresse auf eigener Domain', 'Richte eine Weiterleitung info@domain an dein Postfach und teste.', ['MX gesetzt.', 'Regel erstellt.', 'Testmail gesendet.'], 'P01',
    faq('E-Mail-Routing einfach erklärt', [
      ['Senden auch moeglich?', 'Routing ist primär Empfang.', 'Senden oft ueber SMTP Anbieter.'],
      ['SPF DKIM?', 'Wichtig wenn du sendest.', 'Weiterleitung allein simpler.'],
      ['Catch-all?', 'Praktisch aber Spam-Risiko.', 'Bewusst entscheiden.'],
      ['Impressum Adresse?', 'Echte erreichbare Adresse noetig.', 'Routing hilft dabei.'],
      ['Provider sperrt SMTP?', 'Separates Thema M09-07.', 'Transactional Mail anders.'],
    ]),
    [
      ['E-Mail-Weiterleitung?', 'Mail von Domain weiterleiten.', 'Nur Newsletter.', 'Nur SMS.', 'Nur DNS A.'],
      ['MX-Record?', 'Mail Eingang DNS.', 'Web CDN.', 'SSL Cert.', 'Git remote.'],
      ['Routing-Regel?', 'Mapping Adresse zu Ziel.', 'Nur Firewall.', 'Nur CSS.', 'Nur JS.'],
      ['Cloudflare Routing?', 'Empfang ohne Vollserver.', 'Send unlimited always.', 'Ersetzt Gmail.', 'Ersetzt Stripe.'],
      ['Testmail?', 'Immer senden nach Setup.', 'Nie testen.', 'Nur annehmen.', 'Nur Spam.'],
      ['Catch-all?', 'Alle Adressen fangen.', 'Immer empfohlen.', 'Verboten always.', 'Nur MX.'],
      ['Impressum?', 'Erreichbare Kontaktadresse.', 'Fake ok.', 'Nur Formular.', 'Nur Twitter DM.'],
      ['Senden?', 'Oft externer SMTP.', 'Automatisch included always.', 'Unmoeglich.', 'Nur Fax.'],
      ['Spam?', 'Catch-all erhoeht Risiko.', 'Unmoeglich.', 'Kein Filter.', 'Nur DNS.'],
      ['portfolio Kontakt?', 'info@domain professionell.', 'Nur gmail.', 'Nur anon.', 'Kein Kontakt.'],
      ['DNS only MX?', 'Meist grau Wolke.', 'Orange proxied.', 'Kein MX.', 'Nur A.'],
      ['Produktionsregel?', 'Test plus Impressum passend.', 'Fake Adresse.', 'Kein Monitor.', 'Keys in DNS Text.'],
    ]],

  // M09 Stripe
  ['M09-05-01', 'Warum Stripe statt eigener Zahlungsabwicklung', ['M03-06-01'], [
    { term: 'Stripe-Checkout-Session', definition: 'Eine serverseitig erstellte Sitzung, die den Nutzer sicher zur Zahlung fuehrt. Stripe-Checkout-Session uebernimmt PCI-kritische Eingabe der Kartendaten.' },
    { term: 'PCI-Compliance', definition: 'Sicherheitsstandards fuer Zahlungsdaten. PCI-Compliance durch Stripe reduziert deine Scope-Pflichten stark gegenueber Selbstbau.' },
    { term: 'Webhook-Signatur', definition: 'Ein kryptographischer Beweis, dass ein Webhook wirklich von Stripe kommt. Webhook-Signatur pruefst du serverseitig, bevor du Bestellungen als bezahlt markierst.' },
  ], 'Stripe-Anbieter', 'Stell dir einen Tresor mit Wachpersonal vor. Stripe ist der Tresor fuer Kartendaten. Du beruehrst die Karte nie direkt.', 'Eigene Zahlungsabwicklung ist riskant und teuer. Stripe-Checkout-Session hosted Payment. PCI-Compliance wird einfacher. Webhook-Signatur schuetzt vor Fake-Zahlungsmeldungen.', 'Niemals Kartendaten selbst speichern. Stripe plus signierte Webhooks.', 'repo-microsaas', 'M03 Stripe Lektionen und Checkout Flow', 'Skizziere Flow: Session erstellen, Redirect, Webhook verify.', ['Session Schritt.', 'Webhook verify.', 'PCI Scope notiert.'], null,
    faq('Warum Stripe statt eigener Zahlungsabwicklung', [
      ['Stripe Gebuehren?', 'Pro Transaktion, im Preis einrechnen.', 'Guenstiger als Compliance Selbstbau.'],
      ['Test Mode?', 'Immer zuerst test keys.', 'Niemals live keys in Git.'],
      ['Refunds?', 'Ueber Stripe Dashboard oder API.', 'Prozesse dokumentieren.'],
      ['EU Anforderungen?', 'SCA und lokale Methoden beachten.', 'Stripe Docs folgen.'],
      ['Webhook Retry?', 'Idempotenz auf deiner Seite.', 'Doppelte Events normal.'],
    ]),
    [
      ['Stripe-Checkout-Session?', 'Hosted Payment Flow.', 'Lokales HTML Form mit PAN.', 'Nur PayPal only.', 'Nur Barzahlung.'],
      ['PCI-Compliance?', 'Kartendaten Schutzstandard.', 'Nur DSGVO.', 'Nur SEO.', 'Nur CSS.'],
      ['Webhook-Signatur?', 'Echtheit des Webhooks pruefen.', 'Optional.', 'Nur Client JS.', 'Nur CSS.'],
      ['Karte speichern?', 'Stripe tokens, nicht selbst.', 'In Postgres Klartext.', 'In localStorage.', 'In URL.'],
      ['Test Mode?', 'Fake Karten testen.', 'Live always dev.', 'Kein Test.', 'Nur Prod.'],
      ['Idempotenz?', 'Doppel Webhook sicher.', 'Zwei Mal liefern ok.', 'Kein Log.', 'Kein DB Key.'],
      ['SCA?', 'Starke Kundenauth EU.', 'Nur USA.', 'Unnoetig.', 'Nur Cash.'],
      ['Fees?', 'Stripe nimmt Anteil.', 'Gratis always.', 'Nur einmal.', 'Nur Enterprise.'],
      ['microsaas?', 'Beispiel Modular SaaS.', 'Nur Games.', 'Nur DNS.', 'Nur Mail.'],
      ['Refund Flow?', 'Stripe API oder Dashboard.', 'Nur Email.', 'Nur Git revert.', 'Nur DNS.'],
      ['Keys?', 'Env vars only.', 'Im Repo.', 'Im Client bundle.', 'Im Quiz.'],
      ['Produktionsregel?', 'Verify webhook plus idempotent.', 'Trust body blind.', 'Kein HTTPS.', 'Kein Log.'],
    ]],

  // M09 npm
  ['M09-06-01', 'Was ein npm-Paket ist und woher es kommt', ['M02-04-02'], [
    { term: 'npm-Registry', definition: 'Der zentrale Katalog oeffentlicher JavaScript-Pakete unter npmjs.com. Die npm-Registry wird von npm install abgefragt.' },
    { term: 'Paket-Manifest', definition: 'Die package.json mit Name, Version, Abhaengigkeiten und Scripts. Paket-Manifest ist die Visitenkarte deines Pakets.' },
    { term: 'SemVer-Version', definition: 'Semantic Versioning mit MAJOR.MINOR.PATCH. SemVer-Version signalisiert Breaking Changes durch MAJOR Bump.' },
  ], 'npm-Basics', 'Stell dir npm-Registry als App Store fuer Code-Bausteine vor. Paket-Manifest ist die App-Beschreibung. SemVer-Version ist die Versionsnummer.', 'npm-Pakete teilen wiederverwendbaren Code. npm-Registry hostet sie. Paket-Manifest beschreibt Inhalt. SemVer-Version hilft Updates einschaetzen.', 'Lies Manifest vor installieren.', 'repo-cron-last-due', 'repo-cron-last-due package.json auf npm', 'Analysiere package.json eines Projekts: name, deps, scripts.', ['Name notiert.', 'Drei deps.', 'Ein Script erklaert.'], 'P02',
    faq('Was ein npm-Paket ist und woher es kommt', [
      ['pnpm yarn?', 'Andere Clients, gleiche Registry oft.', 'Lockfile committen.'],
      ['private Pakete?', 'Moeglich via Org oder Verdaccio.', 'Fuer interne Tools.'],
      ['package-lock?', 'Fixiert exakte Versionen.', 'Reproduzierbare Installs.'],
      ['globale install?', 'Selten noetig, bevorzugt npx.', 'Weniger Version Chaos.'],
      ['Malicious packages?', 'Namen pruefen, downloads checken.', 'Supply Chain Risiko real.'],
    ]),
    [
      ['npm-Registry?', 'Paket Katalog npm.', 'Nur GitHub.', 'Nur Docker.', 'Nur Vercel.'],
      ['Paket-Manifest?', 'package.json Datei.', 'Nur README.', 'Nur lock.', 'Nur tsconfig.'],
      ['SemVer-Version?', 'MAJOR MINOR PATCH.', 'Nur Datum.', 'Nur Random.', 'Nur Git SHA only.'],
      ['npm install?', 'Laedt deps aus Registry.', 'Formatiert Code.', 'Deployed Prod.', 'Sendet Mail.'],
      ['lockfile?', 'Fixiert exakte Versionen.', 'Optional immer.', 'Nie committen.', 'Nur lokal.'],
      ['MAJOR bump?', 'Breaking change Signal.', 'Nur Bugfix.', 'Nur Docs.', 'Nur Farbe.'],
      ['cron-last-due?', 'Veroeffentlichtes Paket Beispiel.', 'Nur private.', 'Nur App.', 'Nur CSS.'],
      ['npx?', 'Paket temp ausfuehren.', 'Global install always.', 'Nur yarn.', 'Nur pnpm forbidden.'],
      ['Scoped packages?', '@org/name Format.', 'Verboten.', 'Nur CSS.', 'Nur HTML.'],
      ['Scripts field?', 'npm run Befehle.', 'Nur Deko.', 'Nur License.', 'Nur Type.'],
      ['Typosquat?', 'Fake Paketnamen Vorsicht.', 'Unmoeglich.', 'Nur Enterprise.', 'Nur alt.'],
      ['Produktionsregel?', 'Lockfile plus Audit.', 'Latest always prod.', 'Kein Review.', 'Kein CI.'],
    ]],

  ['M09-06-02', 'Ein Paket bewusst auswaehlen', ['M09-06-01'], [
    { term: 'Wartungs-Score', definition: 'Ein Eindruck, wie aktiv ein Paket gepflegt wird, aus Releases, Issues und Commits. Wartungs-Score hilft veraltete Abhaengigkeiten vermeiden.' },
    { term: 'Lizenz-Pruefung', definition: 'Das Lesen der Paket-Lizenz vor Nutzung in Produkt oder npm Publish. Lizenz-Pruefung verhindert unerlaubte GPL-Ketten in kommerziellen Apps.' },
    { term: 'Abhaengigkeits-Tiefe', definition: 'Die Anzahl transitiver Pakete unter deiner direkten Abhaengigkeit. Grosse Abhaengigkeits-Tiefe erhoeht Angriffsflaeche und Wartungslast.' },
  ], 'Paketwahl', 'Stell dir Werkzeugkauf vor: nicht nur Preis, sondern Garantie, Ersatzteile, Hersteller. Wartungs-Score, Lizenz-Pruefung, Abhaengigkeits-Tiefe sind deine Checkliste.', 'Bevor du npm install drueckst, pruefe Wartungs-Score, Lizenz-Pruefung und Abhaengigkeits-Tiefe. Guenstige Wahl heute kann Sicherheitsbuero morgen sein.', 'Weniger deps, aktive Maintainer, passende Lizenz.', 'repo-cron-last-due', 'npm Seite und GitHub Repo des Pakets', 'Vergleiche zwei Pakete fuer gleiche Aufgabe mit Checkliste.', ['Zwei Kandidaten.', 'Checkliste angewendet.', 'Entscheidung begruendet.'], 'P02',
    faq('Ein Paket bewusst auswaehlen', [
      ['Downloads allein?', 'Nicht genug, Typosquatting existiert.', 'Maintainer und Code lesen.'],
      ['Kein Release seit Jahren?', 'Red flag fuer Security Fixes.', 'Fork oder Alternative suchen.'],
      ['Bundle size?', 'Fuer Frontend wichtig.', 'bundlephobia nutzen.'],
      ['Alternative bauen?', 'Nur wenn du Scope wirklich brauchst.', 'repo-cron-last-due zeigt kleines eigenes Paket.'],
      ['Audit npm?', 'npm audit regelmaessig.', 'Nicht blind --force.'],
    ]),
    [
      ['Wartungs-Score?', 'Aktivitaet des Pakets.', 'Nur Sterne GitHub.', 'Nur Farbe Logo.', 'Nur Name.'],
      ['Lizenz-Pruefung?', 'License Feld lesen.', 'Ignorieren.', 'Nur README Emoji.', 'Nur Author.'],
      ['Abhaengigkeits-Tiefe?', 'Transitive Pakete zaehlen.', 'Nur eine Ebene zaehlt.', 'Nie wichtig.', 'Nur fuer CSS.'],
      ['Typosquat?', 'Tippfehler im Namen koennen Malware sein.', 'Unmoeglich.', 'Nur alt.', 'Nur gross.'],
      ['bundlephobia?', 'Groesse schaetzen.', 'Security scan.', 'Deploy tool.', 'DNS tool.'],
      ['Eigenes Paket?', 'Wie cron-last-due wenn sinnvoll.', 'Immer besser.', 'Nie sinnvoll.', 'Verboten.'],
      ['npm audit?', 'Bekannte Vulnerabilities.', 'Ersetzt Review.', 'Fix always force.', 'Unnoetig.'],
      ['Maintainer wenige?', 'Bus Factor beachten.', 'Immer ok.', 'Nur Stars.', 'Nur Downloads.'],
      ['GPL in App?', 'Vorsicht kommerziell.', 'Immer MIT.', 'Egal always.', 'Nur Server.'],
      ['Lock updates?', 'Renovate oder manuell planvoll.', 'Never update.', 'Daily blind major.', 'Kein Test.'],
      ['Two packages?', 'Vergleiche objektiv.', 'Zufall.', 'Neueste always.', 'Groesste always.'],
      ['Produktionsregel?', 'Checkliste vor neuer dep.', 'Latest always.', 'Kein Audit.', 'Kein License read.'],
    ]],

  // M09 Email providers
  ['M09-07-01', 'Transaktions-Mail gegen eigenen Mailserver', ['M04-09-01'], [
    { term: 'Transaktions-E-Mail', definition: 'Automatische Mail aus Anlass wie Passwort-Reset oder Bestellbestaetigung. Transaktions-E-Mail braucht hohe Zustellbarkeit, kein Marketing-Bulk.' },
    { term: 'SMTP-Relais', definition: 'Ein Dienst, der deine App-Mails zuverlaessig an Empfaenger bringt. SMTP-Relais ersetzt nicht immer eigenen Posteingang, aber den Versand.' },
    { term: 'Zustell-Rate', definition: 'Der Anteil der Mails, die im Posteingang landen statt Spam. Zustell-Rate haengt von Reputation, SPF, DKIM und Inhalt ab.' },
  ], 'Transaktions-Mail', 'Stell dir zwei Briefarten vor: persoenlicher Brief vs automatischer Paketschein. Transaktions-E-Mail ist Paketschein. SMTP-Relais ist die Paketpost.', 'Fuer App-Mails nutzt du meist Transaktions-E-Mail Anbieter statt eigenem Mailserver. SMTP-Relais liefert zuverlaessig. Zustell-Rate misst Erfolg.', 'Passwort-Reset nie ueber fragwuerdigen SMTP.', 'repo-futuredev', 'M04-09 E-Mail Lektionen', 'Liste drei Transaktions-Mails deiner App und Anforderungen.', ['Drei Mail-Typen.', 'Inhalt skizziert.', 'Anbieter Kandidat.'], null,
    faq('Transaktions-Mail gegen eigenen Mailserver', [
      ['Resend SendGrid Postmark?', 'Vergleiche Preis und DX.', 'FutureDev braucht planbare Kosten.'],
      ['Eigener SMTP auf VPS?', 'Moeglich aber Zustellbarkeit schwer.', 'Reputation aufbauen dauert.'],
      ['Templates?', 'HTML plus Text Version.', 'Personalization mit Variablen.'],
      ['Bounce Handling?', 'Webhooks fuer hard bounces.', 'Ungueltige Adressen entfernen.'],
      ['DSGVO?', 'AVV mit Anbieter, minimal Daten.', 'Keine unnötigen Tracking Pixel.'],
    ]),
    [
      ['Transaktions-E-Mail?', 'Event-getriebene Systemmail.', 'Newsletter Bulk.', 'Nur Social DM.', 'Nur SMS.'],
      ['SMTP-Relais?', 'Versand-Dienst fuer Apps.', 'Empfang only.', 'DNS only.', 'CDN only.'],
      ['Zustell-Rate?', 'Inbox vs Spam Quote.', 'Open Rate only.', 'Click only.', 'Git stars.'],
      ['Marketing Mail?', 'Andere Regeln und Consent.', 'Gleich wie transactional.', 'Kein Unterschied.', 'Verboten.'],
      ['SPF DKIM?', 'Authentifizierung fuer Zustellung.', 'Nur Design.', 'Nur CSS.', 'Nur JS.'],
      ['Eigener Mailserver?', 'Hoher Ops Aufwand.', 'Immer besser.', 'Immer gratis.', 'Pflicht.'],
      ['Provider Vorteil?', 'Reputation und APIs.', 'Langsamer always.', 'Unsicher always.', 'Nur Hobby.'],
      ['Template Vars?', 'Name Link etc.', 'Nur Binary.', 'Nur PDF attach always.', 'Nur GIF.'],
      ['Bounce webhook?', 'Liste bereinigen.', 'Ignorieren.', 'Mehr senden.', 'Spam more.'],
      ['FutureDev Mail?', 'Reset Verify optional.', 'Nur Marketing.', 'Kein Mail ever.', 'Nur Fax.'],
      ['Consent Marketing?', 'Extra Einwilligung.', 'Transactional braucht kein Marketing Consent.', 'Alles gleich.', 'Nur Cookie.'],
      ['Produktionsregel?', 'Reliable provider plus SPF DKIM.', 'Raw SMTP ohne config.', 'Kein bounce handle.', 'Keys in Mail body.'],
    ]],

  ['M09-07-02', 'Warum Portsperren beim Provider ein Thema sind', ['M09-07-01'], [
    { term: 'SMTP-Port-Sperre', definition: 'Die Blockade von ausgehendem SMTP durch Hosting-Provider gegen Spam. SMTP-Port-Sperre macht eigenen Mailversand vom App-Server oft unmoeglich.' },
    { term: 'Provider-Restriktion', definition: 'Technische oder vertragliche Limits eines Hosters. Provider-Restriktion zu SMTP, Cron oder UDP kann Architektur entscheiden.' },
    { term: 'Relay-Fallback', definition: 'Der Wechsel von direktem SMTP zum Anbieter-Relais wegen Sperren. Relay-Fallback ist Standard in modernen Cloud-Deployments.' },
  ], 'Port-Sperren', 'Stell dir eine Tuer mit Schloss vor. Port 25 ist verschlossen auf vielen Hostern. SMTP-Port-Sperre zwingt dich zum Relay-Fallback ueber Transaktions-Anbieter.', 'Viele Cloud-Server duerfen nicht frei SMTP sprechen. Provider-Restriktion schuetzt vor Spam-Missbrauch. Plane Relay-Fallback statt eigenem Maildaemon auf App-VM.', 'Nicht gegen Provider kaempfen, Relais nutzen.', 'repo-futuredev', 'Hosting Docs zu outbound SMTP', 'Pruefe ob dein Hoster Port 25 blockiert und dokumentiere Alternative.', ['Port Status recherchiert.', 'Relais Option.', 'Architektur Skizze.'], null,
    faq('Warum Portsperren beim Provider ein Thema sind', [
      ['Port 587?', 'Submission oft erlaubter als 25.', 'Trotzdem Relay oft einfacher.'],
      ['Local dev?', 'Anders als Production.', 'Nicht verallgemeinern.'],
      ['Vercel Functions?', 'Kein klassischer SMTP Daemon.', 'API Mail Anbieter nutzen.'],
      ['Firewall selbst?', 'Provider Level blockiert zusaetzlich.', 'Support fragen bei Zweifel.'],
      ['Kosten Relay?', 'Meist guenstiger als eigene IP Reputation.', 'Einfacher Support.'],
    ]),
    [
      ['SMTP-Port-Sperre?', 'Block outgoing SMTP.', 'Nur DNS.', 'Nur HTTP.', 'Nur SSH inbound.'],
      ['Provider-Restriktion?', 'Hoster Limits.', 'Nur Browser.', 'Nur npm.', 'Nur Git.'],
      ['Relay-Fallback?', 'Mail via API Anbieter.', 'Eigener Postfix always.', 'Fax always.', 'SMS only.'],
      ['Port 25?', 'Klassischer SMTP oft gesperrt.', 'Immer offen.', 'Nur fuer Web.', 'Nur UDP.'],
      ['Warum sperren?', 'Anti Spam Massnahme.', 'Geld verdienen only.', 'Langsam machen.', 'Zufall.'],
      ['Vercel SMTP?', 'Nicht als Mailserver gedacht.', 'Full MTA included.', 'Nur IMAP.', 'Nur POP3.'],
      ['Dev vs Prod?', 'Unterschiedliche Netze.', 'Identisch always.', 'Nur lokal exists.', 'Nur Prod local.'],
      ['Workaround?', 'Transactional API statt raw SMTP.', 'Tor.', 'Ignore.', 'Spamhaus.'],
      ['Support Ticket?', 'Bei Unklarheit Provider fragen.', 'Nie fragen.', 'Nur Twitter.', 'Nur Reddit.'],
      ['FutureDev?', 'API Mail statt VM SMTP.', 'Self host MTA.', 'Kein Mail.', 'Nur Post.'],
      ['Security plus?', 'Weniger offene Abuse Vektoren.', 'Mehr Spam always.', 'Kein Effekt.', 'Nur DNS.'],
      ['Produktionsregel?', 'Relais plus monitor bounces.', 'Raw SMTP auf PaaS.', 'Port scan ignore.', 'Kein fallback.'],
    ]],
]);

// M10 in part 4
import { REST_LESSONS_PART4 } from './generate-all-m08-m10-data-part4.mjs';
REST_LESSONS_PART3.push(...REST_LESSONS_PART4);
