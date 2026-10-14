# Breakout bitmap artwork

The artwork was generated with Codex native image_gen (`art_source: host_image`).
The tool did not expose the exact model name or an API dollar estimate.
The two exact prompts are saved in this directory. Original generated PNGs
are preserved in `assets/source/`.

Runtime artwork: six transparent brick PNGs (132 × 40), paddle (240 × 24),
ball (32 × 32), sparkle (24 × 24), and an opaque WebP arena (800 × 560).
Sprites are HD bitmap assets, drawn at half their stored dimensions for
the game's logical canvas. Game collision rectangles retain their original size.

The generated paddle crossed the default atlas cell boundary. Ownership
slicing and repacking preserve its complete end caps before Forge processing.
`prepare_atlas.py` records the ownership regions. The Sprite Forge processor
then checked all nine frames with native alpha, Lanczos sampling and strict QC.
`sprite-processing.json` preserves the processor's full results. Empty frames,
clamped pastes and source/output boundary contact all passed with empty lists.
Body scale variance and anchor variance are skipped because these are distinct
props rather than animation frames of one character.

`export_assets.py` exports runtime PNGs, checks dimensions and transparency,
and produces `preview.png`, a composition at the game's actual display size.
`assets/manifest.json` records sizes, SHA-256 hashes, route and runtime checks.
The processing intermediates are ignored by Git.

Run `node artwork/check_game.cjs` to check local asset references, bitmap
rendering, loading errors/retry, pause, life loss and level progression.
