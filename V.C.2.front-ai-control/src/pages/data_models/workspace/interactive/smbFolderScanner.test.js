import { describe, expect, it, vi } from 'vitest';
import {
  isDataFileName,
  relativePathFromRoot,
  scanSmbFolder,
} from './smbFolderScanner.js';

describe('smbFolderScanner', () => {
  it('detects data file extensions', () => {
    expect(isDataFileName('sales_2023_01.csv')).toBe(true);
    expect(isDataFileName('readme.txt')).toBe(false);
  });

  it('builds relative paths from share root', () => {
    expect(relativePathFromRoot('data/model_data', 'data/model_data/2023/01/a.csv'))
      .toBe('2023/01/a.csv');
  });

  it('recursively scans nested smb folders', async () => {
    const browse = vi.fn(async (_id, path) => {
      if (path === 'data/model_data') {
        return {
          success: true,
          items: [
            { name: '2023', type: 'directory', path: 'data/model_data/2023' },
            { name: 'readme.txt', type: 'file', path: 'data/model_data/readme.txt', size: 10 },
          ],
        };
      }
      if (path === 'data/model_data/2023') {
        return {
          success: true,
          items: [
            { name: '01', type: 'directory', path: 'data/model_data/2023/01' },
          ],
        };
      }
      if (path === 'data/model_data/2023/01') {
        return {
          success: true,
          items: [
            { name: 'sales_2023_01.csv', type: 'file', path: 'data/model_data/2023/01/sales_2023_01.csv', size: 100 },
          ],
        };
      }
      return { success: true, items: [] };
    });

    const result = await scanSmbFolder(1, 'data/model_data', browse);
    expect(result.fileCount).toBe(2);
    expect(result.dataFilesCount).toBe(1);
    expect(result.files.find((f) => f.name === 'sales_2023_01.csv')?.path).toBe('2023/01/sales_2023_01.csv');
  });
});
