function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const out: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries(batch => {
        if (!batch.length) resolve(out);
        else {
          out.push(...batch);
          next();
        }
      }, reject);
    next();
  });
}

async function walk(entry: FileSystemEntry, out: File[]): Promise<void> {
  if (entry.isFile) {
    out.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
  } else if (entry.isDirectory) {
    for (const child of await readAll((entry as FileSystemDirectoryEntry).createReader())) await walk(child, out);
  }
}

/** Files from a drop, with dropped folders opened up. */
export async function filesFromDrop(data: DataTransfer): Promise<File[]> {
  // Entries must be taken before the first await; the browser clears the list after the event.
  const entries = [...data.items]
    .filter(i => i.kind === 'file')
    .map(i => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return [...data.files];
  const files: File[] = [];
  for (const entry of entries) await walk(entry, files);
  return files;
}
