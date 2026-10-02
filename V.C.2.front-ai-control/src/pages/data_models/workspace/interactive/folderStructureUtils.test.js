import { describe, expect, it } from 'vitest';
import {
  analyzeFolderStructure,
  buildFolderInventoryFingerprint,
  buildStructureCache,
  resolveCachedStructure,
} from './folderStructureUtils.js';

describe('folderStructureUtils', () => {
  const sampleFiles = [
    { name: 'sales.csv', path: '2023/01/sales.csv', smbPath: 'data/model_data/2023/01/sales.csv', size: 100, isSmb: true },
    { name: 'readme.txt', path: 'readme.txt', smbPath: 'data/model_data/readme.txt', size: 10, isSmb: true },
  ];

  it('builds stable fingerprint for same inventory', () => {
    const a = buildFolderInventoryFingerprint({
      name: 'model_data',
      isSmb: true,
      smbPath: 'data/model_data',
      files: sampleFiles,
      fileCount: 2,
      dataFilesCount: 1,
    });
    const b = buildFolderInventoryFingerprint({
      name: 'model_data',
      isSmb: true,
      smbPath: 'data/model_data',
      files: [...sampleFiles],
      fileCount: 2,
      dataFilesCount: 1,
    });
    expect(a).toBe(b);
  });

  it('changes fingerprint when file list changes', () => {
    const base = buildFolderInventoryFingerprint({
      name: 'model_data',
      isSmb: true,
      smbPath: 'data/model_data',
      files: sampleFiles,
    });
    const changed = buildFolderInventoryFingerprint({
      name: 'model_data',
      isSmb: true,
      smbPath: 'data/model_data',
      files: [...sampleFiles, { name: 'new.csv', path: 'new.csv', size: 1 }],
    });
    expect(base).not.toBe(changed);
  });

  it('caches and restores structure when fingerprint matches', () => {
    const folderData = { name: 'model_data', files: sampleFiles };
    const cache = buildStructureCache(folderData);
    const restored = resolveCachedStructure(folderData, cache);
    expect(restored?.files).toHaveLength(1);
    expect(restored?.tree?.children?.some((c) => c.name === '2023')).toBe(true);
  });

  it('restores structure via inventoryFingerprint when files list is omitted', () => {
    const folderData = {
      name: 'model_data',
      isSmb: true,
      smbPath: 'data/model_data',
      files: sampleFiles,
      fileCount: 2,
      dataFilesCount: 1,
    };
    const cache = buildStructureCache(folderData);
    const restored = resolveCachedStructure(
      {
        name: 'model_data',
        isSmb: true,
        smbPath: 'data/model_data',
        fileCount: 2,
        dataFilesCount: 1,
        inventoryFingerprint: cache.fingerprint,
        files: [],
      },
      cache,
    );
    expect(restored?.files).toHaveLength(1);
  });

  it('analyzeFolderStructure builds nested tree', () => {
    const structure = analyzeFolderStructure({ name: 'model_data', files: sampleFiles });
    expect(structure.files).toHaveLength(1);
    expect(structure.tree.children[0].name).toBe('2023');
  });
});
