# Struktur Repo

Rencana penataan ulang repositori. Belum dieksekusi — dokumen ini jadi acuan saat pengerjaan dimulai.

## Kenapa perlu ditata

Keadaan sekarang:

| Masalah | Angka |
|---|---|
| `card.js` memegang lima tanggung jawab sekaligus | 1.196 baris |
| `extension.js` mencampur timer, HTTP, cache, statistik, sleep, seek | 604 baris |
| `island.js` mencampur layout panel, tint Cairo, dan data | 607 baris |
| Tes tersebar di root, dijalankan satu per satu | 4 berkas `test-*.js` |
| Mockup desain duduk di root seolah bagian runtime | `mockup/index.html`, 3.914 baris |
| Hasil kompilasi skema ikut ter-commit | `schemas/gschemas.compiled` |
| Tidak ada skrip build, tes, atau paket | — |

Dua berkas terbesar menampung 42% kode dan keduanya sulit diubah tanpa risiko regresi.

## Batasan yang tidak bisa dilanggar

GNOME Shell membaca beberapa berkas langsung dari root ekstensi. Ini bukan pilihan gaya, tapi kontrak:

| Berkas | Alasan |
|---|---|
| `metadata.json` | dibaca saat startup, harus di root |
| `extension.js` | entry point, dicari di root |
| `prefs.js` | dicari di root saat preferensi dibuka |
| `schemas/` | `Gio.SettingsSchemaSource.new_from_directory` menunjuk ke sini |
| `stylesheet.css` | Shell hanya memuat satu berkas CSS dari root |

Modul lain bebas pindah ke subfolder karena impor relatif (`./ui/card/index.js`) didukung penuh oleh ESM di GJS. Konsekuensi penting: **tidak wajib ada build step**, dan itu yang dipertahankan.

## Struktur tujuan

```
sonora/
├── metadata.json              # wajib root
├── extension.js               # wajib root, hanya orkestrasi (~250 baris)
├── prefs.js                   # wajib root
├── stylesheet.css             # wajib root
│
├── src/
│   ├── core/                  # logika murni, tanpa St/Clutter
│   │   ├── player.js          # dari mpris.js
│   │   ├── lyrics.js          # client lrclib, dipisah dari extension.js
│   │   ├── lrc.js             # parser, tetap
│   │   ├── stats.js           # model + agregasi mingguan
│   │   ├── settings.js        # dari config.js
│   │   ├── volume.js          # fade, duck, pause-for-mic
│   │   └── mic.js             # Gvc monitor
│   │
│   ├── ui/
│   │   ├── indicator.js       # dari island.js (~350 baris)
│   │   ├── widgets.js         # ellipsize, iconButton, formatClock, formatWeek
│   │   ├── paint.js           # drawTint, drawArrow, roundedClip
│   │   └── card/
│   │       ├── index.js       # NowPlayingCard, orkestrasi (~350)
│   │       ├── layout.js      # relayout, place, geometri affordance
│   │       ├── head.js        # cover + judul + kontrol + repeat
│   │       ├── timer.js       # baris waktu + seek
│   │       ├── footer.js      # this week + streak
│   │       ├── lyrics-panel.js
│   │       └── stats-panel.js
│   │
│   └── util/
│       ├── art.js             # pixbufToRGBA, setArtImage
│       ├── color.js           # averageColor
│       └── path.js            # extensionDir
│
├── schemas/
│   ├── org.gnome.shell.extensions.spotify-ext.gschema.xml
│   └── gschemas.compiled      # generated, tidak di-commit
│
├── icons/
│
├── tests/
│   ├── run.js                 # runner tunggal
│   ├── lrc.test.js
│   ├── stats.test.js
│   ├── volume.test.js
│   └── color.test.js
│
├── dev/
│   ├── fake-spotify.js
│   └── run-nested.sh          # satu perintah untuk dev loop
│
├── docs/
│   ├── STRUCTURE.md           # dokumen ini
│   ├── IDEAS.md
│   ├── ROADMAP.md
│   └── mockup/
│       └── index.html
│
├── Makefile
├── .gitignore
├── .editorconfig
├── README.md
└── LICENSE
```

## Alasan tiap keputusan

### `card.js` dipecah per panel, bukan per jenis kode

Satu kelas sekarang menangani build UI, geometri, event, gambar Cairo, dan render data. Pemecahan mengikuti **panel** (head, timer, footer, lirik, statistik), bukan lapisan teknis. Alasannya: perubahan fitur biasanya menyentuh satu panel, jadi satu berkas = satu alasan untuk berubah. Hasilnya tiap berkas ~100–200 baris.

`index.js` tetap menjadi satu-satunya yang tahu urutan build, animasi buka/tutup, dan koordinasi antar panel.

### `core/` bebas St dan Clutter

`stats`, `lrc`, `player`, `settings` tidak boleh menyentuh aktor. Dengan begitu:

- bisa diuji tanpa menjalankan Shell (test cepat, bisa masuk CI)
- batas antara "logika" dan "tampilan" jadi nyata, bukan sekadar konvensi

`ui/` sebaliknya boleh bergantung penuh pada Shell.

### `lyrics.js` dipisah dari `extension.js`

Sekarang `extension.js` memegang timer 1 detik, akumulasi statistik, fetch HTTP, cache, sleep timer, dan seek dalam satu kelas. Fetch lirik adalah bagian yang paling sering berubah; mencampurnya dengan loop periodik membuat perubahan kecil berisiko.

Setelah dipisah, `extension.js` tinggal merangkai: buat komponen, sambungkan callback, jalankan timer.

### `docs/mockup/`

Mockup 3.914 baris adalah artefak desain, bukan runtime. Menaruhnya di `docs/` menegaskan mana yang dikirim ke pengguna dan mana yang tidak, sekaligus memudahkan pengecualian saat membuat paket rilis.

### `schemas/gschemas.compiled` berhenti di-commit

Sekarang ikut ter-commit sebagai binari 918 byte. Seharusnya dihasilkan oleh build. Konsekuensi: fresh clone perlu `make schemas` sebelum symlink dipakai — itu langkah instalasi standar ekstensi GNOME, bukan beban tambahan.

## CSS: satu berkas atau dipecah

`stylesheet.css` wajib satu berkas di root, jadi ada dua jalan:

| | A. Satu berkas, dipisah komentar | B. Dipecah + digabung saat build |
|---|---|---|
| Berkas | `stylesheet.css` 476 baris | `styles/*.css` → `stylesheet.css` |
| Dev lewat symlink | langsung jalan | harus `make css` setiap ubah |
| Risiko | membengkak seiring fitur | lupa build, CSS basi |

**Keputusan: A untuk sekarang.** 476 baris masih terbaca dengan penanda `/* --- card --- */`. Pindah ke B hanya kalau sudah melewati ~700 baris; menambah build step untuk CSS saat ini belum sepadan.

## Infrastruktur

### `.gitignore`

```
schemas/gschemas.compiled
*.zip
dist/
.build/
```

### `Makefile`

```
make schemas   # glib-compile-schemas schemas/
make test      # gjs -m tests/run.js
make lint      # node --check untuk semua js
make pack      # zip rilis, tanpa docs/ dev/ tests/
make install   # symlink + compile schema
make nested    # dbus-run-session + fake-spotify + shell --nested
make clean     # hapus artefak build
```

### `tests/run.js`

Runner tunggal yang mengimpor semua `*.test.js` dan melaporkan hasil. Sekarang tes harus dijalankan satu per satu (`gjs -m test-lrc.js`, dan seterusnya) — itu tidak akan diskalakan begitu jumlahnya bertambah.

## Urutan migrasi

Tiap langkah harus hijau sebelum lanjut: `0 critical`, `0 warning`, semua tes lulus.

| # | Langkah | Risiko | Verifikasi |
|---|---|---|---|
| 1 | Infrastruktur: `.gitignore`, `Makefile`, `.editorconfig`, pindah `docs/`, `mockup/`, `tests/` | Nol | `make test` lulus dari lokasi baru |
| 2 | `core/` + `util/`: pindahkan `mpris`, `lrc`, `stats`, `config`, `volume`, `mic`, `art`, `color`, `path` | Rendah | `make test`, reload bersih |
| 3 | Pecah `card.js` per panel | **Tinggi** — geometri saling terkait | satu panel per commit, cek ukuran di shell tiap kali |
| 4 | Pecah `island.js`, ekstrak `paint.js` dan `widgets.js` | Sedang | reload bersih, pill tetap 240×32 |
| 5 | Pecah `extension.js`, ekstrak `lyrics.js` | Sedang | lirik tetap termuat, statistik tetap tercatat |
| 6 | Pisah CSS bila sudah perlu | Rendah | tampilan tidak berubah |

Langkah 3 paling berisiko karena `_relayout()`, `_layoutChildren()`, dan `_place()` saling bergantung pada satu set konstanta dan ukuran aktor. Memecahnya sekaligus akan menyulitkan pelacakan kalau ada regresi.

## Yang sengaja tidak dipakai

| Pilihan | Alasan |
|---|---|
| Bundler (esbuild, rollup) | Shell memuat ESM asli; bundling menambah lapisan build dan mempersulit baca `journalctl` |
| `meson` | Dipakai ekstensi besar, tapi untuk proyek seukuran ini `Makefile` ±30 baris lebih mudah dibaca dan tidak menambah dependensi |
| `dist/` wajib untuk dev | Symlink ke repo harus tetap jalan setelah `make schemas`, supaya loop pengembangan tidak butuh build |
| TypeScript | Butuh transpile; GJS tidak punya pemeriksaan tipe bawaan dan manfaatnya belum sepadan untuk ~4.300 baris |

## Target akhir

| Metrik | Sekarang | Sesudah |
|---|---|---|
| Berkas JS terbesar | 1.196 baris | ~350 baris |
| Perintah untuk tes | 4 perintah manual | `make test` |
| Perintah untuk rilis | manual zip | `make pack` |
| Berkas runtime di root | 15 | 5 |
| Artefak build ter-commit | 1 (skema) | 0 |
