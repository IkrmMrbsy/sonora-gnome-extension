# Ekstensi Now-Playing untuk GNOME Shell

Ekstensi GNOME Shell 50 yang menampilkan lagu Spotify yang sedang diputar langsung di panel atas. Ringkasnya: satu indikator di panel, satu kartu yang muncul saat di-hover, berisi album art, lirik tersinkron, kontrol pemutaran, dan ringkasan kebiasaan mendengarkan.

Tidak memakai Web API Spotify dan tidak butuh login. Semua data diambil dari **MPRIS** (`org.mpris.MediaPlayer2.spotify`) di D-Bus session, jadi apa pun yang sedang diputar Spotify akan terbaca — termasuk kontrol play/pause/next/previous/seek lewat D-Bus.

---

## Kebutuhan

- GNOME Shell **50**
- Spotify (versi desktop, yang mengekspos MPRIS)
- Koneksi internet hanya untuk mengambil lirik dan album art
- Opsional: `Gvc` (biasanya sudah ada di GNOME) untuk fitur ducking mikrofon

---

## Instalasi

1. Letakkan folder ini di:
   ```
   ~/.local/share/gnome-shell/extensions/spotify-ext@ikram
   ```
   Symlink juga boleh, misalnya:
   ```
   ln -s /path/ke/folder-ini ~/.local/share/gnome-shell/extensions/spotify-ext@ikram
   ```
2. Pastikan skema sudah dikompilasi (wajib, karena folder `schemas/` dibaca langsung):
   ```
   glib-compile-schemas schemas/
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

1. **Hitung mundur sisa lagu** (default) — misalnya `-3:10`, tipografinya sama dengan judul (11px, 600).
2. **Sleep timer** — ikon bulan + sisa waktu, muncul hanya saat timer aktif. Klik untuk membatalkan.
3. **Duck mikrofon** — ikon mikrofon + `Duck`, muncul hanya saat musik sedang dikecilkan.

Perpindahan antar isi memakai cross-fade 120ms, dan hanya terjadi saat *makna* slot berubah — bukan setiap detik. Saat lagu dijeda, slot, judul, dan cover meredup.

---

## Kartu (hover / klik)

Arahkan kursor ke indikator (400ms) atau klik untuk membuka kartu. Tutup dengan menggerakkan kursor keluar (320ms), `Esc`, atau klik di luar.

Isi kartu:

- **Album art 64px** dengan sudut membulat. Klik dua kali untuk membuka Spotify.
- **Judul + artis · album**, dipotong dengan elipsis bila panjang.
- **Kontrol** previous / play-pause / next.
- **Lirik** dua baris: baris aktif dan baris berikutnya.
- **Progress bar 3px** — isi dari kiri ke kanan, bisa diklik atau di-drag untuk seek.
- **Footer** satu baris: `This week 3h 12m · top Nama Artis`, lalu di kanan `🔥 5d` (streak berjalan) dan `best 12d` (streak terpanjang).

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

Sisa waktu tampil sebagai hitung mundur di slot pill dan bisa dibatalkan dengan klik. Nilai timer tersimpan sebagai setting, jadi ikut ter-reset ke nol setelah timer selesai.

---

## Ducking mikrofon

Kalau ada aplikasi yang memakai mikrofon, volume musik diturunkan ke 30% secara bertahap (400ms), lalu dikembalikan (600ms) saat mikrofon tidak dipakai lagi. Deteksi memakai `Gvc` (daftar source output). Bisa dimatikan dari preferensi; kalau `Gvc` tidak tersedia, fitur ini otomatis tidak aktif tanpa mengganggu fitur lain.

---

## Statistik mendengarkan

Disimpan lokal di `~/.local/share/spotify-ext/stats.json` dan ditulis maksimal setiap 30 detik.

Yang dicatat:

- total detik per hari
- detik per artis dan per lagu, per hari maupun keseluruhan
- jumlah putar per lagu

Yang ditampilkan di kartu:

- total waktu minggu ini
- artis teratas minggu ini
- streak hari berturut-turut saat ini
- streak terpanjang sepanjang riwayat

Definisi "satu putaran" mengikuti ambang 30 detik seperti Spotify: sebuah lagu dihitung sekali setelah diputar 30 detik. Iklan (artis kosong) tetap menambah total waktu tapi tidak diatribusikan ke artis mana pun.

---

## Preferensi

| Setting | Nilai | Keterangan |
|---|---|---|
| Indikator panel | Ikon saja / Cover + judul + status | berlaku langsung |
| Posisi | Kiri / Tengah / Kanan | berlaku langsung |
| Tampilkan lirik | on / off | kartu mengecil saat off |
| Kecilkan musik saat mikrofon dipakai | on / off | — |
| Sleep timer | Nonaktif / 15 / 30 / 45 / 60 menit | langsung meng-arm timer |

Setting disimpan lewat GSettings (skema `org.gnome.shell.extensions.spotify-ext`), sehingga bisa diubah dari preferensi, `gsettings`, atau `dconf`. Kalau ada file `config.json` lama dari versi sebelumnya, isinya dimigrasikan otomatis sekali saat pertama dijalankan.

---

## Struktur berkas

| Berkas | Peran |
|---|---|
| `extension.js` | Orkestrasi: timer sinkronisasi, pengambilan lirik & art, akumulasi statistik, sleep, seek |
| `mpris.js` | Pembungkus D-Bus: status, metadata, posisi, volume, kontrol pemutaran |
| `island.js` | Indikator panel: mode ikon/pill, tint, slot kontekstual, hover timer |
| `card.js` | Kartu now-playing: layout, panah, animasi, progress, footer |
| `art.js` | Konversi pixbuf → RGBA dan pemasangan album art ke aktor |
| `color.js` | Perhitungan warna aksen dari album art |
| `lrc.js` | Parser LRC dan pencarian baris aktif |
| `stats.js` | Model statistik: bucket harian, streak, top artist |
| `volume.js` | Fade volume untuk ducking dan sleep |
| `mic.js` | Deteksi mikrofon aktif lewat `Gvc` |
| `config.js` | Pembungkus GSettings + migrasi config lama |
| `prefs.js` | Halaman preferensi (GTK4 + libadwaita) |
| `path.js` | Utilitas path direktori ekstensi |
| `schemas/` | Skema GSettings dan hasil kompilasinya |
| `icons/` | Ikon tambahan (api untuk streak) |
| `stylesheet.css` | Gaya tampilan |
| `mockup/` | Mockup HTML untuk eksplorasi desain (bukan bagian runtime) |
| `dev/` | Pemutar MPRIS palsu untuk pengujian |

---

## Pengembangan

**Tes unit** (tanpa GNOME Shell, cukup `gjs`):
```
gjs -m test-lrc.js
gjs -m test-color.js
gjs -m test-stats.js
gjs -m test-volume.js
```

**Uji di shell bersarang** (tidak mengganggu sesi utama):
```
dbus-run-session -- bash -c './dev/fake-spotify.js & gnome-shell --nested --wayland'
```
`dev/fake-spotify.js` meniru pemutar MPRIS: tiga lagu, posisi berjalan otomatis, dan merespons Play/Pause/Next/Previous/SetPosition/Volume.

**Muat ulang setelah mengubah kode:**
```
gnome-extensions disable spotify-ext@ikram
gnome-extensions enable spotify-ext@ikram
```
Setelah mengubah `metadata.json` atau menambah key skema, logout/login diperlukan.

**Log:**
```
journalctl --user -f | grep -i spotify-ext
```

---

## Batasan yang diketahui

- **Hitungan putaran belum akurat.** Lagu yang diulang tanpa berganti judul dihitung sekali; jeda lalu lanjut pada lagu yang sama bisa dihitung dua kali; lagu di bawah 30 detik tidak pernah terhitung; dan bila timer sinkronisasi tertunda, detik yang hilang dibatasi maksimal 2 detik per tick sehingga ambang 30 detik bisa tidak tercapai. Total waktu (detik) tetap akurat.
- **Streak terpanjang dihitung ulang dari riwayat hari** setiap kali kartu diperbarui. Murah untuk data kecil, tapi linier terhadap jumlah hari.
- **Riwayat harian tidak dipangkas** — tumbuh satu entri per hari pemakaian.
- **Blur latar tidak tersedia** di GNOME Shell. Efek "kaca buram" di mockup diganti gradient Cairo, jadi hasilnya lebih tegas, bukan benar-benar blur.
- **Desaturasi cover saat pause** tidak bisa lewat CSS karena album art adalah konten gambar; yang dipakai adalah penurunan opacity.
- **Hanya Spotify.** Bus MPRIS ditulis tetap ke `org.mpris.MediaPlayer2.spotify`; pemutar lain tidak terdeteksi.
- **Klik pill membuka kartu**, bukan play/pause. Kontrol pemutaran ada di dalam kartu.
- Pada Wayland, perubahan kode butuh logout/login bila ekstensi gagal dimuat ulang dengan bersih.
