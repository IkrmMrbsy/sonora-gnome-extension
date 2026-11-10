# Struktur dan Arsitektur Repo

Dokumen ini menjelaskan susunan kode yang ada saat ini dan alasan batas
utamanya. Untuk cara memasang dan memakai ekstensi, lihat
[`../README.md`](../README.md).

## Struktur saat ini

```text
sonora/
├── .github/
│   └── workflows/
│       └── security.yml
├── .editorconfig
├── .gitignore
├── .gitleaks.toml
├── .semgrepignore
├── DESIGN.md
├── LICENSE
├── Makefile
├── README.md
├── metadata.json
├── extension.js
├── prefs.js
├── stylesheet.css
├── schemas/
│   └── org.gnome.shell.extensions.spotify-ext.gschema.xml
├── icons/
│   ├── sonora-flame-symbolic.svg
│   └── sonora-moon-symbolic.svg
├── src/
│   ├── core/
│   │   ├── art.js
│   │   ├── lrc.js
│   │   ├── lyrics.js
│   │   ├── mic.js
│   │   ├── playback.js
│   │   ├── player.js
│   │   ├── settings.js
│   │   ├── stats.js
│   │   ├── token.js
│   │   └── volume.js
│   ├── ui/
│   │   ├── card/
│   │   │   ├── footer.js
│   │   │   ├── head.js
│   │   │   ├── index.js
│   │   │   ├── lyrics-panel.js
│   │   │   ├── stats-panel.js
│   │   │   └── timer.js
│   │   ├── geometry.js
│   │   ├── indicator.js
│   │   ├── paint.js
│   │   └── widgets.js
│   └── util/
│       ├── art.js
│       ├── color.js
│       ├── palette.js
│       └── path.js
├── tests/
│   ├── run.js
│   └── *.test.js
├── dev/
│   ├── fake-spotify.js
│   └── run-headless.sh
└── docs/
    ├── AUDIT.md
    ├── IDEAS.md
    ├── ROADMAP.md
    ├── STRUCTURE.md
    └── mockup/
        └── index.html
```

`schemas/gschemas.compiled` dibuat oleh `make schemas` dan tidak perlu
disimpan sebagai sumber.

## Batas modul

### Root ekstensi

GNOME Shell mengharapkan `metadata.json`, `extension.js`, `prefs.js`,
`stylesheet.css`, dan direktori skema pada lokasi yang dapat diakses ekstensi.
`extension.js` menghubungkan player, pengaturan, statistik, lirik, volume, dan
UI; `prefs.js` membangun preferensi GSettings.

### `src/core/`

Logika data dan layanan ekstensi berada di sini:

- `player.js` membaca status dan metadata Spotify melalui MPRIS/D-Bus.
- `lyrics.js` mengambil dan menyimpan cache lirik; `lrc.js` mem-parsing data
  LRC.
- `stats.js` menormalisasi, mencatat, memangkas, dan mengagregasi statistik.
- `playback.js` melacak waktu dengar dan ambang hitungan putar dari posisi.
- `art.js` mengelola state pemuatan dan retry album art; `token.js` membantu
  mengabaikan hasil request yang sudah usang.
- `settings.js` mengakses GSettings dan memigrasikan konfigurasi lama.
- `volume.js` menangani fade, duck, pause, dan pemulihan volume; `mic.js`
  memantau penggunaan mikrofon.

Modul core tidak membangun aktor UI. Sebagian modul tetap menggunakan layanan
GNOME seperti Gio, GLib, Soup, atau Gvc; pemisahan ini bukan berarti semua
modul core merupakan JavaScript murni tanpa dependensi platform.

### `src/ui/`

`indicator.js` mengelola indikator panel dan koordinasi kartu. `card/` berisi
bagian UI kartu now-playing: header/kontrol, timer, footer, lirik, dan
statistik. `geometry.js` menyediakan perhitungan geometri yang dapat diuji
terpisah; `widgets.js` dan `paint.js` berisi helper tampilan.

`src/util/` berisi helper gambar, warna, dan resolusi path ekstensi yang
digunakan lintas modul.

## Pengujian dan tooling

- `make lint` memeriksa sintaks JavaScript.
- `make test` menjalankan `tests/run.js`; tiap berkas test dijalankan pada
  proses GJS terpisah.
- `make schemas` mengompilasi skema GSettings.
- `make security` menjalankan Gitleaks dan Semgrep.
- `make pack` membuat arsip ekstensi di `dist/`.
- `make install` memasang symlink lokal dan mengompilasi skema.
- `make headless` menjalankan GNOME Shell headless bersama fake Spotify pada
  sesi D-Bus privat.

Shell mengimpor modul JavaScript sebagai ESM, sehingga proyek tidak
membutuhkan bundler untuk pemuatan kode saat ini. `stylesheet.css` tetap satu
file di root karena itulah stylesheet yang dimuat ekstensi.

## Keamanan dan rilis

- `make security` menjalankan Gitleaks untuk secret scanning dan Semgrep untuk
  SAST.
- `.github/workflows/security.yml` menjalankan keduanya pada push dan pull
  request.
- `.gitleaks.toml` hanya memakai allowlist regex untuk token internal; file
  sumber tetap dipindai.
- `.semgrepignore` mengabaikan build, schema terkompilasi, dan mockup web;
  workflow CI sengaja tetap dipindai.
- `make pack` menyertakan `LICENSE`, `README.md`, dan schema XML, tetapi tidak
  menyertakan schema terkompilasi, tests, docs, atau konfigurasi CI.
- `metadata.json` wajib punya `url` yang menunjuk ke repository sebelum dikirim
  ke extensions.gnome.org.

## Prinsip pemeliharaan

- Jaga `extension.js` sebagai penghubung antar-layanan; ekstrak modul ketika
  ada batas tanggung jawab yang jelas dan dapat diuji.
- Hindari ketergantungan UI (`St`/`Clutter`) di logika statistik, parser, dan
  pelacakan playback.
- Pertahankan pengujian modul core tanpa perlu menjalankan GNOME Shell.
- Jangan menambah langkah build atau dependensi hanya untuk memecah file tanpa
  manfaat pemeliharaan yang nyata.
