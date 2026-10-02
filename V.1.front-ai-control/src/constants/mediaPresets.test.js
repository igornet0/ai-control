import { describe, expect, it } from 'vitest';
import { MEDIA_PRESETS, getMediaPreset } from '../constants/mediaPresets';

describe('mediaPresets', () => {
  it('covers UI slots used by dashboards and chat', () => {
    expect(getMediaPreset('avatar_md')).toMatchObject({ width: 80, height: 80, fit: 'cover' });
    expect(getMediaPreset('dashboard_cover').width).toBe(480);
    expect(getMediaPreset('chat_inline').height).toBe(512);
    expect(Object.keys(MEDIA_PRESETS).length).toBeGreaterThanOrEqual(10);
  });
});
