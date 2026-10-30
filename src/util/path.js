import GLib from 'gi://GLib';

// Resolve the extension root by walking up from this module until metadata.json
// is found. Working from the module location keeps the helper usable from any
// subdirectory, so moving files around cannot silently break schema or icon
// lookups.
export function extensionDir() {
  const [path] = GLib.filename_from_uri(import.meta.url);
  let dir = GLib.path_get_dirname(path);

  for (let depth = 0; depth < 6; depth++) {
    if (GLib.file_test(GLib.build_filenamev([dir, 'metadata.json']), GLib.FileTest.EXISTS))
      return dir;

    const parent = GLib.path_get_dirname(dir);
    if (parent === dir)
      break;
    dir = parent;
  }

  // Fall back to the module directory rather than throwing: a missing icon
  // should degrade, not abort the whole extension.
  return GLib.path_get_dirname(path);
}
