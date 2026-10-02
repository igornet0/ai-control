import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  isArchiveFileName,
  isDataFileName,
  unpackArchive,
} from './archiveUtils.js';

describe('archiveUtils', () => {
  it('detects archive and data file names', () => {
    expect(isArchiveFileName('reports.zip')).toBe(true);
    expect(isArchiveFileName('data.csv')).toBe(false);
    expect(isDataFileName('data.csv')).toBe(true);
    expect(isDataFileName('archive.zip')).toBe(false);
  });

  it('unpacks zip archive with nested data files', async () => {
    const zip = new JSZip();
    zip.file('folder/sample.csv', 'a,b\n1,2');
    zip.file('notes.txt', 'ignore me');
    const blob = await zip.generateAsync({ type: 'blob' });
    const archiveFile = new File([blob], 'bundle.zip', { type: 'application/zip' });

    const unpacked = await unpackArchive(archiveFile, 'bundle.zip');

    expect(unpacked.name).toBe('bundle');
    expect(unpacked.fileCount).toBe(2);
    expect(unpacked.dataFilesCount).toBe(1);
    expect(unpacked.files.find((f) => f.relativePath === 'folder/sample.csv')?.file).toBeInstanceOf(File);
  });
});
