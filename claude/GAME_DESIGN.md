# Shadow Dice Gates — design notes (agreed Oct 14, 2026)

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
