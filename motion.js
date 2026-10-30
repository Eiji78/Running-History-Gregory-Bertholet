/* ═══════════════════════════════════════════════════════════════════════
   MOTION.JS — couche motion design commune à toutes les pages
   Rideau de transition · titres cinétiques · révélations au scroll ·
   chiffres décodés · cartes 3D · curseur lumineux · fond animé
   Vocabulaire repris des règles HyperFrames (expo.out à l'arrivée,
   sorties plus courtes, stagger lettre/mot, titre immobile une fois posé).
   Aucune donnée n'est réécrite : chaque texte découpé est restauré à l'identique.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const root = document.documentElement;
    if (!root.classList.contains('mo')) { root.classList.add('mo-done'); return; }

    const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
    const EASE_INOUT = 'cubic-bezier(.76,0,.24,1)';
    const EASE_IN = 'cubic-bezier(.55,0,.68,.19)';
    const EASE_BACK = 'cubic-bezier(.34,1.56,.64,1)';
    const FINE = matchMedia('(pointer: fine)').matches;
    const SMALL = matchMedia('(max-width: 760px)').matches;

    const LABELS = {
        'index.html': 'RUNNING HISTORY',
        'timeline.html': 'TIMELINE',
        'progression.html': 'PROGRESSION',
        'entrainements.html': 'PRÉPA MARATHON',
        'radar.html': 'RADAR DE PERF',
        'elite.html': "VS L'ÉLITE",
        'carte.html': 'CARTE DES COURSES',
        'comparaison.html': 'COMPARATEUR',
        'meteo.html': 'MÉTÉO & PERFS',
        'galerie.html': 'GALERIE',
        'wrapped.html': 'WRAPPED',
        'adn.html': 'ADN DU COUREUR',
        'age-grading.html': 'AGE GRADING',
        'trophees.html': 'MUR DES TROPHÉES',
        'archives.html': 'ARCHIVES',
        'machine-temps.html': 'TIME MACHINE',
        'tour-du-monde.html': 'TOUR DU MONDE',
        '404.html': '404'
    };
    const fileOf = (p) => (p.split('/').pop() || 'index.html');
    const PAGE = fileOf(location.pathname);

    const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter) ? new Intl.Segmenter('fr', { granularity: 'grapheme' }) : null;
    const graphemes = (s) => segmenter ? Array.from(segmenter.segment(s), (x) => x.segment) : Array.from(s);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const animDone = (a) => a ? a.finished.catch(() => {}) : Promise.resolve();

    // ════════════════════════════════════════════════════════════════════
    //  Découpage réversible d'un texte en mots / lettres
    // ════════════════════════════════════════════════════════════════════
    function clipTextHost(node, stop) {
        for (let el = node.parentElement; el; el = el.parentElement) {
            const cs = getComputedStyle(el);
            if (cs.webkitBackgroundClip === 'text' || cs.backgroundClip === 'text') return el;
            if (el === stop) break;
        }
        return null;
    }

    function split(el, unit) {
        const pairs = [];
        const units = [];
        const hosts = new Map();
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                const p = n.parentElement;
                if (!p || p.closest('svg, script, style, .title-emoji, .mo-split')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);

        nodes.forEach((t) => {
            const host = clipTextHost(t, el);
            const wrap = document.createElement('span');
            wrap.className = 'mo-split';
            t.nodeValue.split(/(\s+)/).forEach((tok) => {
                if (!tok) return;
                if (/^\s+$/.test(tok)) { wrap.appendChild(document.createTextNode(tok)); return; }
                const w = document.createElement('span');
                w.className = 'mo-w';
                if (unit === 'word') {
                    w.textContent = tok;
                    units.push(w);
                    if (host) hosts.set(w, host);
                } else {
                    graphemes(tok).forEach((g) => {
                        const c = document.createElement('span');
                        c.className = 'mo-c';
                        c.textContent = g;
                        w.appendChild(c);
                        units.push(c);
                        if (host) hosts.set(c, host);
                    });
                }
                wrap.appendChild(w);
            });
            t.parentNode.replaceChild(wrap, t);
            pairs.push([wrap, t]);
        });

        // Les titres en dégradé « background-clip: text » : Chrome n'affiche pas ce
        // découpage sur un élément animé, donc chaque morceau prend pendant l'effet
        // la couleur du dégradé à sa position ; le dégradé revient à la restauration.
        const muted = [];
        if (hosts.size) {
            const seen = new Map();
            hosts.forEach((host, u) => {
                if (!seen.has(host)) {
                    const cs = getComputedStyle(host);
                    seen.set(host, { r: host.getBoundingClientRect(), stops: gradientStops(cs.backgroundImage) });
                    muted.push([host, host.style.getPropertyValue('background-image'), host.style.getPropertyPriority('background-image')]);
                }
            });
            hosts.forEach((host, u) => {
                const { r, stops } = seen.get(host);
                const ur = u.getBoundingClientRect();
                const t = r.width ? (ur.left + ur.width / 2 - r.left) / r.width : 0;
                const col = mixStops(stops, t);
                u.style.color = col;
                u.style.webkitTextFillColor = col;
            });
            muted.forEach(([host]) => host.style.setProperty('background-image', 'none', 'important'));
        }

        return {
            units,
            restore() {
                pairs.forEach(([wrap, t]) => { if (wrap.parentNode) wrap.parentNode.replaceChild(t, wrap); });
                muted.forEach(([host, v, prio]) => {
                    if (v) host.style.setProperty('background-image', v, prio);
                    else host.style.removeProperty('background-image');
                });
            }
        };
    }

    function gradientStops(bg) {
        const list = (bg || '').match(/rgba?\([^)]+\)/g) || [];
        const stops = list.map((c) => c.match(/[\d.]+/g).map(Number));
        return stops.length ? stops : [[255, 255, 255]];
    }

    function mixStops(stops, t) {
        if (stops.length === 1) return 'rgb(' + stops[0].slice(0, 3).join(',') + ')';
        const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
        const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
        const a = stops[i], b = stops[i + 1];
        return 'rgb(' + [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)).join(',') + ')';
    }

    // ════════════════════════════════════════════════════════════════════
    //  Rideau de transition entre pages
    // ════════════════════════════════════════════════════════════════════
    const SLATS = SMALL ? 4 : 7;
    let curtain, curTitle, curLine, curArt, slats = [];

    function buildCurtain() {
        curtain = document.createElement('div');
        curtain.id = 'mo-curtain';
        curtain.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < SLATS; i++) {
            const s = document.createElement('div');
            s.className = 'mo-slat';
            curtain.appendChild(s);
            slats.push(s);
        }
        const art = document.createElement('div');
        art.className = 'mo-cur-art';
        curtain.appendChild(art);
        const lab = document.createElement('div');
        lab.className = 'mo-cur-label';
        lab.innerHTML = '<span class="mo-cur-kicker">RUNNING HISTORY · GREGORY BERTHOLET</span>' +
            '<span class="mo-cur-title"></span><span class="mo-cur-line"></span>';
        curtain.appendChild(lab);
        curArt = art;
        curTitle = lab.querySelector('.mo-cur-title');
        curLine = lab.querySelector('.mo-cur-line');
        document.body.appendChild(curtain);
    }

    function setCurtainLabel(txt) {
        curTitle.textContent = '';
        graphemes(txt).forEach((g) => {
            const c = document.createElement('span');
            c.className = 'mo-c';
            c.textContent = g;
            curTitle.appendChild(c);
        });
        return Array.from(curTitle.children);
    }

    // Entrée : le rideau couvre la page puis s'ouvre en lamelles
    async function openCurtain(label) {
        const chars = setCurtainLabel(label);
        slats.forEach((s) => { s.style.transform = 'scaleY(1)'; });
        curArt.style.opacity = '1';
        curtain.classList.add('mo-on');
        root.classList.remove('mo-cover');
        root.removeAttribute('data-mo-label');
        await wait(140);

        const anims = [];
        chars.forEach((c, i) => anims.push(c.animate(
            [{ opacity: 1, transform: 'none', filter: 'blur(0)' },
             { opacity: 0, transform: 'translateY(-0.5em)', filter: 'blur(10px)' }],
            { duration: 300, delay: i * 14, easing: EASE_IN, fill: 'forwards' })));
        anims.push(curLine.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)', transformOrigin: 'right center' }],
            { duration: 320, easing: EASE_IN, fill: 'forwards' }));
        anims.push(curArt.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(9%) scale(1.04)' }],
            { duration: 520, easing: EASE_IN, fill: 'forwards' }));
        anims.push(curtain.querySelector('.mo-cur-kicker').animate([{ opacity: 1 }, { opacity: 0, letterSpacing: '0.9em' }],
            { duration: 320, easing: EASE_IN, fill: 'forwards' }));
        const mid = (SLATS - 1) / 2;
        slats.forEach((s, i) => {
            s.style.transformOrigin = 'top center';
            anims.push(s.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }],
                { duration: 720, delay: 160 + Math.abs(i - mid) * 55, easing: EASE_INOUT, fill: 'forwards' }));
        });
        await Promise.all(anims.map(animDone));
        curtain.classList.remove('mo-on');
        slats.forEach((s) => { s.style.transform = 'scaleY(0)'; });
        curArt.style.opacity = '0';
        anims.forEach((a) => a.cancel());
    }

    // Sortie : les lamelles tombent, le nom de la destination s'écrit, on navigue
    let leaving = false;
    async function closeCurtainAndGo(href, label) {
        if (leaving) return;
        leaving = true;
        try { sessionStorage.setItem('mo-nav', label); } catch (e) { /* stockage indisponible */ }
        const failsafe = setTimeout(() => { location.href = href; }, 1400);
        const chars = setCurtainLabel(label);
        chars.forEach((c) => { c.style.opacity = '0'; });
        curLine.style.transform = 'scaleX(0)';
        curtain.classList.add('mo-on');
        const anims = [];
        slats.forEach((s, i) => {
            s.style.transformOrigin = 'bottom center';
            anims.push(s.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }],
                { duration: 520, delay: i * 38, easing: EASE_INOUT, fill: 'forwards' }));
        });
        chars.forEach((c, i) => anims.push(c.animate(
            [{ opacity: 0, transform: 'translateY(0.6em) scale(.9)', filter: 'blur(12px)' },
             { opacity: 1, transform: 'none', filter: 'blur(0)' }],
            { duration: 520, delay: 300 + i * 18, easing: EASE_OUT, fill: 'forwards' })));
        anims.push(curLine.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
            { duration: 600, delay: 360, easing: EASE_OUT, fill: 'forwards' }));
        anims.push(curArt.animate([{ opacity: 0, transform: 'translateX(-12%) scale(1.06)' }, { opacity: 1, transform: 'none' }],
            { duration: 700, delay: 200, easing: EASE_OUT, fill: 'forwards' }));
        await Promise.all(anims.slice(0, SLATS).map(animDone));
        await wait(280);
        clearTimeout(failsafe);
        location.href = href;
    }

    function bindLinks() {
        document.addEventListener('click', (e) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const a = e.target.closest('a[href]');
            if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
            let url;
            try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
            if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
            if (url.pathname === location.pathname) return;
            const file = fileOf(url.pathname);
            if (!/\.html?$/i.test(file) && file !== 'index.html' && url.pathname.slice(-1) !== '/') return;
            e.preventDefault();
            closeCurtainAndGo(url.href, LABELS[file] || file.replace(/\.html?$/i, '').toUpperCase());
        });
        // Retour arrière depuis le cache : on rouvre la page
        window.addEventListener('pageshow', (e) => {
            if (!e.persisted) return;
            leaving = false;
            curtain.classList.remove('mo-on');
            slats.forEach((s) => { s.getAnimations().forEach((a) => a.cancel()); s.style.transform = 'scaleY(0)'; });
            curtain.querySelectorAll('*').forEach((n) => n.getAnimations().forEach((a) => a.cancel()));
            curArt.style.opacity = '0';
        });
    }

    // ════════════════════════════════════════════════════════════════════
    //  Titres des pages : une mise en scène propre à chaque page
    //  (photo-finish, tableau à volets, électrocardiogramme, radar, orbite…)
    //  Chaque effet découpe le titre, joue, puis restaure le texte d'origine.
    // ════════════════════════════════════════════════════════════════════
    function heroTitles() {
        const list = [];
        document.querySelectorAll('h1, .page-title, .main-title').forEach((el) => {
            if (el.closest('#mo-curtain, nav, .pro-mobile-nav, [aria-hidden="true"]')) return;
            if (list.some((x) => x.contains(el) || el.contains(x))) return;
            list.push(el);
        });
        return list;
    }

    const rnd = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const easeOut = (t) => 1 - Math.pow(1 - t, 4);
    const easeInOut = (t) => t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;

    // Calque de décor posé exactement sur le titre (étincelles, lignes, anneaux)
    function fxLayer(el) {
        const r = el.getBoundingClientRect();
        const body = document.body;
        let ox = scrollX, oy = scrollY;
        if (getComputedStyle(body).position !== 'static') {
            const br = body.getBoundingClientRect();
            ox = -br.left - body.clientLeft; oy = -br.top - body.clientTop;
        }
        const L = document.createElement('div');
        L.className = 'mo-fx';
        L.setAttribute('aria-hidden', 'true');
        L.style.left = (r.left + ox) + 'px';
        L.style.top = (r.top + oy) + 'px';
        L.style.width = r.width + 'px';
        L.style.height = r.height + 'px';
        body.appendChild(L);
        return L;
    }

    function makeFx(el, chars, delay) {
        const L = fxLayer(el);
        const lr = L.getBoundingClientRect();
        const box = (n) => {
            const r = n.getBoundingClientRect();
            return { x: r.left - lr.left + r.width / 2, y: r.top - lr.top + r.height / 2, w: r.width, h: r.height, top: r.top - lr.top, bottom: r.bottom - lr.top, left: r.left - lr.left };
        };
        const fx = {
            el, chars, L, d: delay, W: lr.width, H: lr.height,
            P: chars.map(box),
            icons: Array.from(el.querySelectorAll('.title-emoji, .title-icon')),
            box, jobs: [], made: [],
            A(node, frames, opts) {
                const a = node.animate(frames, Object.assign({ easing: EASE_OUT, fill: 'backwards' }, opts));
                fx.made.push(a);
                fx.jobs.push(animDone(a));
                return a;
            },
            wait(p) { fx.jobs.push(p); return p; },
            add(tag, css) {
                const n = document.createElement(tag || 'div');
                if (css) n.style.cssText = css;
                L.appendChild(n);
                return n;
            },
            tween(dur, delay2, fn) {
                return fx.wait(new Promise((res) => {
                    const t0 = performance.now() + delay2;
                    fn(0);
                    const f = (now) => {
                        const p = clamp01((now - t0) / dur);
                        fn(p);
                        if (p < 1) requestAnimationFrame(f); else res();
                    };
                    requestAnimationFrame(f);
                }));
            },
            later(ms, fn) { fx.wait(new Promise((res) => setTimeout(() => { try { fn(); } catch (e) { /* décor seulement */ } res(); }, ms))); },
            burst(x, y, n, colors, o) {
                o = o || {};
                for (let k = 0; k < n; k++) {
                    const s = (o.size || 4) * (0.6 + Math.random() * 0.8);
                    const p = fx.add('i', 'left:' + x + 'px;top:' + y + 'px;width:' + s + 'px;height:' + s + 'px;opacity:0;background:' + colors[k % colors.length] +
                        ';box-shadow:0 0 ' + (s * 2) + 'px ' + colors[k % colors.length] + (o.square ? ';border-radius:1px' : ''));
                    p.className = 'mo-spark';
                    const a = (o.angle != null ? o.angle + (Math.random() - 0.5) * (o.cone || 1.2) : Math.random() * Math.PI * 2);
                    const v = (o.spread || 60) * (0.35 + Math.random() * 0.9);
                    const g = o.gravity == null ? 30 : o.gravity;
                    const rot = o.spin ? ' rotate(' + Math.round((Math.random() - 0.5) * 720) + 'deg)' : '';
                    fx.A(p, [
                        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
                        { opacity: 1, transform: 'translate(calc(-50% + ' + (Math.cos(a) * v * 0.7) + 'px), calc(-50% + ' + (Math.sin(a) * v * 0.7) + 'px)) scale(.9)' + rot, offset: 0.45 },
                        { opacity: 0, transform: 'translate(calc(-50% + ' + (Math.cos(a) * v) + 'px), calc(-50% + ' + (Math.sin(a) * v + g) + 'px)) scale(.2)' + rot }
                    ], { duration: (o.life || 900) * (0.7 + Math.random() * 0.6), delay: o.delay || 0, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'forwards' });
                }
            },
            ring(x, y, size, color, delay2, o) {
                o = o || {};
                const r = fx.add('i', 'left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + (size * (o.flat || 1)) + 'px;opacity:0;border:' + (o.width || 2) + 'px solid ' + color + ';box-shadow:0 0 12px ' + color);
                r.className = 'mo-ring';
                fx.A(r, [{ opacity: 0.95, transform: 'translate(-50%,-50%) scale(.15)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }],
                    { duration: o.life || 700, delay: delay2, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
            },
            svg(w, h) {
                const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                s.setAttribute('width', w); s.setAttribute('height', h);
                s.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
                s.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
                L.appendChild(s);
                return s;
            },
            path(svgEl, d, stroke, width, o) {
                o = o || {};
                const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                p.setAttribute('d', d);
                p.setAttribute('fill', 'none');
                p.setAttribute('stroke', stroke);
                p.setAttribute('stroke-width', width);
                p.setAttribute('stroke-linecap', 'round');
                p.setAttribute('stroke-linejoin', 'round');
                if (o.dash) p.setAttribute('stroke-dasharray', o.dash);
                p.style.filter = 'drop-shadow(0 0 6px ' + (o.glow || stroke) + ')';
                svgEl.appendChild(p);
                return p;
            },
            flash(color, delay2, dur) {
                const f = fx.add('i', 'inset:-30% -8%;opacity:0;border-radius:40%;background:radial-gradient(closest-side, ' + color + ', transparent)');
                f.className = 'mo-flash';
                fx.A(f, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 0 }], { duration: dur || 600, delay: delay2, easing: 'ease-out', fill: 'forwards' });
            },
            iconPop(delay2, frames, dur) {
                fx.icons.forEach((ic) => fx.A(ic, frames || [
                    { opacity: 0, transform: 'scale(0) rotate(-200deg)' }, { opacity: 1, transform: 'none' }
                ], { duration: dur || 900, delay: delay2, easing: EASE_BACK }));
            },
            // Balayage de lumière une fois le titre posé (puis immobile)
            shine(delay2, color, step) {
                chars.forEach((c, i) => fx.A(c, [
                    { filter: 'brightness(1)' },
                    { filter: 'brightness(2.2) drop-shadow(0 0 12px ' + color + ')', offset: 0.4 },
                    { filter: 'brightness(1)' }
                ], { duration: 520, delay: delay2 + i * (step || 16), easing: 'ease-in-out', fill: 'none' }));
            }
        };
        return fx;
    }

    // ── 1. Accueil : PHOTO-FINISH — la ligne d'arrivée balaie, le flash crépite
    function fxPhotoFinish(fx) {
        const { W, H, P, chars, d } = fx;
        const run = 1250;
        const line = fx.add('i', 'top:-14%;bottom:-14%;left:0;width:3px;opacity:0;background:linear-gradient(180deg,transparent,#00fff9 12%,#fff 50%,#00fff9 88%,transparent);box-shadow:0 0 18px #00fff9,0 0 40px rgba(0,255,249,.6)');
        const tag = fx.add('b', 'top:-34px;left:0;opacity:0;font:700 12px/1 "JetBrains Mono",monospace;letter-spacing:.18em;color:#00fff9;white-space:nowrap;text-shadow:0 0 10px #00fff9');
        const rec = document.querySelector('.flagship-time');
        const target = rec ? rec.textContent.trim() : '';
        fx.A(line, [{ opacity: 1, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'translateX(' + (W + 10) + 'px)', offset: 0.92 }, { opacity: 0, transform: 'translateX(' + (W + 30) + 'px)' }],
            { duration: run + 120, delay: d, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
        fx.A(tag, [{ opacity: 1, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'translateX(' + (W - 60) + 'px)', offset: 0.9 }, { opacity: 0, transform: 'translateX(' + (W - 40) + 'px)' }],
            { duration: run + 120, delay: d, easing: 'cubic-bezier(.45,.05,.4,1)', fill: 'forwards' });
        if (target) {
            const parts = target.split(':').map((x) => parseInt(x, 10));
            const total = parts.reduce((a, v) => a * 60 + v, 0);
            fx.tween(run, d, (p) => {
                let s = Math.round(total * easeInOut(p));
                const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
                tag.textContent = '⏱ ' + (parts.length > 2 ? hh + ':' + String(mm).padStart(2, '0') : mm) + ':' + String(ss).padStart(2, '0');
            });
        }
        // Approximation de la position de la ligne (même courbe que le balayage)
        const at = (x) => {
            const target = clamp01(0.92 * (x + 10) / (W + 20));
            let lo = 0, hi = 1;
            for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (cubic(0.45, 0.05, 0.4, 1, m) < target) lo = m; else hi = m; }
            return lo * (run + 120);
        };
        chars.forEach((c, i) => {
            const t = d + at(P[i].x);
            fx.A(c, [
                { opacity: 0, transform: 'scaleX(3.2) translateX(-.35em) skewX(-18deg)', filter: 'blur(5px) brightness(3)' },
                { opacity: 1, transform: 'scaleX(1.2) skewX(-6deg)', filter: 'blur(1px) brightness(1.8)', offset: 0.35 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: 620, delay: t, easing: EASE_OUT });
            if (/\d/.test(c.textContent)) slotRoll(c, t - 200, 520);
        });
        fx.flash('rgba(255,255,255,.9)', d + run - 60, 520);
        fx.later(d + run - 40, () => fx.burst(W - 10, H / 2, 18, ['#00fff9', '#ff00c8', '#ffe600', '#fff'], { spread: 120, gravity: 50, life: 1000 }));
        fx.el.querySelectorAll('.accent, .outline').forEach((acc, k) => fx.A(acc, [
            { textShadow: 'none' },
            { textShadow: '5px 0 rgba(255,0,200,.9), -5px 0 rgba(0,255,249,.9)', offset: 0.15 },
            { textShadow: '-3px 1px rgba(255,0,200,.9), 3px -1px rgba(0,255,249,.9)', offset: 0.4 },
            { textShadow: 'none' }
        ], { duration: 520, delay: d + run + 120 + k * 180, easing: 'steps(6, end)', fill: 'none' }));
    }

    // ── 2. Timeline : TABLEAU À VOLETS — chaque lettre claque comme un panneau de gare
    function fxSplitFlap(fx) {
        const { chars, d, W, H } = fx;
        const G = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const hinge = fx.add('i', 'left:-2%;right:-2%;top:50%;height:2px;opacity:0;background:rgba(0,0,0,.55);box-shadow:0 1px 0 rgba(255,255,255,.12)');
        fx.A(hinge, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 400 + chars.length * 70 + 700, delay: d, fill: 'forwards' });
        fx.iconPop(d, [{ opacity: 0, transform: 'perspective(400px) rotateX(-180deg)' }, { opacity: 1, transform: 'none' }], 800);
        chars.forEach((c, i) => {
            const final = c.textContent;
            const flips = 6 + i * 2;
            const start = d + 80;
            c.style.transformOrigin = '50% 50%';
            fx.A(c, [{ opacity: 0 }, { opacity: 1 }], { duration: 60, delay: start, easing: 'linear' });
            fx.wait(new Promise((res) => {
                let k = 0;
                const flip = () => {
                    if (!c.isConnected) return res();
                    const last = k >= flips;
                    c.textContent = last ? final : G[Math.floor(rnd(i * 31 + k) * G.length)];
                    c.animate([{ transform: 'perspective(300px) rotateX(-75deg)', filter: 'brightness(.55)' }, { transform: 'none', filter: 'brightness(1)' }],
                        { duration: last ? 300 : 48, easing: last ? EASE_BACK : 'cubic-bezier(.2,.7,.4,1)' });
                    if (last) { fx.burst(fx.P[i].x, fx.P[i].bottom, 2, ['#fff', '#ffe600'], { spread: 18, gravity: 14, size: 2.5, life: 380 }); return setTimeout(res, 280); }
                    k++;
                    setTimeout(flip, 78);
                };
                setTimeout(flip, start);
            }));
        });
        fx.shine(d + 80 + (7 + 2 * (chars.length - 1)) * 78 + 420, 'rgba(255,90,90,.9)', 24);
    }

    // ── 3. Progression : HISTOGRAMME — des barres poussent puis se changent en lettres
    function fxBars(fx) {
        const { chars, P, d, W, H } = fx;
        const n = chars.length;
        fx.iconPop(d, [{ opacity: 0, transform: 'translate(-40px, 60px) rotate(-30deg) scale(.4)' }, { opacity: 1, transform: 'none' }], 900);
        const pts = [];
        chars.forEach((c, i) => {
            const k = n > 1 ? i / (n - 1) : 1;
            const hgt = P[i].h * (0.28 + 0.72 * k);
            const t = d + 60 + i * 55;
            const bar = fx.add('i', 'left:' + (P[i].left + P[i].w * 0.12) + 'px;width:' + (P[i].w * 0.76) + 'px;top:' + (P[i].bottom - hgt) + 'px;height:' + hgt + 'px;opacity:0;border-radius:4px 4px 1px 1px;' +
                'background:linear-gradient(180deg,hsl(' + (150 + k * 40) + ',100%,62%),hsl(' + (190 + k * 40) + ',100%,45%));box-shadow:0 0 14px hsla(' + (160 + k * 40) + ',100%,60%,.6);transform-origin:50% 100%');
            fx.A(bar, [
                { opacity: 1, transform: 'scaleY(0)' },
                { opacity: 1, transform: 'scaleY(1.08)', offset: 0.45 },
                { opacity: 1, transform: 'scaleY(1)', offset: 0.6 },
                { opacity: 0, transform: 'scaleY(0) scaleX(.6)' }
            ], { duration: 1050, delay: t, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'forwards' });
            fx.A(c, [
                { opacity: 0, transform: 'translateY(.45em) scaleY(.2)', filter: 'blur(6px)' },
                { opacity: 1, transform: 'translateY(-.08em) scaleY(1.06)', filter: 'none', offset: 0.7 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: 640, delay: t + 560, easing: EASE_OUT });
            pts.push([P[i].x, P[i].bottom - hgt - 6]);
        });
        const s = fx.svg(W, H);
        const dPath = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
        const line = fx.path(s, dPath, '#00ffa8', 3);
        const len = line.getTotalLength();
        line.style.strokeDasharray = len;
        fx.A(line, [{ strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.7 }, { strokeDashoffset: 0, opacity: 0 }],
            { duration: 60 + n * 55 + 1100, delay: d + 120, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
        const last = pts[pts.length - 1] || [W, 0];
        fx.later(d + 60 + n * 55 + 700, () => {
            fx.burst(last[0], last[1], 14, ['#00ffa8', '#00fff9', '#ffe600'], { angle: -Math.PI / 4, cone: 1.1, spread: 90, gravity: 10 });
            fx.ring(last[0], last[1], 70, '#00ffa8', 0);
        });
    }

    // ── 4. Prépa marathon : ÉLECTROCARDIOGRAMME — le tracé bat, les lettres s'allument au rythme du cœur
    function fxHeartbeat(fx) {
        const { chars, P, d, W, H } = fx;
        const y0 = H * 0.55, beats = [0.16, 0.42, 0.68, 0.9];
        let path = 'M0 ' + y0;
        beats.forEach((b) => {
            const x = b * W, a = H * 0.9;
            path += ' L' + (x - 34) + ' ' + y0 + ' L' + (x - 24) + ' ' + (y0 - a * 0.12) + ' L' + (x - 16) + ' ' + y0 +
                ' L' + (x - 8) + ' ' + (y0 + a * 0.12) + ' L' + x + ' ' + (y0 - a * 0.85) + ' L' + (x + 8) + ' ' + (y0 + a * 0.4) + ' L' + (x + 16) + ' ' + y0;
        });
        path += ' L' + W + ' ' + y0;
        const s = fx.svg(W, H);
        const p = fx.path(s, path, '#ff2d6f', 3, { glow: '#ff2d6f' });
        const len = p.getTotalLength();
        const run = 1500;
        p.style.strokeDasharray = len;
        fx.A(p, [{ strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.8 }, { strokeDashoffset: 0, opacity: 0 }],
            { duration: run * 1.25, delay: d, easing: 'linear', fill: 'both' });
        const head = fx.add('i', 'left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;opacity:0;background:#fff;box-shadow:0 0 14px #ff2d6f,0 0 30px #ff2d6f');
        fx.tween(run, d, (q) => {
            const pt = p.getPointAtLength(len * q);
            head.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px)';
            head.style.opacity = q > 0 && q < 1 ? '1' : '0';
        });
        chars.forEach((c, i) => {
            const q = P[i].x / W;
            const t = d + q * run;
            const beatHit = beats.some((b) => Math.abs(b - q) < 0.05);
            fx.A(c, beatHit ? [
                { opacity: 0, transform: 'scale(.4)', filter: 'brightness(3)' },
                { opacity: 1, transform: 'scale(1.45)', filter: 'brightness(2) drop-shadow(0 0 14px #ff2d6f)', offset: 0.3 },
                { opacity: 1, transform: 'scale(.94)', offset: 0.6 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ] : [
                { opacity: 0, transform: 'translateY(.15em) scale(.85)', filter: 'blur(4px)' },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: beatHit ? 620 : 420, delay: t });
        });
        beats.forEach((b, k) => fx.ring(b * W, y0 - H * 0.3, 80, '#ff2d6f', d + b * run, { life: 600 }));
        fx.iconPop(d + beats[0] * run, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1.35)', offset: 0.3 }, { opacity: 1, transform: 'scale(.95)', offset: 0.5 }, { opacity: 1, transform: 'scale(1.15)', offset: 0.65 }, { opacity: 1, transform: 'none' }], 900);
        // double battement final : « poum-poum »
        fx.A(fx.el, [{ transform: 'none' }, { transform: 'scale(1.035)', offset: 0.2 }, { transform: 'none', offset: 0.4 }, { transform: 'scale(1.025)', offset: 0.6 }, { transform: 'none' }],
            { duration: 620, delay: d + run * 1.15, easing: 'ease-in-out', fill: 'none' });
    }

    // ── 5. Radar : BALAYAGE — le faisceau tourne, chaque lettre apparaît comme un écho
    function fxRadar(fx) {
        const { chars, P, d, W, H } = fx;
        const cx = W / 2, cy = H / 2, R = Math.hypot(W, H) * 0.62;
        const run = 1500;
        const sweep = fx.add('i', 'left:' + (cx - R) + 'px;top:' + (cy - R) + 'px;width:' + (2 * R) + 'px;height:' + (2 * R) + 'px;opacity:0;border-radius:50%;' +
            'background:conic-gradient(from 0deg, rgba(0,255,140,0) 0deg, rgba(0,255,140,0) 290deg, rgba(0,255,140,.08) 330deg, rgba(0,255,160,.55) 359deg, rgba(0,255,160,0) 360deg);' +
            '-webkit-mask:radial-gradient(circle, #000 0 66%, transparent 71%);mask:radial-gradient(circle, #000 0 66%, transparent 71%)');
        fx.A(sweep, [{ opacity: 0, transform: 'rotate(0deg)' }, { opacity: 1, transform: 'rotate(40deg)', offset: 0.1 }, { opacity: 1, transform: 'rotate(330deg)', offset: 0.9 }, { opacity: 0, transform: 'rotate(380deg)' }],
            { duration: run * 1.1, delay: d, easing: 'linear', fill: 'forwards' });
        [0.33, 0.66].forEach((f, k) => {
            const g = fx.add('i', 'left:' + (cx - R * f) + 'px;top:' + (cy - R * f) + 'px;width:' + (2 * R * f) + 'px;height:' + (2 * R * f) + 'px;opacity:0;border-radius:50%;border:1px dashed rgba(0,255,150,.45)');
            fx.A(g, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }],
                { duration: run * 1.2, delay: d + k * 80, fill: 'forwards' });
        });
        chars.forEach((c, i) => {
            let ang = Math.atan2(P[i].x - cx, -(P[i].y - cy)) * 180 / Math.PI;
            if (ang < 0) ang += 360;
            const t = d + (ang / 360) * run;
            fx.A(c, [
                { opacity: 0, transform: 'scale(.3)', filter: 'brightness(3) drop-shadow(0 0 10px #00ff8c)' },
                { opacity: 1, transform: 'scale(1.25)', filter: 'brightness(2.4) drop-shadow(0 0 14px #00ff8c)', offset: 0.25 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: 900, delay: t });
            if (i % 2 === 0) fx.ring(P[i].x, P[i].y, 46, 'rgba(0,255,140,.9)', t, { life: 650, width: 1.5 });
        });
        fx.iconPop(d, [{ opacity: 0, transform: 'scale(0) rotate(-360deg)' }, { opacity: 1, transform: 'none' }], 1100);
    }

    // ── 6. Élite : CHUTE D'OR — lettres lourdes qui tombent, poussière d'or, éclat royal
    function fxGold(fx) {
        const { chars, P, d, W, H } = fx;
        const gold = ['#ffe600', '#ffd36b', '#fff4b0', '#ffb300'];
        fx.iconPop(d, [{ opacity: 0, transform: 'translateY(-120px) rotate(-25deg)' }, { opacity: 1, transform: 'translateY(6px) rotate(8deg)', offset: 0.6 }, { opacity: 1, transform: 'none' }], 900);
        chars.forEach((c, i) => {
            const t = d + 150 + i * 42;
            fx.A(c, [
                { opacity: 0, transform: 'translateY(-1.6em) scale(1.25)', filter: 'brightness(2.5) sepia(1) saturate(4)' },
                { opacity: 1, transform: 'translateY(0) scaleY(.78) scaleX(1.12)', filter: 'brightness(2) sepia(1) saturate(4)', offset: 0.55 },
                { opacity: 1, transform: 'translateY(-.08em) scale(1)', offset: 0.75 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: 820, delay: t, easing: 'cubic-bezier(.55,0,.45,1)' });
            if (i % 2 === 0) fx.later(t + 450, () => fx.burst(P[i].x, P[i].bottom, 3, gold, { angle: -Math.PI / 2, cone: 2.4, spread: 34, gravity: 22, size: 3 }));
        });
        const end = d + 150 + chars.length * 42 + 700;
        fx.shine(end, 'rgba(255,215,80,.95)', 20);
        [[0.08, -0.25], [0.55, -0.4], [0.95, 0.1], [0.3, 1.1]].forEach(([fx0, fy0], k) => {
            const sp = fx.add('b', 'left:' + (W * fx0) + 'px;top:' + (H * fy0) + 'px;opacity:0;font-size:' + (18 + k * 6) + 'px;color:#ffe600;text-shadow:0 0 14px #ffd000');
            sp.textContent = '✦';
            fx.A(sp, [{ opacity: 0, transform: 'scale(0) rotate(0deg)' }, { opacity: 1, transform: 'scale(1.2) rotate(90deg)', offset: 0.4 }, { opacity: 0, transform: 'scale(0) rotate(180deg)' }],
                { duration: 900, delay: end + k * 140, easing: 'ease-in-out', fill: 'forwards' });
        });
    }

    // ── 7. Carte : ÉPINGLES GPS — les lettres tombent comme des punaises, l'itinéraire se trace
    function fxPins(fx) {
        const { chars, P, d, W, H } = fx;
        const order = chars.map((_, i) => i);
        const pts = [];
        chars.forEach((c, i) => {
            const t = d + 120 + i * 60;
            fx.A(c, [
                { opacity: 0, transform: 'translateY(-2.2em) scale(.5)' },
                { opacity: 1, transform: 'translateY(0) scaleY(.7) scaleX(1.25)', offset: 0.62 },
                { opacity: 1, transform: 'translateY(-.18em) scaleY(1.08)', offset: 0.8 },
                { opacity: 1, transform: 'none' }
            ], { duration: 700, delay: t, easing: 'cubic-bezier(.55,.05,.6,1)' });
            fx.ring(P[i].x, P[i].bottom, 34, 'rgba(255,0,200,.9)', t + 430, { flat: 0.32, life: 560 });
            pts.push([P[i].x, P[i].bottom + 8 + Math.sin(i * 1.3) * 5]);
        });
        if (pts.length > 1) {
            const s = fx.svg(W, H);
            let dd = 'M' + pts[0][0] + ' ' + pts[0][1];
            for (let k = 1; k < pts.length; k++) {
                const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
                dd += ' Q' + ((x0 + x1) / 2) + ' ' + (Math.max(y0, y1) + 14) + ' ' + x1 + ' ' + y1;
            }
            const route = fx.path(s, dd, '#ff00c8', 2.5);
            const len = route.getTotalLength();
            const draw = order.length * 60 + 500;
            route.style.strokeDasharray = len;
            fx.A(route, [{ strokeDashoffset: len, opacity: 1 }, { strokeDashoffset: 0, opacity: 1, offset: 0.6 }, { strokeDashoffset: 0, opacity: 0 }],
                { duration: draw / 0.6, delay: d + 400, easing: 'linear', fill: 'both' });
            const runner = fx.add('i', 'left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;opacity:0;background:#00fff9;box-shadow:0 0 14px #00fff9');
            fx.tween(draw, d + 400, (q) => {
                const pt = route.getPointAtLength(len * q);
                runner.style.transform = 'translate(' + pt.x + 'px,' + pt.y + 'px)';
                runner.style.opacity = q > 0 && q < 1 ? '1' : '0';
            });
        }
        fx.iconPop(d, [{ opacity: 0, transform: 'scale(0) rotate(-180deg)' }, { opacity: 1, transform: 'scale(1.2) rotate(20deg)', offset: 0.6 }, { opacity: 1, transform: 'none' }], 1000);
    }

    // ── 8. Comparateur : VERSUS — deux moitiés foncent l'une sur l'autre et se percutent
    function fxVersus(fx) {
        const { chars, P, d, W, H } = fx;
        const mid = Math.ceil(chars.length / 2);
        const T = 560;
        const impact = d + T;
        chars.forEach((c, i) => {
            const left = i < mid;
            const off = left ? -(P[i].x + 260 + (mid - i) * 30) : (W - P[i].x + 260 + (i - mid) * 30);
            fx.A(c, [
                { opacity: 1, transform: 'translateX(' + off + 'px) skewX(' + (left ? -25 : 25) + 'deg)', filter: 'blur(3px)' },
                { opacity: 1, transform: 'translateX(' + (left ? 10 : -10) + 'px) skewX(' + (left ? -10 : 10) + 'deg)', filter: 'blur(0)', offset: 0.62 },
                { opacity: 1, transform: 'translateX(' + (left ? -14 : 14) + 'px)', offset: 0.78 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: T / 0.62, delay: d, easing: 'cubic-bezier(.6,0,.4,1)' });
        });
        const x = P[mid - 1] && P[mid] ? (P[mid - 1].x + P[mid].x) / 2 : W / 2;
        fx.flash('rgba(255,255,255,1)', impact - 20, 520);
        fx.ring(x, H / 2, Math.max(W, 260) * 0.9, '#ffe600', impact, { life: 700, width: 3 });
        fx.ring(x, H / 2, Math.max(W, 260) * 0.55, '#ff00c8', impact + 60, { life: 650, width: 2 });
        fx.later(impact, () => fx.burst(x, H / 2, 26, ['#ffe600', '#ff8a00', '#fff', '#00fff9'], { spread: 150, gravity: 40, size: 4, life: 900 }));
        fx.A(fx.el, [{ transform: 'none' }, { transform: 'translate(-7px,3px)', offset: 0.15 }, { transform: 'translate(6px,-4px)', offset: 0.3 }, { transform: 'translate(-4px,2px)', offset: 0.5 }, { transform: 'translate(2px,-1px)', offset: 0.7 }, { transform: 'none' }],
            { duration: 420, delay: impact, easing: 'linear', fill: 'none' });
        fx.iconPop(impact, [{ opacity: 0, transform: 'scale(2.6) rotate(45deg)' }, { opacity: 1, transform: 'scale(.9)', offset: 0.5 }, { opacity: 1, transform: 'none' }], 600);
    }

    // ── 9. Météo : AVERSE — chaque goutte qui tombe fait éclore une lettre
    function fxRain(fx) {
        const { chars, P, d, W, H } = fx;
        const n = chars.length;
        const order = chars.map((_, i) => i).sort((a, b) => rnd(a + 3) - rnd(b + 3));
        fx.iconPop(d, [{ opacity: 0, transform: 'translateY(-30px) scale(.4)' }, { opacity: 1, transform: 'none' }], 900);
        order.forEach((i, k) => {
            const t = d + 80 + (k / Math.max(1, n - 1)) * 1100;
            const drop = fx.add('i', 'left:' + P[i].x + 'px;top:' + (P[i].top - 2) + 'px;width:2px;height:26px;margin-left:-1px;opacity:0;border-radius:2px;background:linear-gradient(180deg,rgba(140,220,255,0),#bfefff)');
            fx.A(drop, [{ opacity: 0.95, transform: 'translateY(-220px)' }, { opacity: 0.95, transform: 'translateY(-14px)', offset: 0.92 }, { opacity: 0, transform: 'translateY(0) scaleY(.2)' }],
                { duration: 300, delay: t - 300, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' });
            fx.A(chars[i], [
                { opacity: 0, transform: 'scaleY(1.5) translateY(-.25em)', filter: 'blur(6px) brightness(2.5)' },
                { opacity: 1, transform: 'scaleY(.85) scaleX(1.08)', filter: 'blur(1px) brightness(1.6)', offset: 0.4 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: 600, delay: t });
            fx.ring(P[i].x, P[i].bottom, 30, 'rgba(160,230,255,.9)', t, { flat: 0.3, life: 520, width: 1.5 });
            if (k % 3 === 0) fx.later(t, () => fx.burst(P[i].x, P[i].top + 4, 3, ['#bfefff', '#fff'], { angle: -Math.PI / 2, cone: 2, spread: 26, gravity: 26, size: 2.5, life: 500 }));
        });
        fx.shine(d + 1400, 'rgba(255,214,90,.95)', 18);
    }

    // ── 10. Galerie : FLASH & DÉVELOPPEMENT — l'obturateur claque, l'image se révèle comme une photo
    function fxDevelop(fx) {
        const { chars, d } = fx;
        const flash = document.createElement('div');
        flash.className = 'mo-screenflash';
        flash.setAttribute('aria-hidden', 'true');
        document.body.appendChild(flash);
        fx.A(flash, [{ opacity: 0 }, { opacity: 0.85, offset: 0.08 }, { opacity: 0 }], { duration: 700, delay: d + 120, easing: 'ease-out', fill: 'forwards' })
            .finished.then(() => flash.remove(), () => flash.remove());
        fx.A(fx.el, [{ clipPath: 'inset(48% 0 48% 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 380, delay: d + 60, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'backwards' });
        chars.forEach((c, i) => {
            const t = d + 160 + rnd(i + 9) * 420;
            fx.A(c, [
                { opacity: 1, filter: 'brightness(4) saturate(0) contrast(.4) blur(7px)' },
                { opacity: 1, filter: 'brightness(1.8) saturate(.2) sepia(.8) blur(2px)', offset: 0.45 },
                { opacity: 1, filter: 'none' }
            ], { duration: 1500, delay: t, easing: 'cubic-bezier(.3,.1,.3,1)' });
        });
        fx.iconPop(d, [{ opacity: 0, transform: 'scale(1.8)' }, { opacity: 1, transform: 'scale(.9)', offset: 0.3 }, { opacity: 1, transform: 'none' }], 700);
        fx.later(d + 140, () => fx.burst(fx.W * 0.06, fx.H * 0.3, 12, ['#fff', '#fffbe0'], { spread: 70, gravity: 0, size: 3, life: 520 }));
    }

    // ── 11. Wrapped : CADEAU — le ruban se dénoue, les lettres jaillissent avec des confettis
    function fxGift(fx) {
        const { chars, P, d, W, H } = fx;
        const cx = W / 2, cy = H / 2;
        const ribbon = 'linear-gradient(90deg,#ff00c8,#ff6ad5,#ff00c8)';
        const hb = fx.add('i', 'left:-3%;right:-3%;top:' + (cy - 7) + 'px;height:14px;background:' + ribbon + ';box-shadow:0 0 18px rgba(255,0,200,.6)');
        const vb = fx.add('i', 'top:-18%;bottom:-18%;left:' + (cx - 7) + 'px;width:14px;background:' + ribbon.replace('90deg', '180deg') + ';box-shadow:0 0 18px rgba(255,0,200,.6)');
        const bow = fx.add('b', 'left:' + cx + 'px;top:' + cy + 'px;font-size:' + Math.max(34, H * 0.7) + 'px;line-height:1;transform:translate(-50%,-55%)');
        bow.textContent = '🎀';
        const open = d + 520;
        fx.A(bow, [{ opacity: 0, transform: 'translate(-50%,-55%) scale(0)' }, { opacity: 1, transform: 'translate(-50%,-55%) scale(1.2)', offset: 0.2 }, { opacity: 1, transform: 'translate(-50%,-55%) scale(1) rotate(-8deg)', offset: 0.5 },
            { opacity: 1, transform: 'translate(-50%,-55%) scale(1) rotate(8deg)', offset: 0.75 }, { opacity: 0, transform: 'translate(-50%,-160%) scale(1.6) rotate(30deg)' }],
            { duration: 820, delay: d - 300 < 0 ? 0 : d - 300, easing: 'ease-in-out', fill: 'both' });
        fx.A(hb, [{ transform: 'scaleX(1)', opacity: 1 }, { transform: 'scaleX(0)', opacity: 0 }], { duration: 420, delay: open, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' });
        fx.A(vb, [{ transform: 'scaleY(1)', opacity: 1 }, { transform: 'scaleY(0)', opacity: 0 }], { duration: 420, delay: open, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' });
        chars.forEach((c, i) => {
            const dist = Math.abs(P[i].x - cx) / Math.max(cx, 1);
            const t = open + 120 + dist * 260;
            fx.A(c, [
                { opacity: 0, transform: 'translate(' + (cx - P[i].x) + 'px,' + (cy - P[i].y) + 'px) scale(0) rotate(' + (rnd(i) * 360 - 180) + 'deg)' },
                { opacity: 1, transform: 'translate(0,-.5em) scale(1.15) rotate(0deg)', offset: 0.6 },
                { opacity: 1, transform: 'none' }
            ], { duration: 820, delay: t, easing: 'cubic-bezier(.2,.9,.3,1.25)' });
        });
        fx.later(open + 80, () => fx.burst(cx, cy, 42, ['#ff00c8', '#00fff9', '#ffe600', '#7c5cff', '#00ff8c'], { spread: Math.max(160, W * 0.45), gravity: 90, size: 6, life: 1400, square: true, spin: true }));
        fx.iconPop(open + 300, null, 800);
    }

    // ── 12. ADN : DOUBLE HÉLICE — les lettres tournent sur deux brins puis se referment
    function fxHelix(fx) {
        const { chars, P, d, W, H } = fx;
        const amp = Math.max(18, H * 0.75), run = 1900;
        const rungs = [];
        for (let i = 0; i < chars.length - 1; i += 2) {
            const r = fx.add('i', 'left:' + P[i].x + 'px;top:' + (H / 2) + 'px;width:2px;height:2px;opacity:0;background:linear-gradient(180deg,#00fff9,#ff00c8)');
            rungs.push([r, i]);
        }
        fx.tween(run, d, (p) => {
            const e = easeInOut(clamp01((p - 0.25) / 0.75));
            const k = 1 - e;
            chars.forEach((c, i) => {
                const phi = i * 0.62 + p * 7.5;
                const strand = i % 2 ? Math.PI : 0;
                const y = Math.sin(phi + strand) * amp * k;
                const z = Math.cos(phi + strand);
                const sc = 1 + 0.32 * z * k;
                c.style.transform = 'translateY(' + y.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')';
                c.style.opacity = String(Math.min(1, p * 6) * (1 - k * (0.55 - 0.45 * z)));
                c.style.filter = k > 0.02 ? 'hue-rotate(' + Math.round(z * 60 * k) + 'deg) brightness(' + (1 + 0.6 * k * (z + 1) / 2).toFixed(2) + ')' : '';
            });
            rungs.forEach(([r, i]) => {
                const phi = i * 0.62 + p * 7.5;
                const h = Math.abs(Math.sin(phi)) * amp * 2 * k;
                r.style.height = h.toFixed(1) + 'px';
                r.style.transform = 'translateY(' + (-h / 2).toFixed(1) + 'px)';
                r.style.opacity = String(0.6 * k * Math.min(1, p * 6));
            });
        }).then(() => chars.forEach((c) => { c.style.transform = ''; c.style.opacity = ''; c.style.filter = ''; }));
        fx.iconPop(d, [{ opacity: 0, transform: 'rotate(-720deg) scale(.3)' }, { opacity: 1, transform: 'none' }], run * 0.8);
        fx.shine(d + run, 'rgba(0,255,249,.9)', 22);
    }

    // ── 13. Age grading : BALANCE — les lettres tombent comme des poids, le fléau oscille puis s'équilibre
    function fxBalance(fx) {
        const { chars, P, d, W, H } = fx;
        const n = chars.length, mid = (n - 1) / 2;
        const order = chars.map((_, i) => i).sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid) || a - b);
        order.forEach((i, k) => {
            const t = d + 100 + k * 55;
            fx.A(chars[i], [
                { opacity: 0, transform: 'translateY(-1.8em) rotate(' + (i < mid ? -20 : 20) + 'deg)' },
                { opacity: 1, transform: 'translateY(0) scaleY(.82)', offset: 0.7 },
                { opacity: 1, transform: 'none' }
            ], { duration: 560, delay: t, easing: 'cubic-bezier(.5,0,.75,0)' });
        });
        const land = d + 100 + n * 55 + 300;
        const tri = fx.add('i', 'left:' + (W / 2 - 14) + 'px;top:' + (H + 4) + 'px;width:0;height:0;opacity:0;border-left:14px solid transparent;border-right:14px solid transparent;border-bottom:20px solid #00fff9;filter:drop-shadow(0 0 8px #00fff9)');
        fx.A(tri, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'none', offset: 0.2 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 2000, delay: d, fill: 'forwards' });
        fx.A(fx.el, [
            { transform: 'rotate(0deg)' }, { transform: 'rotate(-6deg)', offset: 0.18 }, { transform: 'rotate(4.5deg)', offset: 0.38 },
            { transform: 'rotate(-2.5deg)', offset: 0.58 }, { transform: 'rotate(1.2deg)', offset: 0.76 }, { transform: 'rotate(0deg)' }
        ], { duration: 1500, delay: d + 100, easing: 'ease-in-out', fill: 'none' });
        fx.iconPop(d, [{ opacity: 0, transform: 'rotate(-40deg) scale(.4)' }, { opacity: 1, transform: 'rotate(25deg)', offset: 0.4 }, { opacity: 1, transform: 'rotate(-12deg)', offset: 0.7 }, { opacity: 1, transform: 'none' }], 1500);
        fx.later(land, () => fx.burst(W / 2, H, 12, ['#00fff9', '#7c5cff', '#fff'], { angle: -Math.PI / 2, cone: 2.6, spread: 70, gravity: 20 }));
    }

    // ── 14. Trophées : FORGE — chaque lettre frappée sort chauffée à blanc puis refroidit en or
    function fxForge(fx) {
        const { chars, P, d } = fx;
        chars.forEach((c, i) => {
            const t = d + 160 + i * 70;
            fx.A(c, [
                { opacity: 0, transform: 'scale(1.9) translateY(-.2em)', filter: 'brightness(4) sepia(1) saturate(6) hue-rotate(-20deg) blur(4px)' },
                { opacity: 1, transform: 'scale(.86)', filter: 'brightness(3) sepia(1) saturate(6) hue-rotate(-25deg) drop-shadow(0 0 16px #ff7a00)', offset: 0.18 },
                { opacity: 1, transform: 'scale(1.05)', filter: 'brightness(2) sepia(1) saturate(4) hue-rotate(-10deg) drop-shadow(0 0 10px #ffb000)', offset: 0.35 },
                { opacity: 1, transform: 'none', filter: 'brightness(1.3) sepia(.5) saturate(2) drop-shadow(0 0 6px #ffd000)', offset: 0.7 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: 1500, delay: t, easing: 'cubic-bezier(.2,.8,.3,1)' });
            fx.later(t + 200, () => fx.burst(P[i].x, P[i].y, 5, ['#ff7a00', '#ffd000', '#fff2a8'], { spread: 55, gravity: 40, size: 3, life: 650 }));
        });
        fx.A(fx.el, [{ transform: 'none' }, { transform: 'translateY(2px)', offset: 0.5 }, { transform: 'none' }], { duration: 70, delay: d + 160, iterations: chars.length, easing: 'ease-out', fill: 'none' });
        fx.iconPop(d, [{ opacity: 0, transform: 'translateY(-90px) rotate(-360deg) scale(.4)' }, { opacity: 1, transform: 'translateY(4px) scale(1.15)', offset: 0.7 }, { opacity: 1, transform: 'none' }], 1100);
        fx.shine(d + 160 + chars.length * 70 + 900, 'rgba(255,200,40,.95)', 18);
    }

    // ── 15. Archives : MACHINE À ÉCRIRE — frappe touche par touche, puis coup de tampon
    function fxTypewriter(fx) {
        const { chars, P, d, W, H } = fx;
        const caret = fx.add('i', 'left:0;top:' + (H * 0.12) + 'px;width:3px;height:' + (H * 0.76) + 'px;opacity:0;background:#00fff9;box-shadow:0 0 10px #00fff9');
        let t = d + 120;
        const times = chars.map((c, i) => { const v = t; t += 55 + rnd(i + 2) * 55 + (c.textContent === ' ' ? 60 : 0); return v; });
        chars.forEach((c, i) => {
            fx.A(c, [
                { opacity: 0, transform: 'translateY(-.12em) rotate(' + ((rnd(i) - 0.5) * 8).toFixed(1) + 'deg)', filter: 'blur(2px) brightness(.4)' },
                { opacity: 1, transform: 'translateY(.04em)', filter: 'brightness(1.4)', offset: 0.3 },
                { opacity: 1, transform: 'none', filter: 'none' }
            ], { duration: 260, delay: times[i], easing: 'cubic-bezier(.2,.9,.3,1)' });
        });
        const end = t + 80;
        chars.forEach((c, i) => fx.later(times[i], () => {
            caret.style.opacity = '1';
            caret.style.transform = 'translateX(' + (P[i].left + P[i].w + 3) + 'px)';
        }));
        fx.later(end, () => fx.A(caret, [{ opacity: 1 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }], { duration: 300, iterations: 3, easing: 'steps(1, end)', fill: 'none' }));
        fx.later(end + 950, () => { caret.style.opacity = '0'; });
        const stamp = fx.add('b', 'top:50%;opacity:0;padding:.2em .55em;border:3px solid #ff2d55;border-radius:8px;color:#ff2d55;font:900 ' + Math.max(14, H * 0.32) + 'px/1 "Archivo Black","Arial Black",sans-serif;letter-spacing:.12em;white-space:nowrap;text-shadow:0 0 12px rgba(255,45,85,.5);box-shadow:inset 0 0 12px rgba(255,45,85,.35),0 0 16px rgba(255,45,85,.35)');
        stamp.textContent = 'OFFICIEL';
        const lastC = P[P.length - 1];
        const sw = stamp.offsetWidth;
        stamp.style.right = 'auto';
        stamp.style.left = Math.max(0, Math.min(lastC.left + lastC.w - sw * 0.75, W - sw - 8)) + 'px';
        fx.A(stamp, [
            { opacity: 0, transform: 'translateY(-50%) rotate(-14deg) scale(3)' },
            { opacity: 0.95, transform: 'translateY(-50%) rotate(-14deg) scale(.95)', offset: 0.12 },
            { opacity: 0.95, transform: 'translateY(-50%) rotate(-14deg) scale(1)', offset: 0.2 },
            { opacity: 0.95, transform: 'translateY(-50%) rotate(-14deg) scale(1)', offset: 0.8 },
            { opacity: 0, transform: 'translateY(-50%) rotate(-14deg) scale(1.05)' }
        ], { duration: 1600, delay: end + 100, easing: 'ease-out', fill: 'forwards' });
        fx.A(fx.el, [{ transform: 'none' }, { transform: 'translateY(3px)', offset: 0.3 }, { transform: 'none' }], { duration: 180, delay: end + 290, fill: 'none' });
        fx.iconPop(d, [{ opacity: 0, transform: 'translateX(-30px) rotate(-20deg)' }, { opacity: 1, transform: 'none' }], 700);
    }

    // ── 16. Machine à remonter le temps : REMBOBINAGE VHS — parasites, décalages RVB, années qui défilent
    function fxVHS(fx) {
        const { chars, d, W, H } = fx;
        const run = 1700;
        const osd = fx.add('b', 'left:0;top:-30px;opacity:0;font:700 14px/1 "JetBrains Mono",monospace;letter-spacing:.2em;color:#fff;text-shadow:2px 0 #ff00c8,-2px 0 #00fff9');
        const band = fx.add('i', 'left:-4%;right:-4%;top:0;height:22%;opacity:0;background:linear-gradient(180deg,transparent,rgba(255,255,255,.35),rgba(255,255,255,.08),transparent);mix-blend-mode:screen');
        const lines = fx.add('i', 'inset:-10% -4%;opacity:0;background:repeating-linear-gradient(180deg,rgba(255,255,255,.07) 0 1px,transparent 1px 3px)');
        fx.A(band, [{ opacity: 1, transform: 'translateY(-40%)' }, { opacity: 1, transform: 'translateY(' + (H * 4.5) + 'px)' }], { duration: run / 3, delay: d, iterations: 3, easing: 'linear', fill: 'none' });
        fx.A(lines, [{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: run + 200, delay: d, fill: 'forwards' });
        const years = ['1896', '1908', '1924', '1936', '1960', '1972', '1984', '1999', '2012', '2026'];
        const finals = chars.map((c) => c.textContent);
        fx.tween(run, d, (p) => {
            const k = 1 - easeOut(p);
            osd.style.opacity = Math.floor(p * 14) % 2 ? '1' : '0.55';
            osd.textContent = p < 0.82 ? '◀◀ REW  ' + years[Math.min(years.length - 1, Math.floor(p / 0.82 * years.length))] : '▶ PLAY';
            const frame = Math.floor(p * 30);
            chars.forEach((c, i) => {
                const r1 = rnd(i * 7 + frame), r2 = rnd(i * 13 + frame * 3);
                const jx = (r1 - 0.5) * 46 * k;
                const sliceY = (r2 > 0.8 ? (r2 - 0.8) * 60 : 0) * k;
                c.style.transform = 'translate(' + jx.toFixed(1) + 'px,' + sliceY.toFixed(1) + 'px) skewX(' + ((r2 - 0.5) * 30 * k).toFixed(1) + 'deg)';
                c.style.opacity = p < 0.08 ? '0' : String(1 - k * 0.5 * (r1 > 0.85 ? 1 : 0));
                c.style.textShadow = k > 0.03 ? (6 * k).toFixed(1) + 'px 0 rgba(255,0,200,.85),' + (-6 * k).toFixed(1) + 'px 0 rgba(0,255,249,.85)' : '';
                c.textContent = p < 0.7 && /[A-ZÀ-Ü]/i.test(finals[i]) && r2 > 0.55 ? String.fromCharCode(48 + Math.floor(r1 * 10)) : finals[i];
            });
        }).then(() => chars.forEach((c, i) => { c.style.transform = ''; c.style.opacity = ''; c.style.textShadow = ''; c.textContent = finals[i]; }));
        fx.later(d + run + 450, () => { osd.style.opacity = '0'; });
        fx.iconPop(d, [{ opacity: 0, transform: 'rotate(720deg)' }, { opacity: 1, transform: 'rotate(-30deg)', offset: 0.8 }, { opacity: 1, transform: 'none' }], run);
    }

    // ── 17. Tour du monde : ORBITE — les lettres tournent autour du globe avant de rejoindre leur place
    function fxOrbit(fx) {
        const { chars, P, d, W, H } = fx;
        const ic = fx.icons[0];
        const c0 = ic ? fx.box(ic) : { x: 0, y: H / 2, w: H, h: H };
        const R = Math.max(c0.w, 40) * 0.95 + 16;
        const run = 2100;
        const orbit = fx.add('i', 'left:' + (c0.x - R) + 'px;top:' + (c0.y - R * 0.42) + 'px;width:' + (2 * R) + 'px;height:' + (R * 0.84) + 'px;opacity:0;border-radius:50%;border:1.5px dashed rgba(0,255,249,.55);box-shadow:0 0 14px rgba(0,255,249,.25)');
        fx.A(orbit, [{ opacity: 0, transform: 'scale(.4) rotate(-12deg)' }, { opacity: 1, transform: 'rotate(-12deg)', offset: 0.2 }, { opacity: 1, transform: 'rotate(-12deg)', offset: 0.7 }, { opacity: 0, transform: 'scale(1.6) rotate(-12deg)' }],
            { duration: run, delay: d, fill: 'forwards' });
        fx.tween(run, d, (p) => {
            chars.forEach((c, i) => {
                const a = i * (Math.PI * 2 / Math.max(chars.length, 1)) + p * Math.PI * 3.2;
                const ox = c0.x + Math.cos(a) * R - P[i].x;
                const oy = c0.y + Math.sin(a) * R * 0.42 - P[i].y;
                const cos = Math.cos(-0.21), sin = Math.sin(-0.21);
                const rx = ox * cos - oy * sin, ry = ox * sin + oy * cos;
                const q = easeOut(clamp01((p - 0.35 - i * 0.018) / 0.5));
                const front = Math.sin(a) > 0;
                c.style.transform = 'translate(' + (rx * (1 - q)).toFixed(1) + 'px,' + (ry * (1 - q)).toFixed(1) + 'px) scale(' + (0.55 + 0.45 * q + (front ? 0.15 : -0.1) * (1 - q)).toFixed(3) + ')';
                c.style.opacity = String(Math.min(1, p * 5) * (q > 0 ? 1 : (front ? 1 : 0.45)));
            });
        }).then(() => chars.forEach((c) => { c.style.transform = ''; c.style.opacity = ''; }));
        fx.iconPop(d, [{ opacity: 0, transform: 'scale(.2) rotate(-360deg)' }, { opacity: 1, transform: 'scale(1.15) rotate(0deg)', offset: 0.5 }, { opacity: 1, transform: 'rotate(360deg)' }], run);
        fx.later(d + run * 0.8, () => fx.ring(c0.x, c0.y, R * 2.4, '#00fff9', 0, { life: 800 }));
        fx.shine(d + run, 'rgba(0,255,249,.9)', 18);
    }

    // ── 18. 404 : PERDU — les lettres errent aux quatre coins puis retrouvent le parcours
    function fxLost(fx) {
        const { chars, P, d } = fx;
        chars.forEach((c, i) => {
            const dx = (rnd(i + 1) - 0.5) * innerWidth * 0.9, dy = (rnd(i + 5) - 0.5) * innerHeight * 0.7;
            fx.A(c, [
                { opacity: 0, transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + Math.round((rnd(i + 8) - 0.5) * 540) + 'deg) scale(.6)' },
                { opacity: 0.8, transform: 'translate(' + (dx * 0.6) + 'px,' + (dy * 0.6) + 'px) rotate(' + Math.round((rnd(i + 8) - 0.5) * 240) + 'deg)', offset: 0.3 },
                { opacity: 1, transform: 'translate(' + (dx * -0.04) + 'px,' + (dy * -0.04) + 'px) rotate(-4deg)', offset: 0.85 },
                { opacity: 1, transform: 'none' }
            ], { duration: 1700, delay: d + rnd(i + 11) * 500, easing: 'cubic-bezier(.4,0,.2,1)' });
        });
        fx.shine(d + 2300, 'rgba(255,0,200,.9)', 20);
    }

    // Courbe de Bézier cubique (x → y) pour suivre le balayage du photo-finish
    function cubic(x1, y1, x2, y2, t) {
        let lo = 0, hi = 1, s = t;
        for (let k = 0; k < 20; k++) {
            s = (lo + hi) / 2;
            const x = 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
            if (x < t) lo = s; else hi = s;
        }
        return 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
    }

    const TITLE_FX = {
        'index.html': fxPhotoFinish, 'timeline.html': fxSplitFlap, 'progression.html': fxBars,
        'entrainements.html': fxHeartbeat, 'radar.html': fxRadar, 'elite.html': fxGold,
        'carte.html': fxPins, 'comparaison.html': fxVersus, 'meteo.html': fxRain,
        'galerie.html': fxDevelop, 'wrapped.html': fxGift, 'adn.html': fxHelix,
        'age-grading.html': fxBalance, 'trophees.html': fxForge, 'archives.html': fxTypewriter,
        'machine-temps.html': fxVHS, 'tour-du-monde.html': fxOrbit, '404.html': fxLost
    };

    let fxRunning = 0;
    function animateTitle(el, startDelay) {
        const effect = TITLE_FX[PAGE] || fxPhotoFinish;
        let s = null, fx = null, cleaned = false;
        fxRunning++;
        document.body.classList.add('mo-fxing');
        const cleanup = () => {
            if (cleaned) return;
            cleaned = true;
            if (--fxRunning <= 0) document.body.classList.remove('mo-fxing');
            if (fx) {
                // seulement nos animations : celles de la page (CSS) doivent continuer
                fx.made.forEach((a) => { try { a.cancel(); } catch (e) { /* déjà terminée */ } });
                fx.L.remove();
            }
            if (s) s.restore();
        };
        try {
            s = split(el, 'char');
            if (!s.units.length) { s.restore(); return; }
            fx = makeFx(el, s.units, startDelay);
            effect(fx);
            Promise.all(fx.jobs).then(() => setTimeout(cleanup, 80), cleanup);
            setTimeout(cleanup, startDelay + 7000); // filet : le titre revient toujours à l'identique
        } catch (e) {
            cleanup();
        }
    }

    // Chiffre qui défile comme une machine à sous avant de se poser
    function slotRoll(c, delay, dur) {
        const final = c.textContent;
        let n = parseInt(final, 10);
        const t0 = performance.now() + delay;
        const tick = (now) => {
            if (!c.isConnected) return;
            if (now < t0) { requestAnimationFrame(tick); return; }
            if (now - t0 >= dur) { c.textContent = final; return; }
            n = (n + 1) % 10;
            c.textContent = String(n);
            setTimeout(() => requestAnimationFrame(tick), 55);
        };
        requestAnimationFrame(tick);
    }

    // ════════════════════════════════════════════════════════════════════
    //  Intertitres : mots qui sortent du flou
    // ════════════════════════════════════════════════════════════════════
    const HEADINGS = 'h2, .section-title, .sec-title, h2.sec, .ach-cat-title, .era-year';

    function animateHeading(el) {
        const s = split(el, 'word');
        const words = s.units;
        const anims = [];
        words.forEach((w, i) => anims.push(w.animate(
            [{ opacity: 0, transform: 'translateY(.35em) scale(.96)', filter: 'blur(10px)', letterSpacing: '0.12em' },
             { opacity: 1, transform: 'none', filter: 'blur(0)', letterSpacing: 'normal' }],
            { duration: 900, delay: i * 85, easing: EASE_OUT, fill: 'backwards' })));
        el.querySelectorAll('.title-emoji').forEach((ic) => anims.push(ic.animate(
            [{ opacity: 0, transform: 'scale(.2) rotate(-90deg)' }, { opacity: 1, transform: 'none' }],
            { duration: 700, easing: EASE_BACK, fill: 'backwards' })));
        const sweep = words.length * 85 + 500;
        words.forEach((w, i) => anims.push(w.animate(
            [{ filter: 'brightness(1)' }, { filter: 'brightness(1.9)', offset: 0.4 }, { filter: 'brightness(1)' }],
            { duration: 420, delay: sweep + i * 50 })));
        // Trait néon qui file sous l'intertitre puis s'efface
        let L = null;
        if (words.length) {
            L = fxLayer(el);
            const lr = L.getBoundingClientRect();
            const first = words[0].getBoundingClientRect(), last = words[words.length - 1].getBoundingClientRect();
            const w = Math.max(40, last.right - first.left);
            const bar = document.createElement('i');
            bar.style.cssText = 'left:' + (first.left - lr.left) + 'px;top:' + (last.bottom - lr.top + 4) + 'px;width:' + w + 'px;height:3px;border-radius:3px;opacity:0;' +
                'background:linear-gradient(90deg,#00fff9,#ff00c8,#ffe600);box-shadow:0 0 12px rgba(255,0,200,.6);transform-origin:0 50%';
            L.appendChild(bar);
            anims.push(bar.animate([
                { opacity: 1, transform: 'scaleX(0)' },
                { opacity: 1, transform: 'scaleX(1)', offset: 0.45 },
                { opacity: 0, transform: 'translateX(' + (w * 0.4) + 'px) scaleX(.2)' }
            ], { duration: 1300, delay: 200, easing: EASE_OUT, fill: 'forwards' }));
        }
        Promise.all(anims.map(animDone)).then(() => setTimeout(() => { s.restore(); if (L) L.remove(); }, 60));
    }

    // ════════════════════════════════════════════════════════════════════
    //  Révélations au scroll
    // ════════════════════════════════════════════════════════════════════
    const BLOCKS = [
        '.glass-card', '.card', '.kpi-card', '.flagship-main', '.stamp-card', '.era-card', '.insight-card',
        '.feat-card', '.chart-card', '.chart-wrap', '.cond-card', '.stat-item', '.stat-pill', '.axis-item',
        '.bilan-item', '.sum-item', '.ideal-kpi', '.race', '.podium-row', '.detail-row', '.greg-row', '.dist-row',
        '[class*="-card"]', '[class$="-item"]', 'table', 'figure', 'img', 'canvas'
    ].join(',');
    const EXCLUDE = 'nav, header.topbar, .topbar, .pro-mobile-nav, .pro-breadcrumb, .fade-up, #mo-curtain, .mo-ticker,' +
        '.leaflet-container, svg, [aria-hidden="true"], dialog, [role="dialog"], .mo-fx, #top-list';

    const handled = new WeakSet();
    let io, numIO;

    function kindOf(el) {
        const tag = el.tagName;
        if (tag === 'IMG') return 'img';
        if (tag === 'TABLE' || tag === 'CANVAS' || el.matches('.chart-wrap, .chart-card, figure')) return 'zoom';
        if (el.matches('.race, [class*="-row"]')) return 'slide';
        return 'rise';
    }

    function eligible(el) {
        if (handled.has(el)) return false;
        if (el.closest(EXCLUDE)) return false;
        if (el.parentElement && el.parentElement.closest('.mo-hide, .mo-watch')) return false;
        if (el.tagName === 'IMG') {
            const w = el.width || el.offsetWidth;
            if (w && w < 70) return false;
        }
        if (el.tagName === 'CANVAS' && el.parentElement && el.parentElement.closest(BLOCKS)) return false;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.position === 'sticky' || cs.display === 'contents') return false;
        if (parseFloat(cs.opacity) === 0) return false;
        return true;
    }

    function prepare(scope) {
        const fresh = [];
        const add = (el) => {
            if (!eligible(el)) return;
            handled.add(el);
            if (el.matches(HEADINGS)) {
                el.classList.add('mo-watch');
                el.dataset.moKind = 'heading';
                fresh.push(el);
                return;
            }
            const k = kindOf(el);
            el.classList.add('mo-hide', 'mo-k-' + k, 'mo-watch');
            fresh.push(el);
        };
        // Les intertitres d'abord, pour qu'un titre de carte ne soit pas pris pour un bloc
        const heads = [];
        scope.querySelectorAll(HEADINGS).forEach((h) => {
            if (h.closest('.mo-hide') || h.closest(BLOCKS)) return;
            if (h.textContent.trim().length > 90) return;
            heads.push(h);
        });
        heads.forEach(add);
        scope.querySelectorAll(BLOCKS).forEach(add);
        // Lignes des petits tableaux : défilement en cascade
        scope.querySelectorAll('table.mo-hide').forEach((t) => {
            const rows = t.tBodies[0] ? t.tBodies[0].rows : [];
            if (rows.length && rows.length <= 60) t.dataset.moRows = '1';
        });
        fresh.forEach((el) => io.observe(el));
    }

    function reveal(batch) {
        batch = batch.filter((el) => el.classList.contains('mo-watch'));
        batch.sort((a, b) => {
            const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
            return (ra.top - rb.top) || (ra.left - rb.left);
        });
        const cx = innerWidth / 2;
        let i = 0;
        batch.forEach((el) => {
            io.unobserve(el);
            el.classList.remove('mo-watch');
            if (el.dataset.moKind === 'heading') {
                delete el.dataset.moKind;
                setTimeout(() => animateHeading(el), i++ * 70);
                return;
            }
            const r = el.getBoundingClientRect();
            if (el.classList.contains('mo-k-rise')) {
                const off = ((r.left + r.width / 2) - cx) / cx;
                el.style.setProperty('--mo-x', (off * 34).toFixed(1) + 'px');
            }
            const delay = Math.min(i++ * 70, 900);
            el.style.setProperty('--mo-d', delay + 'ms');
            // double rAF : l'état caché doit être peint avant la transition
            requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('mo-in')));
            if (el.dataset.moRows) cascadeRows(el, delay);
            setTimeout(() => {
                el.classList.remove('mo-hide', 'mo-in', 'mo-k-rise', 'mo-k-slide', 'mo-k-zoom', 'mo-k-wipe', 'mo-k-img');
                el.style.removeProperty('--mo-d');
                el.style.removeProperty('--mo-x');
                if (el.dataset.moRows) delete el.dataset.moRows;
                bindTilt(el);
            }, delay + 1250);
        });
    }

    function cascadeRows(table, delay) {
        Array.from(table.tBodies[0].rows).forEach((tr, i) => tr.animate(
            [{ opacity: 0, transform: 'translateX(-28px)' }, { opacity: 1, transform: 'none' }],
            { duration: 650, delay: delay + 200 + i * 38, easing: EASE_OUT, fill: 'backwards' }));
    }

    // ════════════════════════════════════════════════════════════════════
    //  Chiffres clés : décodage chiffre par chiffre
    // ════════════════════════════════════════════════════════════════════
    const NUM_SEL = '.kpi-value, .kpi-val, .stat-num, .card-num, .flagship-time, .flagship-stat-val, .stat-pill-val,' +
        '.teaser-stat-val, .stat-val, .stat-value, .race-time';

    function numericCandidates(scope) {
        const out = new Set(scope.querySelectorAll(NUM_SEL));
        scope.querySelectorAll('div, span, strong, b, p, dd').forEach((el) => {
            if (el.children.length) return;
            const t = el.textContent.trim();
            if (t.length < 1 || t.length > 16) return;
            const digits = (t.match(/\d/g) || []).length;
            if (!digits || digits / t.length < 0.3) return;
            if (parseFloat(getComputedStyle(el).fontSize) < 22) return;
            out.add(el);
        });
        return Array.from(out).filter((el) =>
            el.childNodes.length === 1 && el.firstChild.nodeType === 3 && /\d/.test(el.textContent) &&
            !el.closest('nav, table, .leaflet-container, svg, #mo-curtain, .mo-ticker'));
    }

    const decoded = new WeakSet();
    function watchNumbers(scope) {
        numericCandidates(scope).forEach((el) => {
            if (decoded.has(el)) return;
            decoded.add(el);
            numIO.observe(el);
        });
    }

    function decode(el) {
        const node = el.firstChild;
        if (!node || node.nodeType !== 3) return;
        const final = node.nodeValue;
        const chars = Array.from(final);
        const idx = chars.map((ch, i) => /\d/.test(ch) ? i : -1).filter((i) => i >= 0);
        if (!idx.length) return;
        const dur = 1100;
        const t0 = performance.now();
        let last = final;
        const step = (now) => {
            if (!node.isConnected || node.nodeValue !== last) return; // le script de la page a repris la main
            const p = (now - t0) / dur;
            if (p >= 1) { node.nodeValue = final; return; }
            const out = chars.slice();
            idx.forEach((ci, k) => {
                const lock = 0.25 + (k / idx.length) * 0.7;
                if (p < lock) out[ci] = String(Math.floor(Math.random() * 10));
            });
            last = out.join('');
            node.nodeValue = last;
            setTimeout(() => requestAnimationFrame(step), 45);
        };
        requestAnimationFrame(step);
    }

    // ════════════════════════════════════════════════════════════════════
    //  Cartes : inclinaison 3D + reflet qui suit la souris
    // ════════════════════════════════════════════════════════════════════
    const TILT = '.card, .kpi, .kpi-card, .flagship-main, .glass-card, .stamp-card, .era-card, .insight-card, .feat-card, .cond-card, [class*="-card"]';
    const tilted = new WeakSet();

    function bindTilt(el) {
        if (!FINE || tilted.has(el) || !el.matches(TILT)) return;
        if (el.closest('nav, .leaflet-container, #mo-curtain')) return;
        tilted.add(el);
        let glare = null, base = '', raf = 0;
        el.addEventListener('pointerenter', () => {
            const r = el.getBoundingClientRect();
            if (r.width > 900 || r.height > 700) return;
            base = el.style.transition;
            const cs = getComputedStyle(el);
            const tr = cs.transition && cs.transition !== 'all 0s ease 0s' ? cs.transition + ', ' : '';
            el.style.transition = tr + 'rotate .25s ease-out, scale .45s ' + EASE_OUT;
            el.style.scale = '1.025';
            if (cs.position !== 'static' && !glare) {
                glare = document.createElement('span');
                glare.className = 'mo-glare';
                glare.setAttribute('aria-hidden', 'true');
                el.appendChild(glare);
                requestAnimationFrame(() => glare && glare.classList.add('mo-on'));
            }
            // L'icône de la carte saute et pivote
            const ic = el.querySelector('.card-icon, .kpi-icon, .title-emoji, [class$="-icon"]');
            if (ic && !ic.getAnimations().length) ic.animate([
                { transform: 'none' },
                { transform: 'translateY(-10px) rotate(-14deg) scale(1.25)', offset: 0.35 },
                { transform: 'translateY(2px) rotate(6deg) scale(.95)', offset: 0.7 },
                { transform: 'none' }
            ], { duration: 650, easing: 'ease-out' });
        });
        el.addEventListener('pointermove', (e) => {
            if (!el.style.scale) return;
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => {
                const r = el.getBoundingClientRect();
                const nx = (e.clientX - r.left) / r.width - 0.5;
                const ny = (e.clientY - r.top) / r.height - 0.5;
                el.style.rotate = (-ny).toFixed(3) + ' ' + nx.toFixed(3) + ' 0 ' + (Math.hypot(nx, ny) * 14).toFixed(2) + 'deg';
                if (glare) {
                    glare.style.setProperty('--mo-mx', ((nx + 0.5) * 100).toFixed(1) + '%');
                    glare.style.setProperty('--mo-my', ((ny + 0.5) * 100).toFixed(1) + '%');
                }
            });
        });
        el.addEventListener('pointerleave', () => {
            cancelAnimationFrame(raf);
            el.style.rotate = '';
            el.style.scale = '';
            const g = glare;
            glare = null;
            if (g) { g.classList.remove('mo-on'); setTimeout(() => g.remove(), 380); }
            setTimeout(() => { if (!el.style.scale) el.style.transition = base; }, 480);
        });
    }

    // ════════════════════════════════════════════════════════════════════
    //  Menu : cascade d'entrée + lettres brouillées au survol
    // ════════════════════════════════════════════════════════════════════
    function navEntrance(delay) {
        document.querySelectorAll('nav.site-nav:not([aria-hidden="true"]) a').forEach((a, i) => a.animate(
            [{ opacity: 0, transform: 'translateY(-14px) scale(.9)', filter: 'blur(6px)' },
             { opacity: 1, transform: 'none', filter: 'blur(0)' }],
            { duration: 650, delay: delay + i * 28, easing: EASE_OUT, fill: 'backwards' }));
    }

    // ════════════════════════════════════════════════════════════════════
    //  Boutons : attraction magnétique + gerbe d'étincelles au clic
    // ════════════════════════════════════════════════════════════════════
    const BTN = 'button, [role="button"], .btn, [class*="-btn"], [class*="filter"] > a, .chip, [class*="pill"]';
    function bindButtons() {
        if (FINE) {
            document.addEventListener('pointermove', (e) => {
                const b = e.target.closest && e.target.closest(BTN);
                if (!b || b.closest('nav, #mo-curtain, .pro-mobile-nav, .leaflet-container') || b.matches('.pro-theme-toggle, .pro-home-btn')) return;
                const r = b.getBoundingClientRect();
                if (r.width > 320 || r.height > 120) return;
                const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
                b.style.translate = (nx * 8).toFixed(1) + 'px ' + (ny * 6).toFixed(1) + 'px';
                if (!b.dataset.moMag) {
                    b.dataset.moMag = '1';
                    b.addEventListener('pointerleave', function off() {
                        b.style.translate = '';
                        delete b.dataset.moMag;
                        b.removeEventListener('pointerleave', off);
                    });
                }
            }, { passive: true });
        }
        let layer = null;
        document.addEventListener('click', (e) => {
            const b = e.target.closest && e.target.closest(BTN);
            if (!b || b.closest('#mo-curtain') || e.clientX === 0 && e.clientY === 0) return;
            if (!layer) { layer = document.createElement('div'); layer.className = 'mo-clickfx'; layer.setAttribute('aria-hidden', 'true'); document.body.appendChild(layer); }
            const cols = ['#00fff9', '#ff00c8', '#ffe600', '#fff'];
            for (let k = 0; k < 10; k++) {
                const p = document.createElement('i');
                const sz = 3 + Math.random() * 4;
                p.style.cssText = 'left:' + e.clientX + 'px;top:' + e.clientY + 'px;width:' + sz + 'px;height:' + sz + 'px;background:' + cols[k % 4] + ';box-shadow:0 0 8px ' + cols[k % 4];
                layer.appendChild(p);
                const a = (k / 10) * Math.PI * 2 + Math.random() * 0.5, v = 26 + Math.random() * 30;
                p.animate([
                    { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
                    { opacity: 0, transform: 'translate(calc(-50% + ' + (Math.cos(a) * v) + 'px), calc(-50% + ' + (Math.sin(a) * v + 12) + 'px)) scale(.2)' }
                ], { duration: 520 + Math.random() * 200, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'forwards' }).finished.then(() => p.remove(), () => p.remove());
            }
        });
    }

    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@';
    function bindScramble() {
        if (!FINE) return;
        document.addEventListener('pointerover', (e) => {
            const a = e.target.closest && e.target.closest('nav.site-nav a, .pro-mobile-nav a');
            if (!a || a.dataset.moScr) return;
            const node = Array.from(a.childNodes).filter((n) => n.nodeType === 3 && n.nodeValue.trim()).pop();
            if (!node) return;
            a.dataset.moScr = '1';
            const final = node.nodeValue;
            const chars = Array.from(final);
            const t0 = performance.now();
            let last = final;
            const step = (now) => {
                if (node.nodeValue !== last) { delete a.dataset.moScr; return; }
                const p = (now - t0) / 420;
                if (p >= 1) { node.nodeValue = final; delete a.dataset.moScr; return; }
                last = chars.map((ch, i) => (/[A-Za-zÀ-ÿ0-9]/.test(ch) && i / chars.length > p)
                    ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)] : ch).join('');
                node.nodeValue = last;
                setTimeout(() => requestAnimationFrame(step), 30);
            };
            requestAnimationFrame(step);
        });
    }

    // ════════════════════════════════════════════════════════════════════
    //  Curseur lumineux, barre de progression, fond animé
    // ════════════════════════════════════════════════════════════════════
    function cursor() {
        if (!FINE) return;
        const glow = document.createElement('div'); glow.id = 'mo-glow';
        const ring = document.createElement('div'); ring.id = 'mo-ring';
        [glow, ring].forEach((n) => { n.setAttribute('aria-hidden', 'true'); document.body.appendChild(n); });
        let mx = -999, my = -999, gx = mx, gy = my, rx = mx, ry = my, running = false;
        const loop = () => {
            gx += (mx - gx) * 0.12; gy += (my - gy) * 0.12;
            rx += (mx - rx) * 0.32; ry += (my - ry) * 0.32;
            glow.style.transform = 'translate3d(' + gx + 'px,' + gy + 'px,0)';
            ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
            if (Math.abs(mx - rx) + Math.abs(my - ry) + Math.abs(mx - gx) + Math.abs(my - gy) > 0.5) requestAnimationFrame(loop);
            else running = false;
        };
        document.addEventListener('pointermove', (e) => {
            if (e.pointerType !== 'mouse') return;
            if (mx < -900) { gx = rx = e.clientX; gy = ry = e.clientY; }
            mx = e.clientX; my = e.clientY;
            root.classList.add('mo-pointer');
            if (!running) { running = true; requestAnimationFrame(loop); }
        }, { passive: true });
        document.addEventListener('pointerover', (e) => {
            const hot = e.target.closest && e.target.closest('a, button, [role="button"], input, select, label, summary');
            ring.classList.toggle('mo-hot', !!hot);
        });
        document.documentElement.addEventListener('pointerleave', () => root.classList.remove('mo-pointer'));
    }

    function progressBar() {
        const bar = document.createElement('div');
        bar.id = 'mo-progress';
        bar.setAttribute('aria-hidden', 'true');
        document.body.appendChild(bar);
        let queued = false;
        const update = () => {
            queued = false;
            const max = document.documentElement.scrollHeight - innerHeight;
            bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollY / max) : 0) + ')';
        };
        addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
        addEventListener('resize', update);
        update();
    }

    function background() {
        const cv = document.createElement('canvas');
        cv.id = 'mo-bg';
        cv.setAttribute('aria-hidden', 'true');
        document.body.insertBefore(cv, document.body.firstChild);
        const ctx = cv.getContext('2d');
        if (!ctx) return;
        const COLORS = ['0,255,249', '255,0,200', '255,230,0', '120,140,255'];
        let w = 0, h = 0, dpr = 1, streaks = [], last = 0;
        const make = (fresh) => ({
            x: fresh ? Math.random() * w : -Math.random() * w * 0.5,
            y: Math.random() * h,
            len: 80 + Math.random() * 260,
            v: 1.2 + Math.random() * 4.5,
            a: 0.05 + Math.random() * 0.16,
            c: COLORS[Math.floor(Math.random() * COLORS.length)],
            t: 0.6 + Math.random() * 1.6
        });
        const resize = () => {
            dpr = Math.min(devicePixelRatio || 1, 1.5);
            w = innerWidth; h = innerHeight;
            cv.width = w * dpr; cv.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const n = Math.round(Math.min(46, w * h / 34000));
            streaks = Array.from({ length: n }, () => make(true));
        };
        resize();
        addEventListener('resize', resize);
        let sv = 0, lastY = scrollY;
        const frame = (now) => {
            requestAnimationFrame(frame);
            if (document.hidden || now - last < 33) return;
            last = now;
            const dy = scrollY - lastY; lastY = scrollY;
            sv += (Math.min(60, Math.abs(dy)) - sv) * 0.15;
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            streaks.forEach((s, i) => {
                s.x += s.v * (1 + sv * 0.12);
                if (s.x - s.len > w) streaks[i] = make(false);
                const g = ctx.createLinearGradient(s.x - s.len, 0, s.x, 0);
                g.addColorStop(0, 'rgba(' + s.c + ',0)');
                g.addColorStop(1, 'rgba(' + s.c + ',' + s.a + ')');
                ctx.strokeStyle = g;
                ctx.lineWidth = s.t;
                ctx.beginPath();
                ctx.moveTo(s.x - s.len, s.y);
                ctx.lineTo(s.x, s.y);
                ctx.stroke();
            });
        };
        requestAnimationFrame(frame);
    }

    // ════════════════════════════════════════════════════════════════════
    //  Accueil : parallaxe du héros, bandeau défilant
    // ════════════════════════════════════════════════════════════════════
    function homepage() {
        const hero = document.querySelector('section.hero');
        if (!hero) return;

        const h1 = hero.querySelector('h1');
        const meta = hero.querySelector('.hero-meta');

        // Fond généré avec Higgsfield : coureur dans la brume, zoom très lent, légère parallaxe
        const bg = document.createElement('div');
        bg.className = 'mo-hero-bg';
        bg.setAttribute('aria-hidden', 'true');
        bg.innerHTML = '<img src="media/hero-coureur-brume.jpg" alt="" decoding="async">';
        hero.classList.add('mo-hero-host');
        hero.insertBefore(bg, hero.firstChild);
        const img = bg.querySelector('img');
        // fondu seul : animer « filter » écraserait la contre-inversion du mode clair
        img.animate([
            { opacity: 0 },
            { opacity: getComputedStyle(img).opacity }
        ], { duration: 2200, delay: root.classList.contains('mo-cover') ? 600 : 100, easing: EASE_OUT, fill: 'backwards' });
        if (FINE) document.addEventListener('pointermove', (e) => {
            bg.style.setProperty('--mo-px', ((e.clientX / innerWidth - 0.5) * -12).toFixed(1) + 'px');
            bg.style.setProperty('--mo-pyx', ((e.clientY / innerHeight - 0.5) * -8).toFixed(1) + 'px');
        }, { passive: true });
        let queued = false;
        const par = () => {
            queued = false;
            const y = Math.min(scrollY, innerHeight);
            if (h1) { h1.style.translate = '0 ' + (y * 0.28).toFixed(1) + 'px'; h1.style.opacity = String(Math.max(0.15, 1 - y / (innerHeight * 0.9))); }
            if (meta) meta.style.translate = '0 ' + (y * 0.12).toFixed(1) + 'px';
            bg.style.setProperty('--mo-py', (y * 0.4).toFixed(1) + 'px');
        };
        addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(par); } }, { passive: true });

        // Bandeau : les chiffres sont relus sur la page, rien n'est écrit en dur
        const items = [];
        document.querySelectorAll('.kpis .kpi').forEach((k) => {
            const v = k.querySelector('.kpi-value'), l = k.querySelector('.kpi-label'), u = k.querySelector('.kpi-unit');
            if (v && l) items.push([v.textContent.trim(), (l.textContent.trim() + ' ' + (u ? u.textContent.trim() : '')).trim()]);
        });
        document.querySelectorAll('.flagship .flagship-main').forEach((f) => {
            const t = f.querySelector('.flagship-time'), tag = f.querySelector('.flagship-tag');
            if (t && tag) items.push([t.textContent.trim(), tag.textContent.replace(/^★\s*RECORD PERSONNEL\s*·\s*/i, 'Record · ').trim()]);
        });
        if (items.length) {
            const tk = document.createElement('div');
            tk.className = 'mo-ticker';
            tk.setAttribute('aria-hidden', 'true');
            const track = document.createElement('div');
            track.className = 'mo-ticker-track';
            const html = items.map(([v, l]) => {
                const s = document.createElement('span');
                s.className = 'mo-ticker-item';
                const b = document.createElement('b'); b.textContent = v;
                const sm = document.createElement('small'); sm.textContent = l;
                s.append(b, sm);
                return s.outerHTML;
            }).join('');
            track.innerHTML = html + html;
            tk.appendChild(track);
            hero.insertAdjacentElement('afterend', tk);
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  Progression : les graphiques se dessinent point par point à l'écran
    //  (courbe tracée en direct, points qui éclatent, barres qui rebondissent,
    //  comète lumineuse en tête de tracé, explosion sur le dernier point)
    // ════════════════════════════════════════════════════════════════════
    function progressionCharts() {
        if (PAGE !== 'progression.html') return;
        const played = new WeakSet();
        const cio = new IntersectionObserver((entries) => entries.forEach((e) => {
            if (!e.isIntersecting || played.has(e.target)) return;
            const chart = window.Chart && Chart.getChart && Chart.getChart(e.target);
            if (!chart) return; // pas encore créé : on réessaiera au prochain passage
            played.add(e.target);
            cio.unobserve(e.target);
            setTimeout(() => replayChart(chart), 250);
        }), { threshold: 0.35 });
        const scan = () => document.querySelectorAll('canvas').forEach((c) => { if (!played.has(c)) cio.observe(c); });
        scan();
        addEventListener('load', () => setTimeout(scan, 300));
    }

    function replayChart(chart) {
        const canvas = chart.canvas;
        const n = Math.max(1, ...chart.data.datasets.map((d) => (d.data || []).length));
        const total = Math.min(2600, 700 + n * 45);
        const step = total / n;
        const isBar = (ctx) => (chart.data.datasets[ctx.datasetIndex].type || chart.config.type) === 'bar';
        const meta = (ctx) => chart.getDatasetMeta(ctx.datasetIndex);
        const clampY = (y) => Math.max(chart.chartArea.top, Math.min(chart.chartArea.bottom, y));
        const baseY = (ctx) => clampY(meta(ctx).vScale ? meta(ctx).vScale.getPixelForValue(0) : chart.chartArea.bottom);
        const prevY = (ctx) => {
            if (isBar(ctx)) return baseY(ctx);
            if (ctx.index === 0) return chart.chartArea.bottom;
            const prev = meta(ctx).data[ctx.index - 1];
            return prev ? prev.getProps(['y'], true).y : chart.chartArea.bottom;
        };
        const started = new Set();
        const delay = (key) => (ctx) => {
            if (ctx.type !== 'data') return 0;
            const id = key + ctx.datasetIndex + ':' + ctx.index;
            if (started.has(id)) return 0;
            started.add(id);
            return ctx.index * step;
        };
        const saved = { animation: chart.options.animation, animations: chart.options.animations };
        chart.options.animation = { duration: step * 1.2 };
        chart.options.animations = {
            x: { type: 'number', easing: 'linear', duration: step, from: NaN, delay: delay('x') },
            y: { type: 'number', easing: 'easeOutQuart', duration: step * 2.2, from: prevY, delay: delay('y') },
            base: { type: 'number', easing: 'easeOutQuart', duration: step * 2.2, from: baseY, delay: delay('b') },
            radius: { type: 'number', easing: 'easeOutBack', duration: 520, from: 0, delay: (ctx) => ctx.type === 'data' ? ctx.index * step + step : 0 }
        };
        canvas.style.transition = 'filter .6s ease';
        canvas.style.filter = 'drop-shadow(0 0 10px rgba(0,255,170,.55))';
        chart.reset();
        chart.update();

        // Décor par-dessus le graphique : comète, étincelles, onde finale
        const L = fxLayer(canvas);
        const lr = L.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
        const ox = cr.left - lr.left, oy = cr.top - lr.top;
        const add = (css, cls) => { const d = document.createElement('i'); d.style.cssText = css; if (cls) d.className = cls; L.appendChild(d); return d; };
        const spark = (x, y, color, k, spread) => {
            for (let j = 0; j < k; j++) {
                const p = add('left:' + x + 'px;top:' + y + 'px;width:4px;height:4px;opacity:0;background:' + color + ';box-shadow:0 0 8px ' + color, 'mo-spark');
                const a = Math.random() * Math.PI * 2, v = (spread || 22) * (0.4 + Math.random());
                p.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
                    { opacity: 0, transform: 'translate(calc(-50% + ' + (Math.cos(a) * v) + 'px), calc(-50% + ' + (Math.sin(a) * v + 10) + 'px)) scale(.2)' }],
                    { duration: 600 + Math.random() * 300, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'forwards' });
            }
        };
        const ring = (x, y, size, color) => {
            const r = add('left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;opacity:0;border:2px solid ' + color + ';box-shadow:0 0 14px ' + color, 'mo-ring');
            r.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(.1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }],
                { duration: 800, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
        };
        const colorOf = (ds) => {
            const c = ds.pointBackgroundColor || ds.borderColor || '#00fff9';
            return typeof c === 'string' ? c : '#00fff9';
        };
        const lines = chart.data.datasets.map((ds, i) => ({ ds, i, m: chart.getDatasetMeta(i) }))
            .filter((o) => !o.m.hidden && (o.ds.data || []).length > 1);
        const comets = lines.filter((o) => (o.ds.type || chart.config.type) === 'line').map((o) =>
            ({ o, el: add('left:0;top:0;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#fff;box-shadow:0 0 12px ' + colorOf(o.ds) + ',0 0 28px ' + colorOf(o.ds)) }));
        const t0 = performance.now();
        let lastIdx = -1;
        const tick = (now) => {
            const el = now - t0;
            const idx = Math.min(n - 1, Math.floor(el / step));
            comets.forEach(({ o, el: dot }) => {
                const pt = o.m.data[Math.min(idx, o.m.data.length - 1)];
                if (!pt) return;
                const pr = pt.getProps(['x', 'y']);
                dot.style.transform = 'translate(' + (pr.x + ox) + 'px,' + (pr.y + oy) + 'px)';
            });
            if (idx !== lastIdx) {
                for (let k = lastIdx + 1; k <= idx; k++) lines.forEach((o) => {
                    const pt = o.m.data[k];
                    if (!pt || (o.ds.pointRadius === 0 && (o.ds.type || chart.config.type) === 'line')) return;
                    const pr = pt.getProps(['x', 'y'], true);
                    const bar = (o.ds.type || chart.config.type) === 'bar';
                    setTimeout(() => spark(pr.x + ox, pr.y + oy, bar ? 'rgba(200,80,255,1)' : colorOf(o.ds), bar ? 5 : 3, bar ? 30 : 20), bar ? step * 1.4 : step);
                });
                lastIdx = idx;
            }
            if (el < total + step * 2) requestAnimationFrame(tick);
            else finish();
        };
        requestAnimationFrame(tick);
        const finish = () => {
            comets.forEach(({ el }) => el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }));
            lines.forEach((o) => {
                const pt = o.m.data[o.m.data.length - 1];
                if (!pt) return;
                const pr = pt.getProps(['x', 'y'], true);
                ring(pr.x + ox, pr.y + oy, 90, colorOf(o.ds));
                spark(pr.x + ox, pr.y + oy, '#ffe600', 14, 60);
            });
            canvas.style.filter = '';
            setTimeout(() => {
                chart.options.animation = saved.animation;
                chart.options.animations = saved.animations;
                L.remove();
                canvas.style.transition = '';
            }, 1200);
        };
    }

    // ════════════════════════════════════════════════════════════════════
    //  ADN : la double hélice se construit au fil du défilement
    //  (les deux brins se tracent jusqu'au bas de l'écran, une tête lumineuse
    //  glisse sur chaque brin, barreaux et étiquettes éclosent à son passage)
    // ════════════════════════════════════════════════════════════════════
    function dnaScroll() {
        if (PAGE !== 'adn.html') return;
        const svg = document.getElementById('dna-svg');
        if (!svg) return;
        const NS = 'http://www.w3.org/2000/svg';
        let st = null, queued = false;

        const setup = () => {
            const strands = Array.from(svg.querySelectorAll('path')).filter((p) => (p.getAttribute('stroke') || '').includes('strandGrad'));
            if (strands.length < 2) return;
            svg.querySelectorAll('.mo-dna-head').forEach((n) => n.remove());
            const docY = (y) => {
                const pt = svg.createSVGPoint(); pt.x = 0; pt.y = y;
                return pt.matrixTransform(svg.getScreenCTM()).y + scrollY;
            };
            const lines = strands.map((p) => {
                const len = p.getTotalLength();
                const table = [];
                for (let k = 0; k <= 240; k++) { const l = len * k / 240; table.push([l, docY(p.getPointAtLength(l).y)]); }
                p.style.strokeDasharray = len;
                p.style.strokeDashoffset = len;
                const head = document.createElementNS(NS, 'circle');
                head.setAttribute('r', '6');
                head.setAttribute('class', 'mo-dna-head');
                head.setAttribute('fill', '#fff');
                svg.appendChild(head);
                return { p, len, table, head };
            });
            const items = Array.from(svg.querySelectorAll('line.rung, circle, text')).filter((n) => !n.classList.contains('mo-dna-head')).map((n) => {
                const r = n.getBoundingClientRect();
                n.classList.add('mo-dna-el');
                if (n.tagName === 'text' || n.hasAttribute('transform')) n.classList.add('mo-dna-fade');
                n.classList.add('mo-dna-off');
                return { n, y: r.top + r.height / 2 + scrollY, on: false };
            });
            st = { lines, items };
            update();
        };

        const update = () => {
            queued = false;
            if (!st) return;
            const edge = scrollY + innerHeight * 0.82;
            st.lines.forEach((o) => {
                let l = 0;
                for (const [len, y] of o.table) { if (y <= edge) l = len; else break; }
                o.p.style.strokeDashoffset = String(o.len - l);
                const pt = o.p.getPointAtLength(l);
                o.head.setAttribute('cx', pt.x);
                o.head.setAttribute('cy', pt.y);
                o.head.style.opacity = l > 0 && l < o.len ? '1' : '0';
            });
            st.items.forEach((it) => {
                const on = it.y <= edge;
                if (on === it.on) return;
                it.on = on;
                it.n.classList.toggle('mo-dna-off', !on);
                if (on && it.n.matches('line.rung')) {
                    it.n.classList.remove('mo-dna-pop'); void it.n.getBBox(); it.n.classList.add('mo-dna-pop');
                }
            });
        };

        addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
        let rt = 0;
        addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(setup, 250); });
        // La page reconstruit l'hélice (filtres, redimensionnement) : on se recâble
        new MutationObserver((muts) => {
            if (muts.some((m) => Array.from(m.addedNodes).some((n) => !(n.classList && n.classList.contains('mo-dna-head'))))) {
                clearTimeout(rt); rt = setTimeout(setup, 60);
            }
        }).observe(svg, { childList: true });
        setup();
        addEventListener('load', () => setTimeout(setup, 200));
    }

    // ════════════════════════════════════════════════════════════════════
    //  Age grading : Hall of Fame — compte à rebours du 5e au 1er
    //  (cartes qui tombent en 3D, médailles qui tournent, scores qui
    //  grimpent, couronne et feu d'artifice doré pour le n°1)
    // ════════════════════════════════════════════════════════════════════
    function hallOfFame() {
        if (PAGE !== 'age-grading.html') return;
        const box = document.getElementById('top-list');
        if (!box) return;
        let busy = false, seen = false;

        const decorate = () => {
            Array.from(box.querySelectorAll('.top-item')).forEach((card, i) => {
                card.classList.add('mo-hof-card');
                card.classList.toggle('mo-hof-champ', i === 0);
                const b = card.querySelector('.rank');
                if (b) { b.classList.remove('mo-hof-medal-1', 'mo-hof-medal-2', 'mo-hof-medal-3'); if (i < 3) b.classList.add('mo-hof-medal-' + (i + 1)); }
                if (i === 0 && !card.querySelector('.mo-hof-crown')) {
                    const c = document.createElement('span');
                    c.className = 'mo-hof-crown';
                    c.setAttribute('aria-hidden', 'true');
                    c.textContent = '👑';
                    card.appendChild(c);
                }
            });
        };

        const countUp = (el, delay) => {
            const node = el && el.firstChild;
            if (!node || node.nodeType !== 3) return;
            const final = node.nodeValue;
            const m = final.match(/[\d.]+/);
            if (!m) return;
            const target = parseFloat(m[0]), dec = (m[0].split('.')[1] || '').length;
            node.nodeValue = final.replace(m[0], (0).toFixed(dec));
            const t0 = performance.now() + delay;
            let last = node.nodeValue;
            const step = (now) => {
                if (node.nodeValue !== last) return; // la page a réécrit la carte
                const p = Math.max(0, Math.min(1, (now - t0) / 1100));
                last = p >= 1 ? final : final.replace(m[0], (target * (1 - Math.pow(1 - p, 3))).toFixed(dec));
                node.nodeValue = last;
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };

        const play = () => {
            const cards = Array.from(box.querySelectorAll('.top-item'));
            if (!cards.length || busy) return;
            busy = true;
            decorate();
            const L = fxLayer(box);
            const lr = L.getBoundingClientRect();
            const add = (css, cls) => { const d = document.createElement('i'); d.style.cssText = css; if (cls) d.className = cls; L.appendChild(d); return d; };
            const burst = (x, y, n, cols, spread, delay) => {
                for (let k = 0; k < n; k++) {
                    const sz = 4 + Math.random() * 5;
                    const p = add('left:' + x + 'px;top:' + y + 'px;width:' + sz + 'px;height:' + (sz * (k % 2 ? 1 : 0.5)) + 'px;opacity:0;border-radius:1px;background:' + cols[k % cols.length] + ';box-shadow:0 0 8px ' + cols[k % cols.length]);
                    const a = Math.random() * Math.PI * 2, v = spread * (0.35 + Math.random() * 0.9);
                    p.animate([{ opacity: 1, transform: 'translate(-50%,-50%) rotate(0deg)' },
                        { opacity: 1, transform: 'translate(calc(-50% + ' + (Math.cos(a) * v * 0.7) + 'px), calc(-50% + ' + (Math.sin(a) * v * 0.7 - 20) + 'px)) rotate(' + Math.round(Math.random() * 540) + 'deg)', offset: 0.5 },
                        { opacity: 0, transform: 'translate(calc(-50% + ' + (Math.cos(a) * v) + 'px), calc(-50% + ' + (Math.sin(a) * v + 60) + 'px)) rotate(' + Math.round(Math.random() * 900) + 'deg)' }],
                        { duration: 1300 + Math.random() * 500, delay, easing: 'cubic-bezier(.15,.7,.35,1)', fill: 'forwards' });
                }
            };
            const ring = (x, y, size, col, delay) => {
                const r = add('left:' + x + 'px;top:' + y + 'px;width:' + size + 'px;height:' + size + 'px;opacity:0;border-radius:50%;border:3px solid ' + col + ';box-shadow:0 0 18px ' + col);
                r.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(.1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }],
                    { duration: 900, delay, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
            };
            const GOLD = ['#ffd700', '#fff6b0', '#ffb300', '#ffffff'];
            const MEDAL = ['#ffd700', '#d8d8e0', '#cd7f32', '#4da6ff', '#4da6ff'];
            let endAt = 0;
            cards.forEach((card, i) => {
                const d = (cards.length - 1 - i) * 320 + (i === 0 ? 260 : 0); // compte à rebours, pause avant le n°1
                const champ = i === 0;
                card.animate([
                    { opacity: 0, transform: 'perspective(900px) translateY(-70px) rotateX(-80deg) scale(.85)', filter: 'blur(6px) brightness(2)' },
                    { opacity: 1, transform: 'perspective(900px) translateY(8px) rotateX(10deg) scale(' + (champ ? 1.06 : 1.02) + ')', filter: 'brightness(1.4)', offset: 0.65 },
                    { opacity: 1, transform: 'none', filter: 'none' }
                ], { duration: champ ? 1100 : 850, delay: d, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });
                const badge = card.querySelector('.rank');
                if (badge) badge.animate([
                    { transform: 'scale(0) rotateY(0deg)' },
                    { transform: 'scale(' + (champ ? 2 : 1.6) + ') rotateY(540deg)', offset: 0.6 },
                    { transform: 'scale(1) rotateY(720deg)' }
                ], { duration: 1000, delay: d + 300, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
                const sweep = document.createElement('span');
                sweep.className = 'mo-hof-sweep';
                card.appendChild(sweep);
                sweep.animate([{ transform: 'translateX(-120%) skewX(-20deg)', opacity: 1 }, { transform: 'translateX(220%) skewX(-20deg)', opacity: 1 }],
                    { duration: 900, delay: d + 500, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'both' }).finished.then(() => sweep.remove(), () => sweep.remove());
                countUp(card.querySelector('.ti-score'), d + 350);
                const r = card.getBoundingClientRect();
                const bx = (badge ? badge.getBoundingClientRect() : r);
                const cx = bx.left - lr.left + bx.width / 2, cy = bx.top - lr.top + bx.height / 2;
                setTimeout(() => burst(cx, cy, champ ? 46 : 10, champ ? GOLD : [MEDAL[i], '#fff'], champ ? 190 : 60, 0), d + 650);
                ring(cx, cy, champ ? 260 : 90, MEDAL[i], d + 650);
                if (champ) {
                    ring(cx, cy, 420, '#fff6b0', d + 780);
                    const crown = card.querySelector('.mo-hof-crown');
                    if (crown) crown.animate([
                        { opacity: 0, transform: 'translateY(-90px) rotate(-30deg) scale(1.8)' },
                        { opacity: 1, transform: 'translateY(4px) rotate(8deg) scale(1)', offset: 0.7 },
                        { opacity: 1, transform: 'none' }
                    ], { duration: 900, delay: d + 900, easing: 'cubic-bezier(.3,.7,.4,1.3)', fill: 'backwards' });
                    const flash = add('left:' + (r.left - lr.left) + 'px;top:' + (r.top - lr.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px;opacity:0;border-radius:12px;background:radial-gradient(circle, rgba(255,240,170,.9), transparent 70%)');
                    flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }], { duration: 700, delay: d + 620, fill: 'forwards' });
                }
                endAt = Math.max(endAt, d + 2200);
            });
            setTimeout(() => { L.remove(); busy = false; }, endAt + 400);
        };

        const io2 = new IntersectionObserver((es) => es.forEach((e) => {
            if (e.isIntersecting && box.children.length && !seen) { seen = true; play(); }
        }), { threshold: 0.3 });
        io2.observe(box);
        // La page recalcule le Top 5 (date de naissance modifiée) : décor + nouvelle cérémonie
        new MutationObserver((muts) => {
            if (!muts.some((m) => Array.from(m.addedNodes).some((n) => n.classList && n.classList.contains('top-item')))) return;
            decorate();
            if (seen) play();
        }).observe(box, { childList: true });
        decorate();
    }

    // ════════════════════════════════════════════════════════════════════
    //  Tour du monde : le voyage se joue tout seul à l'arrivée sur la carte
    //  (on déclenche le bouton « Rejouer » de la page, halo pendant le trajet,
    //  gerbe d'étincelles sur le coureur à l'arrivée)
    // ════════════════════════════════════════════════════════════════════
    function worldTour() {
        if (PAGE !== 'tour-du-monde.html') return;
        const mapEl = document.getElementById('map');
        const btn = document.getElementById('replay');
        if (!mapEl || !btn) return;
        let done = false;
        const go = () => {
            if (done) return;
            done = true;
            mapEl.classList.add('mo-tour-live');
            // Les textes des cartes « Position / Prochaine étape / Tour de la Terre »
            // changent de nombre de lignes à chaque ville : on fige la hauteur du bloc
            // (elle ne peut que grandir) pour que la carte en dessous ne saute pas.
            const status = document.querySelector('section.status');
            const vals = status ? Array.from(status.querySelectorAll('.val')) : [];
            let maxH = status ? status.offsetHeight : 0, lock = 0;
            const hold = () => {
                if (!status) return;
                vals.forEach((v) => { if (v.offsetHeight > (parseFloat(v.style.minHeight) || 0)) v.style.minHeight = v.offsetHeight + 'px'; });
                if (status.offsetHeight > maxH) maxH = status.offsetHeight;
                status.style.minHeight = maxH + 'px';
                lock = requestAnimationFrame(hold);
            };
            hold();
            btn.click();
            const watch = setInterval(() => {
                if (!/REJOUER/i.test(btn.textContent)) return; // trajet en cours
                clearInterval(watch);
                cancelAnimationFrame(lock);
                mapEl.classList.remove('mo-tour-live');
                const ic = mapEl.querySelector('.runner-icon');
                if (!ic) return;
                const r = ic.getBoundingClientRect();
                const layer = document.createElement('div');
                layer.className = 'mo-clickfx';
                layer.setAttribute('aria-hidden', 'true');
                document.body.appendChild(layer);
                const cols = ['#00fff9', '#ff00c8', '#ffe600', '#fff'];
                for (let k = 0; k < 28; k++) {
                    const p = document.createElement('i');
                    const sz = 3 + Math.random() * 5;
                    p.style.cssText = 'left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;width:' + sz + 'px;height:' + sz + 'px;background:' + cols[k % 4] + ';box-shadow:0 0 10px ' + cols[k % 4];
                    layer.appendChild(p);
                    const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 90;
                    p.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
                        { opacity: 0, transform: 'translate(calc(-50% + ' + (Math.cos(a) * v) + 'px), calc(-50% + ' + (Math.sin(a) * v + 20) + 'px)) scale(.2)' }],
                        { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.15,.75,.35,1)', fill: 'forwards' });
                }
                const ring = document.createElement('i');
                ring.style.cssText = 'left:' + (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;width:160px;height:160px;border:2px solid #00fff9;box-shadow:0 0 18px #00fff9';
                layer.appendChild(ring);
                ring.animate([{ opacity: 1, transform: 'translate(-50%,-50%) scale(.1)' }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1)' }],
                    { duration: 900, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
                setTimeout(() => layer.remove(), 1700);
            }, 200);
        };
        const tio = new IntersectionObserver((es) => es.forEach((e) => {
            if (!e.isIntersecting) return;
            tio.disconnect();
            setTimeout(go, root.classList.contains('mo-cover') || document.querySelector('#mo-curtain.mo-on') ? 1600 : 1100);
        }), { threshold: 0.4 });
        tio.observe(mapEl);
    }

    // ════════════════════════════════════════════════════════════════════
    //  Contenu ajouté plus tard par les scripts des pages (filtres, listes)
    // ════════════════════════════════════════════════════════════════════
    function watchDom() {
        let pending = [], timer = 0, batches = 0;
        const since = performance.now();
        const mo = new MutationObserver((muts) => {
            muts.forEach((m) => m.addedNodes.forEach((n) => {
                if (n.nodeType !== 1) return;
                if (n.id && n.id.startsWith('mo-')) return;
                if (n.closest && n.closest('.mo-fx')) return;
                if (n.classList && Array.from(n.classList).some((c) => c.startsWith('mo-'))) return;
                pending.push(n);
            }));
            if (!pending.length) return;
            clearTimeout(timer);
            timer = setTimeout(() => {
                const nodes = pending; pending = [];
                if (++batches > 40 && performance.now() - since < 20000) { mo.disconnect(); return; }
                nodes.forEach((n) => {
                    if (!n.isConnected || !n.parentElement) return;
                    // le nœud lui-même et tout ce qu'il contient
                    prepare(n.parentElement === document.body ? n : n.parentElement);
                    watchNumbers(n.parentElement);
                });
            }, 90);
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    // ════════════════════════════════════════════════════════════════════
    //  Démarrage
    // ════════════════════════════════════════════════════════════════════
    function init() {
        buildCurtain();
        const entering = root.classList.contains('mo-cover');
        const label = root.getAttribute('data-mo-label') || LABELS[PAGE] || '';
        const t0 = entering ? 520 : 60;

        io = new IntersectionObserver((entries) => {
            const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target);
            if (batch.length) reveal(batch);
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.01 });

        numIO = new IntersectionObserver((entries) => entries.forEach((e) => {
            if (!e.isIntersecting) return;
            numIO.unobserve(e.target);
            setTimeout(() => decode(e.target), entering ? 650 : 250);
        }), { threshold: 0.6 });

        // Filet de sécurité : un bloc décalé hors d'un parent « overflow: hidden »
        // ou masqué par son clip-path échappe à l'IntersectionObserver.
        let sweepQueued = false;
        const sweep = () => {
            sweepQueued = false;
            const late = [];
            document.querySelectorAll('.mo-watch').forEach((el) => {
                const r = el.getBoundingClientRect();
                if ((r.width || r.height) && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) late.push(el);
            });
            if (late.length) reveal(late);
        };
        addEventListener('scroll', () => { if (!sweepQueued) { sweepQueued = true; setTimeout(sweep, 260); } }, { passive: true });
        setInterval(sweep, 900);

        if (entering) openCurtain(label);

        heroTitles().forEach((el, i) => animateTitle(el, t0 + i * 200));
        root.classList.add('mo-done');
        navEntrance(t0 - 120);

        const scope = document.body;
        prepare(scope);
        watchNumbers(scope);
        homepage();
        progressionCharts();
        dnaScroll();
        hallOfFame();
        worldTour();
        bindLinks();
        bindScramble();
        bindButtons();
        cursor();
        progressBar();
        background();
        watchDom();
        addEventListener('load', () => {
            prepare(document.body);
            watchNumbers(document.body);
            const pre = new Image();
            pre.src = 'media/rideau-coureur.jpg';
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
