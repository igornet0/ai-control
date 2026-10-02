const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z']);
const DATA_FILE_EXTENSIONS = new Set(['csv', 'xlsx', 'xls']);

export function isArchiveFileName(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return ARCHIVE_EXTENSIONS.has(ext);
}

export function isDataFileName(name) {
  const ext = String(name || '').split('.').pop()?.toLowerCase() || '';
  return DATA_FILE_EXTENSIONS.has(ext);
}

function shouldSkipArchiveEntry(relativePath) {
  const name = relativePath.split('/').pop() || relativePath;
  if (name === '.DS_Store' || name === '._.DS_Store') return true;
  return name.startsWith('._');
}

export async function unpackZipArchive(archiveFile, archiveName) {
  const JSZip = (await import('jszip')).default || (await import('jszip'));
  const zipInput = archiveFile instanceof Blob
    ? await archiveFile.arrayBuffer()
    : archiveFile;
  const zip = await JSZip.loadAsync(zipInput);

  const entries = [];
  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && !shouldSkipArchiveEntry(relativePath)) {
      entries.push({ relativePath, zipEntry });
    }
  });

  const files = [];
  for (const { relativePath, zipEntry } of entries) {
    const name = relativePath.split('/').pop();
    const size = zipEntry._data?.uncompressedSize || 0;
    const entry = {
      name,
      relativePath,
      path: relativePath,
      size,
    };

    if (isDataFileName(name)) {
      const blob = await zipEntry.async('blob');
      entry.file = new File([blob], name, {
        type: blob.type || 'application/octet-stream',
        lastModified: zipEntry.date?.getTime?.() || Date.now(),
      });
    }

    files.push(entry);
  }

  const dataFiles = files.filter((f) => isDataFileName(f.name));
  const resolvedArchiveName = archiveName || archiveFile?.name || 'archive.zip';
  const rootName = resolvedArchiveName.replace(/\.(zip|rar|7z)$/i, '') || 'Архив';

  return {
    name: rootName,
    archiveFileName: resolvedArchiveName,
    files,
    fileCount: files.length,
    dataFilesCount: dataFiles.length,
  };
}

export async function unpackArchive(archiveFile, archiveName) {
  const name = archiveName || archiveFile?.name || '';
  if (!name.toLowerCase().endsWith('.zip')) {
    throw new Error('Пока поддерживаются только ZIP-архивы. Для RAR и 7Z требуется дополнительная библиотека.');
  }
  return unpackZipArchive(archiveFile, name);
}
