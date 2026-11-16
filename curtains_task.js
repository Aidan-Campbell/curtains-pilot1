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
 *     both conditions take the same total game time (~18.5 min at current pacing).
 *
 * SESSION FLOW
 *   Overview (two games, bonus) → Game 1 instructions → comprehension check →
 *   Game 1 practice → Game 1 (50 rounds) → Game 1 questionnaires →
 *   "New game" screen (new value map + key) → Game 2 practice →
 *   Game 2 (50 rounds) → Game 2 questionnaires → demographics → end screen.
 *
 * HOW A ROUND WORKS (unchanged from v3)
 *   Curtains sit in a fixed grid with values in ascending order (top left
 *   lowest, then left to right and top to bottom). The participant presses
 *   Start; the game removes curtains one bit at a time in a random order:
 *   both groups are outlined and flash, the removed group's outline goes, a
 *   red X marks its curtains and they open to show their values. The last
 *   curtain's value is added to the score.
 *
 * DATA FOR ANALYSIS
 *   - phase 'reveal' = ONE ROW PER ROUND: outcome (points), start_rt (ms to
 *     click Start), prev_outcome / prev_was_win (previous scored round in the
 *     same game), game, n_bits, round_type, cumulative_score, bonus, removal
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
        revealLeadIn_ms: 400,          // after Start, before the first brackets
        bracketFlash_ms: 900,          // both brackets flashing
        markRemoved_ms: 400,           // red X on the removed group, before its curtains open
        removeFlip_ms: 500,            // must match the curtain-flip-open CSS keyframe
        stepGap_ms: 400,               // pause before the next bit's brackets
        finalLeadIn_ms: 500,           // after the last removal, before the survivor opens
        finalHold_ms: 2500,            // fully revealed round stays on screen

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
        openRemovedGroups: true,
        showValueLabels: false,
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
        'curtain_open_purple.png', 'curtain_open_green.png',
        ...OVERLAYS.flatMap(o => [`${o.asset}.png`, `${o.asset}_open.png`]),
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
     * =========================================================================
     */
    const curtainLayerHTML = (curtain, state) => {
        const path = S.assetPath;
        const suffix = (state === 'open') ? '_open' : '';
        const overlayHTML = OVERLAYS
            .filter(o => curtain.features[o.dim] === o.on)
            .map(o => `<img class="curtain-layer" src="${path}${o.asset}${suffix}.png" alt="">`)
            .join('');
        const labelHTML = (S.showValueLabels && curtain.value !== undefined)
            ? `<span class="curtain-label">${formatPoints(curtain.value)}</span>` : '';

        if (state === 'open') {
            const valueClass = curtain.value > 0 ? 'curtain-value-prize' : 'curtain-value-punish';
            return `<img class="curtain-layer" src="${path}curtain_open_${curtain.features.color}.png" alt="">`
                + overlayHTML
                + `<span class="curtain-value ${valueClass}">${formatPoints(curtain.value)}</span>`
                + labelHTML;
        }
        return `<img class="curtain-layer" src="${path}feature_${curtain.features.color}.png" alt="">`
            + overlayHTML + labelHTML;
    };

    const renderStageHTML = (game, roundLabel, scoreLabel) => {
        const curtainsHTML = game.curtains.map(c =>
            `<div class="curtain" data-curtain-id="${c.id}">${curtainLayerHTML(c, 'closed')}</div>`).join('');
        return `<div class="round-header">${roundLabel}</div>
            <div class="score-display">${scoreLabel}</div>
            <div class="curtain-stage">
                <div class="curtain-grid" style="--curtain-cols: ${game.shape.cols}">${curtainsHTML}</div>
                <div class="bracket-layer"></div>
            </div>`;
    };

    const renderValueMapHTML = (game) => {
        const cells = game.curtains.map((c) => {
            const cls = c.value > 0 ? 'map-cell-prize' : 'map-cell-punish';
            return `<div class="map-cell ${cls}">${formatPoints(c.value)}</div>`;
        }).join('');
        return `<div class="value-map" style="--map-cols: ${game.shape.cols}">${cells}</div>`;
    };

    const miniMapHTML = (game, dimId, side) => {
        const cells = game.curtains.map(c =>
            `<div class="mini-cell${c.sides[dimId] === side ? ` mini-on-${side}` : ''}"></div>`).join('');
        return `<div class="mini-map" style="--map-cols: ${game.shape.cols}">${cells}</div>`;
    };
    const keyCurtainHTML = (features) =>
        `<div class="key-curtain">${curtainLayerHTML({ features }, 'closed')}</div>`;

    const renderFeatureKeyHTML = (game) => {
        const cards = game.dims.map((d, i) => {
            let a, b;
            if (d.kind === 'spatial') {
                a = miniMapHTML(game, d.id, 'A'); b = miniMapHTML(game, d.id, 'B');
            } else if (d.id === 'color') {
                a = keyCurtainHTML({ color: d.valueA }); b = keyCurtainHTML({ color: d.valueB });
            } else {
                a = keyCurtainHTML({ color: S.defaultColor, [d.id]: d.valueA });
                b = keyCurtainHTML({ color: S.defaultColor, [d.id]: d.valueB });
            }
            return `<div class="key-card">
                <div class="key-title">${S.randomizeRemovalOrder ? '' : `${i + 1}. `}${d.name}</div>
                <div class="key-pair">
                    <div class="key-item">${a}<div class="key-caption">${d.labelA}</div></div>
                    <div class="key-item">${b}<div class="key-caption">${d.labelB}</div></div>
                </div>
            </div>`;
        }).join('');
        return `<div class="feature-key">${cards}</div>`;
    };

    const keyIntroText = (game) => (game.bits === 1)
        ? 'The curtains are split by color:'
        : (S.randomizeRemovalOrder
            ? `The curtains are split in these ${game.bits} ways, one at a time. The order is random and
               changes every round:`
            : 'The curtains are split in this order:');


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

    const drawBrackets = (displayEl, game, group, side) => {
        const stage = displayEl.querySelector('.curtain-stage');
        const layer = displayEl.querySelector('.bracket-layer');
        const stageBox = stage.getBoundingClientRect();
        const cellBox = (r, c) => {
            const cur = game.curtains.find(x => x.row === r && x.col === c);
            return displayEl.querySelector(`[data-curtain-id="${cur.id}"]`).getBoundingClientRect();
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
     *   7. SCORE (one running total across both games)
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
    const scoreLabelHTML = (isPractice, score = totalScore) => isPractice
        ? `Practice round: points don't count`
        : `Score: ${formatPoints(score)} points &nbsp;·&nbsp; Bonus: ${formatMoney(bonusSubunits(score))}`;


    /*
     * =========================================================================
     *   8. MakeCurtainsRound — Start screen + random removal reveal
     * =========================================================================
     */
    function MakeCurtainsRound(game, roundNum, isPractice) {
        const nPractice = S.nPracticeRounds[game.index - 1] || 0;
        const roundLabel = isPractice
            ? `Game ${game.index} · Practice round ${roundNum} of ${nPractice}`
            : `Game ${game.index} · Round ${roundNum} of ${S.nRoundsPerGame}`;
        const roundType = isPractice ? 'practice' : 'main';

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

        const schedule = () => {
            let t = S.revealLeadIn_ms;
            const events = [];
            const markTime = S.showRemovalX ? S.markRemoved_ms : 0;
            steps.forEach((st, i) => {
                events.push({ time: t, type: 'brackets', step: i });
                events.push({ time: t + S.bracketFlash_ms, type: 'mark', step: i });
                events.push({ time: t + S.bracketFlash_ms + markTime, type: 'open', step: i });
                t += S.bracketFlash_ms + markTime + S.removeFlip_ms + S.stepGap_ms;
            });
            const finalTime = t - S.stepGap_ms + S.finalLeadIn_ms;
            events.push({ time: finalTime, type: 'final' });
            return { events, total: finalTime + S.removeFlip_ms + S.finalHold_ms };
        };

        const baseData = {
            task: 'curtains', round_type: roundType, round: roundNum,
            game: game.index, n_bits: game.bits,
        };

        // Filled in by the Start trial, copied onto this round's reveal row.
        let startRT = null;
        let click = null;
        let clickListener = null;

        const startTrial = {
            type: jsPsychHtmlButtonResponse,
            stimulus: () => renderStageHTML(game, roundLabel, scoreLabelHTML(isPractice)),
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

        const revealTrial = {
            type: jsPsychHtmlKeyboardResponse,
            stimulus: () => renderStageHTML(game, roundLabel, scoreLabelHTML(isPractice)),
            choices: 'NO_KEYS',
            trial_duration: () => schedule().total,
            data: { ...baseData, phase: 'reveal' },
            on_load: () => {
                const displayEl = jsPsych.getDisplayElement();
                const elFor = (c) => displayEl.querySelector(`[data-curtain-id="${c.id}"]`);
                let live = [];

                schedule().events.forEach((ev) => {
                    setTimeout(() => {
                        if (ev.type === 'brackets') {
                            live.forEach(b => b.el.remove());
                            const st = steps[ev.step];
                            live = [
                                ...drawBrackets(displayEl, game, st.groupA, 'a').map(el => ({ el, side: 'A' })),
                                ...drawBrackets(displayEl, game, st.groupB, 'b').map(el => ({ el, side: 'B' })),
                            ];
                        } else if (ev.type === 'mark') {
                            const st = steps[ev.step];
                            live.forEach((b) => {
                                if (b.side === st.keptSide) b.el.classList.remove('bracket-flash');
                                else b.el.remove();
                            });
                            live = live.filter(b => b.side === st.keptSide);
                            if (S.showRemovalX) {
                                st.removed.forEach(c => elFor(c).insertAdjacentHTML('beforeend', REMOVAL_X_HTML));
                            }
                        } else if (ev.type === 'open') {
                            steps[ev.step].removed.forEach((c) => {
                                const el = elFor(c);
                                if (S.openRemovedGroups) {
                                    el.innerHTML = curtainLayerHTML(c, 'open') + (S.showRemovalX ? REMOVAL_X_HTML : '');
                                    el.classList.add('curtain-open', 'curtain-removed');
                                } else {
                                    el.classList.add('curtain-eliminated');
                                }
                            });
                        } else if (ev.type === 'final') {
                            live.forEach(b => b.el.remove());
                            live = [];
                            const el = elFor(survivor);
                            el.innerHTML = curtainLayerHTML(survivor, 'open');
                            el.classList.add('curtain-open', 'curtain-final');
                            const scoreEl = displayEl.querySelector('.score-display');
                            if (scoreEl && !isPractice) scoreEl.innerHTML = scoreLabelHTML(false, totalScore + survivor.value);
                        }
                    }, ev.time);
                });
            },
            on_finish: (data) => {
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
                data.reveal_duration_ms = schedule().total;
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
     *   9. INSTRUCTIONS
     * =========================================================================
     */
    const nStepsText = (game) => (game.bits === 1 ? 'one step' : `${game.bits} steps`);

    const howRoundWorksHTML = (game) => `
        <p>Each round starts when you press <b>Start</b>. The game then removes curtains in
        ${nStepsText(game)}.</p>
        <p>At each step, the curtains still in play are split into two groups, outlined in
        <span class="txt-a">orange</span> and <span class="txt-b">blue</span>. After a moment,
        one group is removed at random: its outline disappears, a red ✕ marks its curtains,
        and they open to show their points.</p>
        <p>${game.bits === 1 ? 'Then' : 'When only one curtain is left,'} your curtain opens and its
        points are added to your score. You don't make any choices; every curtain is equally
        likely to be the last one left.</p>`;

    const valueMapPageHTML = (game) => `
        <p>The points are always <b>in order</b>: the top-left curtain hides the lowest value, and
        the values increase from left to right, then from top to bottom, up to the highest value
        at the bottom right. In Game ${game.index} they are the same on every round:</p>
        ${renderValueMapHTML(game)}
        <p>So on any round of Game ${game.index} you could get anything from ${formatPoints(game.values[0])}
        to ${formatPoints(game.values[game.values.length - 1])} points.</p>`;

    // Overview + Game 1 instructions.
    const g1 = GAMES[0], g2 = GAMES[1];
    const nP1 = S.nPracticeRounds[0] || 0;

    const game1Instructions = {
        type: jsPsychInstructions,
        pages: [
            `<div class='parent'>
                <p>In this study you'll play <b>two versions of a curtain game</b>, one after the other
                (Game 1 and Game 2). They work the same way, but the number of curtains and the points
                behind them are different.</p>
                <p>After each game, you'll answer a few short questions about it.</p>
                <p>You'll earn a bonus from both games together. It starts at
                <b>${formatMoney(S.endowmentSubunits)}</b>, and your points are turned into money:
                <b>${pointRateText()}</b>. Prizes add to your bonus and penalties subtract from it.
                Your bonus is rounded up to the next whole penny, and stays between
                ${formatMoney(S.bonusFloorSubunits)} and ${formatMoney(S.bonusCapSubunits)}.</p>
            </div>`,
            `<div class='parent'>
                <p><b>Game 1.</b> You'll see <b>${g1.nCurtains} curtains</b>. Behind each curtain is a
                different number of points: some are prizes (+) and some are penalties (−).</p>
                <p>On each round, the game removes curtains at random until only one is left.
                Its points are added to your score.</p>
            </div>`,
            `<div class='parent'>${valueMapPageHTML(g1)}</div>`,
            `<div class='parent'>${howRoundWorksHTML(g1)}</div>`,
            `<div class='parent'><p>${keyIntroText(g1)}</p>${renderFeatureKeyHTML(g1)}</div>`,
            `<div class='parent'>
                <p>Game 1 has ${nP1 > 0 ? `${nP1} practice round${nP1 > 1 ? 's' : ''} that
                ${nP1 > 1 ? "don't" : "doesn't"} count, then ` : ''}${S.nRoundsPerGame} rounds that do.</p>
                ${S.includeComprehensionCheck ? `<p>First, a few quick questions to check the rules are clear.</p>` : ''}
            </div>`,
        ],
        show_clickable_nav: true,
        data: { task: 'curtains', phase: 'instructions', game: 1 },
    };

    const COMPREHENSION_QUESTIONS = [
        {
            id: 'value_order',
            prompt: `Which curtain hides the <b>most</b> points?`,
            choices: ['The top-left curtain', 'The bottom-right curtain', 'It changes every round'],
            correct: 1,
        },
        {
            id: 'random_removal',
            prompt: `How are curtains removed?`,
            choices: ['You choose which group to remove', 'The game removes one group at random', 'The group with the most points is always removed'],
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

    // "New game" screen before Game 2.
    const nP2 = S.nPracticeRounds[1] || 0;
    const newGameScreen = {
        type: jsPsychInstructions,
        pages: [
            `<div class='parent'>
                <p><b>Game 2: a new version of the game.</b></p>
                <p>This time there are <b>${g2.nCurtains} curtains</b>, and the points behind them are
                different from Game 1. Everything else works the same way, and your score and bonus
                carry on from Game 1.</p>
            </div>`,
            `<div class='parent'>${valueMapPageHTML(g2)}</div>`,
            `<div class='parent'>
                <p>In Game 2 the curtains are removed in ${nStepsText(g2)}.</p>
                <p>${keyIntroText(g2)}</p>${renderFeatureKeyHTML(g2)}
            </div>`,
            `<div class='parent'>
                <p>Game 2 has ${nP2 > 0 ? `${nP2} practice round${nP2 > 1 ? 's' : ''} that
                ${nP2 > 1 ? "don't" : "doesn't"} count, then ` : ''}${S.nRoundsPerGame} rounds that do.</p>
            </div>`,
        ],
        show_clickable_nav: true,
        data: { task: 'curtains', phase: 'instructions', game: 2 },
    };


    /*
     * =========================================================================
     *   10. QUESTIONNAIRES AFTER EACH GAME
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
     *   11. FULL SESSION
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
