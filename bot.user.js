// ==UserScript==
// @name         Thursday Arena Smart Bot (with Debug Overlay)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  Advanced heuristic auto-player with visual debugger.
// @match        https://thursdayarena.com/match*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const ACTION_DELAY = 700; 
    const LOOP_INTERVAL = 2000;
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- OVERLAY SETUP ---
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; bottom: 10px; left: 10px; width: 300px;
        background: rgba(0, 0, 0, 0.85); color: #00ff00; font-family: monospace;
        font-size: 12px; padding: 15px; border-radius: 5px; z-index: 999999;
        pointer-events: none; border: 1px solid #00ff00;
    `;
    document.body.appendChild(overlay);

    function updateOverlay(state, actionText) {
        overlay.innerHTML = `
            <strong style="color:white;">Bot Status:</strong> Running<br>
            <strong style="color:white;">Phase:</strong> ${state.isShopPhase ? 'Shop' : 'Combat / Waiting'}<br>
            <strong style="color:white;">Gold:</strong> ${state.gold}<br>
            <strong style="color:white;">Board:</strong> ${state.boardCount}/3<br>
            <strong style="color:white;">Shop Units:</strong> ${state.shop.units.length} | <strong>Food:</strong> ${state.shop.food.length}<br>
            <hr style="border-color: #444;">
            <strong style="color:yellow;">Action:</strong> ${actionText}
        `;
    }

    // --- DOM HELPERS ---
    const getElByText = (selector, text) => {
        return Array.from(document.querySelectorAll(selector))
            .find(el => el.textContent.toLowerCase().includes(text.toLowerCase()) && !el.disabled);
    };

    const parseStats = (text) => {
        const atkMatch = text.match(/ATK\s*(\d+)/i);
        const hpMatch = text.match(/HP\s*(\d+)/i);
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

        const boardUnits = Array.from(document.querySelectorAll('button, div')).filter(el => el.textContent.trim() === 'Sell');
        const frontUnit = boardUnits.length > 0 ? boardUnits[0].closest('div') : null;

        const allCards = Array.from(document.querySelectorAll('div'))
            .filter(el => el.textContent.length > 20 && (el.textContent.includes('ATK') || el.textContent.includes('FOOD')));
        
        const shopCardsRaw = allCards.filter(card => !card.textContent.includes('Sell') && !card.textContent.includes('YOUR LINE'));
        const foodCards = shopCardsRaw.filter(c => c.textContent.includes('FOOD') || c.textContent.includes('🍎'));
        const unitCards = shopCardsRaw
            .filter(c => !foodCards.includes(c))
            .map(cardEl => ({ element: cardEl, stats: parseStats(cardEl.textContent) }))
            .sort((a, b) => b.stats.total - a.stats.total);

        return {
            isShopPhase: fightBtn && !fightBtn.disabled,
            buttons: { fight: fightBtn, buy: buyBtn, use: useBtn, reroll: rerollBtn },
            gold, boardCount: boardUnits.length, frontUnit, shop: { food: foodCards, units: unitCards }
        };
    }

    // --- HEURISTIC ENGINE ---
    async function executeTurn() {
        const state = getGameState();

        if (!state.isShopPhase) {
            updateOverlay(state, "Waiting for combat...");
            return;
        }

        if (state.buttons.buy && state.gold >= 3) {
            updateOverlay(state, "Clicking 'Buy' confirm button...");
            state.buttons.buy.click();
            return;
        }

        if (state.buttons.use && state.frontUnit && state.gold >= 3) {
            updateOverlay(state, "Feeding front unit...");
            state.buttons.use.click();
            await sleep(300);
            state.frontUnit.click();
            return;
        }

        if (state.boardCount < 3 && state.gold >= 3 && state.shop.units.length > 0) {
            updateOverlay(state, `Selecting unit with ${state.shop.units[0].stats.total} total stats...`);
            state.shop.units[0].element.click();
            return;
        }

        if (state.boardCount === 3 && state.gold >= 3 && state.shop.food.length > 0) {
            updateOverlay(state, "Board full. Selecting food...");
            state.shop.food[0].click();
            return;
        }

        if (state.gold > 2 && state.buttons.reroll) {
            updateOverlay(state, "Rerolling shop...");
            state.buttons.reroll.click();
            return;
        }

        if (state.buttons.fight) {
            updateOverlay(state, "Ready. Clicking Fight!");
            state.buttons.fight.click();
        }
    }

    updateOverlay({ isShopPhase: false, gold: 0, boardCount: 0, shop: { units: [], food: [] } }, "Initializing...");
    
    setInterval(async () => {
        try {
            await executeTurn();
        } catch (error) {
            console.error("[Bot Error]", error);
            overlay.innerHTML += `<br><strong style="color:red;">Error:</strong> ${error.message}`;
        }
    }, LOOP_INTERVAL);

})();
