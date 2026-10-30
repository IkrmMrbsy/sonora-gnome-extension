# Ide & Pembeda

Dokumen ini berisi arah produk dan kumpulan ide. Untuk rencana eksekusi (urutan, detail teknis, verifikasi), lihat `ROADMAP.md`.

## Posisi produk

Ekstensi ini bukan pemutar musik. Kontrol pemutaran ada, tapi itu bukan alasan orang memasangnya. Yang membuatnya berbeda adalah **pencatatan kebiasaan mendengarkan**: berapa lama, kapan, artis siapa, berapa hari berturut-turut.

Satu kalimat yang menggambarkan arahnya: *player memberi tahu apa yang sedang diputar; pendamping memberi tahu bagaimana kamu mendengarkan.*

## Kenapa arahnya bukan "player yang lebih lengkap"

Pembanding terdekat di ekosistem GNOME membangun *player*. Perbandingan yang sudah diperiksa langsung dari kodenya:

| | Ekstensi pembanding | Ekstensi ini |
|---|---|---|
| Ukuran kode | ~13.500 baris | ~2.750 baris |
| Visualizer / waveform | ada | tidak ada |
| Vinyl berputar | ada | tidak ada |
| Karaoke word-level | ada | tidak ada (per baris) |
| Blur asli | ada | tidak ada (gradient) |
| Scroll wheel = volume/lagu | ada | tidak ada |
| Multi-player + pemilih | ada | tidak ada |
| Integrasi dock | ada | tidak ada |
| **Statistik mendengarkan** | **tidak ada** | ada |
| **Streak + streak terpanjang** | **tidak ada** | ada |
| **Duck mikrofon** | **tidak ada** | ada |
| **Top artis di UI** | **tidak ada** | ada |

Angka nol di kolom kanan bukan tafsiran — itu hasil pencarian di seluruh kode mereka.

Kesimpulan yang jujur: **sebagai player, mereka jauh lebih lengkap.** Menyaingi itu berarti berlomba pada lapangan yang sudah matang, dengan biaya ribuan baris, dan hasilnya akan selalu terlihat seperti versi lebih sederhana dari mereka.

Yang mirip di antara keduanya adalah **lapisan permukaan**, bukan produk: pill di panel, kartu saat hover, lirik tersinkron, progress bar, tint warna album. Itu pola kategori, bukan pembeda. Setiap widget now-playing memakainya, sama seperti setiap aplikasi musik punya tombol play.

## Ide pembeda

Semua ide di bawah bertumpu pada satu hal: mereka membangun player, kita membangun pendamping. Jadi ambil wilayah yang mereka kosongkan.

### 1. Statistik yang benar-benar akurat

Fondasi semua fitur lain. Sekarang hitungan putaran salah ke dua arah (detail di `ROADMAP.md`). Kalau diperbaiki, ada klaim yang bisa dipertanggungjawabkan: hitungan mengikuti definisi yang sama dengan Spotify. Tidak ada ekstensi lain yang bisa mengklaim itu, karena mereka tidak menghitung sama sekali.

Nilai: tinggi. Biaya: sedang. Ini prasyarat, bukan pelengkap.

### 2. Halaman statistik lengkap

Wilayah kosong terbesar. Data yang sudah tersimpan (`days`, `artists`, `tracks`) belum pernah tampil lebih dari satu baris footer. Yang bisa dibuka:

- **Listening clock** — jam berapa paling banyak mendengar
- **Top 5 artis & lagu** per periode
- **Tren 7 / 30 hari** — naik atau turun dibanding periode sebelumnya
- **Ringkasan** hari ini, minggu ini, total

Nilai: tinggi. Biaya: sedang-tinggi (perlu jendela sendiri). Ini yang membuat orang membuka ekstensi walau musik sedang tidak main.

### 3. Recap mingguan

Setiap Senin pagi, sekali: "Minggu lalu 12 jam 4 menit, top The Weeknd, streak 5 hari." Datanya sudah ada, tinggal disajikan. Pola yang terbukti membuat orang kembali.

Nilai: sedang-tinggi. Biaya: rendah.

### 4. Kesadaran sesi

"Kamu sudah mendengarkan 3 jam tanpa jeda." Bukan fitur player, tapi fitur pendamping. Muncul halus di footer setelah melewati ambang, tanpa notifikasi, tanpa suara.

Nilai: sedang, tapi **paling membedakan secara posisi** — tidak ada player yang memberi tahu hal seperti ini.

### 5. Ducking yang sadar screen share

Sekarang musik hanya dikecilkan saat mikrofon aktif. Rapat daring sering memakai screen share tanpa mikrofon menyala. Perluas deteksinya ke indikator screen share GNOME.

Nilai: tinggi untuk pengguna kerja. Biaya: rendah-sedang.

### 6. Ekspor data

CSV/JSON berisi riwayat harian. Untuk pengguna Last.fm / ListenBrainz yang melacak sendiri. Nol kompetitor menyediakan ini. Segmennya kecil, tapi loyalitasnya tinggi.

Nilai: sedang. Biaya: rendah.

### 7. Insight berbasis pola

Lapisan di atas statistik: kalimat pendek yang tidak bisa disimpulkan sekali lihat.

- "Artis paling sering kamu dengar bulan ini tapi belum pernah masuk top 5 mingguan."
- "Kamu mendengar 40% lebih banyak di malam hari dibanding pagi."
- "Lagu ini pertama kali kamu putar 2 tahun lalu."

Butuh data yang cukup panjang sebelum berguna, dan rawan terasa mengarang kalau datanya tipis. Simpan untuk nanti.

## Yang sengaja tidak dikejar

| Fitur | Alasan |
|---|---|
| Visualizer / waveform | MPRIS tidak menyediakan spektrum; yang ada hanya animasi simulasi. Biaya CPU terus-menerus di shell. |
| Karaoke word-level | Sumber lirik hanya menyediakan level baris. Butuh sumber dan parser baru. |
| Vinyl berputar | Dekorasi murni. |
| Multi-player | Mengubah arsitektur: `mpris.js` terikat ke satu bus name. |
| Integrasi dock | Bergantung pada ekstensi pihak ketiga yang bisa berubah sewaktu-waktu. |
| Blur latar | GNOME Shell tidak menyediakan `backdrop-filter`; menirunya berarti render ulang tiap frame. |
| Tema terang / kustom warna | Menambah permukaan konfigurasi besar untuk manfaat kecil. Aksen sudah mengikuti album. |

## Cara menilai ide baru

Empat pertanyaan sebelum sebuah ide dikerjakan:

1. **Apakah ini fitur player atau pendamping?** Kalau player, kemungkinan besar sudah dimenangkan orang lain.
2. **Apakah datanya sudah kita punya?** Ide yang memakai data yang sudah ada jauh lebih murah.
3. **Apakah ini terlihat tanpa harus dicari?** Fitur yang butuh dijelaskan lewat dokumentasi biasanya tidak terpakai.
4. **Apakah ini menambah permukaan konfigurasi?** Setiap setting baru adalah biaya perawatan dan beban pilihan bagi pengguna.

Satu ide yang lolos keempatnya lebih berharga daripada lima ide yang hanya lolos satu.
