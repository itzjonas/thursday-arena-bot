// ==UserScript==
// @name         Thursday Arena Smart Bot (Pro Edition)
// @namespace    https://github.com/itzjonas/thursday-arena-bot
// @version      4.6.0
// @description  Self-adapting auto-battler: loss diagnostics, telemetry analytics, auto carry-repositioning, combat speedup, and API logging.
// @author       itzjonas
// @match        https://thursdayarena.com/*
// @updateURL    https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js
// @downloadURL  https://raw.githubusercontent.com/itzjonas/thursday-arena-bot/main/bot.user.js
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // --- CONFIGURATION & ADAPTIVE TUNING ---
    const CONFIG = {
        actionDelay: 700,
        loopInterval: 1500,
        combatPollInterval: 300,
        enableAutoSellUpgrade: true,
        upgradeStatThreshold: 3,
        carryStrategy: 'highest-stat', // 'highest-stat', 'backline', 'frontline'
        econSmartReroll: true,
        autoFastForward: true,
        autoContinue: true,
        autoPlayAgain: true,
        logNetworkToConsole: true,
        paused: false
    };

    // Persistent Telemetry & Loss Analytics
    const STORAGE_KEY = 'ta_bot_analytics_v1';
    let ANALYTICS = {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        roundsWon: 0,
        roundsLost: 0,
        lossReasons: {
            statDeficit: 0,
            frontlineCollapsed: 0,
            unspentGold: 0,
            abilityOutplayed: 0
        },
        recentBattles: []
    };

    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) Object.assign(ANALYTICS, JSON.parse(saved));
    } catch (_) {}

    function saveAnalytics() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ANALYTICS));
        } catch (_) {}
    }

    // Network Sniffer
    const NETWORK_LOGS = [];
    const MAX_LOGS = 12;

    function recordNetworkTraffic(type, url, reqData, resData) {
        if (typeof url === 'string') {
            if (url.match(/\.(png|jpg|jpeg|gif|svg|woff2?|ttf|css|ico)(\?.*)?$/i)) return;
            if (url.includes('google-analytics') || url.includes('clarity') || url.includes('mixpanel')) return;
        }

        const logEntry = {
            time: new Date().toLocaleTimeString(),
            type,
            url: typeof url === 'string' ? url.split('?')[0] : 'WS',
            fullUrl: url,
            req: reqData,
            res: resData
        };

        NETWORK_LOGS.unshift(logEntry);
        if (NETWORK_LOGS.length > MAX_LOGS) NETWORK_LOGS.pop();

        if (CONFIG.logNetworkToConsole) {
            console.log(`%c[TA-API] [${type}] ${url}`, 'color: #38bdf8; font-weight: bold;', {
                request: reqData,
                response: resData
            });
        }
        updateHudNetworkList();
    }

    // Hook Fetch & XHR
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [resource, config] = args;
        const url = typeof resource === 'string' ? resource : resource?.url;
        let reqBody = null;
        try {
            if (config && config.body) {
                reqBody = typeof config.body === 'string' ? JSON.parse(config.body) : config.body;
            }
        } catch (_) { reqBody = config?.body; }

        try {
            const response = await originalFetch.apply(this, args);
            const clone = response.clone();
            clone.text().then(text => {
                let resBody = text;
                try { resBody = JSON.parse(text); } catch (_) {}
                recordNetworkTraffic('FETCH', url, reqBody, resBody);
            }).catch(() => {});
            return response;
        } catch (err) {
            recordNetworkTraffic('FETCH-ERR', url, reqBody, err.message);
            throw err;
        }
    };

    const originalXHR = window.XMLHttpRequest;
    function CustomXHR() {
        const xhr = new originalXHR();
        let method = 'GET';
        let url = '';
        let postData = null;

        const origOpen = xhr.open;
        xhr.open = function(m, u, ...rest) {
            method = m;
            url = u;
            return origOpen.call(this, m, u, ...rest);
        };

        const origSend = xhr.send;
        xhr.send = function(data) {
            postData = data;
            return origSend.call(this, data);
        };

        xhr.addEventListener('load', function() {
            let res = xhr.responseText;
            try { res = JSON.parse(res); } catch (_) {}
            let req = postData;
            try { req = JSON.parse(req); } catch (_) {}
            recordNetworkTraffic(`XHR-${method}`, url, req, res);
        });

        return xhr;
    }
    window.XMLHttpRequest = CustomXHR;

    // --- SYNTHETIC CLICK HELPER ---
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

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- DOM HELPERS ---
    const getElByText = (selector, text) => {
        return Array.from(document.querySelectorAll(selector))
            .find(el => {
                if (el.closest('#ta-bot-hud')) return false;
                const t = el.textContent.trim().toLowerCase();
                return t.includes(text.toLowerCase()) && !el.disabled;
            });
    };

    const parseStats = (text) => {
        const atkMatch = text.match(/ATK\s*(\d+)/i) || text.match(/(\d+)\s*⚔️/) || text.match(/ATK\n*(\d+)/i);
        const hpMatch = text.match(/HP\s*(\d+)/i) || text.match(/(\d+)\s*❤️/) || text.match(/HP\n*(\d+)/i);
        
        let atk = atkMatch ? parseInt(atkMatch[1]) : 0;
        let hp = hpMatch ? parseInt(hpMatch[1]) : 0;

        if (atk === 0 || hp === 0) {
            const rawNumbers = text.match(/\b\d+\b/g);
            if (rawNumbers && rawNumbers.length >= 2) {
                if (atk === 0) atk = parseInt(rawNumbers[0]) || 0;
                if (hp === 0) hp = parseInt(rawNumbers[1]) || 0;
            }
        }

        return { atk, hp, total: atk + hp };
    };

    function getCardElementForSellButton(sellBtn) {
        let current = sellBtn.parentElement;
        for (let i = 0; i < 5 && current; i++) {
            const candidate = current.querySelector('div[class*="card"], div[class*="unit"]');
            if (candidate && candidate !== sellBtn) return candidate;
            if (current.offsetHeight > 100) return current;
            current = current.parentElement;
        }
        return sellBtn.parentElement;
    }

    // --- LOSS & OUTCOME ANALYZER ---
    let lastLoggedRoundOutcome = null;

    function analyzeRoundOutcome() {
        const bodyText = document.body ? document.body.textContent : '';

        // Detect round outcomes
        const lossMatch = bodyText.match(/they took round\s*(\d+)/i);
        const winMatch = bodyText.match(/you took round\s*(\d+)/i);

        if (lossMatch) {
            const roundNum = lossMatch[1];
            const key = `loss_round_${roundNum}_${new Date().getMinutes()}`;
            if (lastLoggedRoundOutcome !== key) {
                lastLoggedRoundOutcome = key;
                ANALYTICS.roundsLost++;

                // Diagnose reason for loss
                const state = getGameState();
                let diagnosis = "Enemy power out-scaled board";

                if (state.boardUnits.length > 0) {
                    const frontUnit = state.boardUnits[0];
                    if (frontUnit.stats.hp < 6) {
                        diagnosis = "Frontline collapsed (low HP on front tank)";
                        ANALYTICS.lossReasons.frontlineCollapsed++;
                        // Auto-Adaptation: If frontline collapsed, switch carry to frontline or backline
                        if (CONFIG.carryStrategy === 'frontline') {
                            CONFIG.carryStrategy = 'highest-stat';
                        }
                    } else if (state.gold > 3) {
                        diagnosis = "Unspent gold reserve";
                        ANALYTICS.lossReasons.unspentGold++;
                    } else {
                        ANALYTICS.lossReasons.statDeficit++;
                    }
                }

                ANALYTICS.recentBattles.unshift({
                    result: 'LOSS',
                    round: roundNum,
                    time: new Date().toLocaleTimeString(),
                    diagnosis
                });
                if (ANALYTICS.recentBattles.length > 8) ANALYTICS.recentBattles.pop();
                saveAnalytics();
                console.warn(`[TA-Loss-Analysis] Round ${roundNum} Lost. Diagnosis: ${diagnosis}`);
            }
        } else if (winMatch) {
            const roundNum = winMatch[1];
            const key = `win_round_${roundNum}_${new Date().getMinutes()}`;
            if (lastLoggedRoundOutcome !== key) {
                lastLoggedRoundOutcome = key;
                ANALYTICS.roundsWon++;
                ANALYTICS.recentBattles.unshift({
                    result: 'WIN',
                    round: roundNum,
                    time: new Date().toLocaleTimeString(),
                    diagnosis: "Dominant board scaling"
                });
                if (ANALYTICS.recentBattles.length > 8) ANALYTICS.recentBattles.pop();
                saveAnalytics();
                console.log(`[TA-Win-Analysis] Round ${roundNum} Won!`);
            }
        }
    }

    // --- HUD OVERLAY SETUP ---
    let overlay = null;

    function initOverlay() {
        if (overlay || !document.body) return;

        overlay = document.createElement('div');
        overlay.id = 'ta-bot-hud';
        overlay.style.cssText = `
            position: fixed; bottom: 12px; left: 12px; width: 335px;
            background: rgba(12, 16, 24, 0.95); color: #e2e8f0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px; padding: 14px; border-radius: 8px; z-index: 999999;
            box-shadow: 0 8px 30px rgba(0, 0, 0, 0.75); border: 1px solid rgba(56, 189, 248, 0.4);
            backdrop-filter: blur(10px); line-height: 1.5; user-select: none;
        `;
        document.body.appendChild(overlay);
    }

    function updateHudNetworkList() {
        const netList = document.getElementById('ta-net-list');
        if (!netList) return;
        if (NETWORK_LOGS.length === 0) {
            netList.innerHTML = '<span style="color:#64748b;">Awaiting game API calls...</span>';
            return;
        }
        netList.innerHTML = NETWORK_LOGS.slice(0, 3).map(l => {
            const shortUrl = l.url.replace(/^https?:\/\/[^\/]+/, '');
            return `
                <div style="margin-bottom: 2px; font-size: 9px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    <span style="color:#38bdf8; font-weight: bold;">[${l.type}]</span>
                    <span style="color:#e2e8f0;" title="${l.fullUrl}">${shortUrl || l.url}</span>
                </div>
            `;
        }).join('');
    }

    function renderOverlay(state, actionText) {
        initOverlay();
        if (!overlay) return;

        const carryLabel = state.carryUnit 
            ? `#${state.carryUnit.index + 1} (${state.carryUnit.stats.atk}/${state.carryUnit.stats.hp})`
            : 'None';

        const totalRounds = ANALYTICS.roundsWon + ANALYTICS.roundsLost;
        const winRate = totalRounds > 0 ? Math.round((ANALYTICS.roundsWon / totalRounds) * 100) : 0;
        const lastBattle = ANALYTICS.recentBattles[0];

        overlay.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #334155; padding-bottom: 6px;">
                <span style="font-weight: 700; color: #38bdf8; font-size: 12px;">⚔️ THURSDAY ARENA BOT v4.6.0</span>
                <button id="ta-toggle-pause" style="
                    background: ${CONFIG.paused ? '#dc2626' : '#16a34a'}; color: white; border: none;
                    padding: 3px 8px; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 10px;
                ">${CONFIG.paused ? '▶ RESUME' : '⏸ PAUSE'}</button>
            </div>

            <!-- Stats & Record -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 8px;">
                <div><span style="color:#94a3b8;">Status:</span> <strong style="color:${CONFIG.paused ? '#f87171' : '#4ade80'};">${CONFIG.paused ? 'PAUSED' : 'ACTIVE'}</strong></div>
                <div><span style="color:#94a3b8;">Win Rate:</span> <strong style="color:#4ade80;">${winRate}%</strong> (${ANALYTICS.roundsWon}W / ${ANALYTICS.roundsLost}L)</div>
                <div><span style="color:#94a3b8;">Gold:</span> <strong style="color:#facc15;">${state.gold}</strong></div>
                <div><span style="color:#94a3b8;">Board:</span> <strong style="color:white;">${state.boardCount}/3</strong></div>
                <div><span style="color:#94a3b8;">Carry Unit:</span> <strong style="color:#a855f7;">${carryLabel}</strong></div>
                <div><span style="color:#94a3b8;">Shop:</span> ${state.shop.units.length}u / ${state.shop.food.length}f</div>
            </div>

            <!-- Strategy & Controls -->
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
                        ${CONFIG.enableAutoSellUpgrade ? 'ON (+3 Min)' : 'OFF'}
                    </button>
                    <span style="color:#94a3b8; font-size:10px; margin-left:6px;">Play Again:</span>
                    <strong style="color:#4ade80; font-size:9px;">ON</strong>
                </div>
            </div>

            <!-- Loss Diagnostics Banner -->
            ${lastBattle ? `
            <div style="background: ${lastBattle.result === 'WIN' ? 'rgba(22, 101, 52, 0.4)' : 'rgba(153, 27, 27, 0.4)'}; border: 1px solid ${lastBattle.result === 'WIN' ? '#16a34a' : '#ef4444'}; border-radius: 4px; padding: 5px 8px; margin-bottom: 8px; font-size: 10px;">
                <span style="font-weight: bold; color: ${lastBattle.result === 'WIN' ? '#4ade80' : '#f87171'};">[Last: Round ${lastBattle.round} ${lastBattle.result}]</span>
                <div style="color: #cbd5e1; font-size: 9px; margin-top: 2px;">Diagnosis: ${lastBattle.diagnosis}</div>
            </div>
            ` : ''}

            <!-- API Traffic Monitor -->
            <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid #1e293b; border-radius: 4px; padding: 5px; margin-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px; border-bottom: 1px solid #334155; padding-bottom: 2px;">
                    <span style="color:#38bdf8; font-weight:bold; font-size:9px;">📡 API Monitor</span>
                    <span style="color:#64748b; font-size:8px;">Console: [TA-API]</span>
                </div>
                <div id="ta-net-list" style="max-height: 48px; overflow: hidden; font-family: monospace;"></div>
            </div>

            <div style="font-size: 11px; color: #cbd5e1; border-top: 1px dashed #334155; padding-top: 6px;">
                <span style="color:#fbbf24;">Action:</span> <span style="color:#f1f5f9;">${actionText}</span>
            </div>
        `;

        updateHudNetworkList();

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

    // --- TRANSITIONS (COMBAT 2X, CONTINUE, PLAY AGAIN) ---
    function checkCombatTransitions() {
        if (CONFIG.paused) return false;

        // 1. Play Again
        if (CONFIG.autoPlayAgain) {
            const playAgainBtn = Array.from(document.querySelectorAll('button, div[role="button"], a, div')).find(el => {
                if (el.closest('#ta-bot-hud')) return false;
                const t = el.textContent.trim().toLowerCase();
                const isMatch = (
                    (t === 'play again' || t.includes('play again') || t === 'rematch' || t.includes('new match')) &&
                    t.length < 35
                );
                return isMatch && el.offsetParent !== null && !el.disabled;
            });

            if (playAgainBtn) {
                ANALYTICS.totalMatches++;
                saveAnalytics();
                triggerClick(playAgainBtn);
                if (playAgainBtn.firstElementChild) triggerClick(playAgainBtn.firstElementChild);
                return 'play-again';
            }
        }

        // 2. Continue
        if (CONFIG.autoContinue) {
            const continueBtn = Array.from(document.querySelectorAll('button, div[role="button"], a, div')).find(el => {
                if (el.closest('#ta-bot-hud')) return false;
                const t = el.textContent.trim().toLowerCase();
                const isMatch = (
                    (t === 'continue' || t.startsWith('continue') || t === 'next round' || t.includes('next round') || t === 'go to shop') &&
                    t.length < 30
                );
                return isMatch && el.offsetParent !== null && !el.disabled;
            });

            if (continueBtn) {
                triggerClick(continueBtn);
                if (continueBtn.firstElementChild) triggerClick(continueBtn.firstElementChild);
                return 'continue';
            }
        }

        // 3. Fast Forward / Skip
        if (CONFIG.autoFastForward) {
            const speedBtn = Array.from(document.querySelectorAll('button, div[role="button"], a, span')).find(el => {
                if (el.closest('#ta-bot-hud')) return false;
                const t = el.textContent.trim().toLowerCase();
                const aria = (el.getAttribute('aria-label') || '').toLowerCase();
                const isMatch = (
                    t === '2x' ||
                    t === 'skip' ||
                    t === 'fast' ||
                    t === '>>' ||
                    t.includes('skip round') ||
                    t.includes('skip battle') ||
                    t.includes('2x speed') ||
                    aria.includes('skip') ||
                    aria.includes('2x') ||
                    aria.includes('speed')
                );
                return isMatch && el.offsetParent !== null && !el.disabled;
            });

            if (speedBtn) {
                const isAlreadyActive = speedBtn.classList.contains('active') || 
                                        speedBtn.getAttribute('aria-pressed') === 'true';
                if (!isAlreadyActive) {
                    triggerClick(speedBtn);
                    return 'speed';
                }
            }
        }

        return false;
    }

    // --- STATE PARSER ---
    function getGameState() {
        const fightBtn = getElByText('button, div[role="button"]', 'fight');
        
        const actionButtons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const buyBtn = actionButtons.find(b => {
            if (b.closest('#ta-bot-hud')) return false;
            const t = b.textContent.trim().toLowerCase();
            return (t.includes('buy') || t.startsWith('buy')) && !b.disabled;
        });
        const useBtn = actionButtons.find(b => {
            if (b.closest('#ta-bot-hud')) return false;
            const t = b.textContent.trim().toLowerCase();
            return (t.includes('use') || t.startsWith('use')) && !b.disabled && !t.includes('use on a bot');
        });
        const rerollBtn = actionButtons.find(b => {
            if (b.closest('#ta-bot-hud')) return false;
            return b.textContent.trim().toLowerCase().includes('reroll') && !b.disabled;
        });

        const feedLeafButtons = Array.from(document.querySelectorAll('*')).filter(el => {
            if (el.closest('#ta-bot-hud')) return false;
            return el.children.length === 0 && el.textContent.trim().toUpperCase() === 'FEED' && el.offsetParent !== null;
        });

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

        const sellButtons = Array.from(document.querySelectorAll('button, div[role="button"], div'))
            .filter(el => !el.closest('#ta-bot-hud') && el.textContent.trim() === 'Sell');

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

        const allCards = Array.from(document.querySelectorAll('div'))
            .filter(el => !el.closest('#ta-bot-hud') && el.textContent.length > 15 && (el.textContent.includes('ATK') || el.textContent.includes('FOOD') || el.textContent.includes('APPLE') || el.textContent.includes('🍎')));
        
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
            feedLeafButtons,
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
        if (CONFIG.paused) return;

        // Analyze any victory/loss outcomes visible on screen
        analyzeRoundOutcome();

        const transition = checkCombatTransitions();
        if (transition === 'play-again') {
            renderOverlay(getGameState(), "Match finished! Requeuing ('Play Again')...");
            await sleep(CONFIG.actionDelay);
            return;
        } else if (transition === 'continue') {
            renderOverlay(getGameState(), "Round over! Advancing ('Continue')...");
            await sleep(CONFIG.actionDelay);
            return;
        } else if (transition === 'speed') {
            renderOverlay(getGameState(), "Speeding combat: '2X / Skip'...");
            await sleep(350);
            return;
        }

        const state = getGameState();

        if (!state.isShopPhase) {
            renderOverlay(state, "In battle / transition...");
            return;
        }

        // 1. If FEED buttons active, feed carry
        if (state.feedLeafButtons.length > 0) {
            const targetIdx = state.carryUnit ? state.carryUnit.index : 0;
            const targetBtn = state.feedLeafButtons[targetIdx] || state.feedLeafButtons[0];
            renderOverlay(state, `Feed targeting: Clicking 'FEED' on carry #${targetIdx + 1}...`);
            triggerClick(targetBtn);
            if (targetBtn.parentElement) triggerClick(targetBtn.parentElement);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 2. Click bottom 'Use 3g' / 'Use' to enter feed mode
        if (state.buttons.use && state.gold >= 3) {
            renderOverlay(state, `Clicking '${state.buttons.use.textContent.trim()}' to feed...`);
            triggerClick(state.buttons.use);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 3. Click 'Buy' to confirm unit purchase
        if (state.buttons.buy && state.gold >= 3) {
            renderOverlay(state, `Confirming purchase: Clicking '${state.buttons.buy.textContent.trim()}'...`);
            triggerClick(state.buttons.buy);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 4. Fill open board slots (< 3 units)
        if (state.boardCount < 3 && state.gold >= 3 && state.shop.units.length > 0) {
            const bestUnit = state.shop.units[0];
            renderOverlay(state, `Recruiting ${bestUnit.stats.total} stat unit in shop (${bestUnit.stats.atk}/${bestUnit.stats.hp})...`);
            triggerClick(bestUnit.element);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 5. Auto-upgrade: Sell weakest unit if shop offers >= +3 stat upgrade
        if (CONFIG.enableAutoSellUpgrade && state.boardCount === 3 && state.gold >= 3 && state.shop.units.length > 0 && state.weakestUnit) {
            const bestShopUnit = state.shop.units[0];
            const statDifference = bestShopUnit.stats.total - state.weakestUnit.stats.total;

            if (statDifference >= CONFIG.upgradeStatThreshold) {
                renderOverlay(state, `Upgrading: Selling unit #${state.weakestUnit.index + 1} for +${statDifference} stat shop unit...`);
                triggerClick(state.weakestUnit.sellBtn);
                await sleep(CONFIG.actionDelay);
                return;
            }
        }

        // 6. Board is full: Select Food item to prepare feed flow
        if (state.boardCount === 3 && state.gold >= 3 && state.shop.food.length > 0) {
            renderOverlay(state, `Selecting food card in shop...`);
            const foodCard = state.shop.food[0];
            const innerBtn = Array.from(foodCard.querySelectorAll('*')).find(el => el.textContent.trim().toUpperCase() === 'USE ON A BOT');
            triggerClick(innerBtn || foodCard);
            await sleep(CONFIG.actionDelay);
            return;
        }

        // 7. Strategic Reroll
        if (state.buttons.reroll && state.gold > 0) {
            const shouldReroll = !CONFIG.econSmartReroll || state.gold >= 4 || state.gold === 1;
            if (shouldReroll) {
                renderOverlay(state, `Rerolling shop (Gold: ${state.gold})...`);
                triggerClick(state.buttons.reroll);
                await sleep(CONFIG.actionDelay);
                return;
            }
        }

        // 8. Ready for battle: Start Fight
        if (state.buttons.fight) {
            renderOverlay(state, "Board optimal. Starting combat!");
            triggerClick(state.buttons.fight);
            await sleep(CONFIG.actionDelay);
        }
    }

    const checkDomReady = setInterval(() => {
        if (document.body) {
            clearInterval(checkDomReady);
            renderOverlay({
                isShopPhase: false,
                gold: 0,
                boardCount: 0,
                carryUnit: null,
                shop: { units: [], food: [] }
            }, "Bot v4.6.0 with Loss Analyzer");
        }
    }, 100);

    // Main turn loop
    setInterval(async () => {
        try {
            await executeTurn();
        } catch (error) {
            console.error("[Bot Error]", error);
            renderOverlay(getGameState(), `Error: ${error.message}`);
        }
    }, CONFIG.loopInterval);

    // Fast transition poll
    setInterval(() => {
        try {
            analyzeRoundOutcome();
            checkCombatTransitions();
        } catch (_) {}
    }, CONFIG.combatPollInterval);

})();
