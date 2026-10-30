# Rencana Pengembangan

Dokumen kerja untuk fitur lanjutan. Bukan spesifikasi final — urutan dan cakupannya masih terbuka.

Lihat `IDEAS.md` untuk arah produk, katalog ide, dan daftar fitur yang sengaja tidak dikejar.
Dokumen ini hanya berisi rencana eksekusi.

---

## 1. Akurasi hitungan putaran

**Prioritas: tertinggi — fondasi semua fitur statistik**

### Kondisi sekarang

Hitungan "berapa kali lagu diputar" tidak bisa dipercaya. Sudah dibuktikan lewat simulasi yang meniru `_accumulate()` persis:

| Skenario | Seharusnya | Hasil sekarang |
|---|---|---|
| Satu lagu 60 detik | 1 | 1 ✓ |
| Lagu sama diputar ulang 2×60 detik | 2 | **1** |
| Pause lalu lanjut, 40+40 detik lagu sama | 1 | **2** |
| Lagu 20 detik diputar 10 kali | 10 | **0** |
| Timer sinkronisasi tertunda (celah 5 detik) | 60 detik | **22 detik** |

Penyebabnya ada empat, semuanya di `extension.js`:

1. `_listen.counted` hanya di-reset saat judul berubah, jadi putar ulang tidak dihitung.
2. `_listen` dikosongkan setiap kali status bukan *Playing*, jadi jeda-lanjut membuat sesi baru.
3. Ambang tetap 30 detik, jadi lagu lebih pendek dari itu tidak pernah terhitung.
4. `delta` dibatasi maksimal 2 detik per tick, jadi waktu hilang saat shell sibuk.

### Rencana

- Identitas putaran memakai **posisi lagu**, bukan durasi akumulasi. Putaran dihitung ketika posisi melewati titik tertentu, sehingga putar ulang dan seek mundur tertangani.
- Ambang menyesuaikan durasi: `min(30, duration × 0.5)`.
- Reset penanda saat posisi mundur tajam (seek ke awal) atau track id berubah.
- `delta` tidak lagi dipotong 2 detik; pakai `min(current, last)` dari posisi MPRIS bila tersedia, dan tandai data yang hilang alih-alih menyembunyikannya.
- Migrasi: `version` naik, penghitung lama dibiarkan apa adanya (tidak dihitung ulang), mulai akurat dari titik migrasi.

**Verifikasi:** perluas simulasi menjadi test permanen, minimal 8 skenario termasuk lagu pendek, putar ulang, seek mundur, jeda-lanjut, dan celah timer.

---

## 2. Recap mingguan

**Prioritas: tinggi — biaya rendah, kesan besar**

### Gagasan

Setiap Senin pagi, sekali, tampilkan ringkasan minggu lalu: total waktu, jumlah putaran, artis teratas, dan streak. Datanya sudah tersimpan, tinggal penyajian.

### Rencana

- Fungsi `lastWeekRecap()` pernah ada dan dihapus; hidupkan kembali (perhitungannya sederhana dan sudah teruji).
- Tampil sebagai kartu sementara di bawah indikator, atau satu notifikasi GNOME.
- Disimpan penanda "recap terakhir ditampilkan" agar tidak muncul berulang.
- Bisa dimatikan dari preferensi.

**Risiko:** butuh pengguna aktif minimal dua minggu sebelum ada isinya. Untuk pengguna baru, lewati saja tanpa pesan.

---

## 3. Penyimpanan statistik & halaman statistik

**Prioritas: tinggi — sekaligus menutup kebocoran pertumbuhan file**

### Keputusan cakupan

Tampilan statistik dibatasi **mingguan saja** (minggu kalender Senin–Minggu). Tidak ada pilihan bulanan, tidak ada jendela 2 minggu, tidak ada tab periode, tidak ada perbandingan minggu lalu. Satu cakupan, satu makna.

Tapi **penyimpanan tidak boleh dibatasi mingguan**, karena `best streak` di footer kartu dihitung dari seluruh riwayat detik harian. Kalau semua data dipangkas ke 7 hari, angka `best 12d` mustahil dihitung.

Jadi: tampilan mingguan, penyimpanan dua tingkat.

### Aturan simpan

| Data | Umur simpan | Ukuran | Alasan |
|---|---|---|---|
| `days[].seconds` | **selamanya** | 35 B/hari | `best streak` butuh seluruh riwayat |
| `days[].plays` | **selamanya** | 13 B/hari | top lagu butuh jumlah putar |
| `days[].artists` | **10 hari** | ~1,2 KB/hari | top 5 artis minggu ini |
| `days[].tracks` | **10 hari** | ~0,8 KB/hari | top 5 lagu minggu ini |
| `stats.artists` (atas) | **dibuang** | — | tidak ada kode yang membacanya |
| `stats.tracks` (atas) | **dibuang** | — | tidak ada kode yang membacanya |
| `total` | **selamanya** | 10 B | total sepanjang waktu |

### Kenapa 10 hari, bukan 7

Minggu berjalan butuh sampai 7 hari. Kalau jendela detail persis 7 hari, pruning yang jalan hari Senin bisa menghapus hari dari minggu berjalan — dan top artis jadi salah tanpa memunculkan error. 10 hari memberi margin 3 hari dengan biaya hanya ~6 KB.

### Proyeksi ukuran

| Umur pakai | Agregat | Detail 10 hari | Total |
|---|---|---|---|
| 1 tahun | 17 KB | 20 KB | **37 KB** |
| 2 tahun | 34 KB | 20 KB | **54 KB** |
| 5 tahun | 86 KB | 20 KB | **105 KB** |
| 10 tahun | 171 KB | 20 KB | **191 KB** |
| 20 tahun | 342 KB | 20 KB | **362 KB** |

Setelah hari ke-10, file hanya bertambah **48 byte/hari**.

### Frekuensi simpan

Sekarang file ditulis ulang penuh setiap 30 detik selama musik menyala (120×/jam). Itu beban disk yang jauh lebih besar daripada ukuran filenya: setelah beberapa tahun, 2–3 MB × 120 kali = ratusan MB per jam pemakaian.

| | Sekarang | Target |
|---|---|---|
| Interval | 30 detik | **5 menit** |
| Tulis per jam | 120 | **12** |
| Beban disk 1 jam | ~2,6 MB | **~0,44 MB** |
| Risiko kehilangan saat crash | ≤30 detik | ≤5 menit |

**Kenapa performa bukan alasan membatasi tampilan:** memangkas jendela tampilan hanya menghemat ~13 KB. Yang benar-benar menghemat adalah mengurangi frekuensi tulis dan membuang dua map yang tidak terpakai.

### Pemangkasan

Dijalankan **sekali sehari** saat tanggal berganti, bukan di jalur panas. Untuk setiap hari yang lebih tua dari 10 hari: hapus `artists` dan `tracks`, sisakan `seconds` dan `plays`. Biaya beberapa milidetik.

`version` naik ke 3 untuk migrasi. Data lama tidak bisa dipulihkan detailnya — hanya agregat harian yang bertahan.

### Isi halaman statistik

| Blok | Data | Status |
|---|---|---|
| Total minggu ini | jumlah 7 hari | **selesai** (`currentWeek`) |
| 7 batang hari Sen–Min | detik per hari, posisi tetap | **selesai** |
| Top 5 artis + menit | `days[].artists` dijumlahkan | **selesai** (`weekArtists`) |
| Top 5 lagu + jumlah putar | `days[].tracks` dijumlahkan | **selesai** (`weekTracks`) |
| Hari aktif `4 dari 7` | detik per hari | **selesai** |

Tidak ditampilkan: delta vs minggu lalu, listening clock, periode sepanjang waktu, streak (sudah ada di footer kartu).

Catatan implementasi: `days[].tracks` kini menyimpan `{seconds, plays}` (bukan angka), sehingga jumlah putar per minggu bisa dihitung. Ini menaikkan `version` ke 3; berkas lama dimigrasikan otomatis saat dibaca.

### Yang hilang permanen

- Top artis / top lagu sepanjang waktu — hanya bisa untuk minggu ini
- Riwayat rincian di luar 10 hari

### Urutan kerja

1. **Buang `stats.artists` + `stats.tracks` level atas** — memotong 59% file saat ini, nol risiko, tidak mengubah skema
2. **Simpan tiap 5 menit** — memotong 90% beban disk, tidak mengubah skema
3. **Prune detail ke 10 hari** — menaikkan `version` ke 3, perlu migrasi

Langkah 1 dan 2 tidak menyentuh struktur data, jadi aman dikerjakan lebih dulu.

---

## 4. Kesadaran sesi

**Prioritas: sedang — paling khas "pendamping"**

### Gagasan

"Kamu sudah mendengarkan 3 jam tanpa jeda." Bukan fitur pemutar, tapi fitur pendamping. Muncul halus, tidak memaksa, dan bisa diabaikan.

### Rencana

- Hitung durasi sesi berjalan (reset saat jeda lebih dari N menit).
- Tampil di footer kartu hanya setelah melewati ambang, misalnya 2 jam.
- Tidak ada notifikasi, tidak ada suara. Hanya satu baris.

**Risiko:** mudah terasa mengganggu kalau terlalu sering. Perlu ambang yang tinggi dan tidak berulang dalam satu sesi.

---

## 5. Ducking yang sadar screen share

**Prioritas: sedang-tinggi untuk pengguna kerja**

### Gagasan

Sekarang musik hanya dikecilkan saat mikrofon aktif. Rapat daring sering memakai screen share tanpa mikrofon menyala, dan musik tetap mengganggu rekaman.

### Rencana

- Deteksi indikator screen share GNOME Shell (indikatornya sudah ada di panel).
- Perlakukan sama seperti mikrofon: kecilkan sementara, pulihkan setelah selesai.
- Preferensi terpisah, karena tidak semua orang mau musiknya turun saat merekam layar.

**Risiko:** indikator screen share adalah API internal GNOME dan bisa berubah antar versi. Perlu penjagaan agar fitur mati diam-diam kalau API tidak ada, tanpa mengganggu fitur lain.

---

## 6. Ekspor data

**Prioritas: rendah — segmen kecil, loyalitas tinggi**

- Ekspor riwayat harian ke CSV atau JSON.
- Berguna untuk pengguna Last.fm / ListenBrainz yang memang melacak sendiri.
- Nol kompetitor menyediakan ini.
- Cukup satu tombol di halaman statistik atau preferensi.

---

## Urutan kerja yang diusulkan

1. **Akurasi putaran** — fondasi; juga menutup bug yang sudah terbukti
2. **Penyimpanan: buang map tak terpakai + simpan tiap 5 menit** — murah, tidak mengubah skema
3. **Prune detail ke 10 hari** — menaikkan `version`, perlu migrasi
4. **Halaman statistik** — memakai data yang sudah bersih
5. **Recap mingguan** — cepat, hasil langsung terasa
6. **Duck screen share** — relevan untuk pengguna kerja
7. **Ekspor** — pelengkap

Nomor 1–3 sebaiknya berurutan: statistik yang belum akurat tidak layak ditampilkan, dan halaman statistik sebaiknya dibangun di atas bentuk data yang sudah final agar tidak dikerjakan dua kali.

---

## Catatan teknis yang perlu diingat

- Data disimpan di `~/.local/share/spotify-ext/stats.json`. Saat ini ditulis tiap 30 detik; target 5 menit.
- Model data punya `version` untuk migrasi; perubahan bentuk data wajib menaikkannya.
- Saat ini **belum ada pemangkasan**. File tumbuh selamanya — proyeksi dan rencana pemangkasan ada di poin 3.
- `stats.artists` dan `stats.tracks` di level atas hanya ditulis, tidak pernah dibaca UI — kandidat dibuang.
- `bestStreak()` menghitung ulang dari seluruh riwayat setiap kali kartu diperbarui — murah untuk data sekarang, tapi linier terhadap jumlah hari.
- Lagu dengan artis kosong (iklan) menambah total waktu tanpa atribusi artis. Perlakuan ini disengaja.
