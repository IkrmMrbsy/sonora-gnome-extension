import GLib from 'gi://GLib';

export function extensionDir() {
  const [path] = GLib.filename_from_uri(import.meta.url);
  return GLib.path_get_dirname(path);
}
