import { describe, expect, it } from 'vitest';
import {
  collectUniqueImageValues,
  coerceMediaBlob,
  detectMediaKind,
  isModelImageFile,
  isModelMediaFile,
  modelFileUri,
  parseImageValue,
  resolveHttpOrStaticUrl,
  toEmbedUrl,
} from '../src/widgets/image/imageResolve.js';

describe('parseImageValue', () => {
  it('parses asset:// sha', () => {
    const sha = 'a'.repeat(64);
    expect(parseImageValue(`asset://${sha}`)).toEqual({ kind: 'asset', sha });
  });

  it('parses model-file:// refs', () => {
    expect(parseImageValue('model-file://27/42')).toEqual({
      kind: 'model-file',
      modelId: 27,
      fileId: 42,
    });
    expect(modelFileUri(27, 42)).toBe('model-file://27/42');
  });

  it('treats http and static as url', () => {
    expect(parseImageValue('https://x/y.png')).toEqual({
      kind: 'url',
      url: 'https://x/y.png',
    });
    expect(parseImageValue('/static/avatars/a.jpg').kind).toBe('url');
  });

  it('empty', () => {
    expect(parseImageValue('')).toEqual({ kind: 'empty' });
  });
});

describe('toEmbedUrl / detectMediaKind', () => {
  it('converts YouTube watch and short links', () => {
    expect(toEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(toEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
    );
    expect(detectMediaKind('https://youtu.be/dQw4w9WgXcQ')).toBe('embed');
  });

  it('converts Vimeo and Rutube', () => {
    expect(toEmbedUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
    expect(toEmbedUrl('https://rutube.ru/video/abcdef1234567890abcdef12/')).toBe(
      'https://rutube.ru/play/embed/abcdef1234567890abcdef12',
    );
  });

  it('detects image video pdf by extension and mime', () => {
    expect(detectMediaKind('https://cdn/x.png')).toBe('image');
    expect(detectMediaKind('https://cdn/x.mp4')).toBe('video');
    expect(detectMediaKind('https://cdn/doc.pdf')).toBe('pdf');
    expect(detectMediaKind('blob:http://local/1', 'video/mp4')).toBe('video');
    expect(detectMediaKind('blob:http://local/1', 'application/pdf')).toBe('pdf');
    expect(detectMediaKind('blob:http://local/1', 'audio/mpeg')).toBe('audio');
  });

  it('does not treat bare blob as image without mime', () => {
    expect(detectMediaKind('blob:http://localhost/abc')).toBe('unknown');
    expect(detectMediaKind('blob:http://localhost/abc', '', 'track.mp3')).toBe('audio');
    expect(detectMediaKind('blob:http://localhost/abc', '', 'clip.mp4')).toBe('video');
  });
});

describe('coerceMediaBlob', () => {
  it('retags octet-stream blob using filename', () => {
    const raw = new Blob([new Uint8Array([1, 2, 3])], { type: 'application/octet-stream' });
    const out = coerceMediaBlob(raw, '', 'song.mp3');
    expect(out.mediaKind).toBe('audio');
    expect(out.mime).toBe('audio/mpeg');
    expect(out.blob.type).toBe('audio/mpeg');
  });
});

describe('isAudioModelFile', () => {
  it('detects audio by role and extension', async () => {
    const { isAudioModelFile } = await import('../src/widgets/image/audioPlayerPanel.js');
    expect(isAudioModelFile({ role: 'audio', filename: 'x.bin' })).toBe(true);
    expect(isAudioModelFile({ filename: 'song.mp3' })).toBe(true);
    expect(isAudioModelFile({ mime_type: 'audio/wav', filename: 'a' })).toBe(true);
    expect(isAudioModelFile({ filename: 'pic.png' })).toBe(false);
  });
});

describe('collectUniqueImageValues', () => {
  it('dedupes and keeps multiple distinct values', () => {
    expect(
      collectUniqueImageValues([{ photo: 'a' }, { photo: 'b' }, { photo: 'a' }], 'photo'),
    ).toEqual(['a', 'b']);
  });

  it('returns single when filter collapses to one', () => {
    expect(collectUniqueImageValues([{ photo: 'x' }, { photo: 'x' }], 'photo')).toEqual(['x']);
  });

  it('expands JSON array cell', () => {
    expect(collectUniqueImageValues([{ photo: '["u1","u2"]' }], 'photo')).toEqual(['u1', 'u2']);
    expect(collectUniqueImageValues([{ photo: '["only"]' }], 'photo')).toEqual(['only']);
  });
});

describe('isModelImageFile / isModelMediaFile', () => {
  it('accepts role=image and image mime', () => {
    expect(isModelImageFile({ role: 'image', filename: 'a.bin' })).toBe(true);
    expect(isModelImageFile({ role: 'data', mime_type: 'image/png' })).toBe(true);
    expect(isModelImageFile({ role: 'data', filename: 'photo.jpg' })).toBe(true);
    expect(isModelImageFile({ role: 'data', filename: 'data.csv' })).toBe(false);
  });

  it('accepts video and pdf for media picker', () => {
    expect(isModelMediaFile({ role: 'video', filename: 'a.bin' })).toBe(true);
    expect(isModelMediaFile({ mime_type: 'application/pdf', filename: 'x' })).toBe(true);
    expect(isModelMediaFile({ filename: 'clip.webm' })).toBe(true);
    expect(isModelMediaFile({ filename: 'notes.csv' })).toBe(false);
  });
});

describe('resolveHttpOrStaticUrl', () => {
  it('passes through absolute urls', () => {
    expect(resolveHttpOrStaticUrl('https://cdn/x.png', () => null)).toBe('https://cdn/x.png');
  });

  it('uses getAvatarUrl for relative paths', () => {
    expect(
      resolveHttpOrStaticUrl('/static/avatars/a.jpg', (p) => `http://api${p}`),
    ).toBe('http://api/static/avatars/a.jpg');
  });
});
