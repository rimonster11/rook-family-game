# Approved mode and reaction specification

Approved in this workspace conversation, October 26, 2026. Source:
https://winning-moves.com/images/RookrulesV6s.pdf (printed pages 22–23 and the
referenced Tournament / Partnership Rook sections). This document records the
approved product specification; it does not describe every item as implemented.

## Implementation boundaries

Keep Family Four separate. Its established rules, low permission default on,
high initial hand choice, 2000ms configurable bot delay, and special timing paths
remain intact. Implement infrastructure only as needed, then Partnership for Six,
then separately implement and verify High Card Partner. Five-player remains
unavailable until that milestone. New banter and reactions remain deferred.

## Publisher-based profiles

Partnership for Six uses 57 cards (1–14 in four colors plus Rook), eight each,
a nine-card nest, alternating teams of three, and Tournament bidding/play.
High Card Partner uses 41 cards (5–14 plus Rook), seven each, a six-card nest,
a called partner against three opponents, and the Partnership bidding/scoring
reference. Targets: six uses the Tournament baseline of 300; five specifies 500.
Both lead from dealer's left and award the nest to the final trick winner.
Counters: 5 = 5, 10/14 = 10, Rook = 20. Other ranks have no counter value.
The publisher's Rook-anytime exception belongs to these profiles, not Family Four.

## Approved house interpretations (not claims of official rules)

- Six (approved October 27, 2026): seats remain fixed throughout the match.
  Tournament's exchange after four hands has no specified adaptation for teams
  of three. We do not rotate seats automatically; this is our digital house
  adaptation, not a claim about the publisher's six-player instructions.
- Five: retain the referenced 20-point majority-trick bonus, count it toward
  the contract, award it for at least four of seven tricks. The nest adds counters,
  not another trick. This resolves the scoring cross-reference explicitly.
- Five: each player has a continuing individual ledger. Each member receives the
  full score change of their hand-side, without division. Failed bidding partners
  each lose the full bid; each defender receives the defenders' combined score.
- Five: unique highest individual total at or above 500 wins after a full hand,
  irrespective of bidding role. A tied highest score requires another complete
  hand with all five players and normal scoring.
- Five: the called-card holder knows privately; public partnership revelation
  occurs when that card is played. Captures from the start belong to the actual
  partnership. Public state must not disclose unrevealed membership indirectly.
- Five: any card, including Rook, absent from declarer's retained hand AND buried
  nest is eligible. This guarantees a partner among the other four players.
- Five bidding: positive multiples of five, 5–140. Six bidding: 70–120 in fives.
  Both permit opening passes. If everyone passes, advance dealer clockwise and
  redeal without changing scores. All-pass convention and explicit UI caps are
  house interpretations, not additional publisher quotations.
- New profiles do not inherit family low-card, moon, face-up nest, forced opener,
  bidder-first lead, configurable target, or bidder-must-make victory settings.
  Bot pacing and graphics preferences remain configurable.

### Approved worked five-player examples

Starting from zero: A bids 90 and calls C's card. A+C capture 85 counters and
four tricks: their side earns 105, so each receives +105. B+D+E each receive +35.
Next D bids 100 and calls B's card. D+B capture 75 and three tricks: each gets
-100. A+C+E capture 45 and four tricks: each gets +65. Continuing totals are
A=170, B=-65, C=170, D=-65, E=100. Partnership changes never move old scores.
For simultaneous qualification: A at 480 and C at 470 receiving +105 finish at
585 and 575, so A wins. If both started at 480, tied 585 totals continue play.

## Lobby and help

Host selects mode before seats fill. Mode changes require no occupied seats other
than the host: other humans stand and bots are explicitly removed first. Never
silently displace occupants. Mode remains locked for the match. How to play is
available in both the pregame seating lobby and opened in-game sidebar, reflects
actual settings, and labels house interpretations separately from publisher rules.

## Approved deferred local banter/reactions

Extend the authored local system, without an external AI service. Personality-
weighted public situations, recent-line exclusion, shared and per-bot cooldowns,
bounded occasional two-line exchanges, stale-event cancellation, host controls,
and personal mute. Never delay gameplay or reveal private cards/hidden partners.
Suggested tuning: 12-second shared and 45-second per-bot cooldowns, exclude the
last 20 lines, at most three starts and one two-line exchange per hand.

Melissa's exact lines: "we are so set", "this is the worst hand i've ever had",
and "Ughh". Pessimism may follow taking the bid; selection must not reliably
encode private strength. Automated speech/tears are bot-only; humans retain control.
No new audio. Brief nonblocking cartoon tears, once at completed-hand recap, if
her side was set OR its final hand score change is lower than the other side's,
including applicable bonus/moon outcomes. Equal changes, cumulative standings,
and individual lost tricks do not trigger tears. Reduced motion uses a static
tear expression. This loss definition is our approved house interpretation.

## Release gates

At each stage: engine/socket regression tests plus rendered browser screenshots
and layout checks. Preserve four-player baseline. Cover phone portrait/landscape,
desktop, every seat orientation, 2D/Lite/High, maximum nest pickups, Last trick,
and help/sidebar. Label browser emulation separately from physical-device tests.
Six-player auto-finish remains disabled until separately proven and tested.
No commit, push, or deployment is authorized by this milestone.
