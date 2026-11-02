# Roadmap

Dokumen ini mencatat kondisi fitur dan kandidat pengembangan Sonora. Kandidat
belum menjadi komitmen sampai dipilih untuk dikerjakan. Ide produk yang lebih
luas ada di [`IDEAS.md`](./IDEAS.md).

## Kondisi saat ini

### Statistik dan pemutaran

- Hitungan putar memakai posisi lagu dengan ambang
  `min(30 detik, 50% durasi)`; untuk posisi yang tidak tersedia, penghitung
  waktu memakai selang waktu antar-pembaruan.
- Perubahan track mereset state hitungan. Seek mundur dapat mengaktifkan
  kembali hitungan jika posisi kembali sebelum ambang.
- Statistik mingguan ditampilkan melalui laci di kartu: total minggu ini,
  grafik tujuh hari, lima artis teratas, lima lagu teratas, dan hari aktif.
- Footer kartu menampilkan total minggu ini, artis teratas, streak berjalan,
  dan streak terpanjang.
- Iklan tetap menambah total waktu, tetapi tidak dimasukkan ke atribusi artis
  atau lagu.

### Penyimpanan statistik

- Data disimpan lokal di
  `~/.local/share/spotify-ext/stats.json`.
- Skema statistik saat ini versi 4.
- Total waktu, agregat detik harian, dan jumlah putar harian dipertahankan.
- Detail artis dan lagu pada hari yang lebih lama dari 10 hari dihapus;
  detail tersebut digunakan untuk ringkasan mingguan.
- Penyimpanan berkala berjalan setiap lima menit. Perubahan yang belum berhasil
  disimpan tetap ditandai untuk dicoba kembali.

### Fitur pendamping dan antarmuka

- Statistik dan streak dapat dibuka dari kartu now-playing.
- Lirik disinkronkan dengan posisi lagu, dengan pencarian fallback saat hasil
  pencarian tepat tidak tersedia.
- Ducking atau pause mikrofon dapat diatur dari preferensi. Sleep timer dan
  kontrol playback juga tersedia.
- Album art dan permintaan lirik menggunakan pengendalian state/request agar
  hasil lama tidak menimpa track yang lebih baru.

Rincian penggunaan dan keterbatasan yang terlihat oleh pengguna ada di
[`../README.md`](../README.md).

## Kandidat pengembangan

Belum ada urutan rilis yang ditetapkan. Prioritaskan berdasarkan permintaan
pengguna, kesesuaian dengan positioning, dan biaya pemeliharaan.

### Recap mingguan

Ringkasan minggu sebelumnya yang mudah dilihat dan tidak mengganggu. Sebelum
implementasi, tentukan waktu kemunculan, format penyajian, preferensi pengguna,
dan perilaku untuk pengguna yang belum memiliki cukup data.

### Kesadaran sesi

Tampilkan durasi sesi mendengarkan yang panjang secara opsional dan halus.
Tentukan definisi sesi dan ambang sebelum mengembangkan agar informasinya
konsisten dan tidak terasa menghakimi.

### Insight statistik

Eksplorasi insight yang lebih kaya hanya setelah kebutuhan pengguna jelas.
Retensi detail saat ini 10 hari; tren jangka panjang memerlukan keputusan
eksplisit mengenai jenis data yang disimpan, durasi, dan dampaknya terhadap
privasi serta ukuran berkas.

### Ekspor data

Pertimbangkan ekspor data lokal jika pengguna membutuhkan interoperabilitas
atau salinan cadangan. Tentukan format dan data yang disertakan terlebih dahulu.

### Ducking saat screen sharing

Pertimbangkan jika ada kebutuhan pengguna yang nyata. Ketergantungan pada API
internal GNOME perlu dievaluasi terhadap kompatibilitas antarversi dan perilaku
fallback.

## Batas cakupan statistik saat ini

Laci statistik saat ini berfokus pada minggu kalender berjalan. Tidak ada
komitmen untuk tampilan bulanan, perbandingan periode, atau statistik
sepanjang masa. Penambahan periode baru harus didasari kebutuhan pengguna dan
ditinjau bersama kebijakan retensi data.

## Prinsip prioritas

1. Perbaiki kebenaran data dan keandalan sebelum menambah interpretasi atau
   insight.
2. Utamakan manfaat yang terlihat dan mudah dipahami.
3. Jangan menambah integrasi eksternal atau ketergantungan GNOME yang rapuh
   tanpa alasan pengguna yang kuat.
4. Pertahankan kontrol pengguna atas data lokal dan hindari pengumpulan data
   yang tidak diperlukan.
5. Catat kandidat sebagai ide sampai ruang lingkup dan verifikasinya disepakati.
