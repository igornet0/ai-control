// Developer API Docs — interactive behaviour

(function () {
    'use strict';

    // ── Base URL from query string or parent postMessage ──────────────────────
    var BASE_URL_PLACEHOLDER = 'https://api-control.example.com/ext';
    var currentBase = BASE_URL_PLACEHOLDER;

    function readBaseFromQuery() {
        try {
            var params = new URLSearchParams(window.location.search);
            var b = params.get('apiBase');
            return b ? b.replace(/\/$/, '') : null;
        } catch (e) {
            return null;
        }
    }

    function applyBase(base) {
        currentBase = base || BASE_URL_PLACEHOLDER;
        var inp = document.getElementById('base-url-input');
        if (inp) inp.value = currentBase;
        refreshCodeBlocks();
    }

    function refreshCodeBlocks() {
        document.querySelectorAll('pre[data-tmpl]').forEach(function (pre) {
            var tmpl = pre.getAttribute('data-tmpl') || '';
            pre.textContent = tmpl.replace(/\{BASE\}/g, currentBase);
        });
    }

    // ── Tab navigation ────────────────────────────────────────────────────────
    function showTab(id) {
        document.querySelectorAll('.nav-btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-tab') === id);
        });
        document.querySelectorAll('.tab-panel').forEach(function (p) {
            p.classList.toggle('active', p.id === 'tab-' + id);
        });
    }

    // ── Copy button ───────────────────────────────────────────────────────────
    function copyCode(btn) {
        var pre = btn.closest('.code-block').querySelector('pre');
        navigator.clipboard.writeText(pre.textContent).then(function () {
            var orig = btn.textContent;
            btn.textContent = 'Скопировано';
            setTimeout(function () { btn.textContent = orig; }, 1800);
        }).catch(function () {});
    }

    // ── postMessage from parent (React passes apiBase) ────────────────────────
    window.addEventListener('message', function (e) {
        if (!e.data || typeof e.data !== 'object') return;
        if (e.data.type === 'SET_API_BASE' && e.data.apiBase) {
            applyBase(e.data.apiBase.replace(/\/$/, ''));
        }
    });

    // ── Init ──────────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        // Base URL
        var fromQuery = readBaseFromQuery();
        applyBase(fromQuery);

        // Sidebar nav
        document.querySelectorAll('.nav-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                showTab(btn.getAttribute('data-tab'));
            });
        });

        // Base URL input – live update
        var inp = document.getElementById('base-url-input');
        if (inp) {
            inp.addEventListener('input', function () {
                refreshCodeBlocks();
            });
            inp.addEventListener('change', function () {
                currentBase = inp.value.replace(/\/$/, '') || BASE_URL_PLACEHOLDER;
                refreshCodeBlocks();
            });
        }

        // Expose copyCode globally for onclick attributes
        window.copyCode = copyCode;

        // Activate first tab
        showTab('overview');
    });
})();
