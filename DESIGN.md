# Panduan Desain Sonora

> Arah desain untuk ekstensi Sonora di GNOME Shell 50: indikator panel, kartu
> now playing, lirik, statistik, dan preferences.
>
> Ini bukan spesifikasi mockup dan bukan brief web app. Ekstensi yang berjalan
> adalah source of truth. Eksplorasi mockup dan screenshot hanya referensi. Saat
> panduan ini dan kode berbeda, tentukan apakah kode itu utang lama atau panduan
> ini yang basi, lalu perbarui keduanya dalam perubahan yang sama.

## 1. Kebenaran produk

Sonora adalah pendamping mendengarkan untuk GNOME Shell. Sonora menampilkan apa
yang sedang diputar Spotify dan membantu pengguna memahami cara mereka
mendengarkan. Sonora bukan klien Spotify, bukan dashboard, dan bukan tiruan
panel kontrol pemutar lain.

Produk punya tiga pekerjaan:

| Pekerjaan | Surface | Yang dibutuhkan pengguna |
|---|---|---|
| Melirik | Indikator panel | Lagu, state, dan sisa waktu tanpa meninggalkan desktop |
| Memeriksa | Kartu now playing | Kontrol, progress, lirik, dan konteks mingguan |
| Mengatur | Preferences | Sedikit pilihan dengan akibat yang langsung terlihat |

Antarmuka adalah instrumen yang tenang. Ia harus terasa hadir saat dilihat dan
hampir hilang saat diabaikan.

### Komitmen desain

1. Panel dulu. Panel adalah surface utama, bukan pintasan menuju aplikasi besar.
2. Satu aksen ambient. Album art memberi satu warna, dan warna itu dipakai
   sebagai cahaya, bukan hiasan di setiap kontrol.
3. Tinta matte, bukan kaca. Surface padat, cukup opak untuk dibaca, dan tanpa
   efek blur.
4. Informasi muncul saat diminta. Lirik dan statistik tinggal di drawer, bukan di
   dashboard permanen.
5. Kebenaran lokal. Statistik berasal dari data pemutaran lokal. Tidak ada angka
   palsu, testimoni karangan, atau klaim penggunaan yang dibuat-buat.

### Bukan tujuan

- Tidak ada layout mobile. Ini ekstensi desktop shell. Uji panel sempit, HiDPI,
  dan text scaling.
- Tidak ada dashboard web, halaman marketing, atau sistem akun.
- Tidak ada cloud sync, social feed, atau surface rekomendasi.
- Tidak ada miniplayer terpisah dari panel.
- Tidak ada lyric seeking yang bisa diklik di ekstensi. Mock v7 pernah
  mengeksplorasi itu, tetapi perilaku tersebut tidak dikirim dan tidak boleh
  didokumentasikan seolah sudah ada.
- Tidak ada light theme di surface Shell. Panel dan kartu hidup di dalam chrome
  shell. Preferences mengikuti tema terang atau gelap sistem.

## 2. Design Read dan dial

Membaca ini sebagai: utilitas desktop shell untuk pengguna GNOME yang membiarkan
Spotify terbuka, dalam bahasa instrumen tenang, dial ENERGY 1 / RHYTHM 1 /
MOTION 2.

| Dial | Nilai | Arti di sini |
|---|---|---|
| ENERGY | 1 | Tanpa gradient dekoratif, badge berisik, atau motion ornamental |
| RHYTHM | 1 | Satu shell kartu yang konsisten. Variasi datang dari drawer, bukan section |
| MOTION | 2 | Transisi state singkat. Tanpa loop, parallax, atau koreografi |

Tuas yang dipakai:

- Satu focal point per surface: judul lagu di kartu, pill di panel, preview hidup
  di Preferences.
- Satu aksen yang disengaja: warna album atau preset untuk tint, border, ikon
  footer, dan ikon stats aktif. Tidak ada yang bersaing dengannya.
- Whitespace sebagai struktur: kartu 360 px dengan padding 16 px, bukan grid
  padat.
- Motif identitas: warna album masuk dari kiri atas dan memudar sebelum kontrol.
  Putih kertas duduk di atas tinta.

## 3. Peta surface

| Surface | Pekerjaan | Implementasi | Motion |
|---|---|---|---|
| Ikon panel | Kehadiran tenang | `src/ui/indicator.js` | Hover saja |
| Pill panel | Now playing sekali lirik | `src/ui/indicator.js` | Cross-fade state |
| Kartu now playing | Kontrol dan konteks | `src/ui/card/index.js` | Buka, tutup, resize |
| Drawer lirik | Mengikuti baris aktif | `src/ui/card/lyrics-panel.js` | Resize lebar |
| Drawer statistik | Meninjau minggu | `src/ui/card/stats-panel.js` | Resize tinggi |
| Preferences | Mengatur perilaku | `prefs.js` | Adw native saja |

Kartu adalah satu-satunya surface melayang. Jangan menambah kartu bersarang,
tumpukan modal, atau jendela statistik terpisah tanpa keputusan produk yang
dicatat di sini.

## 4. Fondasi

### 4.1 Warna

Paletnya kecil. Warna album berubah, tetapi sistem netralnya tetap.

| Token | Nilai | Penggunaan |
|---|---|---|
| `ink` | `#0d0d12` | Dasar pill panel dan kartu |
| `ink-raised` | `rgba(20,20,26,0.94)` | Tab drawer dan affordance terangkat |
| `ink-card` | `rgba(13,13,18,0.94)` | Surface kartu |
| `paper` | `#f4f2ef` | Teks utama |
| `paper-pure` | `#ffffff` | Teks hover, isi tombol play, bar hari ini |
| `paper-hover` | `#f0f0f0` | Latar hover tombol play |
| `text-secondary` | `rgba(244,242,239,0.72)` | Artis dan teks pendukung |
| `text-tertiary` | `rgba(244,242,239,0.56)` | Waktu, periode, meta |
| `text-disabled` | `rgba(244,242,239,0.46)` | Label paused atau inactive, hanya jika tetap terbaca |
| `hairline` | `rgba(255,255,255,0.10)` | Divider dan border |
| `hairline-strong` | `rgba(255,255,255,0.14)` | Track progress |
| `accent` | Aksen album atau preset | Tint, border, ikon footer, ikon stats aktif |
| `accent-line` | Aksen pada alpha `0.40` sampai `0.45` | Border kartu, pill, dan tab |
| `play-ink` | `#111111` | Glyph di tombol play putih |
| `flame` | `#ffb066` | Ikon streak saja |
| `preview-accent` | `#ff4d6d` | Preview Preferences mode album, tidak dipakai di Shell |

Aturan:

- Hanya satu aksen aktif. Di mode album, aksen berasal dari cover. Di mode solid,
  aksen berasal dari preset terpilih. Jangan campur aksen album dan aksen preset
  di surface yang sama.
- Api adalah pengecualian semantik untuk streak, bukan aksen kedua. Jangan
  menyebarkan oranye api ke kontrol lain.
- Delapan preset latar adalah tema, bukan delapan warna di satu layar. Hanya satu
  preset aktif. Satu preset memasangkan satu latar dengan satu aksen.
- Tidak ada warna dekoratif baru. Warna baru harus punya token atau alasan
  tertulis. Jika state baru butuh warna, state itu butuh makna status nyata.
- `preview-accent` hanya untuk preview Preferences. Jangan memakainya di Shell
  atau di data nyata.
- Jangan memakai opacity saja untuk menyampaikan state. Pasangkan dengan ikon,
  label, atau perubahan bentuk.
- Surface Shell sengaja gelap karena hidup di panel GNOME di atas wallpaper
  sembarang dan harus menyatu dengan chrome shell. Preferences memakai token
  libadwaita dan mengikuti tema sistem.

#### Batas kontras

Setiap token teks harus mencapai minimal 4.5:1 terhadap surface yang benar-benar
dirender, termasuk tint album. Di atas `#0d0d12`, putih 56% alpha sekitar 6.5:1,
putih 46% sekitar 4.7:1, dan putih 40% sekitar 3.8:1. Karena itu nilai 40% tidak
boleh dipakai untuk teks yang harus dibaca.

Nilai alpha 30% sampai 40% yang ada di stylesheet sekarang adalah utang kontras.
Jangan menyalinnya ke komponen baru. Naikkan saat menyentuh komponen tersebut.
Tint paling kuat harus berada di belakang artwork, bukan di belakang teks kecil.
Jika teks kecil harus berada di atas tint terang, turunkan tint atau tambahkan
scrim gelap. Jangan menyelesaikan masalah dengan menurunkan opacity teks lebih
jauh.

#### Preset latar

| ID | Latar | Aksen |
|---|---|---|
| `midnight` | `#0d0d12` | `#3584e4` |
| `graphite` | `#15151a` | `#c0bfbc` |
| `navy` | `#0b1626` | `#62a0ea` |
| `forest` | `#0d1a12` | `#57e389` |
| `plum` | `#1a1024` | `#c061cb` |
| `wine` | `#200f17` | `#e56b8a` |
| `ember` | `#1f140c` | `#ffa348` |
| `lagoon` | `#081a1c` | `#2ec4b6` |

`midnight` adalah default. Preset didefinisikan di `src/util/palette.js`.

### 4.2 Tipografi

Pakai font UI sistem GNOME. Jangan membundel atau mengimpor web font. Antarmuka
harus terasa native dan mengikuti pengaturan font pengguna.

| Peran | Ukuran | Berat | Catatan |
|---|---|---|---|
| Judul pill panel | 11 | 700 | Satu baris, ellipsized |
| Judul kartu | 14 | 700 | Satu baris, ellipsized |
| Artis dan album | 11 | 400 | Digabung dengan `·` |
| Waktu kartu | 9.5 | 400 | Angka tabular |
| Countdown pill | 11 | 700 | Angka tabular, sejajar dengan judul pill |
| Footer | 11 | 400 | Nilai bold |
| Baris lirik | 12 | 400 | Wrap, jangan ellipsize |
| Lirik aktif | 15 | 700 | Putih kertas |
| Label section statistik | 9.5 | 700 | Uppercase, tracking `0.14em` |
| Total minggu | 20 | 700 | Angka tabular |
| Baris statistik | 10 | 400 | Nama ellipsized |
| Hero Preferences | 20 | 800 | Satu baris atau wrap |
| Judul field Preferences | 12 | 700 | Sentence case |

Aturan:

- Berat dibatasi ke 400, 700, dan 800. Tidak ada italic.
- Pakai angka tabular untuk waktu, total, peringkat, dan streak.
- Uppercase dengan tracking hanya untuk header statistik dan eyebrow Preferences.
  Jangan uppercase tombol, judul, atau body copy.
- Nilai di bawah 10 px hanya untuk label mikro: waktu, inisial hari, peringkat.
  Jangan menaruh kalimat di ukuran itu.
- Ellipsize judul dan nama satu baris. Wrap lirik karena baris lirik yang
  terpotong lebih buruk daripada dua baris.

### 4.3 Spasi dan ukuran

Pakai skala spasi kecil: 2 untuk koreksi optik, 6 untuk jarak lokal, 8 sampai 14
untuk jarak kontrol dan grid statistik, 16 untuk padding struktural, dan 20 untuk
hero Preferences.

| Elemen | Ukuran |
|---|---|
| Pill panel | 240 x setinggi panel, fallback 26 |
| Slot judul pill | 116, menyusut ke 46 di panel sempit |
| Cover panel | 18 x 18 |
| Kotak ikon panel | 28 x 24 |
| Kartu | Lebar 360, tinggi diukur dari konten |
| Padding kartu | 16 |
| Cover kartu | 64 x 64 |
| Panel lirik | Lebar 300, jarak seam 16 |
| Drawer statistik | Tinggi 160 sampai ruang monitor, fallback 360 |
| Tab drawer | 18 x 56 |
| Tab statistik | 56 x 18 |
| Jendela Preferences | 720 x 820 default |
| Preview Preferences | 300 x 160 |

Aturan:

- Jangan hardcode tinggi teks. Ukur kartu dari kontennya.
- Dimensi tetap boleh untuk chrome panel dan ikon yang diketahui, bukan untuk
  paragraf atau lirik.
- Drawer statistik boleh memakai ruang antara panel dan dasar monitor. Ia harus
  scroll, bukan clip, saat konten melebihi ruang.

### 4.4 Radius, border, dan elevasi

| Elemen | Radius | Alasan |
|---|---|---|
| Track dan fill progress | 2 | Kecil, linear, berarah |
| Cover panel | 5 | Gambar kecil, bukan kartu |
| Tombol ikon dan repeat | 8 | Kontrol ringkas |
| Tab drawer | 9 | Affordance kecil |
| Hover ikon panel | 12 | Surface hover lembut |
| Pill panel | 13 | Kapsul karena ia chip panel |
| Cover kartu | 14 | Artwork di dalam kartu |
| Tombol play | 14 | Aksi melingkar, satu-satunya kontrol terisi penuh |
| Kartu | 18 | Surface melayang utama |
| Hero Preferences | 18 | Satu surface brand |

- Jangan membuat semua elemen berbentuk pill. Variasi radius adalah cara UI
  mengatakan "chip", "kontrol", "artwork", dan "kartu" tanpa label.
- Kartu memakai satu shadow netral: `0 6px 16px rgba(0,0,0,0.40)`. Shadow itu
  mengangkat kartu dari panel dan wallpaper. Pill tidak punya shadow karena
  duduk di dalam panel.
- Border adalah hairline. Border aksen tipis dan alpha rendah, bukan glow.
- Drawer memakai wash datar `rgba(255,255,255,0.015)`, bukan kartu lain.
- Jangan menambah blur, backdrop filter, kartu bersarang, atau lapisan shadow
  kedua.

### 4.5 Tint album

Mode album menggambar tint radial dari kiri atas:

- Alpha pusat `0.50`, stop tengah `0.16`, tepi `0`.
- Origin berada dekat artwork supaya warna terkuat tetap di belakang cover.
- Tint memudar sebelum ujung chip di pill.
- Mode solid mematikan tint sepenuhnya.
- Gambar Cairo harus mengikuti surface scale HiDPI.

Tint adalah identitas ambient, bukan gradient latar. Ia tidak boleh berubah
menjadi wash warna penuh, glow, atau aksen kedua.

### 4.6 Ikonografi

- Pakai ikon simbolik GNOME untuk aksi sistem: play, pause, previous, next,
  repeat, audio, mikrofon, display, theme, mouse, dan waktu.
- Pakai ikon kustom Sonora hanya untuk makna khas produk: bulan untuk sleep dan
  api untuk streak.
- Ikon kustom memakai viewBox 24 dan dipakai pada 13 sampai 28 px, satu siluet
  jelas, dan tanpa detail yang hilang di bawah 13 px.
- Bulan memakai putih kertas. Api memakai `#ffb066`. Tidak ada ikon multiwarna
  lain di surface Shell.
- Panah arah hanya untuk affordance drawer: `go-next`, `go-previous`, `go-up`,
  `go-down`. Tidak ada panah dekoratif di copy atau tombol.
- Setiap kontrol ikon saja wajib punya accessible name.

## 5. Aturan surface

### 5.1 Indikator panel

Dua mode, satu pekerjaan: membuat lagu saat ini tersedia tanpa membuka apa pun.

#### Mode ikon

- Area klik 28 x 24, ikon audio simbolik 14 px.
- Tidak ada surface permanen. Surface hover putih 12% dengan radius 12 muncul saat
  pointer di atasnya.
- Ini adalah default tenang untuk pengguna yang ingin hadir tanpa teks.

#### Mode pill

- 240 x 26 nominal, lalu mengisi tinggi panel saat terpasang. Tinta gelap,
  border aksen 1 px, radius 13.
- Border transparan bawaan tombol panel bukan alasan untuk terlihat lebih kecil
  dari panel.
- Isi: cover 18 px, judul 116 px, spacer fleksibel, countdown atau slot state.
- Judul 11 px, berat 700, satu baris, ellipsized. Judul tidak boleh mendorong
  slot keluar dari pill.
- Di panel sempit, susutkan pill sampai batas 170 px dan judul sampai 46 px.
  Jangan biarkan pill mendesak item panel lain.
- Hover memakai surface putih 13%. Hover tidak boleh menghapus border atau slot.

#### State slot

| State | Konten | Surface | Catatan |
|---|---|---|---|
| Countdown | `-m:ss` | Tidak ada | Default saat playing atau paused |
| Sleep | Ikon bulan dan sisa waktu | Chip aksen | Mengalahkan duck |
| Duck | Ikon mikrofon dan `Duck` | Chip aksen | Menjelaskan volume turun |

Hanya satu slot yang terlihat. Saat paused, redupkan countdown tetapi biarkan
chip sleep atau duck tetap terbaca karena chip itu menjelaskan alasan perubahan
pemutaran. Jangan tampilkan slot saat tidak ada lagu.

Slot adalah status, bukan tombol terpisah. Jangan menulis instruksi klik di
accessible name-nya kecuali slot benar-benar menjadi aksi terpisah.

### 5.2 Kartu now playing

Kartu adalah satu surface dengan tiga baris tetap dan dua drawer opsional.

- Lebar: 360. Tinggi: konten terukur ditambah padding 16 px.
- Buka: 180 ms, opacity, scale dari 0.985, translate dari -6.
- Tutup: 120 ms, kebalikan dari buka.
- Resize drawer: 300 ms, ease out cubic.
- Penempatan: dijepit 12 px dari tepi monitor. Arrow menunjuk anchor panel dan
  tetap di dalam margin 20 px.
- Jeda tutup: 320 ms setelah pointer meninggalkan kartu atau affordance-nya.
- Escape menutup drawer yang terbuka dulu, lalu kartu.
- Klik di luar menutup kartu.
- Kartu tidak boleh menghalangi desktop di luar batasnya sendiri.

Jangan menambah panel kedua, toolbar melayang, atau halaman statistik di dalam
kartu. Drawer adalah satu-satunya perluasan.

### 5.3 Head kartu

- Cover: 64 x 64, radius 14, render 2x untuk HiDPI yang tajam.
- Placeholder: aksen 28% alpha saat art tidak ada. Jangan pernah menampilkan
  gambar rusak atau glyph album generik.
- Judul: 14 px, 700, satu baris, ellipsized.
- Artis dan album: 11 px, teks sekunder, digabung dengan ` · `, satu baris,
  ellipsized.
- Kontrol: previous, play, next, repeat, jarak 6 px.
- Play adalah satu-satunya kontrol terisi: lingkaran putih 28 px, glyph gelap
  16 px.
- Previous dan next adalah tombol transparan 24 px, ikon 15 px.
- Repeat 24 px, ikon 15 px. Off redup, on putih. State `off`, `all`, dan `one`
  dengan accessible name yang sesuai.
- Double-click cover membuka Spotify. Aksi tersembunyi ini butuh tooltip atau
  accessible name saat komponen disentuh berikutnya.

State paused meredupkan cover dan teks, tetapi glyph play berubah supaya state
tidak hanya disampaikan lewat warna.

### 5.4 Progress dan waktu

- Label waktu: 9.5 px, tabular, slot 30 px, teks sekunder atau tersier.
- Progress bar: track dan fill 3 px, radius 2, area klik setinggi 14 px.
- Knob: lingkaran putih 9 px, satu shadow kecil.
- Lebar bar mengecualikan dua label waktu dan jarak 16 px. Bar tidak boleh
  melebihi lebar konten kartu.
- Drag menampilkan preview waktu baru dan commit saat release. Release di luar
  bar tetap harus mengakhiri drag dengan bersih.
- Format `m:ss`. Jangan menampilkan persentase.

### 5.5 Footer

- Satu hairline atas, margin 10 px, padding 9 px, jarak 6 px.
- Kiri: ikon audio aksen dan `This week 3h 12m · top Artist`.
- Kanan: api dan streak berjalan, lalu `best Nd`, dipisah hairline vertikal.
- Streak berjalan dan terbaik disembunyikan saat nol. Total minggu tetap
  terlihat.
- Nama artis panjang di-ellipsize. Nilai bold, label tidak.
- Footer adalah bukti mendengarkan, bukan call to action. Jangan menambah panah
  "View stats" atau chevron dekoratif.

### 5.6 Drawer lirik

- Membuka ke kanan. Lebar 300, jarak seam 16 px, divider 1 px.
- Menampilkan jendela lima baris di sekitar baris aktif.
- Baris aktif: 15 px, 700, putih kertas.
- Baris dekat: 12 px, teks sekunder.
- Baris lampau dan mendatang: 12 px, teks tersier atau lebih rendah, tetapi
  tidak boleh di bawah batas kontras.
- Baris panjang wrap. Saat blok terlalu tinggi, buang baris terjauh dari baris
  aktif daripada memotongnya.
- Empty state: `No lyrics for this track`. State ini menyebut sebabnya tanpa
  berpura-pura ada lirik.
- Loading dan error butuh copy berbeda saat state itu diimplementasikan. Jangan
  menampilkan "No lyrics" saat request masih berjalan.
- Lirik tidak bisa diklik di ekstensi yang dikirim. Jangan menambah affordance
  seek ke lirik sampai perilakunya benar-benar ada.

### 5.7 Drawer statistik

- Membuka ke bawah. Minimal 160, maksimal ruang monitor yang tersedia. Nilai
  360 hanya fallback saat monitor tidak diketahui.
- Header: `STATISTICS` di kiri, `THIS WEEK` di kanan.
- Total minggu: 20 px, 700.
- Tujuh bar, tinggi 34 px: hari ini putih, hari dengan listening 13% putih, hari
  kosong stub 2 px 5% putih.
- Label hari: `Mon` sampai `Sun`, 8.5 px, hari ini bold dan lebih terang.
- Dua kolom, lima artis teratas dan lima lagu teratas. Artis diurutkan berdasarkan
  waktu, lagu berdasarkan plays lalu waktu.
- Baris: peringkat, nama ellipsized, nilai. Nilai lagu memakai `3×`.
- Footer: `N of 7 days active`.
- Drawer scroll saat monitor tidak cukup menampung tinggi natural.
- Empty state: pertahankan `0m` dan bar kosong, lalu tampilkan `No listening this
  week` di area daftar. Dua kolom kosong bukan state.
- Chart menjawab satu pertanyaan: hari apa saya mendengarkan minggu ini. Jangan
  menambah chart dekoratif, delta palsu, atau klaim tren.

### 5.8 Preferences

Preferences adalah jendela libadwaita native, bukan surface Shell. Ia mengikuti
tema terang atau gelap sistem dan memakai token aksen sistem.

- Ukuran default: 720 x 820.
- Hero: satu surface gradient aksen, eyebrow `SONORA`, brand line, dan penjelasan
  singkat berbahasa Indonesia. Gradient memisahkan brand dari pengaturan dan tidak
  boleh diulang di setiap grup.
- Preview hero adalah preview panel dan kartu yang representatif, bukan screenshot
  pixel-perfect. Ia diperbarui saat mode latar atau preset berubah. Preview
  memakai track demo tetap, jadi beri label `Pratinjau` agar tidak terbaca sebagai
  playback saat ini.
- Urutan section: `Tampilan`, `Perilaku`, `Mikrofon`, `Tentang`.
- Pakai `Adw.ComboRow`, `Adw.SpinRow`, `Adw.SwitchRow`, dan `Adw.ActionRow`
  dengan ikon prefix simbolik.
- Pemilih preset memakai flow toggle swatch empat kolom. Swatch terpilih memakai
  aksen sistem, bukan aksen album.
- Nonaktifkan pemilih preset saat mode album aktif. Nonaktifkan duck level saat
  mode duck bukan `duck`.
- Setiap pengaturan harus langsung berlaku dan tersimpan. Tidak ada tombol Apply.
- Tidak ada row mati, toggle placeholder, atau link ke halaman yang tidak ada.
- Warna teks berasal dari token libadwaita. Jangan hardcode palet ink Shell ke
  Preferences, kecuali di area preview yang memang meniru kartu Shell.

## 6. State

Setiap surface yang bisa menampilkan data butuh state di bawah ini. Tabel ini
adalah target state, bukan status implementasi. Jika state belum
diimplementasikan, katakan di perubahan. Jangan menyiratkan state itu ada.

| State | Panel | Kartu | Drawer | Preferences |
|---|---|---|---|---|
| Tidak ada lagu | `Nothing playing`, tanpa slot | Judul kosong, tanpa artis, timer nol, kontrol nonaktif | Lirik kosong, statistik lokal tetap | Tidak berubah |
| Paused | Judul dan cover redup, chip state tetap terbaca | Cover dan teks redup, glyph play berubah | Tidak berubah | Tidak berubah |
| Art loading | Placeholder aksen | Placeholder aksen, tanpa gambar rusak | Tidak terpengaruh | Preview memakai preset |
| Art hilang | Placeholder aksen | Placeholder aksen | Tidak terpengaruh | Preview memakai preset |
| Lirik loading | Tidak terpengaruh | Drawer terbuka menampilkan copy loading | Tanpa baris palsu | Tidak berubah |
| Lirik kosong | Tidak terpengaruh | Drawer terbuka menampilkan sebab | Tanpa baris palsu | Tidak berubah |
| Lirik error | Tidak terpengaruh | Drawer terbuka menampilkan kegagalan | Tanpa baris palsu | Tidak berubah |
| Statistik kosong | Tidak terpengaruh | `This week 0m` | `No listening this week` | Tidak berubah |
| Panel sempit | Menyusut ke batas 170 | Kartu dijepit ke layar | Statistik scroll | Jendela reflow |
| Latar solid | Latar dan aksen preset | Tanpa tint | Aksen dari preset | Preview diperbarui |
| Latar album | Tint dan aksen album | Tint dan aksen dari art | Aksen dari art | Preview diperbarui |

Aturan:

- Jangan menampilkan kontrol pemutaran sebagai aktif saat tidak ada lagu.
  Nonaktifkan atau sembunyikan. Kontrol yang tidak bisa berbuat apa-apa adalah
  cacat.
- Jangan memakai baris lirik palsu, nama lagu palsu, atau angka listening palsu
  untuk mengisi state.
- Empty state menyebut sebab dan, jika mungkin, langkah berikutnya. "No data"
  bukan empty state.

## 7. Interaksi

- Seluruh tombol panel membuka kartu sesuai mode buka pengguna: hover, click,
  atau both.
- Buka lewat hover menunggu jeda yang dikonfigurasi. Default 400 ms.
- Berpindah dari panel ke kartu tidak boleh menutup kartu. Berpindah dari kartu
  ke tab drawer juga tidak boleh menutupnya.
- Tab drawer berada di luar tepi kartu dan tetap termasuk area hover.
- Klik tab menyalakan atau mematikan drawer dan membalik arah ikon. State aktif
  adalah perubahan warna dan arah, bukan badge baru.
- Klik di luar menutup kartu. Escape menutup drawer dulu, lalu kartu.
- Progress bar melakukan seek saat press dan drag. Drag berakhir saat release,
  bahkan jika pointer keluar dari bar.
- Double-click cover membuka Spotify.
- Jangan menambah aksi hover saja tanpa padanan keyboard atau accessible.

### Keyboard dan fokus

Kartu Shell bukan jendela aplikasi biasa, tetapi tetap berisi kontrol. Setiap
kontrol yang bisa menerima fokus butuh focus ring yang terlihat, tidak dihapus,
dan urutan tab yang logis. Escape harus menutup drawer dulu, lalu kartu, seperti
perilaku sekarang.

Implementasi saat ini belum menyediakan jalur keyboard lengkap untuk kartu.
Anggap itu utang yang diketahui, bukan pola yang disetujui. Jangan mengklaim
dukungan keyboard penuh sampai fokus, aktivasi, dan visibilitas fokus
diimplementasikan dan diuji.

### Area klik

| Kontrol | Target |
|---|---|
| Tombol panel | Seluruh ikon atau pill |
| Kontrol kartu | 24 sampai 28 px |
| Play | Lingkaran 28 px |
| Progress | Tinggi 14 px, selebar konten kartu |
| Tab lirik | 18 x 56 |
| Tab statistik | 56 x 18 |

Target pointer desktop boleh lebih kecil dari target sentuh, tetapi tidak boleh
menyusut di bawah nilai di atas. Dimensi panjang setiap tab drawer adalah bagian
yang memaafkan dari targetnya.

## 8. Motion

Motion adalah umpan balik, bukan kepribadian.

| Perubahan | Durasi | Easing | Tujuan |
|---|---|---|---|
| Kartu buka | 180 ms | ease out quad | Menghubungkan kartu ke anchor panel |
| Kartu tutup | 120 ms | ease out quad | Cepat pergi, tanpa overlay yang tertinggal |
| Resize drawer | 300 ms | ease out cubic | Menjaga kontinuitas ruang |
| Perubahan makna slot | 120 ms keluar, 120 ms masuk | ease out, ease in | Menandakan status berubah |

Aturan:

- Tidak ada loop tanpa akhir, dot berdenyut, elemen melayang, parallax, atau
  bounce.
- Jangan menganimasikan setiap tick countdown. Cross-fade hanya saat slot berubah
  makna.
- Saat shell mengurangi animasi, pakai durasi nol. UI harus tetap berfungsi.
- Jangan mengklaim dukungan "reduced motion" sampai pengaturan animasi dicek di
  kode dan diverifikasi.

## 9. Copy

### Kontrak bahasa

- Copy surface Shell dan Preferences berbahasa Inggris ringkas sebagai bahasa
  dasar (base language): `Nothing playing`, `This week`, `Appearance`, `Behavior`,
  `About`, dibungkus dengan gettext (`_()`) untuk translasi multi-bahasa.
- Brand line: `The music companion for GNOME.`
- Nama preset seperti `Midnight` dan `Graphite` adalah nama tema, bukan kalimat
  UI, jadi tetap bahasa Inggris.

### Voice

Tenang, faktual, spesifik. Tanpa tanda seru, emoji, hype, atau metafora yang
tidak membantu pengguna bertindak. Tanpa "seamless", "powerful", "next
generation", atau "AI powered".

### Format

- Waktu: `m:ss`.
- Total minggu: `0m`, `47m`, `3h`, `3h 12m`.
- Jumlah play lagu: `3×`.
- Streak: `4d`, `best 12d`.
- Pemisah: middle dot `·`.
- Lirik kosong: `No lyrics for this track`.
- Statistik kosong: `No listening this week`.
- Rentang tanggal: Senin sampai Minggu, satu minggu kalender.

Jangan memakai karakter tanda pisah panjang di copy UI. Pakai koma, titik, titik
dua, atau tanda kurung. Ini juga berlaku untuk tooltip dan teks bantuan.

## 10. Aksesibilitas dan ketahanan

- Kontras teks: 4.5:1 untuk teks normal dan 3:1 untuk teks besar, diukur pada
  surface yang dirender, termasuk tint album.
- Jangan memakai warna saja untuk state. Paused mengubah glyph play. State aktif
  drawer mengubah arah dan warna. Duck dan sleep punya ikon serta label.
- Setiap kontrol ikon saja butuh accessible name: play, pause, previous, next,
  repeat, tab lirik, tab statistik, dan double-click cover.
- Setiap elemen yang bisa diaksi harus punya perilaku hover, active, dan disabled.
- Urutan Escape: drawer, lalu kartu.
- Uji di skala 1x dan 2x, dengan judul lagu panjang, nama artis panjang, tanpa
  art, tanpa lirik, statistik nol, dan panel sempit.
- Uji latar album dan solid. Uji Preferences di tema terang dan gelap.
- Kartu tidak boleh meluber dari monitor. Drawer statistik harus scroll, bukan
  clip.
- README sudah tidak mengklaim seek keyboard atau klik untuk membatalkan sleep.
  Jangan menambah klaim aksesibilitas lain sampai jalur fokus dan nama screen
  reader lengkap.

## 11. Batasan teknis

- UI Shell memakai `St` dan `Clutter`, bukan HTML atau CSS web. `stylesheet.css`
  mendukung subset CSS.
- Tanpa web font. Tanpa icon font eksternal. Pakai ikon simbolik dan SVG lokal.
- Tanpa blur atau backdrop filter. Jangan memalsukan kaca dengan lapisan
  transparan bertumpuk.
- St menerima satu box shadow per node. Jangan merencanakan elevasi multi-shadow.
- Animasi memakai Clutter easing, bukan CSS transition.
- Gambar Cairo lewat `St.DrawingArea` dan harus memakai `surfaceScale` untuk
  HiDPI.
- Preferences memakai GTK4 dan libadwaita. Jangan memakai ulang CSS Shell di
  sana.
- Statistik bersifat lokal. Jangan mengirim data listening ke mana pun.
- Album art dan lirik adalah satu-satunya bacaan jaringan. Tangani kegagalan tanpa
  merusak layout.
- Jangan mengimplementasikan perubahan UI dengan menambal source atau CSS lewat
  script eksternal. Edit file sumber tempat perilaku itu seharusnya berada.

## 12. Log keputusan

Setiap pilihan visual utama punya alasan satu baris. Pilihan baru butuh baris
baru.

| Keputusan | Alasan |
|---|---|
| Surface Shell gelap | Hidup di panel GNOME di atas wallpaper sembarang dan harus menyatu dengan chrome shell |
| Preferences mengikuti tema sistem | Jendela pengaturan milik desktop, bukan overlay Shell |
| Warna album sebagai tint, bukan latar penuh | Menghubungkan kartu ke art tanpa mengubah setiap surface menjadi wash warna |
| Satu kartu matte | Chrome ringkas lebih cepat dibaca daripada dashboard panel |
| Tanpa blur | Blur meratakan hierarki dan tidak dibutuhkan di surface ringkas |
| Radius bervariasi | Membedakan chip, kontrol, artwork, dan kartu tanpa label |
| Satu shadow kartu | Hanya kartu melayang yang butuh elevasi, pill sudah duduk di panel |
| Header statistik uppercase | Label wayfinding mikro di drawer padat, dipakai hemat |
| Tombol play putih | Play adalah satu-satunya aksi utama di kartu |
| Glow api dan aksen saja | Menandai streak dan identitas listening, bukan setiap surface |
| Tanpa panah dekoratif | Panah hanya muncul saat menunjukkan arah drawer |
| Tanpa statistik atau testimoni palsu | Produk memakai data listening lokal dan tidak punya social proof untuk dikarang |
| Motion maksimal 300 ms | Perubahan state harus terasa langsung, bukan sinematik |
| Tanpa layout mobile | Produk adalah ekstensi desktop shell, jadi panel sempit dan HiDPI adalah batasan nyata |

## 13. Peta implementasi

| Area | File |
|---|---|
| Indikator panel, pill, slot, penempatan | `src/ui/indicator.js` |
| Geometri kartu, drawer, buka dan tutup | `src/ui/card/index.js` |
| Cover, judul, playback, repeat | `src/ui/card/head.js` |
| Progress dan seek | `src/ui/card/timer.js` |
| Footer mingguan dan streak | `src/ui/card/footer.js` |
| Lirik | `src/ui/card/lyrics-panel.js` |
| Drawer statistik | `src/ui/card/stats-panel.js` |
| Style Shell dan kartu | `stylesheet.css` |
| Preferences | `prefs.js` |
| Preset dan konversi warna | `src/util/palette.js` |
| Ekstraksi aksen album | `src/util/color.js` |
| Art rounded dan image HiDPI | `src/util/art.js` |
| Tint, arrow, clip | `src/ui/paint.js` |
| Ikon | `icons/` |

## 14. Sebelum mengirim perubahan UI

- [ ] Perubahan punya alasan satu baris di log keputusan atau catatan perubahan.
- [ ] Tidak ada warna baru di luar token. Satu aksen aktif.
- [ ] Setiap teknik baru lolos purpose test: tint, shadow, uppercase, radius,
      ikon, motion.
- [ ] Teks mencapai 4.5:1 pada surface yang dirender, termasuk tint.
- [ ] Empty, loading, error, paused, art hilang, lirik kosong, dan statistik nol
      ditangani atau ditandai jelas sebagai belum diimplementasikan.
- [ ] Setiap kontrol yang terlihat punya aksi nyata. Tanpa tombol mati.
- [ ] Kontrol ikon saja punya accessible name.
- [ ] Kartu tidak meluber di 1x atau 2x. Panel berfungsi di 170 px.
- [ ] Mode album dan solid berfungsi. Preferences berfungsi di terang dan gelap.
- [ ] Motion tetap di bawah 300 ms, tanpa loop, dan punya jalur reduced motion.
- [ ] Tanpa karakter tanda pisah panjang, emoji, angka palsu, atau testimoni
      palsu.
- [ ] Tanpa blur, kartu bersarang, dot status dekoratif, atau shadow tambahan.
- [ ] `make lint`, `make test`, dan `make security` lolos.
- [ ] Fake player headless dipakai untuk perubahan perilaku saat memungkinkan.
- [ ] Panduan ini dan kode sepakat, atau perbedaannya dicatat sebagai utang.

## 15. Utang yang diketahui

Ini bukan pola yang disetujui. Ini adalah utang saat ini yang diharapkan ditutup
oleh pekerjaan berikutnya.

- Kartu belum menyediakan jalur fokus dan aktivasi keyboard yang lengkap.
- Saat tidak ada lagu, tombol playback masih terlihat dan belum dinonaktifkan
  atau disembunyikan.
- Preview Preferences memakai track demo tanpa label `Pratinjau`.
- Lirik belum punya state loading dan error yang terpisah.
- Daftar statistik belum punya pesan empty eksplisit saat minggu ini tidak punya
  listening.
- Beberapa alpha teks di `stylesheet.css` berada di bawah batas kontras,
  terutama label lirik, waktu, dan meta pada 30% sampai 40%.
- Beberapa kontrol ikon saja, termasuk play, previous, next, dan tab drawer,
  belum punya accessible name eksplisit.
- Accessible name slot sleep menyebut bisa dibatalkan dengan klik, tetapi slot
  bukan aksi terpisah.
- Aksi double-click cover belum punya petunjuk visual atau aksesibel.
- Perilaku reduced motion belum dicek di kode.
- Angka tabular baru diterapkan di slot pill. Waktu kartu dan total statistik
  belum memakai `tnum`.
- Copy Preferences saat ini mengandung tanda pisah panjang di subtitle hero dan
  tooltip preset. Ganti saat menyentuh string tersebut.
- Baris `Tentang` mencampur brand line Inggris dengan kalimat Indonesia dalam
  satu subtitle. Pisahkan atau samakan bahasanya saat menyentuh baris itu.
