# Partnership for Six milestone review

Local implementation, October 27, 2026. No commit, push, or deployment.
The approved fixed-seat interpretation is recorded in `APPROVED-MODES.md` and
displayed as a house adaptation in both How to play locations.

## Implemented scope

- `public/js/game-modes.js`: two explicit profiles only. Five-player is rejected
  by the engine/server and absent from mode selectors.
- `src/engine.js` (`settingsFor`, `newGame`, `startHand`, `applyDiscard`,
  `applyPlay`, `decideWinner`, `viewFor`): six-seat turns, 57-card deck, eight-card
  hands, nine-card nest, alternating teams of three, Rook-anytime exception,
  dealer-left first lead, 120 counters without trick bonus, and 300-point victory
  with higher-total/tie handling. Six rules are normalized independently from
  Family Four settings. Private hands, queues, and bidder-only buried cards stay
  private; the completed-hand recap reveals the nest as before.
- `src/server.js` (`createRoom`, `setMode`, seating handlers, `broadcast`): host
  mode selection, exact seat capacity, rejection of occupied-seat displacement,
  match mode locking, per-mode room-setting restoration, six-seat reconnect and
  takeover. Existing scheduler timing paths remain unchanged.
- `src/bot.js`: mode-specific nest size, rank range, last-seat recognition and
  legality; both same-team partners are recognized through alternating teams.
  Decisions remain heuristic and local. No external AI or new banter.
- `src/teams.js`: naming requires every teammate's approval, with bots approving
  automatically. Third-member changes invalidate stale proposals.
- `public/js/app.js`, `table-layout.js`, `three3d.js`, `table-experience.js`,
  `modes.css`: six lobby chairs and table positions, 17-card pickup, six-card
  Last trick, eight-trick progress, three winning avatars, and 57-card deal
  animation. Existing art, character models, textures, and frameworks are reused.
- `public/js/rules-help.js`, `index.html`: mode/settings-aware How to play in the
  seating lobby and opened game sidebar. Publisher rules and approved house
  interpretations are explicitly distinguished. Six offers bot pace, without
  unsupported family rule switches.
- `src/auto-finish.js` and server guard: six-player automatic lay-down is disabled
  both at the proof entry point and scheduling entry point.

Family Four still defaults to low-card permission on and a 2000ms bot delay.
High remains the initial hand choice; its existing low, moon, lead, scoring,
option switches, and timing behavior are preserved. A narrowly scoped existing
2D Last trick label collision was corrected on short mobile viewports. Six-player
history uses one row of six cards so an expanded history cannot push the hand
below a short phone viewport.

## Verification

`npm test`: **65 passed, 0 failed**. Includes all existing regressions plus six-
player deck/deal/bidding/play/scoring/privacy tests, 30 complete six-player hands,
25 complete simulated six-player bot matches, and socket authorization, occupied
seat protection, settings isolation, private queue reconnect, complete hand,
next hand, and bot takeover checks. The existing Node module-type warning remains.
The [full test output](../screenshots/six-player/test-results.txt) is retained locally.

`node scripts/check-mode-flow.cjs`: both modes pass real-browser/real-socket
creation, occupied-seat protection, settings restoration, start, same-hand
reconnect and mode-specific help. Every server used is an isolated child on an
ephemeral port, shut down after testing.

Rendered matrix results are saved in `screenshots/six-player/after/*.json`.
The [consolidated final manifest](../screenshots/six-player/after/verification-final.json)
contains **728 distinct passing layout/interaction cases, zero unresolved
failures**: 576 core cases (288 per engine), plus 152 extra Android-sized,
short-phone, victory and scorecard cases. Corrective reruns supersede the initial
desktop nameplate collisions; original run reports are retained for audit.
Chromium supplies complete rendered page evidence. WebKit's 3D page compositor
limitation is explicitly excluded from that visual claim, as detailed below.

Core sizes: 390×844 portrait with simulated safe areas, 844×390 landscape, and
1440×900 desktop. Additional checks use 412×915 and 915×412 Android-sized views,
and a 390×664 short phone viewport. Every core seat orientation is covered in
2D, Lite and High; the additional sizes check the most crowded states.

Each core engine/graphics/size combination covers lobby, bidding, nest, playing,
Last trick, sidebar, help and recap at seat zero; every other seat is checked at
nest and playing. Nest checks actually select and confirm five/nine cards.
Checks cover label collisions, viewport containment, control/hand separation,
card proportions and SVG text bounds, correct help and prohibited options.
Additional fixtures cover victory's full team and the score ledger.
Those victory/ledger fixtures come from completed bot simulations, rather than
invented terminal scores. Desktop six-player names remain projected near their
avatars; the compact two-row name layout is restricted to mobile tables.

## Before/after evidence

All images are actual local browser captures. Baselines were established before
layout changes; screenshots are ignored by Git but retained in this workspace.

| View | Before | After |
| --- | --- | --- |
| Four, phone, 2D | [baseline](../screenshots/six-player/before/chromium-phone-family4-2d-seat0-playing.png) | [current](../screenshots/six-player/after/chromium-phone-family4-2d-seat0-playing.png) |
| Four, desktop, 2D | [baseline](../screenshots/six-player/before/chromium-desktop-family4-2d-seat0-playing.png) | [current](../screenshots/six-player/after/chromium-desktop-family4-2d-seat0-playing.png) |
| Four, landscape history | [baseline](../screenshots/six-player/before/chromium-landscape-family4-2d-seat0-lastTrick.png) | [current](../screenshots/six-player/after/chromium-landscape-family4-2d-seat0-lastTrick.png) |

The sampled four-player phone and desktop 2D playing captures match the baseline
pixel for pixel. Six-player examples:

- [17-card pickup](../screenshots/six-player/after/chromium-phone-partnership6-2d-seat0-nest.png)
- [Six-player High](../screenshots/six-player/after/chromium-phone-partnership6-high-seat0-playing.png)
- [Six-card history on a short phone](../screenshots/six-player/after/chromium-short-phone-partnership6-2d-seat0-lastTrick.png)
- [Help after a real reconnect](../screenshots/six-player/flow/partnership6-reconnected-help.png)
- [WebKit's separately captured rendered canvas](../screenshots/six-player/after/webkit-phone-partnership6-low-seat0-playing.canvas.png)

## Practical limits and deferred work

- Testing uses Windows Chromium/WebKit emulation, not physical iPhone/Android
  devices or native Safari. Touch, safe-area and viewport dimensions are emulated.
- Windows WebKit's page screenshot can omit a healthy WebGL canvas after its
  buffer resizes. This also occurred in the four-player baseline. Direct canvas
  captures show the rendered scene; those are separate from full-page captures,
  not proof that the full Safari compositor is correct. This matches the
  [upstream Windows WebKit capture issue](https://github.com/microsoft/playwright/issues/42885).
  The harness preserves the buffer for direct captures and checks color variation,
  context health and GL errors. Production rendering is unchanged.
- High capture diagnostics suppress automatic FPS downgrading only in the local
  harness. Production retains its High-to-Lite fallback. These tests assess
  appearance/interaction, not physical GPU frame rate or battery use.
- Rooms remain memory-only, as before: reconnect restores a seat while the server
  is running; restarting the server does not restore rooms. No live game was
  accessed or changed during this milestone.
- Five-player, new banter/reactions, and six-player automatic lay-down remain
  deferred. Physical-device review and approval to publish are still outstanding.
