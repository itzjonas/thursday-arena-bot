# Thursday Arena Smart Bot (Grandmaster Edition) v5.0

A high-performance Tampermonkey userscript for [Thursday Arena](https://thursdayarena.com) powered by Super Auto Pets (SAP) combat meta modeling, React Fiber direct dispatch, auto-seating heuristics, anti-churn economics, and instant battle skipping.

[![Install Userscript](https://img.shields.io/badge/Tampermonkey-Install%20v5.0-brightgreen?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js)

---

## ⚡ 1-Click Installation & Updates

1. Install the [Tampermonkey Extension](https://www.tampermonkey.net/) in your browser.
2. Click here to install: **[👉 Direct 1-Click Install `bot.user.js`](https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js)**
3. Tampermonkey will prompt: **"Install Thursday Arena Smart Bot (Grandmaster Edition)"**. Click **Install**.
4. Go to [thursdayarena.com/match](https://thursdayarena.com/match). The v5.0 HUD will load automatically.
5. Whenever changes are pushed to GitHub, Tampermonkey automatically updates the script via `@updateURL`.

---

## 🧠 What Makes v5.0 Smarter & Faster

### 1. ⚡ Direct React Fiber Dispatch & State Bridge
* **Zero-Lag Execution**: Hooks into the game's internal React Fiber tree (`data-scene`) to read state directly (`state.board`, `state.shop.pets`, `state.gold`, `state.phase`).
* **Direct Action Dispatching**: Dispatches game actions (`buy`, `feed`, `sell`, `move`, `reroll`, `endShop`, `battleDone`, `restart`) instantly without relying on slow artificial delays, with seamless DOM click fallbacks.

### 2. 🏆 Solved SAP Meta Tier System
* Evaluates bots using simulated expected value (EV) based on archetype mechanics:
  * **S-Tier (Compounding Growth)**: `grow` (Boar), `echo` (Kangaroo), `flamingo` (Flamingo), `peacock` (Peacock), `hype` (Moth), `bulk` (Mammoth), `cover` (Ox), `snowball` (Hippo), `spotlight` (Goose), `last_word` (Crocodile).
  * **Trash Tier Avoidance**: Filters out low-EV snipers (`mosquito`, `sidestep`, `pin`, `backtap`) and self-harm units.

### 3. 🛡️ Optimal Seating & Auto-Repositioning
* Automatically rearranges units on the board:
  * **Seat 0 (Front)**: Faint buffers (`flamingo`, `dump`) die first to trigger backline buffs, or high-HP tanks.
  * **Seat 1 (Middle)**: Damage-sponges (`peacock`, `sting`) and trigger-followers (`echo`, `wake`).
  * **Seat 2 (Back)**: Forward-buffing support (`hype`, `dodo`) and backline snipers (`last_word`).

### 4. 💰 Anti-Churn Gold Economy
* **Gold Resets Every Round**: Never bank gold—unspent gold is completely lost. Excess gold is used for food scaling and strategic rerolls.
* **Anti-Churn Invariant**: Units bought in the current round are locked from being sold, preventing wasteful gold cycling.
* **Smart Upgrades**: Sells a unit only when an incoming shop unit offers a decisive net advantage.

### 5. ⏩ Instant Combat Skip & Auto-Requeue
* Detects combat scenes and immediately triggers `Skip` + `Continue` / `battleDone`, turning 15-second battle animations into ~150ms instant transitions.
* Automatically triggers `onReplay()` / `Play again` upon match completion.
