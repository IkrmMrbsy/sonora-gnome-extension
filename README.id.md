[English](README.md) | **Bahasa Indonesia**

# Sonora

**The music companion for GNOME.**

Ekstensi GNOME Shell 50 yang menampilkan lagu Spotify yang sedang diputar langsung di panel atas, dengan lirik tersinkron, kontrol pemutaran, sleep timer, auto-duck mikrofon, dan statistik mendengarkan lokal.

Tidak memakai Web API Spotify dan tidak butuh login. Semua data diambil dari **MPRIS** (`org.mpris.MediaPlayer2.spotify`) di D-Bus session, jadi apa pun yang sedang diputar Spotify akan terbaca — termasuk kontrol play/pause/next/previous/seek lewat D-Bus.

---

## Kebutuhan

- GNOME Shell **50**
- Spotify (versi desktop, yang mengekspos MPRIS)
- Koneksi internet hanya untuk mengambil lirik (`lrclib.net`) dan album art (`mpris:artUrl`)
- Opsional: `Gvc` (biasanya sudah ada di GNOME) untuk fitur ducking mikrofon

---

## Instalasi

Cara tercepat:

```
make install
```

Perintah itu mengompilasi skema dan kamus terjemahan (`make schemas locales`), lalu membuat symlink ke folder ekstensi. Setelahnya logout dan login sekali, kemudian aktifkan:

```
gnome-extensions enable sonora@ikrmmrbsy.github.io
```

Kalau lebih suka manual:

1. Symlink folder ini ke folder ekstensi:
   ```
   ln -s "$PWD" ~/.local/share/gnome-shell/extensions/sonora@ikrmmrbsy.github.io
   ```
2. Kompilasi skema dan locale:
   ```
   make schemas locales
   ```
3. Logout lalu login sekali. Di Wayland, GNOME Shell tidak bisa di-restart di tempat, dan metadata ekstensi di-cache saat startup — tanpa logout, halaman preferensi bisa belum terdeteksi.
4. Aktifkan:
   ```
   gnome-extensions enable sonora@ikrmmrbsy.github.io
   ```

Buka pengaturan lewat **Settings → Extensions → (ekstensi ini) → ikon gerigi**, atau:
```
gnome-extensions prefs sonora@ikrmmrbsy.github.io
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

Latar pill diberi tint warna album art atau preset solid: pekat di tepi kiri (di belakang cover), memudar sampai sekitar 55% lebar, sisanya gelap. Tint digambar sendiri dengan Cairo dan dipotong mengikuti sudut membulat.

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

Warna aksen (border kartu, glow, ikon footer, isi chip state) diambil dari rata-rata warna album art atau preset solid pilihan, dengan piksel jenuh warna diprioritaskan supaya hasilnya tidak keruh.

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
| **Kecilkan volume** | volume diturunkan bertahap (400ms) ke persentase pilihan, lalu dipulihkan (600ms) saat mikrofon bebas |
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

## Preferensi & Bahasa (i18n)

Preferensi menggunakan antarmuka Libadwaita 3 halaman (**Tampilan**, **Perilaku**, dan **Tentang**) dan mendukung lokalisasi via GNU gettext (`po/*.po` → `locale/*/LC_MESSAGES/spotify-ext.mo`).

Setting disimpan lewat GSettings (skema `org.gnome.shell.extensions.spotify-ext`), sehingga bisa diubah dari preferensi, `gsettings`, atau `dconf`.

Untuk menambah bahasa baru:
1. Salin `po/spotify-ext.pot` menjadi `po/<kode-bahasa>.po`.
2. Terjemahkan setiap `msgstr`.
3. Tambahkan kredit penerjemah di `src/util/translators.js`, jalankan `make locales`, lalu kirim Pull Request.

---

## Struktur berkas

```
sonora/
├── .github/
│   └── workflows/             # CI & security scan
├── .editorconfig
├── .gitignore
├── .gitleaks.toml             # aturan Gitleaks
├── .semgrepignore
├── AGENTS.md                  # aturan workspace & arsitektur
├── DESIGN.md                  # panduan desain
├── LICENSE                    # GPL-3.0
├── Makefile
├── README.md                  # dokumentasi utama (Inggris)
├── README.id.md               # dokumentasi Bahasa Indonesia
├── metadata.json              # wajib di root (dibaca Shell saat startup)
├── extension.js               # wajib di root, entry point
├── prefs.js                   # wajib di root, halaman preferensi
├── stylesheet.css             # wajib di root, satu-satunya CSS yang dimuat
├── po/                        # template .pot & kamus terjemahan .po
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
│       ├── path.js            # resolusi folder ekstensi
│       └── translators.js     # daftar kredit penerjemah
│
├── tests/                     # tes unit, satu runner
├── dev/                       # pemutar MPRIS palsu, compile-locales.py, headless shell
├── icons/                     # ikon tambahan (api, bulan, github)
└── docs/                      # AUDIT.md, IDEAS.md, ROADMAP.md, STRUCTURE.md, mockup/
```

---

## Perintah

| Perintah | Kegunaan |
|---|---|
| `make` | `lint` + `test` + `schemas` + `locales` sekaligus |
| `make schemas` | Kompilasi `schemas/gschemas.compiled` |
| `make locales` | Kompilasi terjemahan `po/*.po` ke biner `locale/` |
| `make lint` | Periksa sintaks semua berkas JavaScript |
| `make test` | Jalankan semua tes di `tests/` |
| `make security` | Secret scan dengan Gitleaks dan SAST dengan Semgrep |
| `make install` | Symlink ke folder ekstensi + kompilasi skema & locale |
| `make uninstall` | Hapus symlink |
| `make pack` | Buat `dist/sonora.zip` untuk rilis |
| `make headless` | Jalankan shell headless dengan pemutar palsu |
| `make clean` | Hapus artefak build |
| `make help` | Daftar perintah |

---

## Privasi dan afiliasi

- Tidak ada akun, telemetri, atau pengiriman data ke pembuat ekstensi.
- Statistik disimpan lokal di `~/.local/share/spotify-ext/stats.json`.
- Untuk lirik, judul, artis, album, dan durasi lagu dikirim ke `lrclib.net`.
- Album art diambil dari URL `mpris:artUrl` yang disediakan Spotify.
- Sonora tidak berafiliasi dengan Spotify. Spotify adalah merek dagang Spotify AB.

## Lisensi

Sonora didistribusikan di bawah GNU General Public License v3.0. Lihat [LICENSE](LICENSE).
