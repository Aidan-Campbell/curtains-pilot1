/**
 * curtains_task.js — Curtains task, PILOT 1
 *
 * Built on version 3 (random removal, ordered values, random removal order).
 *
 * DESIGN
 *   - Two conditions (between-subjects): 1 bit vs 5 bits, or 2 bits vs 4 bits.
 *   - Each participant plays BOTH levels of their condition as two separate
 *     50-round games (within-subjects), in counterbalanced order.
 *   - Condition and order are assigned at random in the code (coin flip each).
 *     For testing, ?pair=1v5|2v4 and ?order=lowFirst|highFirst override this.
 *   - Questionnaires after each game: Melnikoff flow (4 items, 1–9), DQ-GEQ
 *     (7 items, 0–4), enjoyment + motivation sliders, Langer & Roth control
 *     sliders. Demographics once at the end.
 *   - One running score and bonus across both games.
 *   - Because game time grows by the same amount per bit and 1+5 = 2+4,
 *     both conditions take the same total game time (~21 min at current pacing).
 *
 * SESSION FLOW
 *   Game 1 instructions (short screens with looping animations) →
 *   comprehension check (2 questions) → Game 1 practice → Game 1 (50 rounds) →
 *   Game 1 questionnaires → Game 2 intro (new points + animation) →
 *   Game 2 practice → Game 2 (50 rounds) → Game 2 questionnaires →
 *   demographics → end screen.
 *
 * HOW A ROUND WORKS (revised after DM's feedback, Nov 2026)
 *   Curtains sit in a fixed grid with values in ascending order (top left
 *   lowest, then left to right and top to bottom). The Start screen shows an
 *   empty board and the scoreboard. After Start, the points are shown
 *   uncovered for 1 s, the curtains fly in over them, and the game removes
 *   curtains one bit at a time in a random order: both groups are outlined
 *   and flash, the removed group's outline goes, a red X marks its curtains
 *   and they fade away, leaving their points dimmed. The last curtain fades
 *   to show its points, which fly up to the scoreboard; the score reels roll
 *   to the new total.
 *
 * DATA FOR ANALYSIS
 *   - phase 'reveal' = ONE ROW PER ROUND: outcome (points), start_rt (ms from
 *     the Start screen appearing to the Start click; the preview comes after),
 *     prev_outcome / prev_was_win (previous scored round in the same game),
 *     game, n_bits, round_type, cumulative_score, bonus, preview_ms, removal
 *     order and steps, and the Start click (click_x/y on screen,
 *     click_button_x/y within the button, click_trusted, click_keyboard,
 *     click_pointer).
 *   - phase 'end' adds a click summary: clicks_unique_positions,
 *     clicks_with_position, clicks_max_same_position, clicks_prop_same_position,
 *     clicks_untrusted,
 *     clicks_keyboard (scored rounds only).
 *
 * NOT BUILT: distribution rebuilding and yes/no recognition (not in Pilot 1),
 * Prolific redirect and server-side saving (lab pipeline).
 *
 * Plugins: jsPsychHtmlButtonResponse, jsPsychHtmlKeyboardResponse,
 * jsPsychInstructions, jsPsychSurveyLikert, jsPsychHtmlSliderResponse,
 * jsPsychSurveyHtmlForm (all jsPsych 7 / v1.x). `jsPsych` must be
 * initialized before this file loads.
 *
 * TO INTEGRATE into exp.js:
 *   const timeline = [...curtainsTask.fullTimeline, ...other tasks...];
 */

const curtainsTask = (function () {
    'use strict';

    const obj = {};


    /*
     * =========================================================================
     *   1. SETTINGS
     * =========================================================================
     */
    const CURTAINS_SETTINGS = {
        // ── Pilot design ──
        conditions: { '1v5': [1, 5], '2v4': [2, 4] },   // bits played in each condition
        pairUrlParam: 'pair',          // testing override: ?pair=1v5 or ?pair=2v4
        orderUrlParam: 'order',        // testing override: ?order=lowFirst or ?order=highFirst

        // ── Rounds ──
        nRoundsPerGame: 50,
        nPracticeRounds: [2, 1],       // practice rounds before Game 1 and before Game 2

        // ── Values ──
        // Symmetric around 0 in clean steps: ±(max / (N/2)) × k, k = 1 … N/2.
        //   1 bit: ±64 · 2 bits: ±32, ±64 · 3 bits: ±16 … ±64 (steps of 16)
        //   4 bits: ±8 … ±64 (steps of 8) · 5 bits: ±4 … ±64 (steps of 4)
        poolMaxAbs: 64,

        // ── Bonus (one running total across both games) ──
        // £1.00 endowment + 0.1p per point; rounded UP to the next penny;
        // kept between the floor and the cap. Simulated over 100 rounds
        // (1 vs 5 bits): ~3% at the floor, ~0.2% at the cap.
        currencySymbol: '£',
        subunitName: 'p',
        subunitsPerUnit: 100,
        endowmentSubunits: 100,        // £1.00
        subunitsPerPoint: 0.1,         // every 10 points = 1p
        bonusFloorSubunits: 0,         // £0.00
        bonusCapSubunits: 250,         // £2.50

        // ── Pacing (identical per bit at every level) ──
        // After Start: points shown → curtains fly in → removals → last curtain.
        preview_ms: 1000,              // points shown uncovered before the curtains move
        flyIn_ms: 500,                 // must match the cover-fly-in CSS keyframe
        revealLeadIn_ms: 400,          // curtains in place, before the first brackets
        bracketFlash_ms: 900,          // both brackets flashing
        markRemoved_ms: 400,           // red X on the removed group, before its curtains fade
        removeFade_ms: 500,            // must match the .cover opacity transition in the CSS
        stepGap_ms: 400,               // pause before the next bit's brackets
        finalLeadIn_ms: 500,           // after the last removal, before the last curtain fades
        finalHold_ms: 2500,            // round stays on screen; the score update plays inside it:
        floatDelay_ms: 200,            //   last card highlighted, then
        float_ms: 700,                 //   its points fly up to the scoreboard, then
        reelSpin_ms: 600,              //   the score reels roll (leftmost reel stops first,
        reelStagger_ms: 120,           //   each later reel this much later; all done in < 1 s)
        demoFinalLeadIn_ms: 700,       // instructions only: pause before the last curtain fades

        // ── Dimensions ──
        dimensionsByBits: {
            1: ['color'],
            2: ['color', 'topbottom'],
            3: ['color', 'topbottom', 'leftright'],
            4: ['color', 'topbottom', 'leftright', 'dots'],
            5: ['color', 'topbottom', 'leftright', 'dots', 'star'],
        },
        randomizeRemovalOrder: true,

        // ── Display ──
        showRemovalX: true,
        defaultColor: 'green',

        // ── Questionnaires after each game ──
        // Shown in this order after every game; item order is shuffled within
        // each scale when shuffleItemsWithinScales is true.
        //
        // 1. Flow (Melnikoff et al., 2022, Experiments 4–5): "how immersive,
        //    engaging, engrossing, and absorbing the game was", 1 = Not at all
        //    to 9 = Extremely. Question stems are worded from that description.
        melnikoffFlowItems: [
            { id: 'flow_immersive', text: 'How immersive was the game?' },
            { id: 'flow_engaging',  text: 'How engaging was the game?' },
            { id: 'flow_engrossing', text: 'How engrossing was the game?' },
            { id: 'flow_absorbing', text: 'How absorbing was the game?' },
        ],
        melnikoffPoints: 9,

        // 2. DQ-GEQ flow (7 items, 0–4). "The slot machine" is changed to "the game".
        //    Scoring: DQ = items 2, 3, 5, 6, 7; GEQ flow = items 1, 4.
        dqGeqItems: [
            { id: 'dqgeq_1', n: 1, subscale: 'geq', text: 'I forgot everything around me' },
            { id: 'dqgeq_2', n: 2, subscale: 'dq',  text: 'I felt like I was in a trance while playing the game' },
            { id: 'dqgeq_3', n: 3, subscale: 'dq',  text: 'I experienced a memory blackout for a period when I was playing the game' },
            { id: 'dqgeq_4', n: 4, subscale: 'geq', text: 'I felt completely absorbed' },
            { id: 'dqgeq_5', n: 5, subscale: 'dq',  text: 'I felt like I was outside of myself or watching myself play the game' },
            { id: 'dqgeq_6', n: 6, subscale: 'dq',  text: 'I felt like I took on a different identity while playing the game' },
            { id: 'dqgeq_7', n: 7, subscale: 'dq',  text: 'I lost track of time while playing the game' },
        ],
        dqGeqLabels: ['Very slightly or not at all', 'A little', 'Moderately', 'Quite a bit', 'Extremely'],

        // 3. Enjoyment and motivation (100-point sliders).
        // 4. Langer & Roth control items, adapted from spins to rounds
        //    (sliders; the two "wins" items count rounds that won points).
        //    max: null = use the number of rounds in the game.
        sliderItems: [
            { id: 'enjoyment',         block: 'motivation', text: 'How much did you enjoy this game?', min: 0, max: 100, labels: ['No enjoyment', 'Very much'] },
            { id: 'continue_desire',   block: 'motivation', text: 'How much do you want to continue to play the game?', min: 0, max: 100, labels: ['No desire', 'Very much'] },
            { id: 'lr_skill',          block: 'control', text: 'How good do you think you are at this game?', min: 0, max: 100, labels: ['Very bad', 'Very good'] },
            { id: 'lr_distracted',     block: 'control', text: 'How well do you think you would do at this game if you were distracted?', min: 0, max: 100, labels: ['Very bad', 'Very well'] },
            { id: 'lr_practice',       block: 'control', text: 'How much do you think you would improve with practice?', min: 0, max: 100, labels: ['Not at all', 'Very much'] },
            { id: 'lr_wins_past',      block: 'control', text: 'How many wins did you have in the {N} rounds of this game? (A win is a round where you gained points.)', min: 0, max: null, labels: ['0', '{N}'], showValue: true },
            { id: 'lr_wins_next100',   block: 'control', text: 'How many wins do you think you would have in the next 100 rounds?', min: 0, max: 100, labels: ['0', '100'], showValue: true },
        ],
        shuffleItemsWithinScales: true,

        // ── Demographics (once, after Game 2) ──
        includeDemographics: true,

        // ── Comprehension check (demo.html turns this off) ──
        includeComprehensionCheck: true,

        assetPath: 'assets/',
    };

    // Optional per-page overrides: window.CURTAINS_OVERRIDES = {...} before this file loads.
    if (typeof window !== 'undefined' && window.CURTAINS_OVERRIDES) {
        Object.assign(CURTAINS_SETTINGS, window.CURTAINS_OVERRIDES);
    }
    const S = CURTAINS_SETTINGS;


    /*
     * =========================================================================
     *   2. DIMENSIONS AND LAYOUT
     * =========================================================================
     */
    const DIMENSIONS = [
        { id: 'topbottom', kind: 'spatial', name: 'Top or bottom', labelA: 'Top half',  labelB: 'Bottom half' },
        { id: 'leftright', kind: 'spatial', name: 'Left or right', labelA: 'Left half', labelB: 'Right half' },
        { id: 'color',     kind: 'feature', name: 'Color', valueA: 'purple', valueB: 'green',  labelA: 'Purple', labelB: 'Green' },
        { id: 'dots',      kind: 'feature', name: 'Dots',  valueA: 'dots',   valueB: 'nodots', labelA: 'Dots',   labelB: 'No dots' },
        { id: 'star',      kind: 'feature', name: 'Star',  valueA: 'star',   valueB: 'nostar', labelA: 'Star',   labelB: 'No star' },
    ];

    // Grid shape per level (columns × rows = 2^n).
    const LEVEL_SHAPES = {
        1: { cols: 2, rows: 1 },
        2: { cols: 2, rows: 2 },
        3: { cols: 4, rows: 2 },
        4: { cols: 4, rows: 4 },
        5: { cols: 8, rows: 4 },
    };

    const OVERLAYS = [
        { dim: 'dots', on: 'dots', asset: 'feature_dots' },
        { dim: 'star', on: 'star', asset: 'feature_star' },
    ];

    const ASSET_FILES = [
        'feature_purple.png', 'feature_green.png',
        ...OVERLAYS.map(o => `${o.asset}.png`),
    ];


    /*
     * =========================================================================
     *   3. UTILITIES
     * =========================================================================
     */
    const readUrlVar = (name) => {
        try { return jsPsych.data.getURLVariable(name); } catch (e) { return undefined; }
    };
    const coinFlip = (a, b) => (Math.random() < 0.5 ? a : b);
    const shuffle = (arr) => jsPsych.randomization.repeat(arr.slice(), 1);

    const buildValues = (nBits) => {
        const half = Math.pow(2, nBits) / 2;
        const step = S.poolMaxAbs / half;
        const pos = Array.from({ length: half }, (_, k) => Math.round(step * (k + 1)));
        const values = [...pos.slice().reverse().map(v => -v), ...pos];
        if (new Set(values).size !== values.length) {
            throw new Error('curtainsTask: values are not unique after rounding — raise poolMaxAbs.');
        }
        return values;
    };

    const stats = (values) => {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
        return { mean, sd };
    };

    const dimensionsForLevel = (nBits) => {
        const ids = S.dimensionsByBits[nBits] || [];
        const dims = ids.map(id => DIMENSIONS.find(d => d.id === id));
        if (dims.length !== nBits || dims.some(d => !d)) {
            throw new Error(`curtainsTask: dimensionsByBits[${nBits}] must list ${nBits} valid dimension ids.`);
        }
        return dims;
    };

    // Every curtain at an n-bit level: grid position, value, features and side
    // ('A'/'B') of each dimension. Spatial sides come from the grid; feature
    // sides are a fixed pattern inside each block the spatial dimensions leave
    // (color by column parity, dots by row parity, star by column pair).
    const buildCurtains = (nBits, values) => {
        const { cols, rows } = LEVEL_SHAPES[nBits];
        const dims = dimensionsForLevel(nBits);
        const has = (id) => dims.some(d => d.id === id);
        const qc = has('leftright') ? cols / 2 : cols;
        const qr = has('topbottom') ? rows / 2 : rows;

        const curtains = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const lc = col % qc, lr = row % qr;
                const sides = {};
                if (has('topbottom')) sides.topbottom = (row < rows / 2) ? 'A' : 'B';
                if (has('leftright')) sides.leftright = (col < cols / 2) ? 'A' : 'B';
                if (has('color'))     sides.color = ((lc & 1) === 0) ? 'A' : 'B';
                if (has('dots'))      sides.dots  = ((lr & 1) === 0) ? 'A' : 'B';
                if (has('star'))      sides.star  = (((lc >> 1) & 1) === 0) ? 'A' : 'B';

                const features = { color: S.defaultColor };
                dims.filter(d => d.kind === 'feature').forEach((d) => {
                    features[d.id] = (sides[d.id] === 'A') ? d.valueA : d.valueB;
                });

                const position = row * cols + col;
                curtains.push({ id: `c${position}`, position, row, col, value: values[position], sides, features });
            }
        }
        const codes = new Set(curtains.map(c => dims.map(d => c.sides[d.id]).join('')));
        if (codes.size !== curtains.length) throw new Error('curtainsTask: layout gives duplicate curtains.');
        return curtains;
    };

    // One game (block) at a given level: everything that depends on the level.
    const makeGame = (index, bits) => {
        const values = buildValues(bits);
        return {
            index,                                     // 1 or 2
            bits,
            nCurtains: values.length,
            shape: LEVEL_SHAPES[bits],
            dims: dimensionsForLevel(bits),
            values,
            valueSD: stats(values).sd,
            curtains: buildCurtains(bits, values),     // fixed layout, same every round
        };
    };

    const START_SPACER_HTML = `<div aria-hidden="true"><div style="display: inline-block; margin: 0px 8px">
        <button class="jspsych-btn" tabindex="-1" style="visibility: hidden">Start</button></div></div>`;

    const REMOVAL_X_HTML = `<svg class="remove-x" viewBox="0 0 100 100" aria-hidden="true">
        <line x1="18" y1="18" x2="82" y2="82"/><line x1="82" y1="18" x2="18" y2="82"/></svg>`;

    // Bonus in whole pence: endowment + points × rate, rounded UP to the next
    // penny (1.1p → 2p), then kept within floor and cap. The inner round()
    // strips floating-point noise (0.1 × 3 = 0.30000000000000004).
    const bonusSubunits = (score) => {
        const raw = S.endowmentSubunits + score * S.subunitsPerPoint;
        const roundedUp = Math.ceil(Math.round(raw * 1e6) / 1e6);
        return Math.min(S.bonusCapSubunits, Math.max(S.bonusFloorSubunits, roundedUp));
    };
    const formatMoney = (subunits) => `${S.currencySymbol}${(subunits / S.subunitsPerUnit).toFixed(2)}`;
    const pointRateText = () => (S.subunitsPerPoint < 1)
        ? `every ${Math.round(1 / S.subunitsPerPoint)} points are worth 1${S.subunitName}`
        : `each point is worth ${S.subunitsPerPoint}${S.subunitName}`;
    const formatPoints = (v) => `${v > 0 ? '+' : ''}${v}`;

    const preloadedImages = ASSET_FILES.map((f) => { const i = new Image(); i.src = S.assetPath + f; return i; });


    /*
     * =========================================================================
     *   4. CONDITION AND GAMES FOR THIS PARTICIPANT
     * =========================================================================
     */
    const COND = (() => {
        const urlPair = readUrlVar(S.pairUrlParam);
        const urlOrder = readUrlVar(S.orderUrlParam);
        const pairKeys = Object.keys(S.conditions);
        const pair = pairKeys.includes(urlPair) ? urlPair : pairKeys[Math.floor(Math.random() * pairKeys.length)];
        const order = ['lowFirst', 'highFirst'].includes(urlOrder) ? urlOrder : coinFlip('lowFirst', 'highFirst');
        const levels = S.conditions[pair].slice().sort((a, b) => a - b);
        const sequence = (order === 'lowFirst') ? levels : levels.slice().reverse();
        return {
            pair, order, sequence,
            pairSource: pairKeys.includes(urlPair) ? 'url' : 'random',
            orderSource: ['lowFirst', 'highFirst'].includes(urlOrder) ? 'url' : 'random',
        };
    })();
    const GAMES = COND.sequence.map((bits, i) => makeGame(i + 1, bits));

    console.info(`[curtainsTask pilot1] condition ${COND.pair} (${COND.pairSource}), order ${COND.order} `
        + `(${COND.orderSource}): Game 1 = ${GAMES[0].bits} bit(s), Game 2 = ${GAMES[1].bits} bit(s)`);

    jsPsych.data.addProperties({
        curtains_version: 'pilot1',
        pilot_condition: COND.pair,
        pilot_order: COND.order,
        pilot_condition_source: COND.pairSource,
        pilot_order_source: COND.orderSource,
        pilot_bits_sequence: JSON.stringify(COND.sequence),
    });


    /*
     * =========================================================================
     *   5. RENDERING (all per game)
     *
     *   Each grid cell holds a value card (the points) with a curtain cover on
     *   top. The grid's classes set the board state:
     *     values-hidden  empty slots, no numbers (Start screen)
     *     (none)         numbers showing, no curtains (preview)
     *     covered        curtains over every card ('fly' plays the fly-in)
     *   Cell classes during a round: gone (curtain faded out), removed (card
     *   dimmed under a red X), final (last card, highlighted).
     * =========================================================================
     */
    const coverHTML = (curtain) => {
        const path = S.assetPath;
        const overlays = OVERLAYS
            .filter(o => curtain.features[o.dim] === o.on)
            .map(o => `<img class="curtain-layer" src="${path}${o.asset}.png" alt="">`)
            .join('');
        return `<div class="cover"><img class="curtain-layer" src="${path}feature_${curtain.features.color}.png" alt="">${overlays}</div>`;
    };

    const cellHTML = (c, cls = '', extra = '') => `
        <div class="curtain ${cls}" data-curtain-id="${c.id}">
            <div class="value-card ${c.value > 0 ? 'value-prize' : 'value-punish'}"><span class="value-num">${formatPoints(c.value)}</span></div>
            ${coverHTML(c)}${extra}
        </div>`;

    // state: 'empty' | 'values' | 'covered'. cellClass / cellExtra let a demo
    // draw the board part-way through a round without playing any transitions.
    const boardHTML = (game, { state = 'empty', cellClass = () => '', cellExtra = () => '' } = {}) => {
        const gridCls = { empty: 'values-hidden', values: '', covered: 'covered' }[state];
        const cells = game.curtains.map(c => cellHTML(c, cellClass(c), cellExtra(c))).join('');
        return `<div class="curtain-stage">
                <div class="curtain-grid ${gridCls}" style="--curtain-cols: ${game.shape.cols}">${cells}</div>
                <div class="bracket-layer"></div>
            </div>`;
    };


    /*
     * =========================================================================
     *   6. BRACKETS
     * =========================================================================
     */
    const groupRects = (group) => {
        const key = (r, c) => `${r},${c}`;
        const inGroup = new Set(group.map(c => key(c.row, c.col)));
        const seen = new Set();
        const rects = [];
        group.forEach((start) => {
            if (seen.has(key(start.row, start.col))) return;
            const comp = []; const stack = [start];
            seen.add(key(start.row, start.col));
            while (stack.length) {
                const c = stack.pop(); comp.push(c);
                [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dr, dc]) => {
                    const k = key(c.row + dr, c.col + dc);
                    if (inGroup.has(k) && !seen.has(k)) {
                        seen.add(k);
                        stack.push(group.find(g => g.row === c.row + dr && g.col === c.col + dc));
                    }
                });
            }
            const r0 = Math.min(...comp.map(c => c.row)), r1 = Math.max(...comp.map(c => c.row));
            const c0 = Math.min(...comp.map(c => c.col)), c1 = Math.max(...comp.map(c => c.col));
            if (comp.length === (r1 - r0 + 1) * (c1 - c0 + 1)) rects.push({ r0, r1, c0, c1 });
            else comp.forEach(c => rects.push({ r0: c.row, r1: c.row, c0: c.col, c1: c.col }));
        });
        return rects;
    };

    const drawBrackets = (rootEl, game, group, side) => {
        const stage = rootEl.querySelector('.curtain-stage');
        const layer = rootEl.querySelector('.bracket-layer');
        const stageBox = stage.getBoundingClientRect();
        const cellBox = (r, c) => {
            const cur = game.curtains.find(x => x.row === r && x.col === c);
            return rootEl.querySelector(`[data-curtain-id="${cur.id}"]`).getBoundingClientRect();
        };
        const pad = 4;
        return groupRects(group).map(({ r0, r1, c0, c1 }) => {
            const tl = cellBox(r0, c0), br = cellBox(r1, c1);
            const el = document.createElement('div');
            el.className = `bracket bracket-${side} bracket-flash`;
            el.style.left = `${tl.left - stageBox.left - pad}px`;
            el.style.top = `${tl.top - stageBox.top - pad}px`;
            el.style.width = `${br.right - tl.left + 2 * pad}px`;
            el.style.height = `${br.bottom - tl.top + 2 * pad}px`;
            layer.appendChild(el);
            return el;
        });
    };


    /*
     * =========================================================================
     *   7. SCORE AND SCOREBOARD (one running total across both games)
     * =========================================================================
     */
    let totalScore = 0;
    const lastOutcome = { 1: null, 2: null };   // previous scored outcome within each game
    const startClicks = [];                      // every scored Start click, for the end-of-session summary

    // Click-pattern summary over all scored Start clicks. Exact repeats are
    // counted on the position WITHIN the button (robust to small layout shifts).
    const clickSummary = () => {
        const n = startClicks.length;
        const located = startClicks.filter(c => c.bx !== null);   // real mouse/touch clicks only
        const counts = {};
        located.forEach((c) => { const k = `${c.bx},${c.by}`; counts[k] = (counts[k] || 0) + 1; });
        const maxSame = located.length ? Math.max(...Object.values(counts)) : 0;
        return {
            clicks_n: n,
            clicks_with_position: located.length,
            clicks_unique_positions: Object.keys(counts).length,
            clicks_max_same_position: maxSame,
            clicks_prop_same_position: located.length ? Math.round((maxSame / located.length) * 1000) / 1000 : null,
            clicks_untrusted: startClicks.filter(c => !c.trusted).length,
            clicks_keyboard: startClicks.filter(c => c.keyboard).length,
        };
    };

    // Scoreboard: a sign and four digit reels. Each reel is a strip of the
    // digits 0–9 three times over; rolling moves the strip at least one full
    // turn, then snaps back to the first copy of the digit.
    const N_REELS = 4;
    const reelTransform = (pos) => `translateY(calc(${-pos} * var(--reel-h)))`;
    const meterParts = (score) => {
        const abs = Math.min(Math.abs(score), Math.pow(10, N_REELS) - 1);
        const nSig = String(abs).length;
        const digits = String(abs).padStart(N_REELS, '0').split('').map(Number);
        return {
            sign: score > 0 ? '+' : (score < 0 ? '−' : ''),
            digits,
            lead: digits.map((_, i) => i < N_REELS - nSig),   // leading zeros are drawn faint
        };
    };
    const reelStrip = Array.from({ length: 30 }, (_, i) => `<span>${i % 10}</span>`).join('');

    const scoreboardHTML = ({ score, label = 'Score', showBonus = true, practice = false }) => {
        const p = meterParts(score);
        const reels = p.digits.map((d, i) =>
            `<span class="reel${p.lead[i] ? ' lead' : ''}" data-pos="${d}"><span class="reel-strip" style="transform: ${reelTransform(d)}">${reelStrip}</span></span>`).join('');
        return `<div class="scoreboard${practice ? ' sb-practice' : ''}">
                <div class="sb-label">${label}</div>
                <div class="sb-meter"><span class="sb-sign">${p.sign}</span>${reels}</div>
                ${showBonus ? `<div class="sb-bonus">Bonus <b>${formatMoney(bonusSubunits(score))}</b></div>` : ''}
            </div>`;
    };

    const rollScoreboard = (sb, to, timers) => {
        const p = meterParts(to);
        let longest = 0;
        sb.querySelectorAll('.reel').forEach((reel, i) => {
            const strip = reel.firstElementChild;
            const cur = Number(reel.dataset.pos);
            const d = p.digits[i];
            reel.classList.toggle('lead', p.lead[i]);
            if (cur === d) return;
            const target = cur + ((d - cur + 10) % 10) + 10;        // one full turn plus the difference
            const dur = S.reelSpin_ms + i * S.reelStagger_ms;       // reels stop left to right
            longest = Math.max(longest, dur);
            strip.style.transition = `transform ${dur}ms cubic-bezier(.15,.6,.25,1)`;
            strip.style.transform = reelTransform(target);
            reel.dataset.pos = d;
            timers.after(dur + 30, () => {
                strip.style.transition = 'none';
                strip.style.transform = reelTransform(d);
            });
        });
        sb.querySelector('.sb-sign').textContent = p.sign;
        sb.classList.remove('sb-bump'); void sb.offsetWidth; sb.classList.add('sb-bump');
        const bonusEl = sb.querySelector('.sb-bonus b');
        if (bonusEl) timers.after(longest, () => { bonusEl.textContent = formatMoney(bonusSubunits(to)); });
    };

    // The won/lost points fly from the last card up to the scoreboard.
    const floatPoints = (rootEl, fromEl, value, fadeOut) => {
        const wrap = rootEl.querySelector('.cg-wrap');
        const target = rootEl.querySelector('.sb-meter');
        if (!wrap || !target || !fromEl) return;
        const w = wrap.getBoundingClientRect(), a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = `score-float ${value > 0 ? 'float-prize' : 'float-punish'}`;
        el.textContent = formatPoints(value);
        el.style.left = `${a.left + a.width / 2 - w.left}px`;
        el.style.top = `${a.top + a.height / 2 - w.top}px`;
        wrap.appendChild(el);
        const dx = (b.left + b.width / 2) - (a.left + a.width / 2);
        const dy = (b.top + b.height / 2) - (a.top + a.height / 2);
        if (!el.animate) { el.remove(); return; }
        const anim = el.animate([
            { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.25)', opacity: 1, offset: 0.2 },
            { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.7)`, opacity: fadeOut ? 0 : 0.9 },
        ], { duration: S.float_ms, easing: 'ease-in', fill: 'forwards' });
        anim.onfinish = () => el.remove();
    };

    // Timers that can all be cancelled at once (used by instruction demos).
    const makeTimers = () => {
        const ids = new Set();
        return {
            after: (ms, fn) => { const id = setTimeout(() => { ids.delete(id); fn(); }, ms); ids.add(id); return id; },
            clear: () => { ids.forEach(clearTimeout); ids.clear(); },
        };
    };


    /*
     * =========================================================================
     *   8. ONE ROUND: plan, schedule, animation
     * =========================================================================
     */
    // Which curtain survives and which groups go at each step.
    const makePlan = (game) => {
        const survivor = game.curtains[Math.floor(Math.random() * game.curtains.length)];
        const removalOrder = S.randomizeRemovalOrder ? shuffle(game.dims) : game.dims.slice();
        const steps = [];
        let remaining = game.curtains.slice();
        removalOrder.forEach((d) => {
            const keptSide = survivor.sides[d.id];
            const groupA = remaining.filter(c => c.sides[d.id] === 'A');
            const groupB = remaining.filter(c => c.sides[d.id] === 'B');
            const removed = keptSide === 'A' ? groupB : groupA;
            steps.push({ dim: d, keptSide, groupA, groupB, removed });
            remaining = keptSide === 'A' ? groupA : groupB;
        });
        return { survivor, removalOrder, steps };
    };

    // Event times from the moment Start is clicked. Every bit adds the same
    // time, and the preview, fly-in and end-of-round parts are the same at
    // every level.
    const roundSchedule = (plan) => {
        const events = [{ time: 0, type: 'values' }, { time: S.preview_ms, type: 'cover' }];
        const markTime = S.showRemovalX ? S.markRemoved_ms : 0;
        let t = S.preview_ms + S.flyIn_ms + S.revealLeadIn_ms;
        plan.steps.forEach((st, i) => {
            events.push({ time: t, type: 'brackets', step: i });
            events.push({ time: t + S.bracketFlash_ms, type: 'mark', step: i });
            events.push({ time: t + S.bracketFlash_ms + markTime, type: 'remove', step: i });
            t += S.bracketFlash_ms + markTime + S.removeFade_ms + S.stepGap_ms;
        });
        const finalTime = t - S.stepGap_ms + S.finalLeadIn_ms;
        const floatTime = finalTime + S.removeFade_ms + S.floatDelay_ms;
        events.push({ time: finalTime, type: 'final' });
        events.push({ time: floatTime, type: 'float' });
        events.push({ time: floatTime + S.float_ms, type: 'roll' });
        return { events, finalTime, total: finalTime + S.removeFade_ms + S.finalHold_ms };
    };

    // Plays a round inside rootEl (which holds one board, and optionally a
    // scoreboard inside a .cg-wrap). opts.fromFinal skips straight to the end
    // of the round (instruction demo). opts.scoreTo = null: the scoreboard
    // doesn't change (practice rounds, demos without a score).
    const animateRound = (rootEl, game, plan, timers, opts = {}) => {
        const { scoreTo = null, fromFinal = false, practice = false } = opts;
        const grid = rootEl.querySelector('.curtain-grid');
        const elFor = (c) => rootEl.querySelector(`[data-curtain-id="${c.id}"]`);
        let live = [];
        const sched = roundSchedule(plan);
        const shift = fromFinal ? sched.finalTime - S.demoFinalLeadIn_ms : 0;

        sched.events.filter(ev => ev.time >= shift).forEach((ev) => {
            timers.after(ev.time - shift, () => {
                if (ev.type === 'values') {
                    grid.classList.remove('values-hidden');
                } else if (ev.type === 'cover') {
                    grid.classList.add('covered', 'fly');
                } else if (ev.type === 'brackets') {
                    live.forEach(b => b.el.remove());
                    const st = plan.steps[ev.step];
                    live = [
                        ...drawBrackets(rootEl, game, st.groupA, 'a').map(el => ({ el, side: 'A' })),
                        ...drawBrackets(rootEl, game, st.groupB, 'b').map(el => ({ el, side: 'B' })),
                    ];
                } else if (ev.type === 'mark') {
                    const st = plan.steps[ev.step];
                    live.forEach((b) => {
                        if (b.side === st.keptSide) b.el.classList.remove('bracket-flash');
                        else b.el.remove();
                    });
                    live = live.filter(b => b.side === st.keptSide);
                    if (S.showRemovalX) st.removed.forEach(c => elFor(c).insertAdjacentHTML('beforeend', REMOVAL_X_HTML));
                } else if (ev.type === 'remove') {
                    plan.steps[ev.step].removed.forEach(c => elFor(c).classList.add('gone', 'removed'));
                } else if (ev.type === 'final') {
                    live.forEach(b => b.el.remove());
                    live = [];
                    elFor(plan.survivor).classList.add('gone', 'final');
                } else if (ev.type === 'float') {
                    floatPoints(rootEl, elFor(plan.survivor).querySelector('.value-card'), plan.survivor.value, practice || scoreTo === null);
                } else if (ev.type === 'roll') {
                    const sb = rootEl.querySelector('.scoreboard');
                    if (sb && scoreTo !== null) rollScoreboard(sb, scoreTo, timers);
                }
            });
        });
        return sched.total - shift;
    };

    // The board as it stands just before the last curtain goes (instruction demo).
    const endStateBoardHTML = (game, plan) => {
        const removed = new Set(plan.steps.flatMap(st => st.removed.map(c => c.id)));
        return boardHTML(game, {
            state: 'covered',
            cellClass: c => (removed.has(c.id) ? 'gone removed' : ''),
            cellExtra: c => (removed.has(c.id) && S.showRemovalX ? REMOVAL_X_HTML : ''),
        });
    };


    /*
     * =========================================================================
     *   9. MakeCurtainsRound — Start screen + preview + random removal reveal
     * =========================================================================
     */
    function MakeCurtainsRound(game, roundNum, isPractice) {
        const nPractice = S.nPracticeRounds[game.index - 1] || 0;
        const roundLabel = isPractice
            ? `Game ${game.index} · Practice round ${roundNum} of ${nPractice}`
            : `Game ${game.index} · Round ${roundNum} of ${S.nRoundsPerGame}`;
        const roundType = isPractice ? 'practice' : 'main';

        const plan = makePlan(game);
        const { survivor, removalOrder, steps } = plan;

        // Start screen and the first frame of the reveal look the same: the
        // scoreboard and an empty board.
        const screenHTML = () => `<div class="cg-wrap">
                <div class="round-header">${roundLabel}</div>
                ${scoreboardHTML({
                    score: totalScore,
                    label: isPractice ? "Practice round: points don't count" : 'Score',
                    practice: isPractice,
                })}
                ${boardHTML(game, { state: 'empty' })}
            </div>`;

        const baseData = {
            task: 'curtains', round_type: roundType, round: roundNum,
            game: game.index, n_bits: game.bits,
        };

        // Filled in by the Start trial, copied onto this round's reveal row.
        let startRT = null;
        let click = null;
        let clickListener = null;
        let timers = null;

        const startTrial = {
            type: jsPsychHtmlButtonResponse,
            stimulus: screenHTML,
            choices: ['Start'],
            data: { ...baseData, phase: 'start' },   // rt = round-start latency
            on_load: () => {
                // Record exactly where and how Start was clicked (for single-pixel /
                // scripted-click screening). Capture phase, so this runs before the
                // plugin ends the trial.
                const displayEl = jsPsych.getDisplayElement();
                click = null;
                clickListener = (e) => {
                    const btn = e.target.closest && e.target.closest('button');
                    if (!btn || click) return;
                    const r = btn.getBoundingClientRect();
                    // detail === 0: no pointer behind the click (Enter/Space, or a
                    // script calling .click()), so there is no real position to record.
                    const noPointer = e.detail === 0;
                    click = {
                        x: noPointer ? null : Math.round(e.clientX),                   // on screen
                        y: noPointer ? null : Math.round(e.clientY),
                        bx: noPointer ? null : Math.round(e.clientX - r.left),         // within the button
                        by: noPointer ? null : Math.round(e.clientY - r.top),
                        trusted: e.isTrusted,                                          // false = generated by a script
                        keyboard: noPointer,                                           // no mouse/touch position
                        pointer: e.pointerType || null,                                // mouse / touch / pen
                    };
                };
                displayEl.addEventListener('click', clickListener, true);
            },
            on_finish: (data) => {
                jsPsych.getDisplayElement().removeEventListener('click', clickListener, true);
                startRT = data.rt;
                if (click) {
                    Object.assign(data, {
                        click_x: click.x, click_y: click.y, click_button_x: click.bx, click_button_y: click.by,
                        click_trusted: click.trusted, click_keyboard: click.keyboard, click_pointer: click.pointer,
                    });
                    if (!isPractice) startClicks.push(click);
                }
            },
        };

        // The reveal screen keeps an invisible copy of the Start button, so the
        // board doesn't jump when Start is clicked.
        const revealTrial = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: () => screenHTML() + START_SPACER_HTML,
            choices: 'NO_KEYS',
            trial_duration: () => roundSchedule(plan).total,
            data: { ...baseData, phase: 'reveal' },
            on_load: () => {
                timers = makeTimers();
                animateRound(jsPsych.getDisplayElement(), game, plan, timers, {
                    scoreTo: isPractice ? null : totalScore + survivor.value,
                    practice: isPractice,
                });
            },
            on_finish: (data) => {
                if (timers) timers.clear();
                if (!isPractice) totalScore += survivor.value;

                // ONE ROW PER ROUND: this reveal row carries the round's outcome, the
                // Start latency, the previous outcome (for post-win pauses) and the click.
                data.start_rt = startRT;                                  // ms from round screen to Start click
                data.prev_outcome = isPractice ? null : lastOutcome[game.index];   // null on a game's first round
                data.prev_was_win = (data.prev_outcome === null) ? null : data.prev_outcome > 0;
                if (!isPractice) lastOutcome[game.index] = survivor.value;
                if (click) {
                    Object.assign(data, {
                        click_x: click.x, click_y: click.y, click_button_x: click.bx, click_button_y: click.by,
                        click_trusted: click.trusted, click_keyboard: click.keyboard, click_pointer: click.pointer,
                    });
                }

                data.curtain_position = survivor.position;
                data.curtain_row = survivor.row;
                data.curtain_col = survivor.col;
                data.curtain_features = JSON.stringify(survivor.features);
                data.outcome = survivor.value;
                data.cumulative_score = isPractice ? null : totalScore;
                data.bonus_subunits = isPractice ? null : bonusSubunits(totalScore);
                data.reveal_duration_ms = roundSchedule(plan).total;
                data.preview_ms = S.preview_ms;
                data.removal_order = JSON.stringify(removalOrder.map(d => d.id));
                data.removal_steps = JSON.stringify(steps.map(st => ({
                    dim: st.dim.id,
                    kept: st.keptSide === 'A' ? st.dim.labelA : st.dim.labelB,
                    removed_positions: st.removed.map(c => c.position),
                    removed_values: st.removed.map(c => c.value),
                })));
            },
        };

        this.timeline = [startTrial, revealTrial];
    }


    /*
     * =========================================================================
     *   10. INSTRUCTIONS
     *
     *   One idea per screen; looping animations show how a round works, so
     *   the text stays short. A demo is a <div data-demo="..." data-game="1|2">
     *   in a page; demos start whenever a page is shown and stop when it
     *   changes.
     *     cover  points shown, then covered by curtains
     *     round  a whole round, from the points to the last curtain
     *     score  last curtain goes, its points fly to a scoreboard
     * =========================================================================
     */
    const g1 = GAMES[0], g2 = GAMES[1];
    const nP1 = S.nPracticeRounds[0] || 0;
    const nP2 = S.nPracticeRounds[1] || 0;

    const staticBoardHTML = (game) => `<div class="cg-wrap demo-size">${boardHTML(game, { state: 'values' })}</div>`;
    const demoHTML = (kind, game) => `<div class="demo-slot" data-demo="${kind}" data-game="${game.index}"></div>`;

    let demoTimers = makeTimers();
    let demoScore = 0;

    const runDemo = (slot) => {
        const game = GAMES[Number(slot.dataset.game) - 1];
        const kind = slot.dataset.demo;
        const loop = () => {
            if (!slot.isConnected) return;
            if (kind === 'cover') {
                slot.innerHTML = `<div class="cg-wrap demo-size">${boardHTML(game, { state: 'empty' })}</div>`;
                const grid = slot.querySelector('.curtain-grid');
                demoTimers.after(400, () => grid.classList.remove('values-hidden'));
                demoTimers.after(400 + S.preview_ms, () => grid.classList.add('covered', 'fly'));
                demoTimers.after(400 + S.preview_ms + S.flyIn_ms + 1600, loop);
            } else if (kind === 'round') {
                slot.innerHTML = `<div class="cg-wrap demo-size">${boardHTML(game, { state: 'empty' })}</div>`;
                const total = animateRound(slot, game, makePlan(game), demoTimers, {});
                demoTimers.after(total + 400, loop);
            } else if (kind === 'score') {
                const plan = makePlan(game);
                slot.innerHTML = `<div class="cg-wrap demo-size">
                        ${scoreboardHTML({ score: demoScore, showBonus: false })}
                        ${endStateBoardHTML(game, plan)}
                    </div>`;
                demoScore += plan.survivor.value;
                const total = animateRound(slot, game, plan, demoTimers, { scoreTo: demoScore, fromFinal: true });
                demoTimers.after(total + 300, loop);
            }
        };
        loop();
    };

    // jsPsychInstructions redraws the page on Back/Next; watch for that.
    let demoObserver = null;
    const startDemos = () => {
        demoTimers.clear();
        jsPsych.getDisplayElement().querySelectorAll('.demo-slot').forEach(runDemo);
    };
    const demoInstructions = (pages, data) => ({
        type: jsPsychInstructions,
        pages,
        show_clickable_nav: true,
        data,
        on_load: () => {
            demoScore = 0;
            startDemos();
            demoObserver = new MutationObserver(startDemos);
            demoObserver.observe(jsPsych.getDisplayElement(), { childList: true });
        },
        on_finish: () => {
            if (demoObserver) demoObserver.disconnect();
            demoTimers.clear();
        },
    });

    const bonusRuleText = () => {
        const per = S.subunitsPerPoint < 1 ? Math.round(1 / S.subunitsPerPoint) : null;
        return per
            ? `Every ${per} points you win add 1${S.subunitName} to it, and every ${per} points you lose take 1${S.subunitName} away.`
            : `Each point you win adds ${S.subunitsPerPoint}${S.subunitName} to it, and each point you lose takes ${S.subunitsPerPoint}${S.subunitName} away.`;
    };
    const roundsText = (n) => `${n} round${n === 1 ? '' : 's'}`;
    const practiceText = (n, gameIndex) => (n > 0
        ? `Game ${gameIndex} starts with ${n === 1 ? '1 practice round that doesn\'t' : `${n} practice rounds that don't`} count, then ${roundsText(S.nRoundsPerGame)} that ${S.nRoundsPerGame === 1 ? 'does' : 'do'}.`
        : `Game ${gameIndex} has ${roundsText(S.nRoundsPerGame)}.`);

    const game1Instructions = demoInstructions([
        `<div class='parent'>
            <p>In this study you'll play a game called the <b>Curtain Game</b>.</p>
            <p>In the game, you'll see points arranged on the screen, like this:</p>
            ${staticBoardHTML(g1)}
            <p>Each round, you'll win or lose some of these points. To see how, continue to the next screen.</p>
        </div>`,
        `<div class='parent'>
            <p>At the start of each round, you'll see the points for a moment. Then they're covered by curtains:</p>
            ${demoHTML('cover', g1)}
        </div>`,
        `<div class='parent'>
            <p>Then the curtains are removed at random until only one is left:</p>
            ${demoHTML('round', g1)}
            <p>You don't make any choices: every curtain is equally likely to be the last one left.</p>
        </div>`,
        `<div class='parent'>
            <p>The points behind the last curtain are added to your score:</p>
            ${demoHTML('score', g1)}
        </div>`,
        `<div class='parent'>
            <p>Your points are turned into a <b>bonus payment</b>.</p>
            <p>Your bonus starts at <b>${formatMoney(S.endowmentSubunits)}</b>. ${bonusRuleText()}</p>
            <p>Your bonus is rounded up to the next penny, and stays between
            ${formatMoney(S.bonusFloorSubunits)} and ${formatMoney(S.bonusCapSubunits)}.</p>
        </div>`,
        `<div class='parent'>
            <p>You'll play the game twice: <b>Game 1</b> and <b>Game 2</b>. After each game, you'll answer
            a few short questions about it.</p>
            <p>${practiceText(nP1, 1)}</p>
            ${S.includeComprehensionCheck ? `<p>First, two quick questions to check the rules are clear.</p>` : ''}
        </div>`,
    ], { task: 'curtains', phase: 'instructions', game: 1 });

    const COMPREHENSION_QUESTIONS = [
        {
            id: 'random_removal',
            prompt: `How are curtains removed?`,
            choices: ['You choose which curtains to remove', 'The game removes them at random', 'The curtains with the most points are always removed'],
            correct: 1,
        },
        {
            id: 'scoring',
            prompt: `What gets added to your score each round?`,
            choices: ['The points behind every curtain', 'The points behind the last curtain left', 'Nothing until the end'],
            correct: 1,
        },
    ];

    const comprehensionTrials = COMPREHENSION_QUESTIONS.map((q) => ({
        type: jsPsychHtmlButtonResponse,
        stimulus: `<div class='parent'><p>${q.prompt}</p></div>`,
        choices: q.choices,
        data: { task: 'curtains', phase: 'comprehension', question: q.id },
        on_finish: (data) => { data.correct = (data.response === q.correct); },
    }));

    const lastComprehensionPassed = () => jsPsych.data.get()
        .filter({ phase: 'comprehension' })
        .last(COMPREHENSION_QUESTIONS.length)
        .select('correct').values
        .every(v => v === true);

    const comprehensionFeedback = {
        timeline: [{
            type: jsPsychHtmlButtonResponse,
            stimulus: `<div class='parent'><p>At least one answer wasn't quite right.
                Please read the instructions again.</p></div>`,
            choices: ['Back to the instructions'],
            data: { task: 'curtains', phase: 'comprehension_feedback' },
        }],
        conditional_function: () => !lastComprehensionPassed(),
    };

    obj.instructions = S.includeComprehensionCheck
        ? { timeline: [game1Instructions, ...comprehensionTrials, comprehensionFeedback],
            loop_function: () => !lastComprehensionPassed() }
        : { timeline: [game1Instructions] };

    // Before Game 2: the new points and a round at the new size.
    const newGameScreen = demoInstructions([
        `<div class='parent'>
            <p><b>Game 2</b> uses a different set of points:</p>
            ${staticBoardHTML(g2)}
            <p>Everything else works the same way, and your score and bonus carry over from Game 1.</p>
        </div>`,
        `<div class='parent'>
            <p>Here's what a round of Game 2 looks like:</p>
            ${demoHTML('round', g2)}
        </div>`,
        `<div class='parent'><p>${practiceText(nP2, 2)}</p></div>`,
    ], { task: 'curtains', phase: 'instructions', game: 2 });

    /*
     * =========================================================================
     *   11. QUESTIONNAIRES AFTER EACH GAME
     *       Flow (Melnikoff) → DQ-GEQ → enjoyment/motivation → Langer & Roth
     * =========================================================================
     */
    const maybeShuffle = (arr) => (S.shuffleItemsWithinScales ? shuffle(arr) : arr.slice());

    // Rounds in this game that won points (logged next to the "how many wins" item).
    const actualWins = (game) => jsPsych.data.get()
        .filter({ phase: 'reveal', game: game.index, round_type: 'main' })
        .values().filter(x => x.outcome > 0).length;

    const makeGameQuestionnaires = (game) => {
        const g = game.index;
        const qData = (extra) => ({ task: 'curtains', phase: 'questionnaire', game: g, n_bits: game.bits, ...extra });

        const intro = {
            type: jsPsychHtmlButtonResponse,
            stimulus: `<div class='parent'><p><b>Game ${g} is over.</b></p>
                <p>Please answer some questions about <b>Game ${g}</b>, the game you just played.</p></div>`,
            choices: ['Continue'],
            data: { task: 'curtains', phase: 'questionnaire_intro', game: g, n_bits: game.bits },
        };

        // 1. Melnikoff flow, 1–9
        const mPoints = S.melnikoffPoints;
        const mLabels = Array.from({ length: mPoints }, (_, k) =>
            k === 0 ? `1<br>Not at all` : k === mPoints - 1 ? `${mPoints}<br>Extremely` : String(k + 1));
        const melnikoff = {
            type: jsPsychSurveyLikert,
            preamble: `<p class="q-preamble">Please rate <b>Game ${g}</b>, the game you just played.</p>`,
            questions: maybeShuffle(S.melnikoffFlowItems).map(it => ({ prompt: it.text, name: it.id, labels: mLabels, required: true })),
            scale_width: 620,
            data: qData({ scale: 'melnikoff_flow' }),
            on_finish: (data) => {
                const vals = [];
                S.melnikoffFlowItems.forEach((it) => {
                    const v = data.response[it.id] + 1;            // 1–9
                    data[it.id] = v; vals.push(v);
                });
                data.melnikoff_flow_mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            },
        };

        // 2. DQ-GEQ, 0–4
        const dqGeq = {
            type: jsPsychSurveyLikert,
            preamble: `<p class="q-preamble"><b>Think about your experiences in the game you just played
                (Game ${g}).</b> For each of the statements below, please indicate how strongly it
                applied to you.</p>`,
            questions: maybeShuffle(S.dqGeqItems).map(it => ({ prompt: it.text, name: it.id, labels: S.dqGeqLabels, required: true })),
            scale_width: 620,
            data: qData({ scale: 'dq_geq' }),
            on_finish: (data) => {
                let dq = 0, geq = 0;
                S.dqGeqItems.forEach((it) => {
                    const v = data.response[it.id];                // 0–4, as in the scoring sheet
                    data[it.id] = v;
                    if (it.subscale === 'dq') dq += v; else geq += v;
                });
                data.dq_sum = dq;                                  // items 2, 3, 5, 6, 7 (0–20)
                data.geq_flow_sum = geq;                           // items 1, 4 (0–8)
            },
        };

        // 3–4. Sliders, one per screen. Motivation items, then control items.
        const sliderTrial = (it) => {
            const max = (it.max === null) ? S.nRoundsPerGame : it.max;
            const fill = (txt) => String(txt).replace('{N}', S.nRoundsPerGame);
            return {
                type: jsPsychHtmlSliderResponse,
                stimulus: `<div class='parent slider-q'><p class="slider-context">Game ${g}</p>
                    <p class="slider-text">${fill(it.text)}</p></div>`,
                labels: it.labels.map(fill),
                min: it.min, max, step: 1,
                slider_start: Math.round((it.min + max) / 2),
                require_movement: true,
                slider_width: 520,
                prompt: it.showValue ? `<p class="slider-value">Your answer: <b><span class="slider-readout">–</span></b></p>` : '',
                data: qData({ scale: it.block, item: it.id, slider_max: max }),
                on_load: () => {
                    if (!it.showValue) return;
                    const input = jsPsych.getDisplayElement().querySelector('input[type="range"]');
                    const out = jsPsych.getDisplayElement().querySelector('.slider-readout');
                    input.addEventListener('input', () => { out.textContent = input.value; });
                },
                on_finish: (data) => {
                    data[it.id] = Number(data.response);
                    if (it.id === 'lr_wins_past') data.actual_wins = actualWins(game);
                },
            };
        };
        const motivation = maybeShuffle(S.sliderItems.filter(it => it.block === 'motivation')).map(sliderTrial);
        const control = maybeShuffle(S.sliderItems.filter(it => it.block === 'control')).map(sliderTrial);

        return { timeline: [intro, melnikoff, dqGeq, ...motivation, ...control] };
    };


    /*
     * =========================================================================
     *   10b. DEMOGRAPHICS (once, after Game 2)
     * =========================================================================
     */
    const radioGroup = (name, question, options) => `
        <fieldset class="demo-q"><legend>${question}</legend>
        ${options.map((o, i) => `<label class="demo-opt"><input type="radio" name="${name}" value="${o}"
            ${i === 0 ? 'required' : ''}> ${o}</label>`).join('')}
        </fieldset>`;

    const CULTURE_OPTIONS = ['European', 'East Asian', 'South Asian', 'Southeast Asian', 'Indigenous',
        'Hispanic or Latin', 'Middle Eastern', 'African', 'Prefer not to answer'];

    const demographicsHTML = `
        ${radioGroup('age', '1. What is your age?',
            ['21-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65+'])}
        ${radioGroup('gender', '2. What is your gender?',
            ['Man', 'Woman', 'Non-binary (e.g., genderfluid)', 'Prefer not to answer'])}
        <fieldset class="demo-q"><legend>3. What is your cultural background? Select all that apply.</legend>
            ${CULTURE_OPTIONS.map(o => `<label class="demo-opt"><input type="checkbox" name="culture" value="${o}"> ${o}</label>`).join('')}
            <label class="demo-opt"><input type="checkbox" name="culture" value="Other" id="culture-other-box"> Other (please specify)</label>
            <input type="text" name="culture_other_text" id="culture-other-text" class="demo-text" placeholder="Please specify" disabled>
        </fieldset>
        ${radioGroup('education', '4. What is the highest level of education you have completed?',
            ['Some high school (no diploma)', 'High school diploma or equivalent', 'Some college or university (no degree)',
             'College diploma or associate degree', "Bachelor's degree", "Master's degree",
             'Doctoral degree (e.g., PhD, EdD)', 'Professional doctoral degree (e.g., MD, JD)'])}
        ${radioGroup('employment', '5. What is your current employment status?',
            ['Employed full time', 'Employed part time', 'Not employed, looking for work', 'Not employed, not looking for work',
             'Student', 'Self-employed', 'Retired', 'Homemaker or caregiver'])}
        ${radioGroup('marital', '6. Please report your marital status.',
            ['Married', 'Widowed', 'Divorced', 'Separated', 'Never married'])}`;

    obj.demographics = {
        type: jsPsychSurveyHtmlForm,
        preamble: `<p class="q-preamble"><b>Finally, a few questions about you.</b></p>`,
        html: `<div class="demo-form">${demographicsHTML}</div>`,
        button_label: 'Continue',
        dataAsArray: true,
        data: { task: 'curtains', phase: 'demographics' },
        on_load: () => {
            // Cultural background: at least one box; "Other" needs the text box filled.
            const root = jsPsych.getDisplayElement();
            const boxes = Array.from(root.querySelectorAll('input[name="culture"]'));
            const otherBox = root.querySelector('#culture-other-box');
            const otherText = root.querySelector('#culture-other-text');
            const update = () => {
                boxes[0].setCustomValidity(boxes.some(b => b.checked) ? '' : 'Please select at least one option.');
                otherText.disabled = !otherBox.checked;
                otherText.required = otherBox.checked;
            };
            boxes.forEach(b => b.addEventListener('change', update));
            update();
        },
        on_finish: (data) => {
            // Flatten the form into one column per question.
            const arr = data.response;
            const one = (name) => (arr.find(x => x.name === name) || {}).value || null;
            data.demo_age = one('age');
            data.demo_gender = one('gender');
            data.demo_culture = JSON.stringify(arr.filter(x => x.name === 'culture').map(x => x.value));
            data.demo_culture_other = one('culture_other_text');
            data.demo_education = one('education');
            data.demo_employment = one('employment');
            data.demo_marital = one('marital');
        },
    };


    /*
     * =========================================================================
     *   12. FULL SESSION
     * =========================================================================
     */
    const practiceDone = (game) => ({
        type: jsPsychHtmlButtonResponse,
        stimulus: () => `<div class='parent'><p>That's the end of the practice.</p>
            <p>Game ${game.index} starts now. Your score is ${formatPoints(totalScore)} points and your
            bonus is ${formatMoney(bonusSubunits(totalScore))}.</p></div>`,
        choices: [`Start Game ${game.index}`],
        data: { task: 'curtains', phase: 'practice_done', game: game.index },
    });

    const gameBlock = (game) => {
        const nP = S.nPracticeRounds[game.index - 1] || 0;
        const practice = Array.from({ length: nP }, (_, i) => new MakeCurtainsRound(game, i + 1, true));
        const rounds = Array.from({ length: S.nRoundsPerGame }, (_, i) => new MakeCurtainsRound(game, i + 1, false));
        return {
            timeline: [
                ...(nP > 0 ? [...practice, practiceDone(game)] : []),
                ...rounds,
                makeGameQuestionnaires(game),
            ],
        };
    };

    obj.game1 = gameBlock(g1);
    obj.newGameScreen = newGameScreen;
    obj.game2 = gameBlock(g2);

    obj.endScreen = {
        type: jsPsychHtmlButtonResponse,
        stimulus: () => `<div class='parent'><p>Both games are over. Thank you!</p>
            <p>Final score: <b>${formatPoints(totalScore)} points</b></p>
            <p>Your bonus: <b>${formatMoney(bonusSubunits(totalScore))}</b></p></div>`,
        choices: ['Continue'],
        data: { task: 'curtains', phase: 'end' },
        on_finish: (data) => {
            data.final_score = totalScore;
            data.final_bonus_subunits = bonusSubunits(totalScore);
            // Data-quality screen: how varied the Start clicks were across all scored rounds.
            Object.assign(data, clickSummary());
        },
    };

    obj.fullTimeline = [obj.instructions, obj.game1, obj.newGameScreen, obj.game2,
        ...(S.includeDemographics ? [obj.demographics] : []), obj.endScreen];

    obj.condition = COND;
    obj.games = GAMES;
    obj.preloadImages = ASSET_FILES.map(f => S.assetPath + f);
    obj._debug = { CURTAINS_SETTINGS, DIMENSIONS, LEVEL_SHAPES, buildValues, buildCurtains, groupRects, bonusSubunits, preloadedImages };

    return obj;

}());
