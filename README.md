# Rook Night 🐦 — play Rook online with family & friends

A cozy, browser-based Rook table for 4 players (2 teams of 2, partners across), using our family rules.
Node.js + Express + Socket.IO; the server is authoritative and each client only ever receives its own hand.

## Run
```bash
npm install
npm start            # http://localhost:3000  (PORT env var to change)
npm test             # unit tests for the rules engine + 25 simulated 4-bot games
npm run sim -- 20    # simulate 20 bot-only games and print results
node scripts/e2e-socket.js http://localhost:3000   # socket smoke test: 1 scripted human + 3 bots, full game
```
On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.
`npm test` also covers team-name approvals, appearance validation and syncing,
live hand totals, and 3D character construction. The socket integration test
starts its own temporary server on an available port.
To share over the internet without hosting: `cloudflared tunnel --url http://localhost:3000` (prints a temporary `*.trycloudflare.com` URL).

## How to play
1. Open the site, type your name, **Start a new table**. You get a 4-letter code + **Copy invite link**.
2. Friends open the link (or enter the code). Everyone picks a chair; seats 1 & 3 are Team 1, seats 2 & 4 are Team 2.
3. Host can **Add bot** / **Fill empty seats with bots** (bots get friendly names and a BOT badge), tweak house rules, then **Deal 'em!**
4. **Bidding**: on your turn use the quick buttons (next valid bid, +5, +10) or pick any higher multiple from the dropdown, or Pass.
5. **Nest**: the winning bidder gets the 5 nest cards (marked "nest"), taps 5 cards to bury, picks a trump color, and confirms.
6. **Play**: legal cards are bright; others are dimmed and can't be played. Completed tricks linger briefly showing who took them.
7. After each hand a recap shows points, made/set, score changes and the buried nest. 📋 = scorecard, 💬 = chat + game log.
8. Refreshing the page or losing connection reconnects you to your seat automatically (same browser). The host can replace a disconnected player with a bot; a spectator can take over a bot seat mid-game.

## Family rules (implemented, authoritative)
- Deck: 5–14 in Red, Black, Green, Yellow + the Rook = 41 cards. 9 cards each, 5 to the nest; the top nest card is shown face up during bidding and hidden once the bidder takes the nest.
- Counters: 5 = 5, 10 = 10, 14 = 10, Rook = 20 → 120 per hand.
- The Rook is always the highest card in the game; it belongs to the trump suit.
- Highest bidder takes the nest, buries any 5 cards (counters and the Rook allowed), names trump. Trump beats all other colors.
- Bidding team must take at least its bid or loses the bid amount (scores can go negative); otherwise it scores what it took. Defenders always score what they took.
- The winner of the last trick also gets the 5 buried cards (and their counters).
- Play to 500.

## Defaults chosen for unspecified details (all configurable in the lobby's settings by the host)
| Setting | Default | Notes |
|---|---|---|
| `minBid` | 70 | Opening/minimum bid. |
| `bidIncrement` | 5 | Bids must be multiples of 5; you may jump by any multiple (80 → 90). |
| `maxBid` | 120 | |
| `openerMustBid` | on | Player left of dealer bids first and must open at the minimum; if all others pass, they're stuck with it. Passed players can't re-enter. |
| `allPassRule` | dealerStuck | Only used if `openerMustBid` is off: dealer stuck at min, or redeal. |
| `rookAnytime` | on | Rook may be played on any trick even when you could follow. Either way: Rook counts as trump for following; if the Rook is led, trump must be followed; if trump is led and the Rook is your only trump you **must** play it. |
| `bidderLeads` | on | Winning bidder leads the first trick (off = player left of dealer). Trick winner leads next. |
| `winRule` | bidderMustMake | A team can only win on a hand where it took the bid and made it, reaching ≥ target. Defending points count but can't trigger a win (480 → 510 on defense keeps playing). Alternative `anyReach`: first to target wins; if both cross, bidding team wins. |
| `targetScore` | 500 | |
| `flipNestCard` | on | |
| `botDelayMs` | 700 | Bot pacing. |
- Must follow the led color if able; if void, play anything. Dealer rotates clockwise each hand; first dealer is random.

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
- Bots are simple heuristics (decent, not expert). No misdeal/redeal for counter-less hands, no renege penalties (illegal plays are blocked instead), no "shoot the moon".
- Single process; not designed for horizontal scaling.

## Look & feel (v2)
- Classic blue Rook theme: navy/royal blue with white accents, custom SVG rook-bird emblem, Rook-style cards (red/black/green/yellow + the blue Rook card) and blue card backs.
- 3D table (Three.js r169, vendored at `public/vendor/three.module.min.js`, no CDN): wood rim, blue felt, soft spotlight shadows, camera from your seat. Played cards fly to the center in 3D and are swept to the trick winner.
- Characters: 12 procedural characters (`public/js/art.js` specs, `public/js/three3d.js` models). Pick one on sign-in; stored in localStorage and synced via the server (`character` on create/join/hello, `setCharacter` event). Bots get random characters.
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
  The existing character choices remain available. The Barbarian has a fixed costume.
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
