/**
 * Modal with progress bar for hard reload / model compile from button widgets.
 */

const MODAL_ID = 'button-hard-reload-modal';

function ensureStyles() {
  if (document.getElementById('button-hard-reload-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'button-hard-reload-modal-styles';
  style.textContent = `
    #${MODAL_ID} {
      position: fixed;
      inset: 0;
      z-index: 10050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      background: rgba(8, 10, 14, 0.62);
      backdrop-filter: blur(4px);
      font-family: Inter, system-ui, -apple-system, sans-serif;
    }
    #${MODAL_ID}[hidden] { display: none !important; }
    #${MODAL_ID} .bhr-card {
      width: min(420px, 100%);
      border-radius: 14px;
      border: 1px solid rgba(255,255,255,0.12);
      background: linear-gradient(180deg, #1b1f27 0%, #14171d 100%);
      box-shadow: 0 18px 48px rgba(0,0,0,0.45);
      color: #f3f4f6;
      padding: 1.25rem 1.35rem 1.15rem;
    }
    #${MODAL_ID} .bhr-title {
      margin: 0 0 0.35rem;
      font-size: 1rem;
      font-weight: 650;
      letter-spacing: 0.01em;
    }
    #${MODAL_ID} .bhr-status {
      margin: 0 0 1rem;
      font-size: 0.84rem;
      line-height: 1.45;
      color: #b0b3b8;
      min-height: 2.4em;
    }
    #${MODAL_ID} .bhr-bar {
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      overflow: hidden;
    }
    #${MODAL_ID} .bhr-bar-fill {
      height: 100%;
      width: 0%;
      border-radius: inherit;
      background: linear-gradient(90deg, #3d8bff, #6366f1);
      transition: width 0.35s ease;
    }
    #${MODAL_ID}.is-indeterminate .bhr-bar-fill {
      width: 36% !important;
      animation: bhr-indeterminate 1.1s ease-in-out infinite;
    }
    @keyframes bhr-indeterminate {
      0% { transform: translateX(-120%); }
      100% { transform: translateX(320%); }
    }
    #${MODAL_ID} .bhr-meta {
      display: flex;
      justify-content: space-between;
      margin-top: 0.55rem;
      font-size: 0.72rem;
      color: #8b9099;
    }
    #${MODAL_ID} .bhr-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1.1rem;
    }
    #${MODAL_ID} .bhr-btn {
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.06);
      color: #fff;
      border-radius: 8px;
      padding: 0.45rem 0.85rem;
      font-size: 0.8rem;
      cursor: pointer;
    }
    #${MODAL_ID} .bhr-btn:hover { border-color: rgba(61,139,255,0.45); }
    #${MODAL_ID} .bhr-btn[hidden] { display: none !important; }
    #${MODAL_ID}.is-success .bhr-bar-fill { background: linear-gradient(90deg, #22c55e, #16a34a); }
    #${MODAL_ID}.is-error .bhr-bar-fill { background: linear-gradient(90deg, #ef4444, #b91c1c); }
    #${MODAL_ID}.is-success .bhr-status { color: #86efac; }
    #${MODAL_ID}.is-error .bhr-status { color: #fca5a5; }
  `;
  document.head.appendChild(style);
}

function ensureModal() {
  ensureStyles();
  let root = document.getElementById(MODAL_ID);
  if (root) return root;
  root = document.createElement('div');
  root.id = MODAL_ID;
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'bhr-title');
  root.innerHTML = `
    <div class="bhr-card">
      <h3 class="bhr-title" id="bhr-title">Сборка модели данных</h3>
      <p class="bhr-status" data-bhr-status>Подготовка…</p>
      <div class="bhr-bar"><div class="bhr-bar-fill" data-bhr-fill></div></div>
      <div class="bhr-meta">
        <span data-bhr-step>Шаг 0 / 0</span>
        <span data-bhr-percent>0%</span>
      </div>
      <div class="bhr-actions">
        <button type="button" class="bhr-btn" data-bhr-close hidden>Закрыть</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  root.querySelector('[data-bhr-close]')?.addEventListener('click', () => {
    hideButtonCompileProgressModal();
  });
  return root;
}

export function showButtonCompileProgressModal({ title = 'Сборка модели данных' } = {}) {
  const root = ensureModal();
  root.classList.remove('is-success', 'is-error', 'is-indeterminate');
  root.querySelector('#bhr-title').textContent = title;
  root.querySelector('[data-bhr-status]').textContent = 'Подготовка…';
  root.querySelector('[data-bhr-fill]').style.width = '0%';
  root.querySelector('[data-bhr-step]').textContent = 'Шаг 0 / 0';
  root.querySelector('[data-bhr-percent]').textContent = '0%';
  const closeBtn = root.querySelector('[data-bhr-close]');
  if (closeBtn) closeBtn.hidden = true;
  root.hidden = false;
  return root;
}

export function updateButtonCompileProgressModal({
  status,
  percent,
  step,
  totalSteps,
  indeterminate = false,
} = {}) {
  const root = ensureModal();
  if (status != null) root.querySelector('[data-bhr-status]').textContent = status;
  if (Number.isFinite(step) && Number.isFinite(totalSteps)) {
    root.querySelector('[data-bhr-step]').textContent = `Шаг ${step} / ${totalSteps}`;
  }
  root.classList.toggle('is-indeterminate', !!indeterminate);
  if (!indeterminate && Number.isFinite(percent)) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    root.querySelector('[data-bhr-fill]').style.width = `${p}%`;
    root.querySelector('[data-bhr-percent]').textContent = `${p}%`;
  }
}

export function finishButtonCompileProgressModal({ ok = true, status = '', autoCloseMs = 2200 } = {}) {
  const root = ensureModal();
  root.classList.remove('is-indeterminate');
  root.classList.toggle('is-success', !!ok);
  root.classList.toggle('is-error', !ok);
  root.querySelector('[data-bhr-fill]').style.width = '100%';
  root.querySelector('[data-bhr-percent]').textContent = '100%';
  if (status) root.querySelector('[data-bhr-status]').textContent = status;
  const closeBtn = root.querySelector('[data-bhr-close]');
  if (closeBtn) closeBtn.hidden = false;

  if (ok && autoCloseMs > 0) {
    clearTimeout(root._bhrAutoClose);
    root._bhrAutoClose = setTimeout(() => {
      hideButtonCompileProgressModal();
    }, autoCloseMs);
  }
}

export function hideButtonCompileProgressModal() {
  const root = document.getElementById(MODAL_ID);
  if (!root) return;
  clearTimeout(root._bhrAutoClose);
  root.hidden = true;
}
