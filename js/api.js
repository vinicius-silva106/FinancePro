/**
 * FinancePro - Dual-Mode API Client
 * Seamlessly routes between Local FastAPI and Supabase Cloud
 */

const API_BASE = '/api';

const isCloudMode = () => {
  return (window.cloudManager && window.cloudManager.isCloudMode) ||
         (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1');
};

const hasActiveUser = () => {
  return window.cloudManager && window.cloudManager.currentUser;
};

const api = {
  async getAccounts() {
    if (isCloudMode()) {
      if (!hasActiveUser()) return [];
      return (await window.cloudManager.getAccounts()) || [];
    }
    const res = await fetch(`${API_BASE}/accounts`);
    if (!res.ok) throw new Error('Erro ao carregar contas');
    return res.json();
  },

  async createAccount(data) {
    if (isCloudMode()) {
      if (!hasActiveUser()) throw new Error('Faça login para criar contas');
      return window.cloudManager.createAccount(data);
    }
    const res = await fetch(`${API_BASE}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao criar conta');
    return res.json();
  },

  async getCategories() {
    if (isCloudMode()) {
      if (!hasActiveUser()) return [];
      return (await window.cloudManager.getCategories()) || [];
    }
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error('Erro ao carregar categorias');
    return res.json();
  },

  async createCategory(data) {
    if (isCloudMode()) {
      if (!hasActiveUser()) throw new Error('Faça login para criar categorias');
      return window.cloudManager.createCategory(data);
    }
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Erro ao criar categoria');
    return res.json();
  },

  async getTransactions(filters = {}) {
    if (isCloudMode()) {
      if (!hasActiveUser()) return [];
      return (await window.cloudManager.getTransactions(filters)) || [];
    }
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        params.append(key, filters[key]);
      }
    });
    const res = await fetch(`${API_BASE}/transactions?${params.toString()}`);
    if (!res.ok) throw new Error('Erro ao carregar transações');
    return res.json();
  },

  async createTransaction(data) {
    if (isCloudActive()) {
      return window.cloudManager.createTransaction(data);
    }
    const res = await fetch(`${API_BASE}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erro ao registrar transação');
    }
    return res.json();
  },

  async deleteTransaction(txId) {
    if (isCloudActive()) {
      return window.cloudManager.deleteTransaction(txId);
    }
    const res = await fetch(`${API_BASE}/transactions/${txId}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Erro ao excluir transação');
    return res.json();
  },

  async toggleStatus(txId) {
    if (isCloudMode()) {
      if (!hasActiveUser()) throw new Error('Faça login para alterar status');
      return window.cloudManager.toggleStatus(txId);
    }
    const res = await fetch(`${API_BASE}/transactions/${txId}/toggle-status`, {
      method: 'PATCH'
    });
    if (!res.ok) throw new Error('Erro ao alterar status');
    return res.json();
  },

  async getDashboard(month, year) {
    if (isCloudMode()) {
      if (!hasActiveUser()) {
        return {
          total_liquid: 0,
          total_credit_debt: 0,
          month_income: 0,
          month_expense: 0,
          net_balance: 0,
          categories_breakdown: [],
          recent_transactions: [],
          daily_expenses_timeline: [],
          insights: [
            {
              type: 'info',
              icon: '☁️',
              title: 'Sincronização em Nuvem',
              description: 'Faça login ou crie sua conta para salvar e carregar seus dados no Supabase.'
            }
          ]
        };
      }
      // Aggregate client-side for cloud mode
      const [accs, cats, txs] = await Promise.all([
        window.cloudManager.getAccounts(),
        window.cloudManager.getCategories(),
        window.cloudManager.getTransactions({ month, year })
      ]);

      let total_liquid = 0;
      let total_credit_debt = 0;
      accs.forEach(a => {
        if (a.type !== 'credit_card') total_liquid += a.current_balance;
        else if (a.current_balance < 0) total_credit_debt += Math.abs(a.current_balance);
      });

      let month_income = 0;
      let month_expense = 0;
      const catMap = {};

      const daysInMonth = new Date(year, month, 0).getDate();
      const dailyMap = {};
      for (let d = 1; d <= daysInMonth; d++) {
        dailyMap[d] = { amount: 0, count: 0 };
      }

      txs.forEach(t => {
        const dNum = parseInt(t.date.split('-')[2]);
        if (t.type === 'income' && t.status === 'completed') {
          month_income += t.amount;
        } else if (t.type === 'expense' && t.status === 'completed') {
          month_expense += t.amount;
          catMap[t.category_name] = (catMap[t.category_name] || 0) + t.amount;
          if (dailyMap[dNum]) {
            dailyMap[dNum].amount += t.amount;
            dailyMap[dNum].count += 1;
          }
        }
      });

      const categories_breakdown = Object.keys(catMap).map(name => ({
        name,
        amount: catMap[name],
        color: '#6366F1',
        percentage: month_expense > 0 ? Math.round((catMap[name] / month_expense) * 100) : 0
      })).sort((a, b) => b.amount - a.amount);

      let accum = 0;
      const daily_expenses_timeline = [];
      for (let d = 1; d <= daysInMonth; d++) {
        accum = Math.round((accum + dailyMap[d].amount) * 100) / 100;
        daily_expenses_timeline.append ? null : daily_expenses_timeline.push({
          day: d,
          date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          amount: dailyMap[d].amount,
          accumulated: accum,
          count: dailyMap[d].count
        });
      }

      const net_balance = Math.round((month_income - month_expense) * 100) / 100;

      const insights = [];
      if (month_income > 0) {
        const rate = Math.round((net_balance / month_income) * 100);
        insights.push({
          type: rate >= 20 ? 'success' : rate > 0 ? 'info' : 'danger',
          icon: rate >= 20 ? '📈' : rate > 0 ? '💡' : '⚠️',
          title: `Taxa de Poupança (${rate}%)`,
          description: rate >= 20 ? 'Meta de poupança superior a 20% alcançada!' : 'Mantenha o controle de custos para poupar mais.'
        });
      }

      if (categories_breakdown.length > 0) {
        const top = categories_breakdown[0];
        insights.push({
          type: 'warning',
          icon: '🎯',
          title: `Maior Centro de Custo: ${top.name}`,
          description: `Representa ${top.percentage}% de todos os gastos do mês.`
        });
      }

      return {
        total_liquid,
        total_credit_debt,
        month_income,
        month_expense,
        net_balance,
        categories_breakdown,
        recent_transactions: txs.slice(0, 6),
        daily_expenses_timeline,
        insights
      };
    }

    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (year) params.append('year', year);
    const res = await fetch(`${API_BASE}/dashboard?${params.toString()}`);
    if (!res.ok) throw new Error('Erro ao carregar dashboard');
    return res.json();
  },

  async getForecast(days = 60) {
    if (isCloudMode()) {
      if (!hasActiveUser()) {
        return {
          start_balance: 0,
          end_balance: 0,
          min_balance: 0,
          min_date: '',
          risk_negative: false,
          days_projected: days,
          timeline: []
        };
      }
      const [accs, txs] = await Promise.all([
        window.cloudManager.getAccounts(),
        window.cloudManager.getTransactions()
      ]);

      let startBal = 0;
      accs.forEach(a => {
        if (a.type !== 'credit_card') startBal += a.current_balance;
      });

      const today = new Date();
      const timeline = [];
      let runningBal = startBal;
      let minBal = startBal;
      let minDate = today.toISOString().split('T')[0];

      for (let i = 0; i <= days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        const dStr = d.toISOString().split('T')[0];

        const dayTxs = txs.filter(t => t.date === dStr);
        let inc = 0, exp = 0;
        const events = [];

        dayTxs.forEach(t => {
          if (t.type === 'income') {
            inc += t.amount;
            events.push(`+ R$ ${t.amount.toFixed(2)}: ${t.description}`);
          } else if (t.type === 'expense') {
            exp += t.amount;
            events.push(`- R$ ${t.amount.toFixed(2)}: ${t.description}`);
          }
        });

        runningBal += inc - exp;
        if (runningBal < minBal) {
          minBal = runningBal;
          minDate = dStr;
        }

        timeline.push({
          date: dStr,
          balance: runningBal,
          income: inc,
          expense: exp,
          events
        });
      }

      return {
        start_balance: startBal,
        end_balance: runningBal,
        min_balance: minBal,
        min_date: minDate,
        risk_negative: minBal < 0,
        days_projected: days,
        timeline
      };
    }

    const res = await fetch(`${API_BASE}/forecast?days=${days}`);
    if (!res.ok) throw new Error('Erro ao carregar previsão de fluxo');
    return res.json();
  },

  async uploadBankFile(formData) {
    const res = await fetch(`${API_BASE}/import/file`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Erro ao processar extrato bancário');
    }
    return res.json();
  },

  async confirmImport(payload) {
    const res = await fetch(`${API_BASE}/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Erro ao confirmar importação');
    return res.json();
  }
};

window.api = api;
