# Hasil Audit & Daftar Perbaikan

Dokumen kerja untuk mencatat temuan audit kode Sonora. Bukan spesifikasi final.
Line number mengacu pada branch `main` per 11 November 2026. Batch 1–8 sudah
diterapkan; line number item yang belum dikerjakan bisa bergeser. Terakhir
diperbarui: 11 November 2026.

Status:

- `[ ]` belum dikerjakan
- `[~]` sedang dikerjakan
- `[x]` selesai

---

## Ringkasan Prioritas

| Prioritas | Item | Status | Dampak |
|---|---|---|---|
| P0 | Album art tidak pernah di-fetch | Selesai (code) | Cover tidak muncul |
| P0 | State art tidak di-reset | Selesai (code) | Cover kosong/stale walau fetch diperbaiki |
| P0 | Padding statistik dobel | Selesai (code) | Sisi kanan statistik mepet/terpotong |
| P0 | Progress bar bisa melebar keluar kartu | Selesai (code) | Bar dan label durasi offside |
| P0 | Iklan masuk Top Tracks | Selesai (code) | Statistik lagu salah |
| P1 | Fallback lirik dan cache kosong | Selesai (code) | Lirik kosong padahal data ada |
| P1 | Race lirik antar track | Selesai (code) | Lirik lagu lama menempel ke lagu baru |
| P1 | Ranking Top Tracks tidak konsisten | Selesai (code) | Urutan detik, nilai yang tampil jumlah putar |
| P1 | Hitungan putar masih tidak akurat | Selesai (code) | Statistik tidak bisa dipercaya |
| P1 | Perubahan duck-level diabaikan saat mic aktif | Selesai (code) | Setting tidak langsung berlaku |
| P1 | Volume duck/pause tidak di-restore saat disable | Selesai (code) | Spotify bisa tertinggal kecil/terjeda |
| P1 | Promise fade bisa menggantung | Selesai (code) | Pause/restore tidak berjalan |
| P1 | Semua perubahan setting menutup kartu | Selesai (code) | UX mengganggu |
| P2 | Layout statistik kaku | Selesai (code) | Clipping pada font besar/teks panjang |
| P2 | Penyimpanan statistik boros dan tanpa pruning | Selesai (code) | File tumbuh, write 30 detik |
| P2 | Tooling `make nested` rusak di GNOME Shell 50 | Selesai (code) | Alur development tidak jalan |
| P2 | Test belum mencakup art/player/lyrics/UI | Selesai (code) | Regresi lolos |

---

## P0 — Wajib Diperbaiki

### [x] A1. Album art selalu gagal di-fetch

- **Lokasi:** `extension.js:461`, `extension.js:468`, `src/core/lyrics.js:95`
- **Masalah:** `_fetchPixbuf()` memanggil `this._send(message)`, tetapi `_send()` hanya ada di `LyricsClient`. TypeError ditelan `catch`, sehingga hasilnya selalu `null`.
- **Bukti:** probe headless dengan fake Spotify menghasilkan `artFor=... pixbuf=false cache=0`. `setArt()` manual dengan pixbuf lokal berhasil, jadi renderer tidak bermasalah.
- **Perbaikan:** tambahkan `_send()` di extension atau pindahkan HTTP helper ke modul bersama. Gunakan `this._cancellable` dan `this._http`.
- **Verifikasi:** fake Spotify dengan `mpris:artUrl` valid harus menghasilkan `_pixbuf` dan cover tampil di pill serta kartu.

### [x] A2. State album art tidak di-reset

- **Lokasi:** `extension.js:332-348`, `extension.js:435-442`
- **Masalah:**
  - `_artFor` di-set sebelum fetch dan tidak di-reset saat fetch gagal, sehingga URL yang sama tidak dicoba lagi.
  - `_loadArt()` hanya dipanggil saat key track berubah. Jika `artUrl` muncul belakangan untuk track yang sama, art tidak pernah dimuat.
  - `setTrack(null)` tidak mengosongkan cover, jadi cover lama tetap tampil saat Spotify berhenti.
  - Setelah `setArt(null)`, kembali ke track dengan URL art yang sama akan early-return karena `_artFor` masih URL lama.
- **Perbaikan:** reset `_artFor` saat art dikosongkan/gagal; panggil `_loadArt()` ketika `track.artUrl` berubah, bukan hanya ketika key track berubah; panggil `setArt(null)` pada jalur tanpa track.
- **Verifikasi:** tambahkan skenario track A (art) → track B (tanpa art) → track A (art) untuk memastikan cover kembali muncul.

### [x] A3. Padding statistik dobel, sisi kanan mepet

- **Lokasi:** `src/ui/card/stats-panel.js:86-92`, `src/ui/card/index.js:245`
- **Masalah:** `StatsPanel.layout(x, ...)` menaruh `actor` di `x` dan `_box` juga di `x`. Card memanggilnya dengan `PADDING`, sehingga padding kiri menjadi 2× dan padding kanan nol.
- **Bukti:** card 360 di `x=12`; stats actor di `x=28` dengan lebar 360 (ujung 388, melewati card), box di `x=44` dengan lebar 328 (ujung 372, tepat di tepi card). Seharusnya berhenti di 356.
- **Perbaikan:** actor diposisikan di `x=0` dengan lebar penuh; `_box` tetap di `x` dengan `innerWidth = width - x * 2`.
- **Verifikasi:** `boxRight` harus sama dengan `cardRight - PADDING`; padding kiri dan kanan sama.

### [x] A4. Progress bar melebar keluar kartu

- **Lokasi:** `src/ui/card/timer.js:99-106`, `src/ui/card/index.js:74-75`, `src/ui/card/index.js:248`
- **Masalah:** `render()` memakai `this._bar.width || 300`, lalu lebar itu ditulis kembali ke `_track`. `_layoutChildren()` memanggil `render()` setiap animasi width/height, sehingga lebar bar bisa membesar sendiri. Fallback `300` juga memperparah saat bar belum punya allocation.
- **Bukti:** saat drawer statistik dibuka, probe menghasilkan bar width 367 dengan ujung kanan 433, sedangkan card kanan 372.
- **Perbaikan:** hitung lebar dari kolom kiri/row, bukan dari `_bar.width`; hilangkan fallback 300; pastikan lebar child tidak memengaruhi preferred width bar. Knob juga harus di-clamp ke `[0, width - knobWidth]`.
- **Verifikasi:** buka/tutup statistik berulang kali; `barRight` tidak boleh melewati `cardRight - PADDING`.

### [x] A5. Iklan masuk Top Tracks

- **Lokasi:** `src/core/stats.js:71-109`, `src/core/stats.js:218-240`
- **Masalah:** `addListen()` dan `addPlay()` menyimpan track dengan `artist` kosong, lalu `weekTracks()` mengagregasi semuanya.
- **Bukti:** simulasi menghasilkan entry `Advertisement` dengan 1 play di `weekTracks`.
- **Perbaikan:** jangan masukkan track tanpa artis ke `day.tracks`/Top Tracks dan jangan tambahkan play-nya. Total waktu boleh tetap dihitung sesuai keputusan produk.
- **Verifikasi:** test dengan track normal + iklan; `weekTracks` hanya berisi track normal, total detik tetap memasukkan iklan jika diinginkan.

---

## P1 — Akurasi dan Race

### [x] B1. Fallback lirik hanya pada 404, hasil kosong dicache

- **Lokasi:** `src/core/lyrics.js:35-40`, `src/core/lyrics.js:43-71`
- **Masalah:**
  - `/get` 200 dengan `syncedLyrics` null langsung menghasilkan `[]`; `/search` tidak dicoba.
  - Network error (status tidak ada) langsung `return []`.
  - Hasil kosong disimpan permanen di cache, jadi gangguan sesaat membuat lagu tanpa lirik sampai reload.
- **Perbaikan:** `/search` dicoba saat `/get` kosong, gagal, atau hasil parse-nya kosong; kandidat dicoba berurutan; hasil kosong tidak dicache.
- **Verifikasi:** test dengan respons `/get` 200 tanpa `syncedLyrics` dan `/search` yang punya hasil.

### [x] B2. Race lirik antar track

- **Lokasi:** `extension.js:332-343`, `extension.js:473-483`
- **Masalah:** `_token` hanya naik saat `_load()` dipanggil. Pindah ke iklan atau track <30 detik tidak memanggil `_load()`, sehingga fetch lama masih bisa selesai dan memasang lirik lagu lama ke track baru.
- **Perbaikan:** token dinaikkan saat key track berubah dan saat track kosong; `_load()` tetap memakai token baru untuk fetch-nya sendiri.
- **Verifikasi:** test track A → iklan/track pendek saat fetch A masih berjalan; lirik A tidak boleh muncul.

### [x] B3. `_cancellable` dibuat setelah `LyricsClient`

- **Lokasi:** `extension.js:83-86`
- **Masalah:** `new LyricsClient(this._cancellable)` menerima `undefined` karena `_cancellable` baru dibuat setelahnya. Request lirik tidak ikut ter-cancel.
- **Perbaikan:** buat `_cancellable` dan `_http` sebelum membuat `LyricsClient`.
- **Verifikasi:** `disable()` saat fetch berjalan tidak menghasilkan error dan request berhenti.

### [x] B4. Ranking Top Tracks tidak konsisten

- **Lokasi:** `src/core/stats.js:238`, `src/ui/card/stats-panel.js:141-142`, `README.md:105`
- **Masalah:** data diurutkan berdasarkan `seconds`, tetapi UI menampilkan `plays`. README menyebut Top Tracks berdasarkan jumlah putar.
- **Perbaikan:** mengikuti README: urutkan berdasarkan `plays`, dengan `seconds` sebagai tie-breaker. Test regresi ditambahkan di `tests/stats.test.js`.
- **Verifikasi:** lagu dengan detik tinggi tetapi play rendah tidak boleh berada di atas lagu dengan play lebih banyak bila labelnya jumlah putar.

### [x] B5. Hitungan putar masih tidak akurat

- **Lokasi:** `extension.js:371-397`, `README.md:289`
- **Masalah:** replay tanpa ganti judul dihitung sekali; pause-lanjut bisa dobel; lagu <30 detik tidak pernah dihitung; delta sync dibatasi 2 detik.
- **Perbaikan:** `PlaybackTracker` menghitung putaran dari posisi lagu dengan ambang `min(30, duration × 0.5)`, reset saat track berubah atau seek mundur, serta memakai delta posisi untuk waktu dengar. Test baru di `tests/playback.test.js`.
- **Verifikasi:** jadikan skenario di ROADMAP sebagai test permanen.

### [x] B6. Perubahan `duck-level` diabaikan saat mikrofon aktif

- **Lokasi:** `extension.js:222-237`
- **Masalah:** `_applyDuckSettings()` early-return jika mode duck tidak berubah, sehingga level baru tidak diterapkan sampai mic mati/nyala lagi.
- **Perbaikan:** `VolumeController.duck()` memakai `_base` saat sudah ducked; `_applyDuckSettings()` memanggilnya ulang saat `_micActive` dan mode `duck`.
- **Verifikasi:** ubah level dari preferensi saat mic aktif; volume Spotify harus langsung menyesuaikan.

### [x] B7. Volume duck/pause tidak di-restore saat disable

- **Lokasi:** `src/core/volume.js`
- **Masalah:** `destroy()` hanya menghentikan ramp. Jika sedang duck atau pause-for-mic, Spotify bisa tertinggal dalam volume rendah atau keadaan pause.
- **Perbaikan:** `destroy()` mengembalikan volume asli, me-resume playback yang dijeda untuk mic, dan memulihkan volume saat sleep fade dibatalkan. `fadeOutAndPause()` yang diinterupsi tidak menimpa operasi baru.
- **Verifikasi:** `tests/volume-lifecycle.test.js` mencakup destroy saat duck, pause-for-mic, dan sleep fade berjalan.

### [x] B8. Promise `_fadeTo()` bisa menggantung

- **Lokasi:** `src/core/volume.js`
- **Masalah:** `_stopRamp()` tidak me-resolve promise. Jika fade sleep dihentikan oleh fade lain, `await this._fadeTo(0, 5000)` tidak pernah selesai, sehingga pause/restore tidak dijalankan.
- **Perbaikan:** resolver aktif disimpan dan di-resolve saat ramp dihentikan; token operasi membuat hasil fade lama tidak menimpa operasi baru.
- **Verifikasi:** `tests/volume-lifecycle.test.js` memulai sleep fade lalu memicu duck dan destroy; promise selesai dan status akhir konsisten.

### [x] B9. Semua perubahan setting menutup kartu

- **Lokasi:** `src/core/settings.js`, `src/ui/indicator.js`
- **Masalah:** `watchConfig()` mendengarkan semua key, dan `applyConfig()` selalu memanggil `close(false)`. Mengubah duck-level atau sleep saja ikut menutup kartu.
- **Perbaikan:** `watchConfig()` meneruskan key yang berubah; hanya `mode`/`position` yang memicu `close(false)`. `tests/settings.test.js` mengunci perilaku ini.
- **Verifikasi:** ubah duck-level/sleep dari preferensi saat kartu terbuka; kartu tetap terbuka.

---

## P2 — Polish, Robustness, dan Tooling

### [x] C1. Layout statistik kaku

- **Lokasi:** `src/ui/card/index.js`, `src/ui/card/stats-panel.js`
- **Masalah:** tinggi statistik fixed 256px, value width fixed 38px, tanpa scroll. Font scaling besar atau teks terjemahan panjang bisa terpotong.
- **Perbaikan:** tinggi drawer diukur dari konten (`measure()`), dibatasi 160–360px, dan memakai `St.ScrollView` saat konten lebih tinggi. Lebar value tidak lagi fixed; nama tetap ellipsize.
- **Verifikasi:** uji font scaling 1.5×/2× dan string panjang; drawer tetap bisa di-scroll.

### [x] C2. Penyimpanan statistik boros dan tanpa pruning

- **Lokasi:** `extension.js`, `src/core/stats.js`
- **Masalah:** file ditulis penuh setiap 30 detik, `_statsDirty` tetap di-reset walau `saveStats()` gagal, tidak ada pruning, dan map `stats.tracks`/`stats.artists` level atas tidak dipakai UI.
- **Perbaikan:** simpan tiap 5 menit, reset dirty hanya setelah save sukses, buang map level atas, pangkas detail harian >10 hari saat tanggal berganti, dan migrasikan file lama dengan `version` 4.
- **Verifikasi:** `tests/stats.test.js` mencakup pruning dan pembuangan map; `make test` lulus.

### [x] C3. Pemeriksaan `_destroyed` tidak pernah benar

- **Lokasi:** `extension.js:409`
- **Masalah:** `_updateCardStats()` memeriksa `this._destroyed`, tetapi extension tidak pernah menetapkan nilai tersebut.
- **Perbaikan:** set `_destroyed` di `disable()` sebelum membuang referensi, atau hapus pemeriksaan yang menyesatkan.
- **Verifikasi:** tidak ada callback yang menyentuh UI setelah `disable()`.

### [x] C4. `make nested` rusak di GNOME Shell 50

- **Lokasi:** `Makefile`, `dev/run-headless.sh`
- **Masalah:** `gnome-shell --nested --wayland` gagal karena opsi `--nested` tidak dikenal di GNOME Shell 50.1.
- **Perbaikan:** target diganti menjadi `make headless`; `dev/run-headless.sh` menjalankan fake Spotify dan `gnome-shell --headless --virtual-monitor 1280x800` di sesi D-Bus privat. `dev/run-nested.sh` dihapus.
- **Verifikasi:** `make headless` menjalankan fake Spotify dan shell headless tanpa menyentuh sesi desktop; stop dengan Ctrl-C.

### [x] C5. Test belum mencakup komponen utama

- **Lokasi:** `tests/`
- **Masalah:** belum ada test untuk art pipeline, player, lyrics race, settings, atau UI. `_send` yang hilang lolos `make test`.
- **Perbaikan:** tambahkan test regresi untuk state art (`tests/art.test.js`), parser metadata MPRIS (`tests/player.test.js`), token request async (`tests/token.test.js`), geometri kartu/progress (`tests/geometry.test.js`), filter iklan, fallback lirik, dan settings.
- **Verifikasi:** `make lint` dan `make test` lulus; 12/12 test file.

### [x] C6. Dead code dan dokumentasi usang

- **Lokasi:** `src/core/settings.js`, `stylesheet.css`, `README.md`, `docs/STRUCTURE.md`
- **Masalah:** `saveConfig()` tidak dipakai; ada aturan CSS kosong/duplikat; README masih menyarankan `make nested` dan reload yang tidak berlaku untuk JS.
- **Perbaikan:** `saveConfig()` dan konstanta mati dihapus; aturan CSS kosong/duplikat dirapikan; README/STRUCTURE memakai `make headless`, menjelaskan detail 10 hari, dan menyatakan hot reload JS tidak tersedia di Wayland.
- **Verifikasi:** `make lint`/`make test` tetap lulus; tidak ada referensi ke `make nested` atau `run-nested.sh`.

---

## Sudah Dikerjakan

### Batch 8

- [x] **C4** — `make headless` + `dev/run-headless.sh` menggantikan `make nested`; README dan STRUCTURE diperbarui.
- [x] **C5** — test baru untuk art state, parser player, request token, geometri UI, filter iklan, dan settings.
- [x] **C6** — `saveConfig()` dihapus, CSS kosong/duplikat dirapikan, dokumentasi reload/headless/retensi disamakan.
- `make lint` dan `make test` lulus; 12/12 test file.

### Batch 7

- [x] **B9** — `watchConfig()` meneruskan key; `configNeedsRelayout()` hanya menganggap `mode`/`position` perlu menutup kartu. Test baru di `tests/settings.test.js`.
- [x] **C1** — `StatsPanel.measure()` mengukur konten; card memakai tinggi dinamis 160–360px; drawer memakai `St.ScrollView`; lebar value fixed dihapus.
- [x] **C2** — map `stats.tracks`/`stats.artists` level atas dibuang; detail harian dipangkas ke 10 hari; save tiap 5 menit dan hanya reset dirty saat sukses; versi data 4.
- `make lint` dan `make test` lulus; 8/8 test file.

### Batch 6

- [x] **B7** — `VolumeController.destroy()` mengembalikan volume duck/sleep, me-resume playback pause-for-mic, dan membersihkan state. Sleep fade yang dibatalkan tidak menimpa operasi baru.
- [x] **B8** — `_stopRamp()` me-resolve promise fade aktif; `_fadeTo()` mengembalikan status selesai dan operasi memakai token agar hasil fade lama diabaikan. Test baru di `tests/volume-lifecycle.test.js`.
- `make lint` dan `make test` lulus; 7/7 test file.

### Batch 5

- [x] **B5** — `PlaybackTracker` baru di `src/core/playback.js`; `_accumulate()` memakai posisi MPRIS, ambang adaptif, reset saat replay/seek mundur/track berubah, dan tidak lagi memotong delta 2 detik. `tests/playback.test.js` mencakup 10 skenario. `README.md` dan `docs/ROADMAP.md` diperbarui.

### Batch 4

- [x] **B1** — `/get` kosong atau gagal sekarang mencoba `/search`; kandidat dicoba sampai ada hasil; hasil kosong tidak disimpan di cache. Test baru di `tests/lyrics.test.js`.
- [x] **B2** — token lirik dinaikkan setiap track key berubah dan saat track kosong, jadi fetch lama tidak bisa memasang lirik ke track baru.

### Batch 3

- [x] **A4** — `CardTimer.render()` menghitung lebar dari actor row dan label waktu, bukan `_bar.width`; fallback 300 dihapus dan posisi knob di-clamp ke lebar bar.

### Batch 2

- [x] **B4** — `weekTracks()` sekarang mengurutkan berdasarkan `plays`, lalu `seconds` sebagai tie-breaker. Test regresi ditambahkan di `tests/stats.test.js`.
- [x] **B6** — `VolumeController.duck()` bisa menerapkan level baru saat sudah ducked; `_applyDuckSettings()` memanggilnya ulang saat mikrofon aktif dan mode `duck`.

### Batch 1

- [x] **A1** — `_send()` ditambahkan di `extension.js` dan memakai `this._http` + `this._cancellable`.
- [x] **A2** — state art dipusatkan di `ArtTracker` (URL loading/gagal/retry), art yang datang terlambat diabaikan, dan cover dibersihkan saat track kosong.
- [x] **A3** — `StatsPanel.layout()` sekarang memposisikan actor di `0` dan box di `x`, sehingga padding kiri/kanan simetris.
- [x] **A5** — `addListen()`/`addPlay()` tidak lagi mencatat track tanpa artis; `weekTracks()` memfilter data lama yang tidak punya artis. Total waktu iklan tetap dihitung.
- [x] **B3** — `_cancellable` dan `_http` dibuat sebelum `LyricsClient`.
- [x] **C3** — `_destroyed` di-set di `disable()` dan di-reset di `enable()`.

### Sebelumnya

- [x] Label `STATISTICS`/`THIS WEEK` tidak lagi ter-ellipsize.
  - `src/ui/card/stats-panel.js`: import `Pango`, set `ellipsize = NONE`.
- [x] Divider vertikal setengah tinggi di panel lirik.
  - `src/ui/card/lyrics-panel.js` dan `stylesheet.css`.
- [x] `make lint` dan `make test` lulus setelah batch 8; 12/12 test file.

---

## Urutan Pengerjaan

Batch 1 selesai: **A1, A2, A3, A5, B3, C3**.
Batch 2 selesai: **B4, B6**.
Batch 3 selesai: **A4**.
Batch 4 selesai: **B1, B2**.
Batch 5 selesai: **B5**.
Batch 6 selesai: **B7, B8**.
Batch 7 selesai: **B9, C1, C2**.
Batch 8 selesai: **C4, C5, C6**.

Semua item audit sudah selesai di code. Verifikasi visual dan reload tetap dilakukan manual setelah login.

---

## Catatan

- Iklan tetap menambah total waktu mendengarkan sesuai keputusan produk; yang perlu diperbaiki adalah atribusinya ke Top Tracks/Top Artists.
- Hitungan putar sekarang memakai posisi lagu; detail ambang dan skenario ada di `README.md`, `docs/ROADMAP.md`, dan `tests/playback.test.js`.
- Alur dev memakai `make headless` (`gnome-shell --headless --virtual-monitor 1280x800`) dengan `dev/fake-spotify.js`; `--nested` tidak tersedia di GNOME Shell 50.
