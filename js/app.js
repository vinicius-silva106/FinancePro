/**
 * FinancePro - Application Controller
 */

const state = {
  currentTab: 'dashboard',
  currentDate: new Date(),
  selectedMonth: new Date().getMonth() + 1,
  selectedYear: new Date().getFullYear(),
  accounts: [],
  categories: [],
  dashboard: null,
  forecast: null,
  activeTxType: 'expense',
  deferredPrompt: null
};

// Utilities
const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return 'R$ 0,00';
  return 'R$ ' + Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : '✕'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupPWA();
  setupEventListeners();
  initMonthSelector();
  setupCloudUI();

  if (window.cloudManager && window.cloudManager.ready) {
    await window.cloudManager.ready();
  }

  await loadMetadata();
  await switchTab('dashboard');

  if (window.cloudManager && window.cloudManager.isCloudMode && !window.cloudManager.currentUser) {
    setTimeout(() => {
      openModal('modal-cloud-login');
    }, 400);
  }
});

// PWA Setup
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.style.display = 'flex';
  });
}

function promptInstallPWA() {
  if (state.deferredPrompt) {
    state.deferredPrompt.prompt();
    state.deferredPrompt.userChoice.then(() => {
      state.deferredPrompt = null;
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) installBtn.style.display = 'none';
    });
  } else {
    showToast('Para instalar: no celular toque em Compartilhar > Adicionar à Tela Inicial', 'success');
  }
}

// Navigation & Tabs
async function switchTab(tabName) {
  state.currentTab = tabName;

  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    view.style.display = 'none';
  });

  const activeView = document.getElementById(`view-${tabName}`);
  if (activeView) {
    activeView.style.display = 'block';
    activeView.classList.add('animate-fade-in');
  }

  if (tabName === 'dashboard') {
    await renderDashboard();
  } else if (tabName === 'transactions') {
    await renderTransactionsView();
  } else if (tabName === 'forecast') {
    await renderForecastView();
  } else if (tabName === 'accounts') {
    await renderAccountsView();
  } else if (tabName === 'budgets') {
    await renderBudgetsView();
  }
}

// Load Accounts & Categories
async function loadMetadata() {
  try {
    const [accs, cats] = await Promise.all([
      api.getAccounts(),
      api.getCategories()
    ]);
    state.accounts = accs || [];
    state.categories = cats || [];
    populateSelects();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function populateSelects() {
  const accSelect = document.getElementById('tx-account');
  const destSelect = document.getElementById('tx-destination-account');
  const importAccSelect = document.getElementById('import-account');

  const accOptions = state.accounts.map(a => 
    `<option value="${a.id}">${a.name} (${formatCurrency(a.current_balance)})</option>`
  ).join('');

  if (accSelect) accSelect.innerHTML = accOptions;
  if (destSelect) destSelect.innerHTML = `<option value="">Selecione a conta destino...</option>` + accOptions;
  if (importAccSelect) importAccSelect.innerHTML = `<option value="">Escolha onde importar...</option>` + accOptions;

  updateCategorySelect();
}

function updateCategorySelect() {
  const catSelect = document.getElementById('tx-category');
  if (!catSelect) return;

  const filtered = state.categories.filter(c => c.type === state.activeTxType);
  catSelect.innerHTML = `<option value="">Selecione uma categoria...</option>` +
    filtered.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

// Month Selector Helpers & Modern Navigator
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const MONTH_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

let pickerYear = state.selectedYear;

function updateMonthDisplay() {
  const label = document.getElementById('current-month-label');
  if (label) {
    label.textContent = `${MONTH_NAMES[state.selectedMonth - 1]} ${state.selectedYear}`;
  }
}

function initMonthSelector() {
  updateMonthDisplay();

  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  const displayBtn = document.getElementById('month-display-btn');
  const popup = document.getElementById('month-picker-popup');
  const prevYearBtn = document.getElementById('prev-year-btn');
  const nextYearBtn = document.getElementById('next-year-btn');
  const pickerYearLabel = document.getElementById('picker-year-label');

  if (prevBtn) {
    prevBtn.addEventListener('click', async () => {
      state.selectedMonth--;
      if (state.selectedMonth < 1) {
        state.selectedMonth = 12;
        state.selectedYear--;
      }
      pickerYear = state.selectedYear;
      updateMonthDisplay();
      await onMonthChanged();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', async () => {
      state.selectedMonth++;
      if (state.selectedMonth > 12) {
        state.selectedMonth = 1;
        state.selectedYear++;
      }
      pickerYear = state.selectedYear;
      updateMonthDisplay();
      await onMonthChanged();
    });
  }

  function renderPickerGrid() {
    if (pickerYearLabel) pickerYearLabel.textContent = pickerYear;
    const grid = document.getElementById('month-picker-grid');
    if (!grid) return;
    grid.innerHTML = MONTH_SHORT.map((name, idx) => {
      const mNum = idx + 1;
      const isActive = (mNum === state.selectedMonth && pickerYear === state.selectedYear);
      return `<div class="month-grid-item ${isActive ? 'active' : ''}" data-m="${mNum}">${name}</div>`;
    }).join('');

    grid.querySelectorAll('.month-grid-item').forEach(el => {
      el.addEventListener('click', async () => {
        state.selectedMonth = parseInt(el.dataset.m);
        state.selectedYear = pickerYear;
        updateMonthDisplay();
        if (popup) popup.classList.remove('active');
        await onMonthChanged();
      });
    });
  }

  if (displayBtn && popup) {
    displayBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerYear = state.selectedYear;
      renderPickerGrid();
      popup.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && !displayBtn.contains(e.target)) {
        popup.classList.remove('active');
      }
    });
  }

  if (prevYearBtn) {
    prevYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerYear--;
      renderPickerGrid();
    });
  }

  if (nextYearBtn) {
    nextYearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pickerYear++;
      renderPickerGrid();
    });
  }
}

async function onMonthChanged() {
  if (state.currentTab === 'dashboard') await renderDashboard();
  if (state.currentTab === 'transactions') await renderTransactionsView();
  if (state.currentTab === 'budgets') await renderBudgetsView();
}

// ---------------- DASHBOARD VIEW ----------------
async function renderDashboard() {
  try {
    const data = await api.getDashboard(state.selectedMonth, state.selectedYear);
    state.dashboard = data;

    // Update Metrics
    document.getElementById('metric-liquid-balance').textContent = formatCurrency(data.total_liquid);
    document.getElementById('metric-credit-debt').textContent = formatCurrency(data.total_credit_debt);
    document.getElementById('metric-month-income').textContent = formatCurrency(data.month_income);
    document.getElementById('metric-month-expense').textContent = formatCurrency(data.month_expense);
    document.getElementById('metric-net-balance').textContent = formatCurrency(data.net_balance);

    const netEl = document.getElementById('metric-net-balance');
    if (data.net_balance >= 0) {
      netEl.style.color = 'var(--income-color)';
    } else {
      netEl.style.color = 'var(--expense-color)';
    }

    renderCategoriesBreakdown(data.categories_breakdown);

    if (data.daily_expenses_timeline) {
      FinanceCharts.renderExpensesTimelineChart('expenses-timeline-chart-container', data.daily_expenses_timeline);
    }

    if (data.insights) {
      renderInsights(data.insights);
    }

    renderRecentTransactions(data.recent_transactions);

    const forecast = await api.getForecast(45);
    state.forecast = forecast;
    renderForecastMini(forecast);

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderInsights(insights) {
  const container = document.getElementById('dashboard-insights-grid');
  if (!container) return;

  if (!insights || insights.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum insight disponível para o período selecionado.</div>`;
    return;
  }

  container.innerHTML = insights.map(item => `
    <div class="insight-card ${item.type || 'info'}">
      <div class="insight-icon-box">${item.icon || '💡'}</div>
      <div class="insight-content">
        <h4>${item.title}</h4>
        <p>${item.description}</p>
      </div>
    </div>
  `).join('');
}

function renderCategoriesBreakdown(categories) {
  const container = document.getElementById('dashboard-categories-list');
  if (!container) return;

  if (!categories || categories.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma despesa registrada este mês.</div>`;
    return;
  }

  container.innerHTML = categories.slice(0, 5).map(cat => `
    <div class="category-progress-item">
      <div class="cat-info-row">
        <div class="cat-label">
          <span class="cat-color-dot" style="background: ${cat.color};"></span>
          <span>${cat.name}</span>
        </div>
        <div>
          <span style="font-weight: 700;">${formatCurrency(cat.amount)}</span>
          <span style="color: var(--text-muted); font-size: 0.75rem; margin-left: 6px;">(${cat.percentage}%)</span>
        </div>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${cat.percentage}%; background: ${cat.color};"></div>
      </div>
    </div>
  `).join('');
}

function renderRecentTransactions(txs) {
  const container = document.getElementById('dashboard-recent-txs');
  if (!container) return;

  if (!txs || txs.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhuma movimentação encontrada.</div>`;
    return;
  }

  container.innerHTML = txs.map(tx => {
    const isIncome = tx.type === 'income';
    const isTransfer = tx.type === 'transfer';
    const sign = isIncome ? '+' : isTransfer ? '⇄' : '-';
    const colorClass = isIncome ? 'income' : isTransfer ? 'info' : 'expense';
    const iconBg = isIncome ? 'var(--income-bg)' : isTransfer ? 'var(--info-bg)' : 'var(--expense-bg)';
    const iconColor = isIncome ? 'var(--income-color)' : isTransfer ? 'var(--info-color)' : 'var(--expense-color)';

    return `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon-box" style="background: ${iconBg}; color: ${iconColor};">
            ${isIncome ? '↓' : isTransfer ? '⇄' : '↑'}
          </div>
          <div class="tx-details">
            <h4>${tx.description}</h4>
            <div class="tx-meta">
              <span>${formatDate(tx.date)}</span>
              <span>•</span>
              <span>${tx.category_name || (isTransfer ? 'Transferência' : 'Geral')}</span>
              <span>•</span>
              <span>${tx.account_name}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount ${colorClass}">${sign} ${formatCurrency(tx.amount)}</div>
          <span class="tx-badge ${tx.status}" onclick="toggleStatus('${tx.id}')">
            ${tx.status === 'completed' ? 'Concluído' : 'Pendente'}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function renderForecastMini(forecast) {
  const badge = document.getElementById('forecast-risk-badge');
  if (badge) {
    if (forecast.risk_negative) {
      badge.textContent = 'Atenção: Risco de Saldo Negativo';
      badge.className = 'badge badge-risk';
    } else {
      badge.textContent = 'Fluxo de Caixa Saudável';
      badge.className = 'badge badge-safe';
    }
  }

  const minValEl = document.getElementById('forecast-min-balance');
  const endValEl = document.getElementById('forecast-end-balance');
  if (minValEl) minValEl.textContent = formatCurrency(forecast.min_balance);
  if (endValEl) endValEl.textContent = formatCurrency(forecast.end_balance);

  FinanceCharts.renderForecastChart('forecast-chart-container', forecast.timeline);
}

// ---------------- TRANSACTIONS VIEW ----------------
async function renderTransactionsView() {
  const container = document.getElementById('tx-table-body');
  if (!container) return;

  container.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px;">Carregando transações...</td></tr>`;

  try {
    const txs = await api.getTransactions({
      month: state.selectedMonth,
      year: state.selectedYear
    });

    if (!txs || txs.length === 0) {
      container.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">Nenhuma transação encontrada no período selecionado.</td></tr>`;
      return;
    }

    container.innerHTML = txs.map(tx => {
      const isIncome = tx.type === 'income';
      const isTransfer = tx.type === 'transfer';
      const color = isIncome ? 'var(--income-color)' : isTransfer ? 'var(--info-color)' : 'var(--expense-color)';
      const sign = isIncome ? '+' : isTransfer ? '⇄' : '-';

      return `
        <tr>
          <td>${formatDate(tx.date)}</td>
          <td>
            <strong>${tx.description}</strong>
            ${tx.installment_total > 1 ? `<span style="font-size: 0.75rem; color: var(--accent-primary); margin-left: 6px;">(${tx.installment_current}/${tx.installment_total})</span>` : ''}
          </td>
          <td><span style="display: inline-flex; align-items: center; gap: 6px;"><span class="cat-color-dot" style="background: ${tx.category_color || '#64748B'};"></span>${tx.category_name || (isTransfer ? 'Transferência' : '-')}</span></td>
          <td>${tx.account_name} ${tx.destination_account_name ? `→ ${tx.destination_account_name}` : ''}</td>
          <td style="color: ${color}; font-weight: 700;">${sign} ${formatCurrency(tx.amount)}</td>
          <td>
            <span class="tx-badge ${tx.status}" onclick="toggleStatus('${tx.id}')">
              ${tx.status === 'completed' ? 'Pago' : 'Pendente'}
            </span>
          </td>
          <td style="text-align: right;">
            <button class="icon-btn" style="width: 32px; height: 32px; color: var(--expense-color);" onclick="deleteTx('${tx.id}')">🗑</button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- FORECAST VIEW ----------------
async function renderForecastView(days = 60) {
  try {
    const forecast = await api.getForecast(days);
    state.forecast = forecast;

    document.getElementById('full-forecast-start').textContent = formatCurrency(forecast.start_balance);
    document.getElementById('full-forecast-min').textContent = formatCurrency(forecast.min_balance);
    document.getElementById('full-forecast-min-date').textContent = formatDate(forecast.min_date);
    document.getElementById('full-forecast-end').textContent = formatCurrency(forecast.end_balance);

    const fullBadge = document.getElementById('full-forecast-badge');
    if (fullBadge) {
      if (forecast.risk_negative) {
        fullBadge.textContent = 'Alerta: Você atingirá saldo negativo nesta projeção';
        fullBadge.className = 'badge badge-risk';
      } else {
        fullBadge.textContent = 'Projeção Positiva e Segura';
        fullBadge.className = 'badge badge-safe';
      }
    }

    FinanceCharts.renderForecastChart('full-forecast-chart', forecast.timeline);

    const eventsContainer = document.getElementById('forecast-upcoming-events');
    if (eventsContainer) {
      const allEvents = [];
      forecast.timeline.forEach(t => {
        if (t.events && t.events.length > 0) {
          t.events.forEach(e => allEvents.push({ date: t.date, text: e, balance: t.balance }));
        }
      });

      if (allEvents.length === 0) {
        eventsContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">Nenhum lançamento agendado no período.</div>`;
      } else {
        eventsContainer.innerHTML = allEvents.map(e => `
          <div class="tx-item">
            <div class="tx-left">
              <span style="font-weight: 700; color: var(--text-secondary); width: 85px;">${formatDate(e.date)}</span>
              <span>${e.text}</span>
            </div>
            <div class="tx-right">
              <span style="font-size: 0.8rem; color: var(--text-muted);">Saldo após: ${formatCurrency(e.balance)}</span>
            </div>
          </div>
        `).join('');
      }
    }

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- ACCOUNTS VIEW ----------------
async function renderAccountsView() {
  const container = document.getElementById('accounts-cards-grid');
  if (!container) return;

  try {
    const accounts = await api.getAccounts();
    state.accounts = accounts || [];

    container.innerHTML = accounts.map(acc => {
      const isCard = acc.type === 'credit_card';
      const balanceLabel = isCard ? 'Fatura Atual' : 'Saldo Disponível';
      const typeName = {
        'checking': 'Conta Corrente',
        'credit_card': 'Cartão de Crédito',
        'savings': 'Poupança / Reserva',
        'cash': 'Dinheiro Vivo',
        'investment': 'Investimentos'
      }[acc.type] || 'Outra';

      return `
        <div class="account-card" style="--card-color: ${acc.color};">
          <div class="acc-top">
            <div class="acc-title">
              <div class="acc-icon" style="color: ${acc.color};">
                ${isCard ? '💳' : acc.type === 'savings' ? '🐷' : '🏛️'}
              </div>
              <div>
                <h4 style="font-weight: 700; font-size: 1rem;">${acc.name}</h4>
                <span style="font-size: 0.75rem; color: var(--text-muted);">${typeName}</span>
              </div>
            </div>
          </div>
          <div>
            <div class="acc-balance-label">${balanceLabel}</div>
            <div class="acc-balance-value" style="color: ${acc.current_balance < 0 ? 'var(--expense-color)' : 'var(--text-primary)'}">
              ${formatCurrency(acc.current_balance)}
            </div>
            ${isCard ? `
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px; display: flex; justify-content: space-between;">
                <span>Limite: ${formatCurrency(acc.credit_limit)}</span>
                <span>Vence dia: ${acc.due_day}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- BUDGETS VIEW ----------------
async function renderBudgetsView() {
  const container = document.getElementById('budgets-list-container');
  if (!container) return;

  try {
    const categories = await api.getCategories();
    state.categories = categories || [];

    const expenseCats = categories.filter(c => c.type === 'expense');

    container.innerHTML = expenseCats.map(cat => {
      const limit = cat.budget_limit || 0;
      const spent = cat.spent_this_month || 0;
      const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      const isExceeded = limit > 0 && spent > limit;
      const isWarning = limit > 0 && pct >= 80 && !isExceeded;

      const barColor = isExceeded ? 'var(--expense-color)' : isWarning ? 'var(--warning-color)' : 'var(--income-color)';

      return `
        <div class="section-card">
          <div class="cat-info-row">
            <div class="cat-label">
              <span class="cat-color-dot" style="background: ${cat.color};"></span>
              <strong style="font-size: 1rem;">${cat.name}</strong>
            </div>
            <div style="text-align: right;">
              <span style="font-weight: 700;">${formatCurrency(spent)}</span>
              <span style="color: var(--text-muted); font-size: 0.85rem;"> / ${limit > 0 ? formatCurrency(limit) : 'Sem teto definido'}</span>
            </div>
          </div>
          ${limit > 0 ? `
            <div class="progress-track" style="height: 10px; margin-top: 8px;">
              <div class="progress-fill" style="width: ${pct}%; background: ${barColor};"></div>
            </div>
            <div style="font-size: 0.78rem; display: flex; justify-content: space-between; margin-top: 4px;">
              <span style="color: ${barColor}; font-weight: 600;">${pct}% utilizado</span>
              <span style="color: var(--text-muted);">Restam ${formatCurrency(Math.max(0, limit - spent))}</span>
            </div>
          ` : `
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px;">
              Defina um teto mensal para acompanhar esta categoria.
            </div>
          `}
        </div>
      `;
    }).join('');

  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ---------------- CLOUD MODAL & SETUP ----------------
function setupCloudUI() {
  const cloudUrlInput = document.getElementById('cloud-supabase-url');
  const cloudKeyInput = document.getElementById('cloud-supabase-key');

  if (cloudUrlInput) cloudUrlInput.value = localStorage.getItem('financepro_supabase_url') || '';
  if (cloudKeyInput) cloudKeyInput.value = localStorage.getItem('financepro_supabase_key') || '';

  const saveConfigBtn = document.getElementById('btn-save-cloud-config');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      const url = cloudUrlInput.value;
      const key = cloudKeyInput.value;
      window.cloudManager.setCredentials(url, key);
      showToast('Configuração de nuvem atualizada!');
      window.location.reload();
    });
  }

  const loginForm = document.getElementById('form-cloud-login');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('cloud-email').value;
      const pass = document.getElementById('cloud-password').value;
      try {
        await window.cloudManager.signIn(email, pass);
        showToast('Login realizado com sucesso!');
        closeModal();
        await loadMetadata();
        await renderDashboard();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  const registerBtn = document.getElementById('btn-cloud-signup');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const email = document.getElementById('cloud-email').value;
      const pass = document.getElementById('cloud-password').value;
      if (!email || !pass) {
        showToast('Preencha email e senha para cadastrar', 'error');
        return;
      }
      try {
        const res = await window.cloudManager.signUp(email, pass);
        if (res && res.session) {
          showToast('Conta criada e conectada com sucesso!');
          closeModal();
          await loadMetadata();
          await renderDashboard();
        } else {
          try {
            await window.cloudManager.signIn(email, pass);
            showToast('Conta criada e conectada com sucesso!');
            closeModal();
            await loadMetadata();
            await renderDashboard();
          } catch {
            showToast('Conta criada! Faça login com seu e-mail e senha.');
          }
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

// ---------------- ACTIONS & EVENT LISTENERS ----------------
function setupEventListeners() {
  document.querySelectorAll('[data-tab]').forEach(el => {
    el.addEventListener('click', () => switchTab(el.dataset.tab));
  });

  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.modal));
  });

  document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target === el) closeModal();
    });
  });

  document.querySelectorAll('.type-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeTxType = btn.dataset.type;

      const isTransfer = state.activeTxType === 'transfer';
      const destGroup = document.getElementById('tx-dest-group');
      const catGroup = document.getElementById('tx-cat-group');
      const instGroup = document.getElementById('tx-installments-group');

      if (destGroup) destGroup.style.display = isTransfer ? 'block' : 'none';
      if (catGroup) catGroup.style.display = isTransfer ? 'none' : 'block';
      if (instGroup) instGroup.style.display = state.activeTxType === 'expense' ? 'block' : 'none';

      updateCategorySelect();
    });
  });

  const txForm = document.getElementById('form-new-tx');
  if (txForm) {
    txForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveTransaction();
    });
  }

  const accForm = document.getElementById('form-new-account');
  if (accForm) {
    accForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveAccount();
    });
  }

  const fileInput = document.getElementById('bank-file-input');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
  }

  const themeToggle = document.getElementById('theme-toggle-btn');
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }

  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn) {
    installBtn.addEventListener('click', promptInstallPWA);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('tx-date');
  if (dateInput) dateInput.value = todayStr;
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

async function handleSaveTransaction() {
  try {
    const desc = document.getElementById('tx-desc').value.trim();
    const amountVal = parseFloat(document.getElementById('tx-amount').value);
    const dateVal = document.getElementById('tx-date').value;
    const accountId = document.getElementById('tx-account').value;
    const statusVal = document.getElementById('tx-status').value;
    const isRecurring = document.getElementById('tx-recurring').checked;
    const installments = parseInt(document.getElementById('tx-installments').value) || 1;

    if (!desc || isNaN(amountVal) || amountVal <= 0 || !dateVal || !accountId) {
      showToast('Preencha os campos obrigatórios corretamente', 'error');
      return;
    }

    const payload = {
      description: desc,
      amount: amountVal,
      type: state.activeTxType,
      account_id: isNaN(Number(accountId)) ? accountId : Number(accountId),
      date: dateVal,
      status: statusVal,
      is_recurring: isRecurring,
      installments: installments
    };

    if (state.activeTxType === 'transfer') {
      const destId = document.getElementById('tx-destination-account').value;
      if (!destId || destId === accountId) {
        showToast('Escolha uma conta de destino diferente da origem', 'error');
        return;
      }
      payload.destination_account_id = isNaN(Number(destId)) ? destId : Number(destId);
    } else {
      const catId = document.getElementById('tx-category').value;
      if (catId) payload.category_id = isNaN(Number(catId)) ? catId : Number(catId);
    }

    await api.createTransaction(payload);
    showToast('Lançamento registrado com sucesso!');
    closeModal();
    document.getElementById('form-new-tx').reset();
    document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];

    await loadMetadata();
    if (state.currentTab === 'dashboard') await renderDashboard();
    if (state.currentTab === 'transactions') await renderTransactionsView();
    if (state.currentTab === 'forecast') await renderForecastView();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSaveAccount() {
  try {
    const name = document.getElementById('acc-name').value.trim();
    const type = document.getElementById('acc-type').value;
    const initBalance = parseFloat(document.getElementById('acc-init-balance').value) || 0;
    const creditLimit = parseFloat(document.getElementById('acc-credit-limit').value) || 0;
    const dueDay = parseInt(document.getElementById('acc-due-day').value) || 10;
    const color = document.getElementById('acc-color').value || '#6366F1';

    if (!name) {
      showToast('Digite o nome da conta', 'error');
      return;
    }

    await api.createAccount({
      name,
      type,
      initial_balance: initBalance,
      credit_limit: creditLimit,
      due_day: dueDay,
      color
    });

    showToast('Conta criada com sucesso!');
    closeModal();
    document.getElementById('form-new-account').reset();

    await loadMetadata();
    if (state.currentTab === 'accounts') await renderAccountsView();
    if (state.currentTab === 'dashboard') await renderDashboard();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

let pendingImportTxs = [];
async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await api.uploadBankFile(formData);
    pendingImportTxs = res.transactions;

    const preview = document.getElementById('import-preview-list');
    const confirmBtn = document.getElementById('btn-confirm-import');

    if (preview) {
      preview.innerHTML = res.transactions.slice(0, 15).map(t => `
        <div class="tx-item" style="padding: 8px 12px; font-size: 0.85rem;">
          <div class="tx-left">
            <span>${formatDate(t.date)}</span>
            <span>${t.description}</span>
          </div>
          <div class="tx-right">
            <span style="color: ${t.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)'}; font-weight: 700;">
              ${t.type === 'income' ? '+' : '-'} ${formatCurrency(t.amount)}
            </span>
          </div>
        </div>
      `).join('') + (res.transactions.length > 15 ? `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 6px;">+ mais ${res.transactions.length - 15} transações</div>` : '');
    }

    if (confirmBtn) confirmBtn.style.display = 'block';
    showToast(`${res.count} transações identificadas no extrato!`);

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmImport() {
  const accountId = document.getElementById('import-account').value;
  if (!accountId) {
    showToast('Selecione a conta de destino para a importação', 'error');
    return;
  }

  try {
    await api.confirmImport({
      account_id: isNaN(Number(accountId)) ? accountId : Number(accountId),
      transactions: pendingImportTxs
    });

    showToast('Extrato importado e conciliado com sucesso!');
    closeModal();
    await loadMetadata();
    await renderDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteTx(id) {
  if (!confirm('Deseja realmente excluir este lançamento?')) return;
  try {
    await api.deleteTransaction(id);
    showToast('Lançamento excluído');
    await renderDashboard();
    if (state.currentTab === 'transactions') await renderTransactionsView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleStatus(id) {
  try {
    await api.toggleStatus(id);
    await renderDashboard();
    if (state.currentTab === 'transactions') await renderTransactionsView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
}

window.switchTab = switchTab;
window.openModal = openModal;
window.closeModal = closeModal;
window.deleteTx = deleteTx;
window.toggleStatus = toggleStatus;
window.confirmImport = confirmImport;
window.promptInstallPWA = promptInstallPWA;
