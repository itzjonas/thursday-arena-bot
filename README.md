# Thursday Arena Smart Bot (Pro Edition)

A Tampermonkey userscript for [Thursday Arena](https://thursdayarena.com) featuring an automated heuristic auto-player, real-time on-screen HUD, carry-scaling strategy, and auto-upgrade selling.

[![Install Userscript](https://img.shields.io/badge/Tampermonkey-Install%20Script-brightgreen?style=for-the-badge&logo=tampermonkey)](https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js)

---

## ⚡ One-Click Installation

1. Make sure you have the [Tampermonkey Extension](https://www.tampermonkey.net/) installed in your browser.
2. Click here to install: **[👉 Direct 1-Click Install `bot.user.js`](https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js)**
3. Tampermonkey will automatically open a tab prompting: **"Install Thursday Arena Smart Bot"**. Click **Install**.
4. Navigate to [thursdayarena.com/match](https://thursdayarena.com/match). The HUD overlay will load automatically in the bottom-left corner.

---

## 🔄 Automatic Updates

This script includes `@updateURL` and `@downloadURL` metadata headers:
- Tampermonkey checks this repository periodically in the background for new versions.
- Whenever a new version is pushed to GitHub, Tampermonkey will automatically update the script in your browser.
- To check manually: Open the **Tampermonkey Dashboard** -> click the **Utilities** tab -> click **Check for userscript updates**.

---

## 🎮 Key Features

- **Interactive In-Game HUD**:
  - **Pause / Resume**: Toggle automation on/off with one click during play.
  - **Strategy Selector**: Switch between:
    - `Hyper-Carry (Top Stat)`: Funnels all food buffs into your strongest unit to snowball stats.
    - `Backline Protected`: Buffs and protects the backline unit behind tanks.
    - `Frontline Tank`: Stacks health on the front position.
  - **Auto-Upgrade Selling**: Automatically sells the weakest unit when a shop unit provides at least +3 total stats.
- **Smart Economy**: Avoids wasteful rerolls and preserves gold for unit purchases and food scaling.
- **Visual Feedback**: Displays real-time game phase, gold, board slots, carry stats, and active actions.
