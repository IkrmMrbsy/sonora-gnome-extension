# Aturan Pengembangan Sonora (spotify-ext)

Dokumen ini berisi panduan dan batasan wajib untuk pengembangan ekstensi Sonora pada GNOME Shell 50.

## 1. Pemisahan Modul & Arsitektur
- **`src/core/` Bebas Shell/UI**: File di `src/core/` sama sekali TIDAK BOLEH mengimpor atau bergantung pada `St`, `Clutter`, atau modul internal GNOME Shell. Semua modul core harus dapat diuji secara mandiri dengan `gjs -m tests/run.js`.
- **`src/ui/` untuk Shell Chrome**: Menggunakan `St` dan `Clutter`. Gambar kustom menggunakan Cairo (`St.DrawingArea`) dengan memperhitungkan `surfaceScale` untuk HiDPI.
- **`prefs.js` untuk Preferences**: Menggunakan GTK4 dan Libadwaita (`Adw.*`) murni. Mengikuti tema terang/gelap sistem dan tidak menggunakan palet ink Shell (kecuali pada widget pratinjau).

## 2. Integritas Desain & Panduan UI (`DESIGN.md`)
- **Instrumen Tenang (ENERGY 1 / RHYTHM 1 / MOTION 2)**: Tanpa gradien dekoratif berlebihan, tanpa blur/kaca imitasi, dan tanpa kartu bersarang (*nested cards*).
- **Satu Aksen Warna**: Hanya satu aksen aktif (dari album art atau preset latar). Tidak mencampur aksen album dengan aksen preset.
- **Batas Kontras**: Teks wajib mencapai rasio kontras minimal 4.5:1 terhadap surface yang dirender (hindari alpha teks 30%–40% di `stylesheet.css`).
- **Standar Bahasa & Copy**:
  - Teks Shell UI dan Preferences menggunakan bahasa Inggris ringkas sebagai bahasa dasar (`Nothing playing`, `Appearance`, `Behavior`, dll.) dengan gettext `_()` untuk dukungan translasi.
  - Jangan gunakan tanda pisah em-dash (`—`) dalam teks UI; gunakan koma, titik dua, atau tanda kurung.
- **Aksesibilitas & Feedback**: Setiap kontrol ikon wajib memiliki `accessible_name`. Tidak mengandalkan warna semata untuk menandakan state (contoh: paused harus mengubah glyph tombol play).

## 3. Privasi & Layanan Jaringan
- Statistik hanya disimpan secara lokal di `~/.local/share/spotify-ext/stats.json`. Jangan kirim telemetri atau data keluar.
- Akses jaringan hanya diizinkan untuk `mpris:artUrl` (cover art) dan `lrclib.net` (lirik).

## 4. Alur Verifikasi & Pengujian
- Sebelum menyelesaikan perubahan kode, jalankan:
  - `make lint` (pemeriksaan sintaks seluruh file JavaScript).
  - `make test` (menjalankan 12 suite pengujian unit GJS).
  - `make security` (pemindaian Gitleaks dan Semgrep).
- Untuk pengujian interaktif/headless, gunakan `make headless` (`gnome-shell --headless` + `dev/fake-spotify.js`). Opsi `--nested` tidak didukung pada GNOME Shell 50.
- Perubahan kode JS di Wayland memerlukan logout/login atau sesi headless; reload ekstensi via CLI hanya memuat ulang CSS.

## 5. Standar Publikasi, ASO (EGO), & SEO (GitHub)
- **Penamaan Bersih & Aman Merek (`metadata.json`)**:
  - Field `name` menggunakan identitas bersih `"Sonora"` (atau nama utama `"Sonora"` di depan tanpa meniru aplikasi resmi Spotify).
  - Hindari em-dash (`—`); gunakan titik dua (`:`) atau koma (`,`).
- **Deskripsi Toko Ekstensi Bebas Spam (`metadata.json`)**:
  - Field `description` ditulis dalam bahasa Inggris natural dan padat nilai guna untuk pengguna akhir (`Spotify`, `now-playing`, `synced lyrics`, `playback controls`, `sleep timer`, `mic auto-duck`, `listening stats`), tanpa menyebut detail debugging internal (seperti tombol debug) dan tanpa *keyword stuffing* (daftar kata kunci dipisah koma tanpa kalimat).
- **Dokumentasi Publik Berbahasa Inggris (`README.md`)**:
  - `README.md` utama di root repositori menggunakan bahasa Inggris yang jelas agar terindeks baik di pencarian GitHub/Google serta ramah bagi pengguna dan kontributor terjemahan internasional (dokumentasi Indonesia dapat ditautkan ke `README.id.md`).
