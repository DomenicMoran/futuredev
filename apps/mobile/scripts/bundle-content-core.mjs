import { writeFileSync, renameSync } from 'node:fs';

/** Build the single runtime content pointer without also embedding parsed JSON objects. */
export function buildBundledContentModule(manifestRaw, modulesRaw, rawLessons) {
  const rows = Object.keys(rawLessons).sort().map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(rawLessons[id])},`);
  return `// Automatically generated from a SHA-verified complete content generation.\n// Raw JSON is embedded once; parsed lesson objects are intentionally lazy.\nexport const bundledManifestRaw = ${JSON.stringify(manifestRaw)};\nexport const bundledModulesRaw = ${JSON.stringify(modulesRaw)};\nexport const bundledLessonRaw: Record<string, string> = {\n${rows.join('\n')}\n};\n`;
}

/** Replace one file atomically using a temporary sibling on the same volume. */
export function atomicWriteFile(target, bytes) {
  const temp = `${target}.stage-${process.pid}`;
  writeFileSync(temp, bytes);
  renameSync(temp, target);
}
