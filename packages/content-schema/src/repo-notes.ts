// Die elf Repo-Notizen aus dem Vault (10_Projekte/FutureDev/Wissen/repo-*.md), auf die
// eine Lektion als Praxisbeispiel verweisen darf. Liste ist fest, siehe
// futuredev-brief-gemeinsam.md.
export const REPO_NOTE_NAMES = [
  'repo-portfolio',
  'repo-lexipulse',
  'repo-whisper-ggml-header',
  'repo-cron-last-due',
  'repo-arabic-normalize',
  'repo-verified-done',
  'repo-microsaas',
  'repo-darts-checkout',
  'repo-resilient-ws-client',
  'repo-ssrf-guarded-fetch',
  'repo-futuredev',
] as const;

export type RepoNoteName = (typeof REPO_NOTE_NAMES)[number];
