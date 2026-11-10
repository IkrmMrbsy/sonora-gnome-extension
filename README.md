# Sonora

**The music companion for GNOME.**

Ekstensi GNOME Shell 50 yang menampilkan lagu Spotify yang sedang diputar langsung di panel atas, dengan lirik tersinkron, kontrol pemutaran, dan statistik mendengarkan.

Tidak memakai Web API Spotify dan tidak butuh login. Semua data diambil dari **MPRIS** (`org.mpris.MediaPlayer2.spotify`) di D-Bus session, jadi apa pun yang sedang diputar Spotify akan terbaca — termasuk kontrol play/pause/next/previous/seek lewat D-Bus.

---

## Kebutuhan

- GNOME Shell **50**
- Spotify (versi desktop, yang mengekspos MPRIS)
- Koneksi internet hanya untuk mengambil lirik dan album art
- Opsional: `Gvc` (biasanya sudah ada di GNOME) untuk fitur ducking mikrofon

---

## Instalasi

Cara tercepat:

```
make install
```

Perintah itu mengompilasi skema, lalu membuat symlink ke folder ekstensi. Setelahnya logout dan login sekali, kemudian aktifkan:

```
gnome-extensions enable spotify-ext@ikram
```

Kalau lebih suka manual:

1. Symlink folder ini ke folder ekstensi:
   ```
   ln -s "$PWD" ~/.local/share/gnome-shell/extensions/spotify-ext@ikram
   ```
2. Kompilasi skema (wajib, folder `schemas/` dibaca langsung oleh Shell):
   ```
   make schemas
   ```
3. Logout lalu login sekali. Di Wayland, GNOME Shell tidak bisa di-restart di tempat, dan metadata ekstensi di-cache saat startup — tanpa logout, halaman preferensi bisa belum terdeteksi.
4. Aktifkan:
   ```
   gnome-extensions enable spotify-ext@ikram
   ```

Buka pengaturan lewat **Settings → Extensions → (ekstensi ini) → ikon gerigi**, atau:
```
gnome-extensions prefs spotify-ext@ikram
```

Untuk melepas symlink: `make uninstall`.

---

## Tampilan

Indikator punya dua mode, diatur dari preferensi:

| Mode | Isi panel | Ukuran |
|---|---|---|
| **Ikon saja** | ikon nada | area sentuh 28×24 |
| **Cover + judul + status** | album art, judul lagu, dan satu slot info di kanan | 240×tinggi penuh panel |

Pada mode pill, tingginya mengikuti tinggi panel sehingga tidak menyisakan celah atas-bawah. Posisi bisa **kiri**, **tengah**, atau **kanan**. Kalau ruang panel tidak cukup, lebar pill menyusut otomatis (minimum 170px).

Latar pill diberi tint warna album art: pekat di tepi kiri (di belakang cover), memudar sampai sekitar 55% lebar, sisanya gelap. Tint digambar sendiri dengan Cairo dan dipotong mengikuti sudut membulat.

---

## Slot kanan: hitung mundur, sleep, atau duck

Slot di kanan pill bukan chip statistik. Isinya kontekstual, satu informasi per waktu:

1. **Hitung mundur sisa lagu** (default) — misalnya `-3:10`, tipografinya sama dengan judul (11px, 700).
2. **Sleep timer**: ikon bulan + sisa waktu, muncul hanya saat timer aktif. Timer dihentikan dari preferensi dengan memilih `Nonaktif`.
3. **Duck mikrofon** — ikon mikrofon + `Duck`, muncul hanya saat musik sedang dikecilkan.

Perpindahan antar isi memakai cross-fade 120ms, dan hanya terjadi saat *makna* slot berubah — bukan setiap detik. Saat lagu dijeda, slot, judul, dan cover meredup.

---

## Kartu (hover / klik)

Arahkan kursor ke indikator (400ms) atau klik untuk membuka kartu. Tutup dengan menggerakkan kursor keluar (320ms), `Esc`, atau klik di luar.

Isi kartu:

- **Album art 64px** dengan sudut membulat. Klik dua kali untuk membuka Spotify.
- **Judul + artis · album**, dipotong dengan elipsis bila panjang.
- **Kontrol** previous / play-pause / next / repeat. Repeat bersiklus mati → semua lagu → satu lagu, dan ditulis ke pemutar lewat `LoopStatus` sehingga tetap tersimpan di Spotify.
- **Baris waktu** `1:23 ──────── 3:20`. Garisnya bisa diklik atau di-drag untuk lompat.
- **Footer** satu baris: `This week 3h 12m · top Nama Artis`, lalu di kanan `🔥 5d` (streak berjalan) dan `best 12d` (streak terpanjang).

### Dua laci yang bisa dibuka

Kartu punya dua sisi yang bisa dibuka tanpa menggeser isi utamanya:

| Laci | Arah | Isi |
|---|---|---|
| **Lirik** | melebar ke kanan | 5 baris lirik di sekitar baris aktif |
| **Statistik** | melebar ke bawah | total minggu ini, 7 batang hari, top 5 artis (waktu), top 5 lagu (jumlah putar), hari aktif |

Keduanya berperilaku sama: **klik untuk membuka**, klik lagi atau `Esc` untuk menutup. Tidak ada pratinjau saat kursor lewat — laci hanya terbuka kalau memang diminta, jadi tidak ada panel yang tiba-tiba melebar saat kursor melintas.

Membuka salah satu tidak mengubah ukuran yang lain; membuka keduanya membuat laci statistik melebar mengikuti lebar kartu, sehingga tidak ada ruang kosong di sisi kanan.

Saat laci terbuka, `Esc` menutup laci dulu; `Esc` sekali lagi menutup kartu.

Kartu bisa muncul di mode ikon maupun mode pill, diposisikan mengikuti indikator dengan panah kecil yang menunjuk ke arahnya, dan dijepit agar tidak keluar dari monitor.

Warna aksen (border kartu, glow, ikon footer, isi chip state) diambil dari rata-rata warna album art, dengan piksel jenuh warna diprioritaskan supaya hasilnya tidak keruh.

---

## Lirik

- Sumber: [lrclib.net](https://lrclib.net), endpoint `/get` lalu fallback ke `/search` bila tidak ketemu persis.
- Format LRC diparse, termasuk baris dengan banyak timestamp dan pecahan milidetik.
- Posisi lagu diproyeksikan dari jam monotonik, jadi lirik tetap halus di antara pembaruan MPRIS.
- Cache 40 lagu terakhir (in-memory) supaya lagu yang diulang tidak memanggil API lagi.
- Bisa dimatikan dari preferensi; kartu otomatis mengecil saat lirik disembunyikan.

---

## Sleep timer

Durasi dipilih dari preferensi (nonaktif / 15 / 30 / 45 / 60 menit). Saat waktunya habis:

1. Volume diturunkan bertahap sampai 0 selama 5 detik.
2. Pemutaran dijeda.
3. Volume dikembalikan ke nilai semula.

Sisa waktu tampil sebagai hitung mundur di slot pill. Timer dihentikan dari preferensi dengan memilih `Nonaktif`. Nilai timer tersimpan sebagai setting, jadi ikut ter-reset ke nol setelah timer selesai.

---

## Mikrofon

Tiga pilihan perilaku saat ada aplikasi lain memakai mikrofon:

| Mode | Perilaku |
|---|---|
| **Jangan ganggu** | tidak melakukan apa pun |
| **Kecilkan volume** | volume diturunkan bertahap (400ms) ke persentase pilihan (10%–70%), lalu dipulihkan (600ms) saat mikrofon bebas |
| **Jeda sampai mikrofon selesai** | pemutaran dijeda, lalu dilanjutkan otomatis setelah mikrofon bebas |

Mode jeda hanya melanjutkan pemutaran kalau ekstensi yang menjedakannya — kalau musik memang sudah dijeda sebelumnya, musik tidak akan tiba-tiba berputar setelah rapat selesai.

Deteksi memakai `Gvc` (daftar source output). Kalau `Gvc` tidak tersedia, fitur ini mati diam-diam tanpa mengganggu fitur lain.

---

## Statistik mendengarkan

Disimpan lokal di `~/.local/share/spotify-ext/stats.json` dan ditulis maksimal setiap 5 menit. Detail artis/lagu hanya disimpan 10 hari; agregat detik dan jumlah putar per hari disimpan seterusnya.

Yang dicatat:

- total detik per hari
- detik per artis dan per lagu, per hari (detail 10 hari terakhir)
- jumlah putar per lagu, per hari (detail 10 hari terakhir)

Yang ditampilkan di kartu:

- total waktu minggu ini
- artis teratas minggu ini
- streak hari berturut-turut saat ini
- streak terpanjang sepanjang riwayat

Definisi "satu putaran" memakai posisi lagu: sebuah lagu dihitung setelah posisi melewati ambang `min(30 detik, 50% durasi)`. Putar ulang dan seek mundur ke awal akan mengaktifkan ulang hitungan. Iklan (artis kosong) tetap menambah total waktu tapi tidak diatribusikan ke artis mana pun.

---

## Preferensi

| Setting | Nilai | Keterangan |
|---|---|---|
| Indikator panel | Ikon saja / Cover + judul + status | berlaku langsung |
| Posisi | Kiri / Tengah / Kanan | berlaku langsung |
| Kartu terbuka | Saat kursor diarahkan / Hanya saat diklik / Keduanya | mode klik menutup kartu saat diklik ulang |
| Jeda sebelum terbuka | 0–2000 ms | hanya berlaku untuk mode kursor |
| Tampilkan lirik | on / off | tombol lirik di kartu ikut disembunyikan |
| Sleep timer | Nonaktif / 15 / 30 / 45 / 60 menit | langsung meng-arm timer |
| Saat mikrofon dipakai | Jangan ganggu / Kecilkan volume / Jeda sampai mikrofon selesai | — |
| Volume saat dikecilkan | 10%–70% | aktif hanya pada mode "Kecilkan volume" |

Setting disimpan lewat GSettings (skema `org.gnome.shell.extensions.spotify-ext`), sehingga bisa diubah dari preferensi, `gsettings`, atau `dconf`. Kalau ada file `config.json` lama dari versi sebelumnya, isinya dimigrasikan otomatis sekali saat pertama dijalankan.

---

## Struktur berkas

```
sonora/
├── .github/
│   └── workflows/
│       └── security.yml       # secret scan + SAST
├── .editorconfig
├── .gitignore
├── .gitleaks.toml             # aturan Gitleaks
├── .semgrepignore
├── DESIGN.md                  # panduan desain
├── LICENSE                    # GPL-3.0
├── Makefile
├── README.md
├── metadata.json              # wajib di root (dibaca Shell saat startup)
├── extension.js               # wajib di root, entry point
├── prefs.js                   # wajib di root, halaman preferensi
├── stylesheet.css             # wajib di root, satu-satunya CSS yang dimuat
├── schemas/                   # skema GSettings
│
├── src/
│   ├── core/                  # logika, tanpa St/Clutter
│   │   ├── player.js          # pembungkus D-Bus MPRIS
│   │   ├── lyrics.js          # client lrclib + cache
│   │   ├── lrc.js             # parser LRC
│   │   ├── stats.js           # model statistik + agregasi mingguan
│   │   ├── playback.js        # hitungan putar berbasis posisi
│   │   ├── art.js             # state fetch/cache/retry album art
│   │   ├── token.js           # token pembatalan request async
│   │   ├── settings.js        # GSettings + migrasi config lama
│   │   ├── volume.js          # fade, duck, pause-for-mic
│   │   └── mic.js             # deteksi mikrofon (Gvc)
│   │
│   ├── ui/
│   │   ├── indicator.js       # indikator panel (ikon/pill)
│   │   ├── geometry.js        # helper geometri kartu dan progress
│   │   ├── widgets.js         # format waktu, ellipsize, tombol ikon
│   │   ├── paint.js           # tint radial, panah, clip membulat
│   │   └── card/
│   │       ├── index.js       # orkestrasi kartu, layout, event
│   │       ├── head.js        # cover, judul, kontrol, repeat
│   │       ├── timer.js       # durasi + progress yang bisa digeser
│   │       ├── footer.js      # this week + streak
│   │       ├── lyrics-panel.js
│   │       └── stats-panel.js
│   │
│   └── util/
│       ├── art.js             # pixbuf → RGBA, pemasangan album art
│       ├── color.js           # warna aksen dari album art
│       ├── palette.js         # preset warna kartu dan pill
│       └── path.js            # resolusi folder ekstensi
│
├── tests/                     # tes unit, satu runner
├── dev/                       # pemutar MPRIS palsu + skrip headless shell
├── icons/                     # ikon tambahan (api, bulan)
└── docs/                      # AUDIT.md, IDEAS.md, ROADMAP.md, STRUCTURE.md, mockup/
```

Alasan pemecahan ini, termasuk batasan yang tidak bisa dilanggar GNOME Shell, ada di [`docs/STRUCTURE.md`](docs/STRUCTURE.md).

Prinsipnya: `src/core/` bebas dari `St`/`Clutter` sehingga bisa diuji tanpa menjalankan Shell, sedangkan `src/ui/` boleh bergantung penuh pada Shell.

---

## Perintah

Semua perintah pengembangan lewat `Makefile`:

| Perintah | Kegunaan |
|---|---|
| `make` | `lint` + `test` + `schemas` sekaligus |
| `make schemas` | Kompilasi `schemas/gschemas.compiled` (wajib sebelum jalan pertama kali) |
| `make lint` | Periksa sintaks semua berkas JavaScript |
| `make test` | Jalankan semua tes di `tests/` |
| `make security` | Secret scan dengan Gitleaks dan SAST dengan Semgrep |
| `make install` | Symlink ke folder ekstensi + kompilasi skema |
| `make uninstall` | Hapus symlink |
| `make pack` | Buat `dist/sonora.zip` untuk rilis |
| `make headless` | Jalankan shell headless dengan pemutar palsu |
| `make clean` | Hapus artefak build |
| `make help` | Daftar perintah |

`make security` membutuhkan `gitleaks` dan `semgrep` di `PATH`. CI menjalankan pemeriksaan yang sama dengan versi yang dipin.

**Tes** dijalankan lewat satu pintu:
```
make test
```
Setiap berkas `tests/*.test.js` dijalankan di proses `gjs` sendiri, jadi tes yang memakai main loop tidak mengganggu tes lain.

**Shell headless** (tidak mengganggu sesi utama):
```
make headless
```
`dev/fake-spotify.js` meniru pemutar MPRIS: tiga lagu, posisi berjalan otomatis, serta merespons Play/Pause/Next/Previous/SetPosition/Volume/LoopStatus. Hentikan dengan Ctrl-C.

**Muat ulang setelah mengubah kode:**
Pada Wayland GNOME Shell 50 tidak ada hot reload JavaScript. `gnome-extensions disable/enable` hanya memuat ulang CSS; perubahan JS butuh logout/login. Setelah mengubah `metadata.json` atau menambah key skema, logout/login juga diperlukan.

**Log:**
```
journalctl --user -f | grep -i sonora
```

---

## Batasan yang diketahui

- **Streak terpanjang dihitung ulang dari riwayat hari** setiap kali kartu diperbarui. Murah untuk data kecil, tapi linier terhadap jumlah hari.
- **Detail harian dibatasi 10 hari** — `days[].artists` dan `days[].tracks` yang lebih lama dipangkas; total detik dan jumlah putar per hari tetap disimpan.
- **Blur latar tidak tersedia** di GNOME Shell. Efek "kaca buram" di mockup diganti gradient Cairo, jadi hasilnya lebih tegas, bukan benar-benar blur.
- **Desaturasi cover saat pause** tidak bisa lewat CSS karena album art adalah konten gambar; yang dipakai adalah penurunan opacity.
- **Hanya Spotify.** Bus MPRIS ditulis tetap ke `org.mpris.MediaPlayer2.spotify`; pemutar lain tidak terdeteksi.
- **Klik pill membuka kartu**, bukan play/pause. Kontrol pemutaran ada di dalam kartu.
- Pada Wayland, perubahan kode butuh logout/login bila ekstensi gagal dimuat ulang dengan bersih.

---

## Kontribusi

Issue dan pull request diterima. Sebelum mengirim PR, jalankan `make lint`, `make test`, dan `make security`.

## Keamanan

Jangan membuka issue publik untuk kerentanan. Gunakan pelaporan kerentanan privat di GitHub. `make security` menjalankan Gitleaks dan Semgrep; CI juga memindai setiap push dan pull request.

## Privasi dan afiliasi

- Tidak ada akun, telemetri, atau pengiriman data ke pembuat ekstensi.
- Statistik disimpan lokal di `~/.local/share/spotify-ext/stats.json`.
- Untuk lirik, judul, artis, album, dan durasi lagu dikirim ke `lrclib.net`.
- Album art diambil dari URL `mpris:artUrl` yang disediakan Spotify.
- Sonora tidak berafiliasi dengan Spotify. Spotify adalah merek dagang Spotify AB.

## Lisensi

Sonora didistribusikan di bawah GNU General Public License v3.0. Lihat [LICENSE](LICENSE).
