# Arah Produk dan Ide

Dokumen ini berisi positioning Sonora dan ide yang masih perlu divalidasi.
Daftar ide bukan janji rilis atau backlog yang sudah disetujui. Rencana dan
status implementasi saat ini ada di [`ROADMAP.md`](./ROADMAP.md).

## Posisi produk

Sonora adalah pendamping mendengarkan musik untuk GNOME Shell. Ekstensi ini
menampilkan dan mengontrol Spotify, tetapi fokus produknya adalah membantu
pengguna melihat kebiasaan mendengarkan mereka.

> Player memberi tahu apa yang sedang diputar; Sonora membantu memahami
> bagaimana kamu mendengarkan.

Fondasinya sudah ada: statistik mingguan, hitungan putar berbasis posisi lagu,
streak, dan ducking mikrofon. Tantangan produk berikutnya adalah menjadikan
data tersebut berguna dan mudah dipahami, bukan menambah kontrol pemutar demi
menyamai ekstensi lain.

## Cara memakai pembanding

Ekstensi now-playing lain berguna sebagai referensi untuk memahami ekspektasi
pengguna dan pola antarmuka. Fitur yang ada di produk lain tetapi belum ada di
Sonora **bukan otomatis menjadi pekerjaan yang harus dikejar**.

Perbandingan fitur juga bisa berubah mengikuti versi dan konfigurasi produk
lain. Hindari memperlakukan tabel atau klaim kompetitor sebagai fakta permanen.
Sebelum menjadikan suatu perbedaan sebagai dasar keputusan, verifikasi ulang
dan cari bukti kebutuhan pengguna.

Pill panel, kartu now-playing, lirik, progress bar, dan warna album adalah
konvensi kategori yang dapat ditemukan di berbagai produk. Itu sendiri bukan
pembeda yang cukup kuat. Pembeda yang ingin dibangun Sonora adalah cara
menyajikan konteks kebiasaan mendengarkan dengan jelas, privat, dan tidak
mengganggu.

## Kemungkinan pengembangan

Semua poin berikut masih berupa eksplorasi. Pilih hanya jika ada kebutuhan
pengguna yang jelas dan implementasinya cocok dengan fokus produk.

### Recap mingguan

Ringkasan minggu sebelumnya, misalnya total waktu mendengarkan, artis teratas,
dan hari aktif. Bisa membantu pengguna melihat nilai statistik secara berkala.
Perlu ditentukan waktu, cara penyajian, dan cara mencegah recap terasa seperti
notifikasi yang mengganggu.

### Kesadaran sesi

Menampilkan durasi sesi mendengarkan yang panjang secara halus. Perlu aturan
yang jelas tentang kapan sesi dimulai dan berakhir, serta cara menghindari
pesan yang menghakimi atau berulang.

### Insight pola

Ringkasan sederhana yang diturunkan dari data yang benar-benar tersedia.
Contohnya perubahan pola mendengarkan dalam periode tertentu. Data detail artis
dan lagu saat ini hanya disimpan selama 10 hari, jadi insight jangka panjang
memerlukan keputusan retensi data terlebih dahulu.

### Ekspor data

Ekspor statistik lokal ke format seperti JSON atau CSV dapat berguna bagi
pengguna yang ingin menyimpan atau mengolah datanya sendiri. Tetapkan format
dan cakupan data sebelum membuat antarmuka ekspor.

### Ducking saat screen sharing

Pertimbangkan pengurangan volume saat screen sharing jika ada permintaan nyata.
Integrasi dengan indikator GNOME yang bersifat internal berisiko berubah
antarversi, sehingga perlu alternatif yang aman dan tidak mengganggu fitur
mikrofon yang sudah ada.

## Yang bukan fokus saat ini

| Area | Pertimbangan |
|---|---|
| Integrasi dock pihak ketiga | Nilai tambahnya belum terbukti cukup untuk biaya kompatibilitas dan pemeliharaan. Pertimbangkan kembali bila ada permintaan pengguna dan API yang stabil. |
| Multi-player | Saat ini integrasi MPRIS diarahkan khusus ke Spotify. Dukungan pemutar lain akan mengubah ruang lingkup dan perilaku produk. |
| Visualizer atau waveform | Tidak memperkuat fokus statistik kebiasaan; data spektrum juga tidak tersedia melalui MPRIS standar. |
| Karaoke tingkat kata | Sumber lirik saat ini menyediakan sinkronisasi per baris; dukungan tingkat kata memerlukan sumber data dan pekerjaan tambahan. |
| Tema yang sangat dapat dikustomisasi | Menambah opsi dan beban pemeliharaan; belum terbukti lebih bernilai daripada penyajian statistik yang lebih baik. |

Ini bukan larangan permanen. Keputusan dapat berubah bila kebutuhan pengguna,
dukungan platform, dan biaya pemeliharaan menunjukkan alasan yang kuat.

## Pertanyaan untuk menilai ide

1. Masalah pengguna apa yang diselesaikan, dan bukti apa yang menunjukkan masalah itu ada?
2. Apakah ide ini memperkuat Sonora sebagai pendamping, bukan sekadar menambah fitur player?
3. Apakah data yang dibutuhkan memang dikumpulkan dan disimpan dengan tepat?
4. Apakah manfaatnya mudah ditemukan dan dipahami tanpa mengganggu pengguna?
5. Seberapa besar biaya kompatibilitas, privasi, konfigurasi, dan pemeliharaannya?
