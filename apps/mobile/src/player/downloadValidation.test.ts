import { describe, expect, it } from 'vitest';
import { makeValidLesson } from '../../../../packages/content-schema/test/fixtures.js';
import { checksumCueText, isPlausibleMp3Prefix, parseDownloadPackageMarker, validateCueText } from './downloadValidation.js';

const lesson = makeValidLesson();
const cueText = JSON.stringify({ lessonId: lesson.id, blocks: lesson.speechBlocks.map((block, index) => ({
  index, speaker: block.speaker, startSeconds: index * 10, durationSeconds: 9, isKeySentence: block.isKeySentence,
})) });

describe('download validation contract', () => {
  it('validates cue identity/order/count/duration before publishing', () => {
    expect(validateCueText(cueText, lesson).blocks).toHaveLength(lesson.speechBlocks.length);
    expect(() => validateCueText(JSON.stringify({ lessonId: 'M02-01-01', blocks: [] }), lesson)).toThrow();
    const invalid = JSON.parse(cueText) as { lessonId: string; blocks: { index: number }[] };
    const firstBlock = invalid.blocks[0];
    if (firstBlock) firstBlock.index = 7;
    expect(() => validateCueText(JSON.stringify(invalid), lesson)).toThrow();
  });

  it('recognizes ID3/MPEG prefixes and rejects HTML/error payloads', () => {
    expect(isPlausibleMp3Prefix(btoa('ID3-audio'))).toBe(true);
    expect(isPlausibleMp3Prefix(btoa(String.fromCharCode(0xff, 0xfb, 0x90, 0x64)))).toBe(true);
    expect(isPlausibleMp3Prefix(btoa('<html>404'))).toBe(false);
    expect(isPlausibleMp3Prefix('')).toBe(false);
  });

  it('parses only a confined versioned marker and checks the cue checksum', () => {
    const marker = { version: 1, lessonId: lesson.id, generation: '000000000001abcd', audioFile: `${lesson.id}.000000000001abcd.mp3`, audioBytes: 2048, audioPrefix: btoa('ID3audio'), cuesFile: `${lesson.id}.000000000001abcd.cues.json`, cuesBytes: 200, cuesChecksum: checksumCueText(cueText) };
    expect(parseDownloadPackageMarker(JSON.stringify(marker), lesson.id)).toEqual(marker);
    expect(parseDownloadPackageMarker(JSON.stringify({ ...marker, audioFile: '../escape.mp3' }), lesson.id)).toBeNull();
    expect(checksumCueText(cueText)).toBe(checksumCueText(cueText));
  });
});
