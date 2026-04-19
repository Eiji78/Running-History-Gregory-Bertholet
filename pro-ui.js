/* ═══════════════════════════════════════════════════════════════════════
   PRO-UI.JS — micro-détails transverses
   Breadcrumb injection · loader top · smooth nav
   ═══════════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    // ── Map des pages : filename → label du breadcrumb ─────────────────
    const PAGES = {
        'timeline.html':    { label: 'Timeline', parent: null },
        'progression.html': { label: 'Progression', parent: null },
        'radar.html':       { label: 'Radar de perf', parent: null },
        'elite.html':       { label: 'vs Élite mondiale', parent: null },
        'carte.html':       { label: 'Carte des courses', parent: null },
        'comparaison.html': { label: 'Comparateur', parent: null },
        'meteo.html':       { label: 'Météo & perfs', parent: null },
        'galerie.html':     { label: 'Galerie', parent: null },
        'wrapped.html':     { label: 'Wrapped', parent: null },
        '404.html':         { label: '404', parent: null },
    };

    // ── Breadcrumb injection ───────────────────────────────────────────
    function injectBreadcrumb() {
        // Ne pas afficher sur index
        const path = location.pathname.split('/').pop() || 'index.html';
        if (path === '' || path === 'index.html') return;
        const cur = PAGES[path];
        if (!cur) return;

        const bc = document.createElement('nav');
        bc.className = 'pro-breadcrumb';
        bc.setAttribute('aria-label', 'Fil d\'Ariane');
        bc.innerHTML =
            '<a href="index.html" title="Retour à l\'accueil">Accueil</a>' +
            '<span class="pro-bc-sep">›</span>' +
            '<span class="pro-bc-cur">' + cur.label + '</span>';
        // Le home btn est maintenant à droite, donc le breadcrumb reste à gauche (default)
        document.body.appendChild(bc);
    }

    // ── Home button injection (sur sous-pages qui n'en ont pas) ───────
    function injectHomeButton() {
        const path = location.pathname.split('/').pop() || 'index.html';
        // Pas sur l'accueil
        if (path === '' || path === 'index.html') return;
        // Si un bouton home existe déjà, ne rien injecter
        if (document.querySelector('.home-btn-fixed, .home-btn, .pro-home-btn')) return;

        const btn = document.createElement('a');
        btn.className = 'pro-home-btn';
        btn.href = 'index.html';
        btn.title = 'Retour à l\'accueil';
        btn.setAttribute('aria-label', 'Retour à l\'accueil');
        // SVG icône maison (même style que les autres pages)
        btn.innerHTML =
            '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
                '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>' +
                '<polyline points="9 22 9 12 15 12 15 22"></polyline>' +
            '</svg>';
        document.body.appendChild(btn);
    }

    // ── Loader top ─────────────────────────────────────────────────────
    function injectLoader() {
        if (document.getElementById('pro-loader')) return;
        const loader = document.createElement('div');
        loader.className = 'pro-loader';
        loader.id = 'pro-loader';
        document.body.appendChild(loader);
        return loader;
    }

    function bindLoader(loader) {
        if (!loader) return;
        document.addEventListener('click', function (e) {
            const a = e.target.closest('a');
            if (!a || !a.href) return;
            if (a.target === '_blank' || a.target === '_self' && false) return;
            if (a.target === '_blank') return;
            if (a.hasAttribute('download')) return;
            if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
            if (e.button !== 0) return;

            let url;
            try { url = new URL(a.href, location.href); } catch { return; }
            if (url.origin !== location.origin) return;
            // Anchor sur même page : pas de loader
            if (url.pathname === location.pathname && url.hash) return;
            if (url.href === location.href) return;
            // pdf etc.
            if (/\.(pdf|zip|png|jpg|jpeg|gif|webp)$/i.test(url.pathname)) return;

            loader.classList.remove('active');
            // reflow pour relancer l'animation
            void loader.offsetWidth;
            loader.classList.add('active');

            // Failsafe: reset après 2s si navigation bloquée
            setTimeout(function () { loader.classList.remove('active'); }, 2000);
        });

        // Si l'utilisateur revient via back/forward, on cache le loader
        window.addEventListener('pageshow', function () {
            loader.classList.remove('active');
        });
    }

    // ── Theme toggle (dark/light) ──────────────────────────────────────
    const THEME_KEY = 'running-history-theme';

    function getSavedTheme() {
        try {
            const saved = localStorage.getItem(THEME_KEY);
            if (saved === 'light' || saved === 'dark') return saved;
        } catch (e) {}
        // Fallback: prefers-color-scheme (mais défaut dark pour respecter le design)
        try {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                return 'light';
            }
        } catch (e) {}
        return 'dark';
    }

    function applyTheme(theme) {
        if (theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
        // Met à jour l'icône et le label
        const btn = document.getElementById('pro-theme-toggle');
        if (btn) {
            const icon = btn.querySelector('.pto-icon');
            if (icon) icon.textContent = (theme === 'light') ? '🌙' : '☀️';
            btn.setAttribute('data-label', (theme === 'light') ? 'Mode sombre' : 'Mode clair');
            btn.setAttribute('aria-label', (theme === 'light') ? 'Passer en mode sombre' : 'Passer en mode clair');
        }
    }

    function injectThemeToggle() {
        const btn = document.createElement('button');
        btn.id = 'pro-theme-toggle';
        btn.className = 'pro-theme-toggle';
        btn.type = 'button';
        btn.innerHTML = '<span class="pto-icon">☀️</span>';
        btn.addEventListener('click', function () {
            const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
            const next = current === 'light' ? 'dark' : 'light';

            // Micro-animation
            btn.setAttribute('data-rotating', 'true');
            setTimeout(function () { btn.removeAttribute('data-rotating'); }, 500);

            applyTheme(next);
            try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
        });

        // Sur l'accueil : descendre sous la topbar pour ne pas cacher "dernière maj"
        const path = location.pathname.split('/').pop() || 'index.html';
        if (path === '' || path === 'index.html') {
            btn.style.top = '78px';
            btn.style.right = '20px';
        }

        document.body.appendChild(btn);
    }

    // Applique le thème immédiatement (avant DOMContentLoaded si possible)
    // pour éviter un flash lors du chargement de la page
    (function earlyThemeApply() {
        const t = getSavedTheme();
        if (t === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        }
    })();

    // ── Init ───────────────────────────────────────────────────────────
    function init() {
        injectBreadcrumb();
        injectHomeButton();
        const loader = injectLoader();
        bindLoader(loader);
        injectThemeToggle();
        applyTheme(getSavedTheme());
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
