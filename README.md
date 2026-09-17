# Thursday Arena Smart Bot

A Tampermonkey userscript for [Thursday Arena](https://thursdayarena.com) featuring an automated heuristic player and a real-time on-screen debug overlay.

## Features

- **Live HUD / Debug Overlay**: Displays bot state (status, current phase, gold, board unit count, shop unit/food counts, and last executed action) directly in the bottom-left corner.
- **Smart Shop Phase Automation**:
  - Automatically buys and fills up board slots with the highest combined stat units (ATK + HP).
  - Automatically feeds the frontline unit with food buffs when the board is full.
  - Automatically rerolls the shop when surplus gold exists.
  - Confirms unit purchases and transitions into combat when ready.
- **Non-blocking Loop**: Configurable action delays and turn execution cycles.

## Installation

1. Install the [Tampermonkey](https://www.tampermonkey.net/) extension for Chrome/Firefox/Edge/Brave.
2. In Tampermonkey, click **Create a new script**.
3. Paste the contents of [`bot.user.js`](./bot.user.js) into the editor.
4. Save the script (`Cmd+S` or `Ctrl+S`).
5. Navigate to `https://thursdayarena.com/match` to start playing with the bot overlay active.
