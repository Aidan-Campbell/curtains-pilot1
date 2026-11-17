/*
 * Curtains Pilot 1 — JavaScript for the Qualtrics "Game" question.
 *
 * Paste everything below into the game question's JavaScript box
 * (click the question → JavaScript), replacing what is there.
 * Then change GAME_ORIGIN to your GitHub Pages address.
 *
 * What it does:
 *   - hides Qualtrics' Next/Back buttons and stretches the game to fill the window
 *   - waits for the game to send its data, stores it in embedded-data fields
 *     curtains_01, curtains_02, ... and a few summary fields, then moves on
 *   - if the participant declines consent, records that and moves on
 */
Qualtrics.SurveyEngine.addOnload(function () {
    this.hideNextButton();
    if (this.hidePreviousButton) this.hidePreviousButton();
});

Qualtrics.SurveyEngine.addOnReady(function () {
    var q = this;

    // Your GitHub Pages address, up to ".io" (or your custom domain), with
    // no slash and no path. Example: 'https://aidancampbell.github.io'
    var GAME_ORIGIN = window.CURTAINS_GAME_ORIGIN_OVERRIDE || 'https://YOURNAME.github.io';

    // Must match the number of curtains_NN fields declared in the Survey Flow.
    var MAX_CHUNKS = 20;

    // Stretch the game frame over the whole window.
    var frame = document.getElementById('curtains-frame');
    if (frame) {
        frame.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
                              'border:0;margin:0;z-index:2147483647;background:#fff;';
    }

    function set(name, value) {
        Qualtrics.SurveyEngine.setEmbeddedData(name, value === null || value === undefined ? '' : String(value));
    }

    var done = false;
    window.addEventListener('message', function (e) {
        if (done || e.origin !== GAME_ORIGIN) return;
        var m = e.data || {};
        if (m.source !== 'curtains') return;

        if (m.type === 'declined') {
            done = true;
            set('curtains_consent', 'no');
            q.clickNextButton();
            return;
        }

        if (m.type === 'failed') {
            done = true;
            set('curtains_status', 'save_failed');
            q.clickNextButton();
            return;
        }

        if (m.type === 'data' && m.chunks && m.chunks.length) {
            done = true;
            for (var i = 0; i < m.chunks.length && i < MAX_CHUNKS; i++) {
                set('curtains_' + (i + 1 < 10 ? '0' : '') + (i + 1), m.chunks[i]);
            }
            set('curtains_nchunks', m.chunks.length);
            set('curtains_consent', 'yes');
            set('curtains_bonus_pence', m.bonus_pence);
            set('curtains_condition', m.condition);
            set('curtains_order', m.order);
            set('curtains_status', m.chunks.length <= MAX_CHUNKS ? 'ok' : 'too_many_chunks');
            // Tell the game its data is stored, then go to the debriefing page.
            e.source.postMessage({ source: 'curtains-host', type: 'ack', n: m.chunks.length }, e.origin);
            setTimeout(function () { q.clickNextButton(); }, 500);
        }
    });
});
