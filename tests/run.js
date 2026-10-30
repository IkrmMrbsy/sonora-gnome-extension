// Test runner.
//
// Each test file runs in its own gjs process. Isolation matters here: some
// tests start a GLib main loop, and a shared process would let their state
// leak into the next file (or block it entirely).
//
// Usage: gjs -m tests/run.js
import GLib from 'gi://GLib';

function testDir() {
  const [path] = GLib.filename_from_uri(import.meta.url);
  return GLib.path_get_dirname(path);
}

function listTests() {
  const dir = GLib.Dir.open(testDir(), 0);
  const names = [];

  let name;
  while ((name = dir.read_name()) !== null) {
    if (name.endsWith('.test.js'))
      names.push(name);
  }

  dir.close();
  return names.sort();
}

function runTest(name) {
  const path = GLib.build_filenamev([testDir(), name]);

  const [ok, stdout, stderr, status] = GLib.spawn_sync(
    null, ['gjs', '-m', path], null, GLib.SpawnFlags.SEARCH_PATH, null);

  const out = new TextDecoder().decode(stdout ?? new Uint8Array()).trim();
  const err = new TextDecoder().decode(stderr ?? new Uint8Array()).trim();

  if (out)
    print(out);
  if (err)
    printerr(err);

  // status encodes waitpid() information; 0 means a clean exit.
  return ok && status === 0;
}

const names = listTests();

if (!names.length) {
  printerr('no test files found');
  imports.system.exit(1);
}

const failed = [];

for (const name of names) {
  print(`--- ${name}`);
  if (!runTest(name))
    failed.push(name);
}

print('');

if (failed.length) {
  printerr(`${failed.length} of ${names.length} test files failed:`);
  for (const name of failed)
    printerr(`  ${name}`);
  imports.system.exit(1);
}

print(`all ${names.length} test files passed`);
