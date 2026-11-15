**English** | [Bahasa Indonesia](README.id.md)

# Sonora: Spotify Now-Playing & Synced Lyrics for GNOME Shell 50

**The music companion for GNOME.**

Sonora is a GNOME Shell 50 extension that displays your currently playing Spotify track directly on the top bar, featuring an adaptive now-playing card, synced lyrics, playback controls, a sleep timer, microphone auto-ducking, and local listening statistics.

No Spotify Web API keys and no account login required. All playback state and metadata are read locally via **MPRIS** (`org.mpris.MediaPlayer2.spotify`) on the D-Bus session bus, including full `Play`, `Pause`, `Next`, `Previous`, `Seek`, and `LoopStatus` controls.

---

## Key Features

- **Top Bar Indicator (`Icon` or `Pill` mode)**: Choose between a compact music icon or an adaptive pill showing album cover art, track title, and a contextual right slot (remaining time countdown, active sleep timer, or microphone duck indicator).
- **Now-Playing Card**: Opens on hover or click with album art accent tinting (or a chosen solid color preset), interactive seek bar, and full MPRIS playback + repeat controls. Double-click the cover art to focus Spotify.
- **Synced Lyrics (`lrclib.net`)**: Expandable lyrics drawer with LRC timestamp parsing, smooth monotonic-clock line progression, and a 40-track in-memory cache.
- **Sleep Timer**: Fade out playback volume over 5 seconds and pause automatically after 15, 30, 45, or 60 minutes, then restore the original volume.
- **Microphone Auto-Duck / Auto-Pause**: Uses GNOME Volume Control (`Gvc`) to detect active microphone input (such as video calls) and automatically lower volume or pause Spotify until the microphone is free again.
- **Local Listening Statistics & Streaks**: Tracks listening time, weekly totals, top 5 artists, top 5 tracks, and daily streaks locally at `~/.local/share/spotify-ext/stats.json` with zero telemetry.
- **Libadwaita Preferences & i18n**: Clean 3-page GTK4/Libadwaita preferences window (**Appearance**, **Behavior**, **About**) with live Cairo preview and GNU gettext translation support.

---

## Requirements

- **GNOME Shell 50**
- **Spotify** desktop client exposing MPRIS (`org.mpris.MediaPlayer2.spotify`)
- **Internet access** only for fetching album art (`mpris:artUrl`) and synced lyrics (`lrclib.net`)
- Optional: `Gvc` (typically bundled with GNOME Shell) for microphone detection

---

## Installation

### From source (recommended for development)

```bash
make install
```

This compiles the GSettings schema and gettext translations (`make schemas locales`), then symlinks the extension directory into `~/.local/share/gnome-shell/extensions/sonora@ikrmmrbsy.github.io`.

On Wayland, log out and back in once so GNOME Shell discovers the new extension metadata, then enable it:

```bash
gnome-extensions enable sonora@ikrmmrbsy.github.io
```

Open preferences via **Extensions -> Sonora -> Settings**, or run:

```bash
gnome-extensions prefs sonora@ikrmmrbsy.github.io
```

To remove the symlink:

```bash
make uninstall
```

---

## Panel Indicator & Now-Playing Card

| Mode | Top Bar Contents | Size |
|---|---|---|
| **Icon only** | Music glyph | 28x24 hit area |
| **Cover, title and status** | Album art, track title, contextual slot | 240px wide (shrinks down to 170px if needed) |

The contextual right slot shows one status at a time with a 120ms cross-fade when state changes:
1. **Remaining time** (default), e.g. `-3:10`
2. **Sleep timer**, moon icon + remaining countdown when armed
3. **Mic ducking**, microphone icon + `Duck` while volume is lowered

Inside the card, two optional drawers expand independently without shifting the main card controls:
- **Lyrics drawer** (expands right): 5 lines centered on the active lyric line
- **Stats drawer** (expands down): weekly listening total, 7-day bar chart, top 5 artists by time, top 5 tracks by play count, and active day streaks

---

## Listening Statistics & Privacy

- **Zero accounts, zero telemetry**: Nothing is ever sent to the extension author or third-party analytics.
- **Local storage**: Stats live at `~/.local/share/spotify-ext/stats.json` and flush at most once every 5 minutes.
- **Retention**: Daily artist and track breakdowns are kept for 10 days; total daily listening seconds and play counts are kept long-term.
- **Network requests**: Only track metadata (`title`, `artist`, `album`, `duration`) is sent to `lrclib.net` for lyrics lookup, and cover images load from Spotify's `mpris:artUrl`.

---

## Translations (i18n)

Sonora uses standard GNU gettext (`gettext-domain: spotify-ext`) with English as the base language.

To add a new language (for example Spanish `es`):
1. Copy `po/spotify-ext.pot` to `po/es.po`.
2. Fill in each `msgstr` translation.
3. Add your credit entry in `src/util/translators.js`.
4. Run `make locales` to verify compilation into `locale/es/LC_MESSAGES/spotify-ext.mo`.
5. Open a Pull Request on GitHub.

---

## Development Commands

All tasks are managed through `Makefile`:

| Command | Purpose |
|---|---|
| `make` | Run `lint`, `test`, `schemas`, and `locales` |
| `make schemas` | Compile `schemas/gschemas.compiled` |
| `make locales` | Compile `po/*.po` translations into `locale/*/LC_MESSAGES/spotify-ext.mo` |
| `make lint` | Syntax-check all JavaScript files |
| `make test` | Run all 12 isolated GJS unit test suites in `tests/` |
| `make security` | Run Gitleaks secret scan and Semgrep SAST |
| `make install` | Symlink extension and compile schemas & locales |
| `make uninstall` | Remove extension symlink |
| `make pack` | Build release archive `dist/sonora.zip` |
| `make headless` | Launch headless GNOME Shell 50 with `dev/fake-spotify.js` |
| `make clean` | Remove build artifacts (`dist/`, `locale/`, compiled schemas) |

### Project Structure

```text
sonora/
├── .github/workflows/         # CI (lint, test, pack) & security scans
├── AGENTS.md                  # Architecture & publication rules
├── DESIGN.md                  # Visual & interaction design specification
├── LICENSE                    # GPL-3.0
├── Makefile
├── README.md                  # English documentation (default)
├── README.id.md               # Indonesian documentation
├── metadata.json              # GNOME Shell extension manifest
├── extension.js               # Extension entry point
├── prefs.js                   # GTK4 / Libadwaita preferences window
├── stylesheet.css             # GNOME Shell styling
├── po/                        # Gettext .pot template and .po translations
├── schemas/                   # GSettings XML schema
├── src/
│   ├── core/                  # Pure GJS logic (zero St/Clutter imports)
│   ├── ui/                    # GNOME Shell top bar indicator & popup card
│   └── util/                  # Color extraction, palettes, paths, translators
├── tests/                     # GJS unit tests
├── dev/                       # Fake MPRIS player, headless runner, MO compiler
├── icons/                     # Custom symbolic icons
└── docs/                      # Architecture notes, audit, roadmap, mockup
```

---

## Known Limitations

- **Spotify only**: Connects specifically to `org.mpris.MediaPlayer2.spotify`; other MPRIS media players are not targeted.
- **No true Shell blur**: Uses Cairo radial gradients instead of backdrop blur for consistent performance and readability.
- **Wayland reload**: On Wayland, JavaScript and `metadata.json` changes require logging out and back in (or using `make headless`).

---

## Contributing & Security

Issues and Pull Requests are welcome. Before opening a PR, please ensure `make lint`, `make test`, and `make security` pass.

Please report security vulnerabilities privately via GitHub Security Advisories rather than opening a public issue.

## Affiliation & License

Sonora is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Spotify. Spotify is a trademark of Spotify AB.

Distributed under the **GNU General Public License v3.0 (GPL-3.0)**. See [LICENSE](LICENSE).
