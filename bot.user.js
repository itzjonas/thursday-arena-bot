// ==UserScript==
// @name         Thursday Arena Smart Bot (Pro Edition)
// @namespace    https://github.com/itzjonas/thursday-arena-bot
// @version      4.0.1
// @description  Advanced heuristic auto-player with smart carry targeting, auto-sell upgrades, economy management, and interactive HUD.
// @author       itzjonas
// @match        https://thursdayarena.com/match*
// @updateURL    https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js
// @downloadURL  https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- BOT CONFIGURATION ---
    const CONFIG = {
        actionDelay: 750,
        loopInterval: 1800,
        enableAutoSellUpgrade: true,
        upgradeStatThreshold: 3, // Only sell if shop unit has at least +3 total stats over weakest board unit
        carryStrategy: 'highest-stat', // 'highest-stat', 'backline', 'frontline'
        econSmartReroll: true, // Don't burn gold down to 1 or 2 if we could buy next
        paused: false
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- INTERACTIVE OVERLAY SETUP ---
    const overlay = document.createElement('div');
    overlay.id = 'ta-bot-hud';
    overlay.style.cssText = `
        position: fixed; bottom: 12px; left: 12px; width: 320px;
        background: rgba(12, 16, 24, 0.94); color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px; padding: 14px; border-radius: 8px; z-index: 999999;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7); border: 1px solid rgba(56, 189, 248, 0.35);
        backdrop-filter: blur(8px); line-height: 1.5; user-select: none;
    `;
    document.body.appendChild(overlay);

    function renderOverlay(state, actionText) {
        const carryLabel = state.carryUnit 
            ? `#${state.carryUnit.index + 1} (${state.carryUnit.stats.atk}/${state.carryUnit.stats.hp})`
            : 'None';

        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
                <span style="font-weight: 700; color: #38bdf8; font-size: 12px;">⚔️ THURSDAY ARENA BOT v4.0.1</span>
                <button id="ta-toggle-pause" style="
                    background: ${CONFIG.paused ? '#dc2626' : '#16a34a'}; color: white; border: none;
                    padding: 3px 8px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 10px;
                ">${CONFIG.paused ? '▶ RESUME' : '⏸ PAUSE'}</button>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px;">
                <div><span style="color:#94a3b8;">Status:</span> <strong style="color:${CONFIG.paused ? '#f87171' : '#4ade80'};">${CONFIG.paused ? 'PAUSED' : 'ACTIVE'}</strong></div>
                <div><span style="color:#94a3b8;">Phase:</span> <strong style="color:white;">${state.isShopPhase ? 'Shop' : 'Combat'}</strong></div>
                <div><span style="color:#94a3b8;">Gold:</span> <strong style="color:#facc15;">${state.gold}</strong></div>
                <div><span style="color:#94a3b8;">Board:</span> <strong style="color:white;">${state.boardCount}/3</strong></div>
                <div><span style="color:#94a3b8;">Carry Unit:</span> <strong style="color:#a855f7;">${carryLabel}</strong></div>
                <div><span style="color:#94a3b8;">Shop:</span> ${state.shop.units.length}u / ${state.shop.food.length}f</div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 4px; padding: 6px; margin-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <span style="color:#94a3b8; font-size:10px;">Strategy:</span>
                    <select id="ta-strategy-select" style="background:#1e293b; color:#38bdf8; border:1px solid #475569; border-radius:3px; font-size:10px; padding:1px 4px; cursor:pointer;">
                        <option value="highest-stat" ${CONFIG.carryStrategy === 'highest-stat' ? 'selected' : ''}>Hyper-Carry (Top Stat)</option>
                        <option value="backline" ${CONFIG.carryStrategy === 'backline' ? 'selected' : ''}>Backline Protected</option>
                        <option value="frontline" ${CONFIG.carryStrategy === 'frontline' ? 'selected' : ''}>Frontline Tank</option>
                    </select>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#94a3b8; font-size:10px;">Auto-Upgrade:</span>
                    <button id="ta-toggle-upgrade" style="background:${CONFIG.enableAutoSellUpgrade ? '#0284c7' : '#475569'}; color:white; border:none; border-radius:3px; font-size:9px; padding:2px 6px; cursor:pointer;">
                        ${CONFIG.enableAutoSellUpgrade ? 'ON (+3 Stat Min)' : 'OFF'}
                    </button>
                </div>
            </div>

            <div style="font-size: 11px; color: #cbd5e1; border-top: 1px dashed #334155; padding-top: 6px;">
                <span style="color:#fbbf24;">Action:</span> <span style="color:#f1f5f9;">${actionText}</span>
            </div>
        `;

        // Bind interactive handlers
        const pauseBtn = document.getElementById('ta-toggle-pause');
        if (pauseBtn) {
            pauseBtn.onclick = (e) => {
                e.stopPropagation();
                CONFIG.paused = !CONFIG.paused;
                renderOverlay(state, CONFIG.paused ? "Paused by user" : "Resumed");
            };
        }

        const stratSelect = document.getElementById('ta-strategy-select');
        if (stratSelect) {
            stratSelect.onchange = (e) => {
                CONFIG.carryStrategy = e.target.value;
                renderOverlay(state, `Strategy changed to ${e.target.value}`);
            };
        }

        const upgradeBtn = document.getElementById('ta-toggle-upgrade');
        if (upgradeBtn) {
            upgradeBtn.onclick = (e) => {
                e.stopPropagation();
                CONFIG.enableAutoSellUpgrade = !CONFIG.enableAutoSellUpgrade;
                renderOverlay(state, `Auto-Upgrade toggled ${CONFIG.enableAutoSellUpgrade ? 'ON' : 'OFF'}`);
            };
        }
    }

    // --- DOM HELPERS ---
    const getElByText = (selector, text) => {
        return Array.from(document.querySelectorAll(selector))
            .find(el => el.textContent.toLowerCase().includes(text.toLowerCase()) && !el.disabled);
    };

    const parseStats = (text) => {
        const atkMatch = text.match(/ATK\s*(\d+)/i) || text.match(/(\d+)\s*⚔️/);
        const hpMatch = text.match(/HP\s*(\d+)/i) || text.match(/(\d+)\s*❤️/);
        const atk = atkMatch ? parseInt(atkMatch[1]) : 0;
        const hp = hpMatch ? parseInt(hpMatch[1]) : 0;
        return { atk, hp, total: atk + hp };
    };

    // --- STATE PARSER ---
    function getGameState() {
        const fightBtn = getElByText('button, div[role="button"]', 'fight round');
        const buyBtn = getElByText('button, div[role="button"]', 'Buy');
        const useBtn = getElByText('button, div[role="button"]', 'USE ON A BOT') || getElByText('button, div[role="button"]', 'FEED');
        const rerollBtn = getElByText('button, div[role="button"]', 'Reroll');
        
        let gold = 0;
        const goldEl = getElByText('*', 'gold');
        if (goldEl) {
            const match = goldEl.textContent.match(/(\d+)\s*gold/i);
            if (match) gold = parseInt(match[1]);
        }

        // Board Parsing
        const sellButtons = Array.from(document.querySelectorAll('button, div')).filter(el => el.textContent.trim() === 'Sell');
        const boardUnits = sellButtons.map((sellBtn, index) => {
            const container = sellBtn.closest('div[class*="unit"], div[class*="card"], div') || sellBtn.parentElement;
            const text = container ? container.textContent : '';
            return {
                index,
                sellBtn,
                container,
                stats: parseStats(text)
            };
        });

        // Determine designated carry unit
        let carryUnit = null;
        if (boardUnits.length > 0) {
            if (CONFIG.carryStrategy === 'frontline') {
                carryUnit = boardUnits[0];
            } else if (CONFIG.carryStrategy === 'backline') {
                carryUnit = boardUnits[boardUnits.length - 1];
            } else {
                // 'highest-stat' hyper carry
                carryUnit = [...boardUnits].sort((a, b) => b.stats.total - a.stats.total)[0];
            }
        }

        // Weakest unit on board for potential sell replacement
        const weakestUnit = boardUnits.length > 0 
            ? [...boardUnits].sort((a, b) => a.stats.total - b.stats.total)[0] 
            : null;

        // Shop Parsing
        const allCards = Array.from(document.querySelectorAll('div'))
            .filter(el => el.textContent.length > 15 && (el.textContent.includes('ATK') || el.textContent.includes('FOOD') || el.textContent.includes('🍎')));
        
        const shopCardsRaw = allCards.filter(card => !card.textContent.includes('Sell') && !card.textContent.includes('YOUR LINE'));
        const foodCards = shopCardsRaw.filter(c => c.textContent.includes('FOOD') || c.textContent.includes('🍎'));
        const unitCards = shopCardsRaw
            .filter(c => !foodCards.includes(c))
            .map(cardEl => ({ element: cardEl, stats: parseStats(cardEl.textContent) }))
            .sort((a, b) => b.stats.total - a.stats.total);

        return {
            isShopPhase: !!(fightBtn && !fightBtn.disabled),
            buttons: { fight: fightBtn, buy: buyBtn, use: useBtn, reroll: rerollBtn },
            gold,
            boardCount: boardUnits.length,
            boardUnits,
            carryUnit,
            weakestUnit,
            shop: { food: foodCards, units: unitCards }
        };
    }

    // --- STRATEGIC ENGINE ---
    async function executeTurn() {
        const state = getGameState();

        if (CONFIG.paused) {
            return;
        }

        if (!state.isShopPhase) {
            renderOverlay(state, "Waiting for combat to conclude...");
            return;
        }

        // 1. Confirm pending 'BUY' modal if open
        if (state.buttons.buy && state.gold >= 3) {
            renderOverlay(state, "Confirming purchase ('Buy')...");
            state.buttons.buy.click();
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 2. Feed the designated carry with food
        if (state.buttons.use && state.carryUnit && state.gold >= 3) {
            renderOverlay(state, `Feeding carry unit #${state.carryUnit.index + 1}...`);
            state.buttons.use.click();
            await sleep(400);
            if (state.carryUnit.container) {
                state.carryUnit.container.click();
            }
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 3. Fill empty board slots first (up to 3 units)
        if (state.boardCount < 3 && state.gold >= 3 && state.shop.units.length > 0) {
            const bestUnit = state.shop.units[0];
            renderOverlay(state, `Recruiting unit with ${bestUnit.stats.total} stats (${bestUnit.stats.atk}/${bestUnit.stats.hp})...`);
            bestUnit.element.click();
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 4. Smart Upgrade: Sell weakest board unit if shop has a significantly superior unit
        if (CONFIG.enableAutoSellUpgrade && state.boardCount === 3 && state.gold >= 3 && state.shop.units.length > 0 && state.weakestUnit) {
            const bestShopUnit = state.shop.units[0];
            const statDifference = bestShopUnit.stats.total - state.weakestUnit.stats.total;

            if (statDifference >= CONFIG.upgradeStatThreshold) {
                renderOverlay(state, `Selling unit #${state.weakestUnit.index + 1} (${state.weakestUnit.stats.total} stats) for shop unit (+${statDifference} stats)...`);
                state.weakestUnit.sellBtn.click();
                await sleep(CONFIG.actionDelay);
                return;
            }
        }

        // 5. Board is full: Prioritize buying food buffs for the carry
        if (state.boardCount === 3 && state.gold >= 3 && state.shop.food.length > 0) {
            renderOverlay(state, `Buffing carry: Selecting food item...`);
            state.shop.food[0].click();
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 6. Strategic Reroll
        if (state.buttons.reroll && state.gold > 0) {
            const shouldReroll = !CONFIG.econSmartReroll || state.gold >= 4 || state.gold === 1;
            if (shouldReroll) {
                renderOverlay(state, `Rolling shop for upgrades (Gold: ${state.gold})...`);
                state.buttons.reroll.click();
                await sleep(CONFIG.actionDelay);
                return;
            }
        }

        // 7. All actions complete: Start Fight
        if (state.buttons.fight) {
            renderOverlay(state, "Board optimal. Starting combat!");
            state.buttons.fight.click();
        }
    }

    renderOverlay({
        isShopPhase: false,
        gold: 0,
        boardCount: 0,
        carryUnit: null,
        shop: { units: [], food: [] }
    }, "Initializing Strategic Engine...");

    setInterval(async () => {
        try {
            await executeTurn();
        } catch (error) {
            console.error("[Bot Error]", error);
            renderOverlay(getGameState(), `Error: ${error.message}`);
        }
    }, CONFIG.loopInterval);

})();
