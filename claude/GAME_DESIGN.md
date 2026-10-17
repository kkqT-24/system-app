# Shadow Dice Gates — design notes (agreed Oct 14, 2026)

> **Round 7 (bottom of this file) replaces the gameplay.** The game is now a survivors-like
> action roguelite (Survivor.io-style). The dice, lanes and turn-based combat in rounds 2–5 are
> kept below as history only. Still in force: the core rule, keys, key fusion, losing a keyed run,
> gate scouting, cosmetics, friends as bosses, and the Hunter evolving with real rank.

## Core rule
Play is unlimited; **loot only comes from keys, and keys only come from real-life effort.**

## Modes
- **Training Grounds** — free, unlimited runs. Small rewards only, no extraction.
- **Keyed Gates** — spend a key: boss, extraction, rare drops.

## Keys
| Earned by | Key |
|---|---|
| Any daily quest | E |
| Every 25 workout reps | 1 shard (5 shards = D) |
| All dailies cleared | D + bonus chest |
| Any weekly quest | C |
| All weeklies | B |
| Secret quest fulfilled | Red (no retreat, big loot) |
| Every 5 cleared days (total, never resets) | A |
| Level up | Random key (rank skews higher with level) |
| Rank up | S (Monarch gate) |
- **Key fusion:** combine lower keys into a higher one once they pile up (e.g. 3 → next rank).
- Missing a day pauses progress; nothing resets. Streaks only add bonus shards.

## Gameplay (Dicero-style dice roguelite + tower defense)
- Your owned shadows are your dice faces; bigger/stronger army = better dice.
- Roll + rerolls each turn; combos trigger shadows (pair of Knights = shield wall, 3 Archers = volley, straight = all classes, 5 of a kind = Monarch ultimate).
- Monsters march down lanes; triggered shadows hold positions as defenders.
- Between waves: pick 1 of 3 skill cards (roguelike build).
- Gate ends in a boss → 3 ARISE extraction rolls (higher dice = better odds).
- Difficulty set by key rank — no endless grind wall (Dicero's flaw).
- Workout mana: base mana always full; today's workout adds a bonus (extra reroll / stronger ultimate). Never punishing.
- Habits shape extraction odds (STR weeks → Knights/Berserkers, INT weeks → Mages).
- Shadows level from raids and rank up Soldier → Elite → Knight → Commander → Marshal; real level caps squad size.
- Monarchs: special gates/bosses; once owned they become legendary die faces.

## Rewards
Shadow evolutions (duplicates → named elites, new die face + model), relics (per-shadow gear),
expanding skill-card pool, dice/board skins, Codex completion rewards, titles, achievements,
weekly multi-run boss, mana crystals (upgrades / pre-run rerolls).

## Art direction
Detailed **2D pixel art, Dicero-style, with Solo Leveling designs** — animated idles/attacks,
distinct evolved looks, cool effects and skins. No 3D needed for the game.

## Build order
1. Playable Training Grounds gate: dice, lanes, a few cards, one boss.
2. Key economy + keyed gates + extraction.
3. Rewards layer (evolutions, relics, skins, codex, titles).

## Decisions (Oct 14, 2026 — round 2)
1. **Turn-based**, Dicero-style: monsters advance one step per finished roll.
2. **Dice ↔ shadows — still open.** Leading option: each die *is* one shadow in your squad
   (bring 5 = 5 dice). Dice roll numbers for Dicero poker combos (pair, straight, 5-of-a-kind
   multipliers); each die's class decides what its number does (Knight blocks, Archer hits the
   lane, Mage splashes) and a special face triggers that shadow's ability. Upgrades/evolutions
   improve faces. Alternative: class-icon faces.
3. **Lanes — still open.** Leading option: one Dicero-style lane with 3 positions (front / mid /
   back) for placement; higher gate ranks add a flank lane.
4. Run length: E 5 waves+boss (~5 min), C 7 (~8), A 10 (~12), Red 12 + tougher boss (~15).
5. Losing a keyed run: lose the key, keep half the loot. Red Gate: lose everything.
6. Extraction: 3 ARISE rolls vs a target total (harder for stronger bosses); **your rank adds a
   bonus**, cards/relics can too.
7. **Clean reset at launch.** You start with **yourself (the Hunter)** plus one starter shadow.
   The Hunter's stats come from the real Status screen (VIT → gate HP, STR → damage, INT → mana,
   AGI → rerolls, PER → crit/extraction). The Hunter has its own die and the mana ultimate.
8. Key fusion: 3 of a rank → 1 of the next.

## Decisions — round 3
- **Each die is a shadow** in your 5-slot squad (+ the Hunter's own die). Dice roll numbers for
  Dicero combos; the class decides the attack pattern. No pure blocking — every class deals damage.
- **Class attack patterns (3-lane board):**
  Knight — heavy single hit on the front enemy in its lane + knockback (push back a step) ·
  Archer — pierce: hits every enemy in its lane ·
  Mage — splash: target + neighbours in adjacent lanes ·
  Lancer — sweep: hits the front enemy in all 3 lanes ·
  Assassin — execute: hits the lowest-HP enemy anywhere, x2 under 50% HP ·
  Berserker — damage grows every turn it's rolled in a run (ramps) ·
  Bulwark — shockwave: small damage to its lane + stun 1 turn ·
  Healer — heals the gate and adds +1 to every other die this turn (combo enabler).
- **Special dice / faces (upgrade path):** Wild (counts as any number), Twin (duplicate numbers →
  easier pairs), Weighted (high faces), Crit ★ (triggers class special), Elemental (burn / frost /
  shadow status), Monarch dice (wild + legendary special). Upgrading/evolving = adding or
  replacing faces.
- **Lanes:** 3 lanes. Each shadow is posted to a lane before the run; after locking a roll you can
  tap a die to move it to another lane before it fires. Flank/boss mechanics later.
- **The Hunter evolves with real rank** (E rags → D leathers → C plate → B shadow cloak →
  A crimson knight → S Monarch form); each rank unlocks a Hunter skill. **Gear slots:** weapon,
  armor, accessory — loot with rarity (common → legendary), changes the Hunter's die faces and
  passives, visible on the sprite.

## Scaling (round 4)
- **Squad grows with real level:** start with 3 dice (Hunter + starter Knight + 1 generic soldier
  die); +1 shadow slot at Lv 10 / 20 / 30 → max 6 dice (Hunter + 5).
- **Lanes grow with gate rank:** E = 1 lane (pure Dicero), D–C = 2 lanes, B and up = 3 lanes.
- **The Hunter roams:** not tied to a lane; can target any lane each turn.
- **Threat budget per wave** = gate-rank base + wave × growth, spent on monster types. Keyed
  gates are fixed by rank (getting stronger *feels* stronger); Training Grounds auto-scales to
  your squad power.
- **Monster roles force class choices:** Shielded (front armour — needs pierce/knockback),
  Swarm (many weak — splash/sweep), Brute (huge HP — Berserker/Assassin), Flier (skips the front
  line, lands on the gate — Archer/Lancer), Lane-jumper (switches lanes), Shaman (heals others
  from the back — Archer pierce/Assassin). Waves surge unevenly so you redistribute dice.
- Combo multiplier is global (applies to every die that turn).

## Round 5
- **Gate scouting:** before entering, a gate card shows its rank, lanes, wave count, every monster
  type inside (with role icons), the boss and its extraction difficulty, and possible drops. You
  build your squad from that screen.
- **Cosmetic gear:** separate cosmetic slots (outfit, weapon skin, aura, dice skin, gate theme)
  layered over real gear stats — wear the look you want with the stats you need.
- **Art first:** settle the visual style on a style board (same Knight in a few pixel styles),
  then a design sheet (Hunter by rank, the 8 classes, monsters, dice, UI) before building.

## Round 6 — friends as legends
- No characters from existing anime (recognizable = theirs; generic = pointless). Instead:
- **Friends as Named Bosses → shadows.** Each friend becomes a unique named gate boss with their
  own pixel design, signature ability and special die face; beat them and ARISE them onto your team.
- Per friend we need: name/nickname, look (hair, build, style, signature item), personality,
  the class/power that fits them, and an iconic quirk or inside joke for their ability.

## Round 7 — survivors-like rethink (Oct 14, 2026)
**Why:** the dice/lane/turn-based versions needed custom character art we can't make at the
quality wanted. The things that matter most are **the army, the payoff and the Hunter** — combat
is the vehicle. Survivors-likes deliver all three, are quick or long, and have the easiest art.

**Platform:** phone first (portrait, one-thumb virtual joystick); PC optional (WASD).
**Art:** top-down survivors-style sprites from a bought pack; shadows = recolored monsters
(near-black, glowing eyes, rank aura). Just for personal use for now — AI-generated art is fine
for portraits/forms; replace everything with licensed art if it's ever released.

### The run (a gate)
- Steer the Hunter; attacks fire automatically. Waves of monsters, elites, then a boss.
- Kills drop XP → each level-up: pick **1 of 3** skills (Hunter skills + passives).
  Skill + matching passive **evolves** into an ultimate (Survivor.io-style).
- **Mid-run ARISE:** elites/mini-bosses can rise and fight with you for the rest of the run.
- **Boss ARISE (keyed gates only):** extraction roll — success adds that shadow to the permanent army.
- Lengths: Training Grounds ~5 min · E–C gates 8–12 min · A / Red gates 15–20 min.

### Shadows (feel over power)
- Shadows are there for the **feel** — a growing horde around you — not to carry the run.
  The Hunter's build does the heavy lifting.
- Each shadow has a small attack; **higher rarity/rank adds a little AoE or a special buff**
  (e.g. aura that slows, small heal, crit buff). Rank aura grows Soldier → Marshal.
- Bring a squad of permanent shadows into each run; they follow and auto-fight.
- **Churn:** low ranks have low HP and die fast; you keep ARISE-ing fallen enemies as you fight
  to replace them. The army is always moving, never a wall you watch. Capped by shadow slots
  (grow with real level) so the screen stays readable. A permanent shadow that falls mid-run is
  back for the next run — no permadeath.
- **Squad synergies:** class combos unlock bonuses (e.g. 3 Knights → shield aura,
  Archer + Mage → burning arrows). Gives collecting a purpose without shadows carrying the run.
- **Strong top end:** **Marshals** — big AoE on a long cooldown. **Monarchs** — a unique special
  each (their signature move).

### Luck (replaces the dice)
Extraction rolls (rank + PER improve odds) · chest roulette · gear rarity rolls · crits ·
random mid-run **System quests** ("kill 150 in 30s" → bonus chest) · gate modifiers shown on
the scouting card ("Elites ×2, better loot").

### Real life → game (unchanged core)
- Keys from quests/workouts (key table above) open **Keyed Gates** — the only source of real
  loot and permanent shadows. **Training Grounds** stay free and unlimited with small rewards.
- Real Status sets the Hunter's base: VIT → HP · STR → damage · AGI → move speed ·
  INT → cooldowns · PER → crit, pickup range, extraction luck. Today's workout = bonus for the day.

### Between runs
- Gear: weapon (sets the basic attack), armor, accessory — rarity tiers.
- **Skill unlocks (rare loot):** new attacks found in keyed gates are added to the level-up pool,
  so they can be drawn in future runs. The pool grows with your real-life effort.
- Permanent army: level, rank up, evolve duplicates into named elites.
- Hunter rank forms E → S (Monarch). Cosmetics, codex, titles as in round 5.

### Idle raids (lazy mode)
Spend a key to send the army on a raid; collect when done. Same keys, **lower loot odds** than
playing it yourself.

### Open
- Exact skill list and evolutions · monster roster by role · which sprite pack ·
  how many shadows on screen before it gets messy · keyed-gate boss list (incl. friends).

## Round 8 (Oct 15, 2026): rewards rethink, Kingdom Rush-style roguelike TD
- The survivors-like prototype wasn't polished enough to want to play. New direction, not built yet:
  a Kingdom Rush-style roguelike tower defense (fixed roads, build spots hold shadow squads, the Hunter as the hero).
- Posts hold a squad type, capped by how many shadows of that role you've extracted; extras are reserves that reform fallen units. Cap visible units per post.
- Tower floors with infinite scaling; floors scale a little faster than you, so there's always a wall. Early floors simple and low reward.
- Idle expeditions as a secondary mode: send a squad, come back to loot and an ARISE roll on the boss (random stats, chance at a stronger variant). Random stats matter in the idle mode only; one shared army across modes.
- A few small app upgrades as real rank rises.
- Art: Muse's pixel shadow knight is archived in `game/shadow-knight/`. For now the Hunter uses a line-art placeholder (`hunterFigure()` in v2.js, `window.MXHunterFigure`), and the existing line-art shadows stay as placeholders.
- Asset-pack candidate for enemies and maps: Free Game Assets (CraftPix) Tower Defense bundle on itch.io.

## Round 9 (Oct 16, 2026): first playable TD (test build)
Test page: `claude/game/td/` (not linked from the app yet). All art is code-drawn for now.
- **Floor** = one winding road from a blue gate to your seal, 6 rune build spots, 10 waves, wave 10 brings a named gate boss.
  Waves overlap Kingdom Rush-style: the next one counts down once the last is fully out; calling it early pays mana.
- **Posts** (3 levels each): Vanguard Rift (shadow knights block the road), Ranger Spire (fast, hits fliers),
  Arcane Obelisk (magic, ignores armor, splash at Lv3). Post caps per type come from the real army in `systemApp.v2`
  (Vanguard ← Knight/Bulwark/Berserker/Lancer, Ranger ← Archer/Assassin, Arcane ← Mage/Healer, a Monarch adds 1 to each, min 1).
  Vanguard knights use your actual classes. Pause menu has an "ignore army caps" test toggle.
- **Enemies**: Ghoul (fast), Orc Brute, Stone Golem (armored → Arcane), Gate Bat (flier), Red Cultist (magic-resistant → Rangers), boss (stomps).
- **Hunter**: tap the road to move; melee blocks one enemy, throws daggers at fliers, respawns in 12s.
  **Dagger Rush** (14s): dash to a tapped point, cutting everything on the line. **ARISE** (32s): the last 5 corpses rise as
  shadow versions of themselves for 18s.
- **Climb**: clear a floor → the boss's shadow is extracted (random class, tier odds improve with floor) → pick 1 of 3 boons
  → next floor (+17% HP per floor). Gate integrity carries over (+4 per clear); losing ends the climb. Best floor is saved (`systemTD.v1`).
- Core rule still applies once it's hooked up: extractions only count toward the real army on **keyed** climbs; free climbs are practice.
- Test-build extractions stay in the climb log and are NOT written to the app army.

### Parked idea (Oct 16, 2026): random gates mid-floor
On higher floors, small gates tear open at random spots on the map during a wave (like gate breaks in the show).
- A warning glow and short countdown before it opens, so you can react.
- It releases a small pack straight onto the nearest stretch of road, which can skip past your front-line posts.
- The Hunter can close it early by standing in it or hitting it before it fully opens, for bonus mana and ARISE corpses.
- Starts around floor 5+, gets more frequent higher up. A rare red variant could bring a mini-boss.

## Round 10 (Oct 17, 2026): puzzle direction — Shadow Runes (match-3 battle)
The TD felt "not terrible but needs a lot of refinement," so it's parked (`claude/game/td/` stays as is).
Trying a match-3 battle instead, since puzzle visuals (glowing runes, effects) are where code-drawn art can look finished.
Test page: `claude/game/puzzle/`.
- 7×6 board, five rune colors, each powering one squad member: **Blade** (Vanguard, heavy single hit), **Arrow** (Ranger, hit + splash),
  **Arcane** (Mage, hits all), **Mend** (Healer, heals), **Ward** (Bulwark, shield, capped at 30% max HP).
- Swipe (or tap-tap) to swap; invalid swaps bounce back. Cascades build a combo multiplier.
- Specials: match 4 → **Line rune** (clears its row/column), L/T → **Burst rune** (3×3), match 5 → **Monarch rune** (swap it to wipe a color).
- Monsters show a turn counter and strike when it hits 0; tap one to focus it. Weak/resist tags (▲/▼ in the rune's color).
- **ARISE** meter fills from runes and combos; firing it hits every monster with the whole army and heals 15%.
- Floor = 3 waves (last is the named boss). Clear → boss extraction → pick 1 of 3 boons → next floor (+22% HP, +13% attack per floor).
- Squad levels come from the real army in `systemApp.v2` (Lv = 1 + shadows of that role, max 10); no army → Lv3 test squad.
- Bot sim (greedy best-move): floors 1–2 easy, real pressure from 3–4, runs end around floor 6–10.
