import { describe, expect, it } from 'vitest';
import { MissingBaseUrlError, resolveBaseUrl, resolveManifestBaseUrls } from '../src/manifest-base-url.js';

describe('resolveBaseUrl', () => {
  it('nimmt die Umgebungsvariable, wenn sie gesetzt ist', () => {
    expect(resolveBaseUrl('CONTENT_BASE_URL', { CONTENT_BASE_URL: 'https://env.example/content' }, {})).toBe(
      'https://env.example/content',
    );
  });

  it('faellt auf die Konfigurationsdatei zurueck, wenn die Umgebungsvariable fehlt', () => {
    expect(
      resolveBaseUrl('AUDIO_BASE_URL', {}, { audioBaseUrl: 'https://config.example/audio' }),
    ).toBe('https://config.example/audio');
  });

  it('bevorzugt die Umgebungsvariable vor der Konfigurationsdatei', () => {
    expect(
      resolveBaseUrl(
        'CONTENT_BASE_URL',
        { CONTENT_BASE_URL: 'https://env.example/content' },
        { contentBaseUrl: 'https://config.example/content' },
      ),
    ).toBe('https://env.example/content');
  });

  it('wirft MissingBaseUrlError ohne erfundenen Fallback, wenn beide Quellen fehlen', () => {
    expect(() => resolveBaseUrl('CONTENT_BASE_URL', {}, {})).toThrow(MissingBaseUrlError);
  });

  it('wirft auch dann, wenn der Wert in der Umgebung ein leerer String ist', () => {
    expect(() => resolveBaseUrl('AUDIO_BASE_URL', { AUDIO_BASE_URL: '' }, {})).toThrow(MissingBaseUrlError);
  });
});

describe('resolveManifestBaseUrls', () => {
  it('loest beide URLs aus der Konfigurationsdatei auf', () => {
    expect(
      resolveManifestBaseUrls(
        {},
        {
          contentBaseUrl: 'https://raw.githubusercontent.com/DomenicMoran/futuredev/main/content',
          audioBaseUrl: 'https://github.com/DomenicMoran/futuredev/releases/download/audio-v0.2.0',
        },
      ),
    ).toEqual({
      contentBaseUrl: 'https://raw.githubusercontent.com/DomenicMoran/futuredev/main/content',
      audioBaseUrl: 'https://github.com/DomenicMoran/futuredev/releases/download/audio-v0.2.0',
    });
  });

  it('wirft, wenn nur eine der beiden URLs vorhanden ist', () => {
    expect(() => resolveManifestBaseUrls({}, { contentBaseUrl: 'https://config.example/content' })).toThrow(
      MissingBaseUrlError,
    );
  });
});
