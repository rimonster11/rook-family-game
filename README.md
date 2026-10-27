# Rook Night 🐦 — play Rook online with family & friends

A cozy, browser-based Rook table with Family Four and Partnership for Six modes.
Node.js + Express + Socket.IO; the server is authoritative and each client only ever receives its own hand.

## Run
```bash
npm install
npm start            # http://localhost:3000  (PORT env var to change)
npm test             # engine, socket, appearance and 4-/6-player simulation tests
npm run sim -- 20    # simulate 20 bot-only games and print results
node scripts/e2e-socket.js http://localhost:3000   # socket smoke test: 1 scripted human + 3 bots, full game
```
On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.
`npm test` also covers team-name approvals, appearance validation and syncing,
live hand totals, and 3D character construction. The socket integration test
starts its own temporary server on an available port.
To share over the internet without hosting: `cloudflared tunnel --url http://localhost:3000` (prints a temporary `*.trycloudflare.com` URL).

## How to play
1. Open the site, type your name, choose the game mode, and **Create a table**. You get a 4-letter code + **Copy invite link**.
2. Friends open the link (or enter the code). Alternating chairs form teams: 1 & 3 against 2 & 4 in Family Four; 1, 3 & 5 against 2, 4 & 6 in Partnership for Six.
3. Host can **Add bot** / **Fill empty seats with bots** (bots get friendly names and a BOT badge), tweak house rules, then **Deal 'em!**
4. **Bidding**: use the minus/plus stepper to choose a valid bid, then Bid, or Pass when permitted.
5. **Nest**: the winning bidder picks up the nest, selects cards to bury (five in Family Four, nine in Partnership for Six), chooses trump, and confirms.
6. **Play**: legal cards are bright; others are dimmed and can't be played. Completed tricks linger briefly showing who took them.
7. After each hand a recap shows points, made/set, score changes and the buried nest. 📋 = scorecard, 💬 = chat + game log.
8. Refreshing the page or losing connection reconnects you to your seat automatically (same browser). The host can replace a disconnected player with a bot; a spectator can take over a bot seat mid-game.

## Partnership for Six

Choose **Family Four** or **Partnership for Six** when creating a table, or in the
seating lobby before others sit. Only the host may change modes. Other humans
must stand and bots must be explicitly removed first; an occupied seat is never
silently dropped. Mode stays locked for the match. Each mode remembers its own
room settings when switching back. Existing Family Four settings remain intact.

Six uses all 57 cards (1–14 plus Rook), eight cards per player and a nine-card
nest, with alternating teams of three. The bidder picks up 17 and buries nine.
The player left of the dealer leads first; six cards complete a trick and eight
tricks complete a hand. The Rook may be played at any time; other cards follow
suit. The last trick earns the nest. There are 120 counter points and no trick
bonus; a set team loses its bid, defenders keep their counters. The target is
300, with the higher total winning if both qualify and tied totals continuing.

Source: [Winning Moves rules](https://winning-moves.com/images/RookrulesV6s.pdf),
Partnership for Six (printed page 23) and its Tournament reference. **Approved
house interpretations:** bids are 70–120 in fives; all-pass advances the dealer
and redeals without scoring; seats stay fixed throughout the match, rather than
inventing a three-person version of Tournament's exchange after four hands.
The opening minimum and increment come from the publisher; the explicit cap,
all-pass convention, and fixed-seat adaptation are our conventions.

Family low-card, moon, exposed nest, and adjustable scoring/bidding options do
not carry over. Bot pace and graphics remain configurable. Six-player automatic
lay-down is disabled. Both the seating lobby and in-game sidebar have **How to
play**, reflecting the mode and actual settings. Five-player and new banter/
reactions remain deferred; see [the preserved approved specification](docs/APPROVED-MODES.md).

Browser checks use development-only Playwright on disposable local servers:
`node scripts/check-modes.cjs` captures the rendered matrix, and
`node scripts/check-mode-flow.cjs` exercises real lobby/reconnect flows.
Results are under ignored `screenshots/six-player/`; these are browser emulations,
not physical-device certification. High diagnostics suppress only automatic FPS
downgrading in the test harness; production fallback remains enabled.

## Family rules (implemented, authoritative for Family Four only)
- Deck: 5–14 in Red, Black, Green, Yellow + the Rook = 41 cards. 9 cards each, 5 to the nest; the top nest card is shown face up during bidding and hidden once the bidder takes the nest.
- Counters: 5 = 5, 10 = 10, 14 = 10, Rook = 20 → 120 per hand.
- The Rook is always the highest card in the game; it belongs to the trump suit.
- Highest bidder takes the nest, buries any 5 cards (counters and the Rook allowed), names trump. Trump beats all other colors.
- Bidding team must take at least its bid or loses the bid amount (scores can go negative); otherwise it scores what it took. Defenders always score what they took.
- The winner of the last trick also gets the 5 buried cards (and their counters).
- Play to 500.

## Family Four defaults (configurable by the host in the lobby)
| Setting | Default | Notes |
|---|---|---|
| `minBid` | 70 | Opening/minimum bid. |
| `bidIncrement` | 5 | Bids must be multiples of 5; you may jump by any multiple (80 → 90). |
| `maxBid` | 120 | |
| `openerMustBid` | on | Player left of dealer bids first and must open at the minimum; if all others pass, they're stuck with it. Passed players can't re-enter. |
| `allPassRule` | dealerStuck | Only used if `openerMustBid` is off: dealer stuck at min, or redeal. |
| `allowLowCard` | on | Permits the bidder to choose low after taking the nest; high remains the initial choice for every hand. The host can turn permission off before play. The Rook always wins but must follow suit as trump; the former `rookAnytime` setting is ignored. |
| `bidderLeads` | on | Winning bidder leads the first trick (off = player left of dealer). Trick winner leads next. |
| `winRule` | bidderMustMake | A team can only win on a hand where it took the bid and made it, reaching ≥ target. Defending points count but can't trigger a win (480 → 510 on defense keeps playing). Alternative `anyReach`: first to target wins; if both cross, bidding team wins. |
| `targetScore` | 500 | |
| `flipNestCard` | on | |
| `botDelayMs` | 2000 | Configurable from 200–3000ms; ordinary bot bids, passes, nest decisions, and card plays wait this long. |
- Must follow the led color if able; if void, play anything. Dealer rotates clockwise each hand; first dealer is random.

These defaults apply to newly created family rooms. Host-selected room settings
survive reconnects and returning to the lobby for as long as that room exists.
Starting a game copies those settings into its own snapshot; defaults do not
overwrite explicit settings. Rooms and games remain in memory only.

Bot pacing adds 900ms before the next lead after a completed trick. The separate
timing paths are unchanged: queued pre-plays wait 350ms (plus that 900ms pause),
proven automatic finishes wait 260ms (plus 700ms between tricks), and entirely
bot-filled tables wait 2500ms before starting the next hand.

## Project layout
- `src/engine.js` — pure rules engine (deck, deal, bidding, nest, legal moves, trick winner, scoring, win check, per-seat views)
- `src/bot.js` — heuristic bots (use only information a player would have)
- `src/server.js` — Express + Socket.IO rooms, seats, settings, chat, reconnect, bot scheduling
- `src/sim.js` — bot-vs-bot game simulator
- `public/` — static client (index.html, style.css, app.js)
- `test/engine.test.js` — `node --test` unit tests; `scripts/e2e-socket.js` — live-server socket smoke test (full game)
- `RESEARCH.md` — background research on Rook with sources

## Limitations
- State is in memory: restarting the server ends all games. Idle rooms are purged after ~2 hours with nobody connected.
- Identity is a random id in localStorage — reconnect works in the same browser only; no accounts/passwords. Anyone with the code can join/spectate.
- Bots are simple heuristics (decent, not expert). No misdeal/redeal for counter-less hands, no renege penalties (illegal plays are blocked instead).
- Single process; not designed for horizontal scaling.

## Look & feel (v2)
- Classic blue Rook theme: navy/royal blue with white accents, custom SVG rook-bird emblem, Rook-style cards (red/black/green/yellow + the blue Rook card) and blue card backs.
- 3D table (Three.js r169, vendored at `public/vendor/three.module.min.js`, no CDN): wood rim, blue felt, soft spotlight shadows, camera from your seat. Played cards fly to the center in 3D and are swept to the trick winner.
- Characters: a customizable regular avatar and the special Barbarian. Appearance is stored locally and synced via the server on create/join/reconnect and `setCharacter`. Bots retain twelve varied regular presets.
- Graphics menu (chat drawer): 3D High / 3D Lite / 2D. Phones default to Lite; no-WebGL devices fall back to 2D automatically. Add `?gfx=2d` to force 2D.
- Installable PWA: `manifest.webmanifest`, `sw.js` (network-first, offline shell), icons in `public/icons/`.

## Clubhouse update
- A refreshed navy, blue and warm-gold interface: compact arrival screen, visual
  seat cards, collapsible rules, and matching table, scoreboard and recap styling.
- **Make it yours** on the arrival screen offers skin tone, outfit, hair color,
  headwear and eyewear. Preferences persist in this browser and sync to the table
  on join/reconnect. Use **Character** in the lobby or **Your character** in the
  game menu to update them. The 3D models and 2D portraits use the same choices.
  All artwork is procedural; no external model downloads or new dependencies.
- Opposite seats form a team (1 & 3, 2 & 4). Once both seats are filled, either
  player can propose a name in the lobby or game menu. The other human must accept;
  bots approve automatically. Declining keeps the current name. Changing team
  members resets the name and any proposal; reconnecting to the same seat does not.
- The hand tracker separates captured points from the overall game score. It
  shows the bid, points needed, and how many additional points the bidders can
  afford to lose. It marks a bid secured or mathematically set using captured
  points only. Unawarded points include the nest, which is credited on the last
  trick. Hidden hands and nest contents remain private.

## Illustrated visual update
- Local Lilita One display lettering and Nunito interface text, with illustrated
  SVG controls, a layered title crest, raised buttons and score badges. Font
  licenses and attribution are bundled in `public/fonts/`.
- `public/js/characters.js` builds smooth toy-like characters: sculpted heads,
  expressive eyes, rounded hair, curved glasses, detailed sweaters and soft
  materials. The preview and table share these models and wardrobe choices.
  Characters blink and gently look around; reduced-motion settings are respected.
- The 2D portraits use matching shaded faces, expressive eyes and sweater details.
  Headwear and eyewear selectors show portraits of each option.
- `public/game-art.css` contains the illustrated interface styling;
  `public/js/ui-art.js` contains the original vector icons and title treatment.

## Barbarian model trial
- Choose **Barbarian** in the character grid, or open `/?character=barbarian&gfx=high`.
  Choose **Your character** for customization. The Barbarian has a fixed costume.
- A local, textured GLB is shared by the home preview and table. The portrait is used
  in the lobby, in 2D mode, and while the model loads. Each character has its own head
  motion; reduced-motion preferences are respected.
- Source scene: `art-source/barbarian/barbarian.blend`. Rebuild with
  `blender --background --python scripts/build-barbarian.py`.
- `scripts/verify-barbarian.py` reimports the exported asset and renders a preview.
  Runtime loading/disposal and asset structure are checked by `npm test`.
- The camera looks from your seat, so your own 3D body is hidden at the table.
  To see this model across the table, join from a second browser profile, select
  Barbarian there, and fill the remaining seats with bots.

## Character studio
- New players start with a simple regular character. **Make it yours** groups choices
  into Face, Hair, Outfit, and Extras, with visual previews and a reset button.
- Choose eight hairstyles, six hair colors, six skin tones, five expressions,
  four eye colors, and optional facial hair. Four outfit styles share six coordinated
  three-color palettes. Hats, glasses, earrings, a pendant, and a scarf are optional.
- Regular faces have smooth surfaces, smaller eyes, and no raised cheeks or blush
  circles. The special Barbarian assets and renderer are unchanged.
- Inspect the basic avatar locally at `/?character=basic&gfx=high`; use `gfx=2d`
  to inspect its SVG fallback. Check a second browser profile to see appearance sync.
- Offline geometry preview: run `node scripts/preview-avatars.mjs`, then
  `blender --background --python scripts/render-avatar-preview.py`. The intermediate
  mesh data goes to the system temp directory; the rendered lineup goes to
  `art-source/avatars/character-lineup.png`. This is a Blender geometry preview,
  not a screenshot of the browser's lighting or interface.

## Family Four table play features
- **Pre-play:** tap a card while waiting. Tap again to cancel or another card to
  replace it. Only that player sees the queue. The server rechecks legality on
  the actual turn; an illegal choice is cleared without playing another card.
- **Last trick:** open the small Last trick panel to review all four cards, their
  players, the winner, and points. It stays available until the next completed
  trick and resets when a new hand is dealt.
- **Touch controls:** swipe left from the right Chat handle to open chat, and
  right inside chat to close it. Swipe right from the left Scores handle to open
  scores, and left on the score dialog to close. The score table itself retains
  horizontal scrolling. Buttons and sticky close controls remain available.
- **Follow suit:** the Rook belongs to trump. If a non-trump color is led and you
  have it, you must play that color. Rook-led tricks require trump if available.
- **Shoot the moon:** the bidder declares it when confirming the nest. All nine
  tricks must be won by that individual, not their team. Success replaces the
  bidding team's hand score with +500; failure replaces it with -500. Defenders
  retain their captured points. A failed attempt still plays to the end.
- **Low-card mode:** permission is on by default and can be turned off in House
  rules before starting. High remains selected unless the bidder chooses low
  with the nest. Low ranks beat high ranks within led/trump colors;
  trump still beats other colors, Rook still beats all, and points never change.
  Bots understand both orders but currently choose high when they win the bid.
- **Chat bubbles and banter:** seated players' messages appear near their table
  avatars for 6.5 seconds. Spectator messages stay in chat. Bots use premade lines
  with a table-wide cooldown; they never inspect hidden cards for their banter.
- **Melissa:** select Melissa or use Add Melissa in an empty lobby seat. Her
  preset has blonde corkscrew curls and a lavender cardigan. Her bot includes
  "This is the worst hand ever" and "I'm so gonna get set."
- **Dealing:** a short shuffle and 41-card dealing sequence plays for a newly
  dealt hand, without delaying controls or revealing hidden cards. Reduced-motion
  preferences skip the sequence.
- **Lay it down:** at the bidder's lead, the server proves a winning continuation
  against every other seat, including their partner. It then plays one legal card
  at a time, pausing between tricks. Proof search has a 35ms/25,000-node budget; if
  it cannot prove the result in that budget, ordinary play continues. No hidden
  hands or proof policy are sent to clients.
- Mobile changes include 44px controls, safe-area/dynamic-height layouts, readable
  inputs, landscape adjustments, preserved chat scroll, and fewer hand redraws.

### Verify this update
Run `npm test`, then `npm start`. Run `npm run e2e -- http://localhost:3000` for a
full normal game. Set `$env:ROOK_E2E_MODE='low'` in PowerShell and repeat for low
mode; remove it afterward with `Remove-Item Env:ROOK_E2E_MODE`. Tests cover socket
queue privacy/execution, settings authorization, low ordering, moon outcomes,
proof safety against exhaustive small-hand continuations, and gesture thresholds.

Manual browser/device checks: select Melissa, fill a table with bots, pre-play and
cancel a card, inspect Last trick after the next lead, swipe both panels while
scrolled, send chat, and play a low hand. Check portrait/landscape on an actual
phone and reduced motion. Socket tests do not validate browser layout or touch.
Melissa geometry preview: `node scripts/preview-avatars.mjs --melissa`, followed
by `blender --background --python scripts/render-avatar-preview.py -- --melissa`.
