// ==UserScript==
// @name         Thursday Arena Smart Bot (Grandmaster Edition)
// @namespace    https://github.com/itzjonas/thursday-arena-bot
// @version      5.0.0
// @description  Super Auto Pets meta engine for Thursday Arena: React Fiber dispatch, kit tier scoring, optimal seating heuristics, instant battle skipping, anti-churn economy, and live telemetry HUD.
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
        actionDelay: 120,          // Delay between dispatch actions (ms)
        loopInterval: 280,         // Main decision loop interval (ms)
        combatPollInterval: 100,   // Fast combat skip polling (ms)
        enableAutoSellUpgrade: true,
        upgradeThreshold: 2.2,     // Net value advantage needed to replace a unit
        carryStrategy: 'highest-stat', // 'highest-stat', 'backline', 'frontline'
        econSmartReroll: true,     // Burn excess gold before endShop (gold resets every round)
        autoFastForward: true,     // Instant battle frame skip
        autoContinue: true,        // Auto advance rounds
        autoPlayAgain: true,       // Auto queue next match
        logNetworkToConsole: true,
        paused: false
    };

    // --- 72-BOT CATALOG META KNOWLEDGE BASE ---
    // [name, kitId, cost, baseAtk, baseHp]
    const CATALOG_DATA = {
        "_jOdbfkB16zxu7MRcmReE": ["dr eggbot", "spotlight", 6, 6, 5],
        "NIEguoGUjA648fUPle8F5": ["Overheard", "backtap", 4, 4, 4],
        "wOE4e95HNxhSbrzyLkSI-": ["Tradbot", "guard", 4, 3, 6],
        "AZKaQOsjrAa51Nb4xvTur": ["Projects Manager", "hype", 4, 3, 5],
        "i03IaF768-ielyzegoGye": ["Outbound Prospecting", "mosquito", 3, 3, 4],
        "0IhyZWxwbf2cFmsmroZQL": ["SEO & AEO Desk", "pin", 3, 2, 5],
        "Eeu5NZp62OzQjtlY4ons2": ["Imogen", "bulk", 3, 2, 6],
        "i2hvaEONDg6_gEF5C9RlK": ["Researchy", "last_word", 5, 3, 7],
        "pwQ612YrX3R0eACnIMlom": ["Haggle Bot", "sting", 4, 4, 4],
        "q4u8YgzGQqCAOUZcg0Lgt": ["Credit Card Max", "grow", 3, 3, 4],
        "KDahOjiDbbAvxqx9KaGcq": ["Recruiting Coordinator", "dodo", 4, 3, 5],
        "V8XugyLxzbQXLM9o5b3B-": ["Stills & Clips Desk", "wake", 3, 2, 5],
        "pXNvc_U2cGyZmheYrUuF_": ["figma bro", "wake", 4, 4, 4],
        "gj3IlHOOpzecm6xpmPJOt": ["GTM Loop Closer", "cover", 4, 3, 6],
        "yZ5MFQFdl32vHt6fcIJAc": ["Sales Call Coach", "peacock", 4, 4, 5],
        "YklttiPpAHweKbOLV1TSF": ["Meeting Recap Deck", "echo", 3, 3, 4],
        "zkVS-PkX1ooTE2nP21DPO": ["Pitch Deck Coach", "last_word", 5, 4, 6],
        "-L1yFJ5mtwPgn3O_iYUo_": ["Clip Bot", "wake", 3, 3, 3],
        "YwxIbVEWqXN-HYCxiMCoB": ["Copy Humanizer", "flamingo", 3, 2, 5],
        "G68H57o2b3gZ_E65v1Z15": ["NYC Parent", "bulk", 3, 3, 4],
        "6b9n_D0hZ3qIu569Q8p_B": ["The Morning Newspaper", "flamingo", 3, 3, 4],
        "eY6iO1Qv3tB_jD9W55xPt": ["Writing Bot", "hype", 3, 2, 5],
        "X1mN4y9P6qR_sT7v8wK2z": ["Stalk Bot", "snowball", 6, 6, 6],
        "A3vB8n2M5qL_kP9w4xZ1c": ["Nightly Audit Engineer", "cover", 4, 4, 5],
        "D4eR7t9Y1uI_oP3a6sD8f": ["Paid Media Report Desk", "grow", 4, 4, 4],
        "M8kL2v5N9xQ_wE1r4tY7u": ["Deal Inspector", "cover", 4, 3, 5],
        "C5vB9m1N3xZ_qW7e2rT4y": ["Alfred", "last_word", 5, 5, 7],
        "B2nN7m9K4vL_xP1w3qZ8a": ["Cooper", "echo", 3, 2, 5],
        "F8gH2j4K6lP_oI9u1yT3r": ["Call Follow-Ups", "echo", 3, 3, 4],
        "W4eR8t1Y3uI_pP5a7sD9f": ["WTD", "hype", 3, 3, 3],
        "K9lL3v6N1xQ_zE2r5tY8u": ["Webby", "bulk", 3, 3, 5]
    };

    const CATALOG_BY_ID = new Map();
    const CATALOG_BY_NAME = new Map();
    for (const [id, [name, kitId, cost, atk, hp]] of Object.entries(CATALOG_DATA)) {
        const item = { id, name, kitId, cost, atk, hp };
        CATALOG_BY_ID.set(id, item);
        CATALOG_BY_NAME.set(name.toLowerCase(), item);
    }

    // --- SAP META TIER SYSTEM (Simulated EV) ---
    const KIT_TIER = {
        // S-Tier: Compounding multipliers & token growth (Drives highest win rates)
        grow: 4.0,           // Boar (+1/+1 per attack)
        echo: 3.8,           // Kangaroo (+1/+1 when ahead attacks)
        flamingo: 3.6,       // Flamingo (Faint: +1/+1 to 2 friends behind)
        pass_it_back: 3.6,   // Pass it back
        hype: 3.5,           // Moth (Start: +2 ATK to front friend)
        bulk: 3.4,           // Mammoth (Start: +2 HP to self)
        peacock: 3.5,        // Peacock (Hurt: +3 ATK)
        cover: 3.3,          // Ox (Friend faints: +2 ATK)
        snowball: 3.8,       // Hippo (Kill: +2/+2)
        spotlight: 3.6,      // Goose (Start front: 2 dmg to enemy front)
        last_word: 3.5,      // Crocodile (Start back: 3 dmg to enemy back)
        // A-Tier: Solid Support & Forward Transfer
        dodo: 2.6,           // Dodo (Start: 50% ATK to friend ahead)
        spot: 2.6,
        dump: 2.5,           // Panda (Start: 50% ATK ahead, then faint)
        guard: 2.4,          // Ox (+2 HP ahead)
        wake: 2.3,           // Snake (1 dmg enemy front on friend attack)
        second_look: 2.3,
        sting: 2.5,          // Blowfish (Hurt: 2 dmg enemy front)
        // B-Tier: Low Scaling
        hold_the_line: 1.5,
        patch: 1.4,
        // F-Tier: Snipers & Self-Harm (Worst EV in SAP format)
        mosquito: 0.5,
        sidestep: 0.5,
        pin: 0.5,
        backtap: 0.5,
        first_seat: 0.3,
        drain: 0.4,
        spite: 0.6
    };

    // Optimal seat positions: 0 = Front, 1 = Middle, 2 = Back
    const SEAT_PREFERENCE = {
        // Seat 0: Front (faint buffers die first, or frontline tanks)
        flamingo: 0, pass_it_back: 0, dump: 0, spite: 0,
        grow: 0, bulk: 0, snowball: 0, hold_the_line: 0, spotlight: 0, first_seat: 0,
        // Seat 1: Middle (reacts to damage or friend ahead attacking)
        peacock: 1, sting: 1, cover: 1, patch: 1,
        echo: 1, wake: 1, second_look: 1,
        mosquito: 1, sidestep: 1, pin: 1,
        // Seat 2: Back (buffs forward or snipes back)
        hype: 2, dodo: 2, spot: 2, guard: 2,
        last_word: 2, backtap: 2
    };

    // Anti-Churn Protection: Units bought in this shop round cannot be sold
    const LOCKED_UIDS = new Set();
    let currentShopRound = -1;

    // Telemetry & Diagnostics
    const STORAGE_KEY = 'ta_bot_analytics_v5';
    let ANALYTICS = {
        totalMatches: 0,
        wins: 0,
        losses: 0,
        roundsWon: 0,
        roundsLost: 0,
        lossReasons: {
            statDeficit: 0,
            frontlineCollapsed: 0,
            unspentGold: 0
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

    // --- SYNTHETIC DOM CLICK HELPER ---
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

    // --- REACT FIBER BRIDGE (Direct State & Dispatch) ---
    function getReactFiber(node) {
        if (!node) return null;
        const key = Object.keys(node).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
        return key ? node[key] : null;
    }

    function getGameSceneFiber() {
        const sceneEl = document.querySelector('[data-scene]');
        if (!sceneEl) return null;
        let fiber = getReactFiber(sceneEl);
        while (fiber) {
            if (fiber.memoizedProps) {
                const p = fiber.memoizedProps;
                if (p.state && (typeof p.dispatch === 'function' || typeof p.onReplay === 'function')) {
                    return fiber;
                }
            }
            fiber = fiber.return;
        }
        return null;
    }

    function dispatchGameAction(action) {
        const fiber = getGameSceneFiber();
        if (fiber && fiber.memoizedProps && typeof fiber.memoizedProps.dispatch === 'function') {
            try {
                fiber.memoizedProps.dispatch(action);
                return true;
            } catch (err) {
                console.warn("[TA-Bot] Fiber dispatch error:", err);
            }
        }
        return false;
    }

    function triggerReplay() {
        const fiber = getGameSceneFiber();
        if (fiber && fiber.memoizedProps && typeof fiber.memoizedProps.onReplay === 'function') {
            try {
                fiber.memoizedProps.onReplay();
                return true;
            } catch (_) {}
        }
        return false;
    }

    // --- EVALUATION ENGINE ---
    function resolveKit(unit) {
        if (unit.kitId) return unit.kitId;
        const info = CATALOG_BY_ID.get(unit.botId) || CATALOG_BY_NAME.get((unit.name || '').toLowerCase());
        return info?.kitId || '';
    }

    function evaluateUnit(unit) {
        if (!unit) return 0;
        const kitId = resolveKit(unit);
        const tier = KIT_TIER[kitId] !== undefined ? KIT_TIER[kitId] : 1.5;
        const atk = (unit.atk || 0) + (unit.tempAtk || 0);
        const hp = unit.hp || 0;
        const statTotal = atk + hp;

        // Multipliers based on archetype tier
        let multiplier = 1.0;
        if (tier >= 3.5) multiplier = 1.45;
        else if (tier >= 2.5) multiplier = 1.2;
        else if (tier <= 0.6) multiplier = 0.7;

        // Honey summon synergy
        const honeyBonus = unit.honey ? 2.5 : 0;

        return (statTotal * multiplier) + honeyBonus;
    }

    function getDesiredBoardOrder(board) {
        if (!board || board.length <= 1) return (board || []).map(u => u.uid);

        const scored = board.map(u => {
            const kitId = resolveKit(u);
            const pref = SEAT_PREFERENCE[kitId] !== undefined ? SEAT_PREFERENCE[kitId] : 1;
            const evalScore = evaluateUnit(u);
            return { uid: u.uid, pref, evalScore, hp: u.hp || 0, atk: u.atk || 0, kitId };
        });

        scored.sort((a, b) => {
            if (a.pref !== b.pref) return a.pref - b.pref;
            // For seat 0: fainters (flamingo/dump) front; then bulky HP tanks
            if (a.pref === 0) {
                const aIsFaint = (a.kitId === 'flamingo' || a.kitId === 'pass_it_back' || a.kitId === 'dump');
                const bIsFaint = (b.kitId === 'flamingo' || b.kitId === 'pass_it_back' || b.kitId === 'dump');
                if (aIsFaint && !bIsFaint) return -1;
                if (!aIsFaint && bIsFaint) return 1;
                return b.hp - a.hp;
            }
            // For seat 1: damage absorbers (peacock) first
            if (a.pref === 1) return b.hp - a.hp;
            // For seat 2: higher attack / buffers
            return b.atk - a.atk;
        });

        return scored.map(s => s.uid);
    }

    // --- DOM FALLBACK STATE PARSER ---
    const parseStats = (text) => {
        const atkMatch = text.match(/ATK\s*(\d+)/i) || text.match(/(\d+)\s*⚔️/);
        const hpMatch = text.match(/HP\s*(\d+)/i) || text.match(/(\d+)\s*❤️/);
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

    function getGameState() {
        // 1. Try Live React Fiber State (Fastest & 100% Accurate)
        const fiber = getGameSceneFiber();
        if (fiber && fiber.memoizedProps && fiber.memoizedProps.state) {
            const s = fiber.memoizedProps.state;
            const boardUnits = (s.board || []).map((u, index) => ({
                index,
                uid: u.uid,
                botId: u.botId,
                name: u.name || CATALOG_BY_ID.get(u.botId)?.name || 'Bot',
                kitId: resolveKit(u),
                atk: u.atk,
                hp: u.hp,
                tempAtk: u.tempAtk || 0,
                honey: !!u.honey,
                stats: { atk: u.atk + (u.tempAtk || 0), hp: u.hp, total: u.atk + (u.tempAtk || 0) + u.hp }
            }));

            let carryUnit = null;
            if (boardUnits.length > 0) {
                if (CONFIG.carryStrategy === 'frontline') carryUnit = boardUnits[0];
                else if (CONFIG.carryStrategy === 'backline') carryUnit = boardUnits[boardUnits.length - 1];
                else carryUnit = [...boardUnits].sort((a, b) => evaluateUnit(b) - evaluateUnit(a))[0];
            }

            return {
                isFiber: true,
                phase: s.phase?.kind || 'unknown',
                round: s.phase?.round ?? 0,
                isShopPhase: s.phase?.kind === 'shop',
                isFightPhase: s.phase?.kind === 'battle',
                isResultPhase: s.phase?.kind === 'result',
                gold: s.gold ?? 0,
                boardCount: boardUnits.length,
                boardUnits,
                carryUnit,
                shop: {
                    pets: (s.shop?.pets || []).map((p, index) => p ? ({
                        index,
                        botId: p.botId,
                        name: p.name || CATALOG_BY_ID.get(p.botId)?.name || 'Offer',
                        kitId: resolveKit(p),
                        atk: p.atk,
                        hp: p.hp,
                        cost: p.cost || 3,
                        stats: { atk: p.atk, hp: p.hp, total: p.atk + p.hp }
                    }) : null),
                    food: s.shop?.food || null
                },
                lastSeen: s.lastSeen || null,
                wins: s.wins || { you: 0, them: 0 }
            };
        }

        // 2. DOM Scrape Fallback
        const bodyText = document.body ? document.body.textContent : '';
        const fightBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fight round'));
        const isShop = !!(fightBtn && !fightBtn.disabled);
        const isFight = !!document.querySelector('[data-scene="fight"]') || bodyText.includes('Fast 2×') || bodyText.includes('Skip');
        const isResult = !!document.querySelector('[data-scene="result"]') || bodyText.includes('Play again');

        let gold = 0;
        const goldMatch = bodyText.match(/(\d+)\s*gold/i);
        if (goldMatch) gold = parseInt(goldMatch[1]);

        const sellButtons = Array.from(document.querySelectorAll('button')).filter(el => el.textContent.trim() === 'Sell');
        const boardUnits = sellButtons.map((btn, index) => {
            const card = btn.closest('article, div[class*="pocket-card"], div') || btn.parentElement;
            const stats = parseStats(card ? card.textContent : '');
            return { index, uid: index + 1, botId: '', name: `Unit #${index + 1}`, stats, atk: stats.atk, hp: stats.hp };
        });

        return {
            isFiber: false,
            phase: isShop ? 'shop' : isFight ? 'battle' : isResult ? 'result' : 'unknown',
            round: 0,
            isShopPhase: isShop,
            isFightPhase: isFight,
            isResultPhase: isResult,
            gold,
            boardCount: boardUnits.length,
            boardUnits,
            carryUnit: boardUnits[0] || null,
            shop: { pets: [], food: null },
            lastSeen: null,
            wins: { you: 0, them: 0 }
        };
    }

    // --- HUD OVERLAY ---
    let overlay = null;

    function initOverlay() {
        if (overlay || !document.body) return;
        overlay = document.createElement('div');
        overlay.id = 'ta-bot-hud';
        overlay.style.cssText = `
            position: fixed; bottom: 12px; left: 12px; width: 345px;
            background: rgba(10, 14, 23, 0.94); color: #f1f5f9; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            font-size: 11px; padding: 12px 14px; border-radius: 10px; z-index: 999999;
            box-shadow: 0 10px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56, 189, 248, 0.35);
            backdrop-filter: blur(12px); line-height: 1.45; user-select: none;
        `;
        document.body.appendChild(overlay);
    }

    function renderOverlay(state, actionText) {
        initOverlay();
        if (!overlay) return;

        const totalRounds = ANALYTICS.roundsWon + ANALYTICS.roundsLost;
        const winRate = totalRounds > 0 ? Math.round((ANALYTICS.roundsWon / totalRounds) * 100) : 0;
        const lastBattle = ANALYTICS.recentBattles[0];

        const boardList = (state.boardUnits || []).map((u, i) => {
            const kit = u.kitId ? ` [${u.kitId}]` : '';
            return `<span style="display:inline-block; margin-right:4px; padding:1px 4px; background:rgba(30,41,59,0.8); border-radius:3px; border:1px solid #334155; font-size:9.5px;">
                #${i + 1} ${u.name.slice(0, 10)}${kit} <strong style="color:#38bdf8;">${u.atk}/${u.hp}</strong>
            </span>`;
        }).join('') || '<span style="color:#64748b;">(Empty line)</span>';

        overlay.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; border-bottom:1px solid #334155; padding-bottom:5px;">
                <span style="font-weight:800; color:#38bdf8; font-size:11.5px; letter-spacing:0.5px;">⚡ THURSDAY BOT v5.0</span>
                <span style="font-size:9px; background:${state.isFiber ? '#0369a1' : '#475569'}; color:white; padding:1px 5px; border-radius:3px;">
                    ${state.isFiber ? 'FIBER DIRECT' : 'DOM MODE'}
                </span>
                <button id="ta-toggle-pause" style="
                    background:${CONFIG.paused ? '#dc2626' : '#16a34a'}; color:white; border:none;
                    padding:2px 8px; border-radius:4px; font-weight:700; cursor:pointer; font-size:10px;
                ">${CONFIG.paused ? '▶ RESUME' : '⏸ PAUSE'}</button>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:3px; margin-bottom:6px; font-size:10.5px;">
                <div><span style="color:#94a3b8;">Phase:</span> <strong style="color:#e2e8f0; text-transform:uppercase;">${state.phase}</strong></div>
                <div><span style="color:#94a3b8;">Record:</span> <strong style="color:#4ade80;">${winRate}%</strong> (${ANALYTICS.roundsWon}W/${ANALYTICS.roundsLost}L)</div>
                <div><span style="color:#94a3b8;">Gold:</span> <strong style="color:#facc15; font-size:12px;">${state.gold}g</strong></div>
                <div><span style="color:#94a3b8;">Score:</span> <strong style="color:#38bdf8;">${state.wins.you}–${state.wins.them}</strong> (R${state.round + 1})</div>
            </div>

            <div style="margin-bottom:6px;">
                <div style="color:#94a3b8; font-size:9px; margin-bottom:2px;">BOARD (Front → Back):</div>
                <div style="display:flex; flex-wrap:wrap; gap:2px;">${boardList}</div>
            </div>

            ${lastBattle ? `
            <div style="background:${lastBattle.result === 'WIN' ? 'rgba(22,101,52,0.3)' : 'rgba(153,27,27,0.3)'}; border:1px solid ${lastBattle.result === 'WIN' ? '#16a34a' : '#ef4444'}; border-radius:4px; padding:3px 6px; margin-bottom:6px; font-size:9.5px;">
                <span style="font-weight:bold; color:${lastBattle.result === 'WIN' ? '#4ade80' : '#f87171'};">[Round ${lastBattle.round} ${lastBattle.result}]</span>
                <span style="color:#cbd5e1; margin-left:4px;">${lastBattle.diagnosis}</span>
            </div>` : ''}

            <div style="font-size:10.5px; color:#cbd5e1; border-top:1px dashed #334155; padding-top:5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                <span style="color:#fbbf24; font-weight:bold;">Action:</span> <span style="color:#f8fafc;">${actionText}</span>
            </div>
        `;

        const pauseBtn = document.getElementById('ta-toggle-pause');
        if (pauseBtn) {
            pauseBtn.onclick = (e) => {
                e.stopPropagation();
                CONFIG.paused = !CONFIG.paused;
                renderOverlay(state, CONFIG.paused ? "Bot Paused" : "Bot Resumed");
            };
        }
    }

    // --- INSTANT TRANSITIONS (COMBAT & PLAY AGAIN) ---
    let lastHandledOutcomeRound = null;

    function handleInstantTransitions(state) {
        if (CONFIG.paused) return false;

        // 1. Match Finished: Play Again
        if (state.isResultPhase || document.querySelector('[data-scene="result"]')) {
            const ok = triggerReplay();
            if (ok) {
                renderOverlay(state, "Match over! Instant requeue via onReplay()...");
                return true;
            }
            const playAgainBtn = Array.from(document.querySelectorAll('button, a')).find(b => {
                const t = b.textContent.trim().toLowerCase();
                return (t === 'play again' || t.includes('play again')) && !b.disabled;
            });
            if (playAgainBtn) {
                renderOverlay(state, "Clicking 'Play again'...");
                triggerClick(playAgainBtn);
                return true;
            }
        }

        // 2. Battle Phase: Skip Immediately
        if (state.isFightPhase || document.querySelector('[data-scene="fight"]')) {
            // Check victory / loss outcome
            const body = document.body ? document.body.textContent : '';
            const lossMatch = body.match(/they took round\s*(\d+)/i);
            const winMatch = body.match(/you took round\s*(\d+)/i);
            const roundKey = `${lossMatch ? 'L' : 'W'}_${(lossMatch || winMatch)?.[1] || state.round}`;

            if ((lossMatch || winMatch) && lastHandledOutcomeRound !== roundKey) {
                lastHandledOutcomeRound = roundKey;
                if (lossMatch) {
                    ANALYTICS.roundsLost++;
                    ANALYTICS.recentBattles.unshift({ result: 'LOSS', round: lossMatch[1], diagnosis: 'Enemy scaled higher' });
                } else if (winMatch) {
                    ANALYTICS.roundsWon++;
                    ANALYTICS.recentBattles.unshift({ result: 'WIN', round: winMatch[1], diagnosis: 'Dominant scaling' });
                }
                if (ANALYTICS.recentBattles.length > 6) ANALYTICS.recentBattles.pop();
                saveAnalytics();
            }

            // Click "Skip" button immediately if present
            const skipBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'skip');
            if (skipBtn) {
                triggerClick(skipBtn);
            }

            // Click "Continue" or dispatch battleDone
            const continueBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().toLowerCase() === 'continue');
            if (continueBtn && !continueBtn.disabled) {
                renderOverlay(state, "Advancing battle: Clicking 'Continue'...");
                triggerClick(continueBtn);
                return true;
            }

            // Direct Fiber battleDone
            const dispatched = dispatchGameAction({ type: "battleDone" });
            if (dispatched) {
                renderOverlay(state, "Advancing battle: Dispatched battleDone!");
                return true;
            }
        }

        return false;
    }

    // --- STRATEGIC SHOP DECISION ENGINE ---
    async function executeShopTurn(state) {
        if (CONFIG.paused || !state.isShopPhase) return;

        // Reset anti-churn locks on new round
        if (state.round !== currentShopRound) {
            currentShopRound = state.round;
            LOCKED_UIDS.clear();
        }

        const board = state.boardUnits || [];
        const shopPets = state.shop.pets || [];
        const food = state.shop.food;
        const gold = state.gold;

        // --- STEP 1: FILL VACANT BOARD SLOTS (< 3) ---
        if (board.length < 3) {
            const affordableOffers = shopPets.filter(p => p !== null && gold >= p.cost);
            if (affordableOffers.length > 0) {
                // Rank offers by meta evaluation score
                affordableOffers.sort((a, b) => evaluateUnit(b) - evaluateUnit(a));
                const pick = affordableOffers[0];
                renderOverlay(state, `Recruiting ${pick.name} [${pick.kitId || 'base'}] (Score: ${evaluateUnit(pick).toFixed(1)})...`);

                const success = dispatchGameAction({ type: "buy", shopIndex: pick.index });
                if (success) {
                    await sleep(CONFIG.actionDelay);
                    const postState = getGameState();
                    const newUnit = (postState.boardUnits || [])[(postState.boardUnits || []).length - 1];
                    if (newUnit) LOCKED_UIDS.add(newUnit.uid);
                    return;
                } else {
                    // DOM fallback: click card then click buy button
                    const cards = Array.from(document.querySelectorAll('article.pocket-card, div[class*="pocket-card"]'));
                    const targetCard = cards.find(c => c.textContent.includes(pick.name));
                    if (targetCard) {
                        triggerClick(targetCard);
                        await sleep(CONFIG.actionDelay);
                        const buyBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().startsWith('Buy') && !b.disabled);
                        if (buyBtn) triggerClick(buyBtn);
                    }
                    return;
                }
            }
        }

        // --- STEP 2: REPOSITIONING HEURISTIC (Optimal Seating) ---
        if (board.length >= 2) {
            const desiredUids = getDesiredBoardOrder(board);
            for (let i = 0; i < desiredUids.length; i++) {
                if (board[i].uid !== desiredUids[i]) {
                    const currIndex = board.findIndex(u => u.uid === desiredUids[i]);
                    if (currIndex > i) {
                        renderOverlay(state, `Repositioning: Swapping ${board[currIndex].name} towards front (Seat ${currIndex} → ${currIndex - 1})...`);
                        const success = dispatchGameAction({ type: "move", boardIndex: currIndex - 1, dir: 1 });
                        if (success) {
                            await sleep(CONFIG.actionDelay);
                            return;
                        }
                    }
                }
            }
        }

        // --- STEP 3: UPGRADE SELLING (Board full = 3) ---
        if (CONFIG.enableAutoSellUpgrade && board.length === 3) {
            const nonLocked = board.filter(u => !LOCKED_UIDS.has(u.uid));
            if (nonLocked.length > 0) {
                // Find weakest non-locked unit
                nonLocked.sort((a, b) => evaluateUnit(a) - evaluateUnit(b));
                const weakest = nonLocked[0];
                const weakestScore = evaluateUnit(weakest);

                // Check if any shop pet beats weakest unit by threshold
                const upgradeCandidates = shopPets.filter(p => p !== null && (gold + 1) >= p.cost);
                let bestUpgrade = null;
                let bestDiff = 0;

                for (const cand of upgradeCandidates) {
                    const diff = evaluateUnit(cand) - weakestScore;
                    if (diff >= CONFIG.upgradeThreshold && diff > bestDiff) {
                        bestDiff = diff;
                        bestUpgrade = cand;
                    }
                }

                if (bestUpgrade) {
                    renderOverlay(state, `Upgrading: Selling ${weakest.name} (+${bestDiff.toFixed(1)} gain for ${bestUpgrade.name})...`);
                    const sold = dispatchGameAction({ type: "sell", boardIndex: weakest.index });
                    if (sold) {
                        await sleep(CONFIG.actionDelay);
                        // Follow-up: buy the upgrade
                        dispatchGameAction({ type: "buy", shopIndex: bestUpgrade.index });
                        await sleep(CONFIG.actionDelay);
                        const postState = getGameState();
                        const newUnit = (postState.boardUnits || [])[(postState.boardUnits || []).length - 1];
                        if (newUnit) LOCKED_UIDS.add(newUnit.uid);
                        return;
                    } else {
                        // DOM Fallback
                        const sellButtons = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim() === 'Sell');
                        if (sellButtons[weakest.index]) {
                            triggerClick(sellButtons[weakest.index]);
                            await sleep(CONFIG.actionDelay);
                            return;
                        }
                    }
                }
            }
        }

        // --- STEP 4: FOOD CONSUMPTION (3 Gold) ---
        if (food && gold >= 3 && board.length > 0) {
            let targetIndex = 0;
            if (food === 'apple') {
                // Apple (+1/+1 permanent): Apply to Carry
                targetIndex = state.carryUnit ? state.carryUnit.index : 0;
            } else if (food === 'honey') {
                // Honey (faint drone summon): Apply to Front or Carry
                const withoutHoney = board.find(u => !u.honey);
                targetIndex = withoutHoney ? withoutHoney.index : 0;
            } else if (food === 'potato') {
                // Potato (+2 temporary ATK): Apply to Front attacker
                targetIndex = 0;
            }

            renderOverlay(state, `Feeding ${food.toUpperCase()} to #${targetIndex + 1} (${board[targetIndex]?.name || 'carry'})...`);
            const fed = dispatchGameAction({ type: "feed", boardIndex: targetIndex });
            if (fed) {
                await sleep(CONFIG.actionDelay);
                return;
            } else {
                // DOM fallback
                const useBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Use') && !b.disabled);
                if (useBtn) {
                    triggerClick(useBtn);
                    await sleep(CONFIG.actionDelay);
                    const feedButtons = Array.from(document.querySelectorAll('*')).filter(el => el.children.length === 0 && el.textContent.trim().toUpperCase() === 'FEED');
                    if (feedButtons[targetIndex]) triggerClick(feedButtons[targetIndex]);
                    return;
                }
            }
        }

        // --- STEP 5: STRATEGIC REROLL (Gold Resets, Spend It!) ---
        if (CONFIG.econSmartReroll && gold >= 1) {
            const cheapestPetCost = Math.min(...shopPets.filter(Boolean).map(p => p.cost), 99);
            const canAffordSomething = (gold >= cheapestPetCost) || (gold >= 3 && food);

            // If we have excess gold or cannot buy anything on board, reroll!
            const shouldReroll = (!canAffordSomething && gold >= 1) || (gold >= 4);
            if (shouldReroll) {
                renderOverlay(state, `Cycling shop (Reroll 1g, remaining: ${gold}g)...`);
                const rolled = dispatchGameAction({ type: "reroll" });
                if (rolled) {
                    await sleep(CONFIG.actionDelay);
                    return;
                } else {
                    const rerollBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reroll') && !b.disabled);
                    if (rerollBtn) {
                        triggerClick(rerollBtn);
                        await sleep(CONFIG.actionDelay);
                        return;
                    }
                }
            }
        }

        // --- STEP 6: READY FOR BATTLE ---
        renderOverlay(state, "Board fully optimized! Starting combat...");
        const started = dispatchGameAction({ type: "endShop" });
        if (started) {
            await sleep(CONFIG.actionDelay);
            return;
        } else {
            const fightBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Fight round') && !b.disabled);
            if (fightBtn) {
                triggerClick(fightBtn);
                await sleep(CONFIG.actionDelay);
            }
        }
    }

    // --- MAIN TICK LOOPS ---
    // Fast Transition Poller (Combat Skip, Requeue)
    setInterval(() => {
        try {
            const state = getGameState();
            handleInstantTransitions(state);
        } catch (_) {}
    }, CONFIG.combatPollInterval);

    // Strategic Decision Loop (Shop Phase)
    setInterval(async () => {
        try {
            const state = getGameState();
            if (state.isShopPhase) {
                await executeShopTurn(state);
            } else {
                renderOverlay(state, state.isFightPhase ? "Fast-forwarding battle..." : state.isResultPhase ? "Match completed" : "Waiting for match...");
            }
        } catch (err) {
            console.error("[TA-Bot Loop Error]", err);
        }
    }, CONFIG.loopInterval);

    console.log("%c[Thursday Arena Bot v5.0 Loaded] High-speed SAP meta engine active.", "color:#38bdf8; font-weight:bold; font-size:12px;");
})();
