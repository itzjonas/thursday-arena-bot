// ==UserScript==
// @name         Thursday Arena Smart Bot (Pro Edition)
// @namespace    https://github.com/itzjonas/thursday-arena-bot
// @version      4.1.0
// @description  Advanced heuristic auto-player with robust card targeting, two-step feeding, and HUD.
// @author       itzjonas
// @match        https://thursdayarena.com/match*
// @updateURL    https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js
// @downloadURL  https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION ---
    const CONFIG = {
        actionDelay: 850,
        loopInterval: 2000,
        enableAutoSellUpgrade: true,
        upgradeStatThreshold: 3,
        carryStrategy: 'highest-stat', // 'highest-stat', 'backline', 'frontline'
        econSmartReroll: true,
        paused: false
    };

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- SYNTHETIC CLICK HELPER ---
    // Dispatches full pointer and mouse event sequence to ensure React/framework synthetic handlers fire
    function triggerClick(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const clientX = rect.left + rect.width / 2;
        const clientY = rect.top + rect.height / 2;
        const eventInit = { bubbles: true, cancelable: true, view: window, clientX, clientY };

        element.dispatchEvent(new PointerEvent('pointerdown', eventInit));
        element.dispatchEvent(new MouseEvent('mousedown', eventInit));
        element.dispatchEvent(new PointerEvent('pointerup', eventInit));
        element.dispatchEvent(new MouseEvent('mouseup', eventInit));
        element.click();
    }

    // --- HUD OVERLAY ---
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
                <span style="font-weight: 700; color: #38bdf8; font-size: 12px;">⚔️ THURSDAY ARENA BOT v4.1.0</span>
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

        const pauseBtn = document.getElementById('ta-toggle-pause');
        if (pauseBtn) {
            pauseBtn.onclick = (e) => {
                e.stopPropagation();
                CONFIG.paused = !CONFIG.paused;
                renderOverlay(state, CONFIG.paused ? "Paused" : "Resumed");
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
            .find(el => el.textContent.trim().toLowerCase().includes(text.toLowerCase()) && !el.disabled);
    };

    const parseStats = (text) => {
        const atkMatch = text.match(/ATK\s*(\d+)/i) || text.match(/(\d+)\s*⚔️/) || text.match(/ATK\n*(\d+)/i);
        const hpMatch = text.match(/HP\s*(\d+)/i) || text.match(/(\d+)\s*❤️/) || text.match(/HP\n*(\d+)/i);
        
        let atk = atkMatch ? parseInt(atkMatch[1]) : 0;
        let hp = hpMatch ? parseInt(hpMatch[1]) : 0;

        // Fallback: search for numbers near ATK/HP if regex didn't catch due to formatting
        if (atk === 0 || hp === 0) {
            const rawNumbers = text.match(/\b\d+\b/g);
            if (rawNumbers && rawNumbers.length >= 2) {
                // Often the first two discrete numbers in a unit card are ATK and HP
                if (atk === 0) atk = parseInt(rawNumbers[0]) || 0;
                if (hp === 0) hp = parseInt(rawNumbers[1]) || 0;
            }
        }

        return { atk, hp, total: atk + hp };
    };

    // Find the real board card element above a Sell button
    function getCardElementForSellButton(sellBtn) {
        // Look upwards for the column/container that holds both the unit card and the sell button
        let current = sellBtn.parentElement;
        for (let i = 0; i < 5 && current; i++) {
            // Find any sibling or child card above the sell button
            const candidate = current.querySelector('div[class*="card"], div[class*="unit"], div[style*="cursor"]');
            if (candidate && candidate !== sellBtn) {
                return candidate;
            }
            // If the element has substantial height and isn't just the button bar
            if (current.offsetHeight > 100) {
                return current;
            }
            current = current.parentElement;
        }
        return sellBtn.parentElement;
    }

    // --- STATE PARSER ---
    function getGameState() {
        const fightBtn = getElByText('button, div[role="button"]', 'fight');
        const buyBtn = getElByText('button, div[role="button"]', 'buy');
        const useBtn = getElByText('button, div[role="button"]', 'use on a bot') 
            || getElByText('button, div[role="button"]', 'use 3g')
            || getElByText('button, div[role="button"]', 'use')
            || getElByText('button, div[role="button"]', 'feed');
        const rerollBtn = getElByText('button, div[role="button"]', 'reroll');
        
        // Extract gold count
        let gold = 0;
        const goldEl = getElByText('*', 'gold');
        if (goldEl) {
            const match = goldEl.textContent.match(/(\d+)\s*gold/i);
            if (match) {
                gold = parseInt(match[1]);
            } else {
                const nums = goldEl.textContent.match(/\d+/);
                if (nums) gold = parseInt(nums[0]);
            }
        }

        // Board Units (Look for "Sell" buttons in "YOUR LINE")
        const sellButtons = Array.from(document.querySelectorAll('button, div[role="button"], div'))
            .filter(el => el.textContent.trim() === 'Sell');

        const boardUnits = sellButtons.map((sellBtn, index) => {
            const cardElement = getCardElementForSellButton(sellBtn);
            const text = cardElement ? cardElement.textContent : '';
            return {
                index,
                sellBtn,
                cardElement,
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
                carryUnit = [...boardUnits].sort((a, b) => b.stats.total - a.stats.total)[0];
            }
        }

        const weakestUnit = boardUnits.length > 0 
            ? [...boardUnits].sort((a, b) => a.stats.total - b.stats.total)[0] 
            : null;

        // Shop Cards
        const allCards = Array.from(document.querySelectorAll('div'))
            .filter(el => el.textContent.length > 15 && (el.textContent.includes('ATK') || el.textContent.includes('FOOD') || el.textContent.includes('APPLE') || el.textContent.includes('🍎')));
        
        const shopCardsRaw = allCards.filter(card => 
            !card.textContent.includes('Sell') && 
            !card.textContent.includes('YOUR LINE') &&
            !card.textContent.includes('THEY TOOK') &&
            !card.textContent.includes('AI • NO GHOST')
        );

        const foodCards = shopCardsRaw.filter(c => c.textContent.includes('FOOD') || c.textContent.includes('APPLE') || c.textContent.includes('🍎'));
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

        if (CONFIG.paused) return;

        if (!state.isShopPhase) {
            renderOverlay(state, "Waiting for combat...");
            return;
        }

        // 1. If bottom "Use" button is active (e.g., 'Use 3g'), click it first, then tap the carry unit
        const bottomUseBtn = getElByText('button, div[role="button"]', 'use 3g') || getElByText('button, div[role="button"]', 'use');
        if (bottomUseBtn && state.carryUnit && state.gold >= 3) {
            renderOverlay(state, `Clicking '${bottomUseBtn.textContent.trim()}'...`);
            triggerClick(bottomUseBtn);
            await sleep(500);

            renderOverlay(state, `Tapping carry unit #${state.carryUnit.index + 1}...`);
            triggerClick(state.carryUnit.cardElement);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 2. If a confirmation "Buy" button is visible
        if (state.buttons.buy && state.gold >= 3) {
            renderOverlay(state, "Confirming purchase...");
            triggerClick(state.buttons.buy);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 3. Fill open board slots (< 3 units)
        if (state.boardCount < 3 && state.gold >= 3 && state.shop.units.length > 0) {
            const bestUnit = state.shop.units[0];
            renderOverlay(state, `Recruiting ${bestUnit.stats.total} stat unit (${bestUnit.stats.atk}/${bestUnit.stats.hp})...`);
            triggerClick(bestUnit.element);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 4. Auto-upgrade: Sell weakest unit if shop has a strictly superior unit
        if (CONFIG.enableAutoSellUpgrade && state.boardCount === 3 && state.gold >= 3 && state.shop.units.length > 0 && state.weakestUnit) {
            const bestShopUnit = state.shop.units[0];
            const statDifference = bestShopUnit.stats.total - state.weakestUnit.stats.total;

            if (statDifference >= CONFIG.upgradeStatThreshold) {
                renderOverlay(state, `Replacing unit #${state.weakestUnit.index + 1} with +${statDifference} stat upgrade...`);
                triggerClick(state.weakestUnit.sellBtn);
                await sleep(CONFIG.actionDelay);
                return;
            }
        }

        // 5. Board is full: Select Food item to trigger feed flow
        if (state.boardCount === 3 && state.gold >= 3 && state.shop.food.length > 0) {
            renderOverlay(state, `Selecting food item to buff carry...`);
            triggerClick(state.shop.food[0]);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 6. Strategic Reroll
        if (state.buttons.reroll && state.gold > 0) {
            const shouldReroll = !CONFIG.econSmartReroll || state.gold >= 4 || state.gold === 1;
            if (shouldReroll) {
                renderOverlay(state, `Rolling shop for better options (Gold: ${state.gold})...`);
                triggerClick(state.buttons.reroll);
                await sleep(CONFIG.actionDelay);
                return;
            }
        }

        // 7. Ready for battle
        if (state.buttons.fight) {
            renderOverlay(state, "Ready. Starting fight!");
            triggerClick(state.buttons.fight);
        }
    }

    renderOverlay({
        isShopPhase: false,
        gold: 0,
        boardCount: 0,
        carryUnit: null,
        shop: { units: [], food: [] }
    }, "Bot v4.1.0 Initialized");

    setInterval(async () => {
        try {
            await executeTurn();
        } catch (error) {
            console.error("[Bot Error]", error);
            renderOverlay(getGameState(), `Error: ${error.message}`);
        }
    }, CONFIG.loopInterval);

})();
