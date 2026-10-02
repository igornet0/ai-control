import { describe, expect, it } from 'vitest';
import {
  buildSmbLibPath,
  resolveFilePathForSettings,
  resolveSourcePathForSettings,
} from './interactive/fileSourceDataCodeSync.js';
import {
  collectLocalFileRequirements,
  collectSmbConnectionIds,
  getSmbShareNameFromConnection,
} from './compileFileUtils.js';

describe('compileFileUtils', () => {
  it('collects local file requirements', () => {
    const widgets = [
      {
        id: 'w1',
        settings: {
          sourceType: 'file',
          fileDeliveryMode: 'local',
          sourcePath: 'sample.csv',
          selectedFile: { name: 'sample.csv', file: new File(['a'], 'sample.csv') },
        },
      },
    ];
    const reqs = collectLocalFileRequirements(widgets);
    expect(reqs).toHaveLength(1);
    expect(reqs[0].fileName).toBe('sample.csv');
    expect(reqs[0].hasFileInMemory).toBe(true);
  });

  it('reads smb share name from connection config', () => {
    expect(getSmbShareNameFromConnection({
      name: 'My SMB',
      connection_config: { share_name: 'Shared_dir' },
    })).toBe('Shared_dir');
    expect(getSmbShareNameFromConnection({ name: 'No config' })).toBe('');
  });

  it('collects smb connection ids from folder widgets', () => {
    const widgets = [
      { id: 'w1', settings: { sourceType: 'folder', fileDeliveryMode: 'smb', smbConnectionId: 7 } },
    ];
    expect(collectSmbConnectionIds(widgets)).toEqual([7]);
  });

  it('collects smb connection ids', () => {
    const widgets = [
      { id: 'w1', settings: { sourceType: 'file', fileDeliveryMode: 'smb', smbConnectionId: 5 } },
    ];
    expect(collectSmbConnectionIds(widgets)).toEqual([5]);
  });
});

describe('fileSourceDataCodeSync smb', () => {
  it('builds lib path', () => {
    expect(buildSmbLibPath('Data', 'reports/sample.csv')).toBe('lib://Data/reports/sample.csv');
  });

  it('resolveFilePathForSettings smb mode', () => {
    const path = resolveFilePathForSettings({
      fileDeliveryMode: 'smb',
      smbShareName: 'Data',
      smbSharePath: 'sample.csv',
    });
    expect(path).toBe('lib://Data/sample.csv');
  });

  it('resolveSourcePathForSettings folder smb mode', () => {
    const path = resolveSourcePathForSettings({
      sourceType: 'folder',
      fileDeliveryMode: 'smb',
      smbShareName: 'Data',
      smbSharePath: 'reports',
    });
    expect(path).toBe('lib://Data/reports');
  });
});
