/**
 * FinancePro - Supabase Cloud Service Layer & Auth Manager
 * Enables full cloud hosting on Vercel with PostgreSQL + Auth + RLS on Supabase.
 */

class CloudManager {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.isCloudMode = false;
    this.init();
  }

  init() {
    const savedUrl = localStorage.getItem('financepro_supabase_url') || window.ENV_SUPABASE_URL;
    const savedKey = localStorage.getItem('financepro_supabase_key') || window.ENV_SUPABASE_ANON_KEY;

    if (savedUrl && savedKey && window.supabase) {
      try {
        this.client = window.supabase.createClient(savedUrl, savedKey);
        this.isCloudMode = true;
        this.checkAuth();
      } catch (err) {
        console.warn('Erro ao inicializar Supabase:', err);
      }
    }
  }

  setCredentials(url, key) {
    if (!url || !key) {
      localStorage.removeItem('financepro_supabase_url');
      localStorage.removeItem('financepro_supabase_key');
      this.client = null;
      this.isCloudMode = false;
      this.currentUser = null;
      return false;
    }

    localStorage.setItem('financepro_supabase_url', url.trim());
    localStorage.setItem('financepro_supabase_key', key.trim());
    this.client = window.supabase.createClient(url.trim(), key.trim());
    this.isCloudMode = true;
    return true;
  }

  async checkAuth() {
    if (!this.client) return null;
    try {
      const { data: { user } } = await this.client.auth.getUser();
      this.currentUser = user;
      this.updateAuthUI();
      return user;
    } catch {
      return null;
    }
  }

  async signUp(email, password) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    this.updateAuthUI();
    return data;
  }

  async signIn(email, password) {
    if (!this.client) throw new Error('Supabase não configurado');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    this.updateAuthUI();
    return data;
  }

  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.currentUser = null;
    this.updateAuthUI();
    window.location.reload();
  }

  updateAuthUI() {
    const cloudBtn = document.getElementById('btn-cloud-status');
    const userBadge = document.getElementById('header-user-badge');

    if (this.isCloudMode && this.currentUser) {
      if (cloudBtn) {
        cloudBtn.innerHTML = `☁️ Conectado: ${this.currentUser.email.split('@')[0]}`;
        cloudBtn.classList.add('connected');
      }
      if (userBadge) {
        userBadge.style.display = 'flex';
        userBadge.querySelector('.user-email').textContent = this.currentUser.email;
      }
    } else if (this.isCloudMode && !this.currentUser) {
      if (cloudBtn) {
        cloudBtn.innerHTML = `☁️ Fazer Login`;
        cloudBtn.classList.remove('connected');
      }
      if (userBadge) userBadge.style.display = 'none';
    } else {
      if (cloudBtn) {
        cloudBtn.innerHTML = `☁️ Modo Nuvem`;
        cloudBtn.classList.remove('connected');
      }
      if (userBadge) userBadge.style.display = 'none';
    }
  }

  // --- SUPABASE DIRECT QUERIES ---

  async getAccounts() {
    if (!this.client || !this.currentUser) return null;
    const { data, error } = await this.client
      .from('accounts')
      .select('*')
      .eq('archived', false)
      .order('type', { ascending: true });

    if (error) throw error;

    return data.map(a => ({
      ...a,
      initial_balance: Number(a.initial_balance) / 100,
      current_balance: Number(a.current_balance) / 100,
      credit_limit: Number(a.credit_limit) / 100
    }));
  }

  async createAccount(acc) {
    if (!this.client || !this.currentUser) return null;
    const initCents = Math.round((acc.initial_balance || 0) * 100);
    const limitCents = Math.round((acc.credit_limit || 0) * 100);

    const { data, error } = await this.client
      .from('accounts')
      .insert({
        user_id: this.currentUser.id,
        name: acc.name,
        type: acc.type,
        initial_balance: initCents,
        current_balance: initCents,
        credit_limit: limitCents,
        due_day: acc.due_day || 10,
        color: acc.color || '#6366F1'
      })
      .select()
      .single();

    if (error) throw error;
    return { id: data.id, message: 'Conta criada com sucesso!' };
  }

  async getCategories() {
    if (!this.client || !this.currentUser) return null;
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return data.map(c => ({
      ...c,
      budget_limit: Number(c.budget_limit || 0) / 100,
      spent_this_month: 0
    }));
  }

  async createCategory(cat) {
    if (!this.client || !this.currentUser) return null;
    const budgetCents = Math.round((cat.budget_limit || 0) * 100);
    const { data, error } = await this.client
      .from('categories')
      .insert({
        user_id: this.currentUser.id,
        name: cat.name,
        type: cat.type || 'expense',
        color: cat.color || '#64748B',
        icon: cat.icon || 'tag',
        budget_limit: budgetCents
      })
      .select()
      .single();

    if (error) throw error;
    return { id: data.id, message: 'Categoria criada com sucesso!' };
  }

  async getTransactions(filters = {}) {
    if (!this.client || !this.currentUser) return null;
    let query = this.client
      .from('transactions')
      .select(`
        *,
        accounts:account_id(name),
        categories:category_id(name, color, icon)
      `)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (filters.year && filters.month) {
      const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
      const lastDay = new Date(filters.year, filters.month, 0).getDate();
      const end = `${filters.year}-${String(filters.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      query = query.gte('date', start).lte('date', end);
    }

    const { data, error } = await query;
    if (error) throw error;

    return data.map(t => ({
      ...t,
      amount: Number(t.amount) / 100,
      account_name: t.accounts ? t.accounts.name : '',
      category_name: t.categories ? t.categories.name : '',
      category_color: t.categories ? t.categories.color : '#64748B',
      category_icon: t.categories ? t.categories.icon : 'tag'
    }));
  }

  async createTransaction(tx) {
    if (!this.client || !this.currentUser) return null;
    const amountCents = Math.round(tx.amount * 100);

    const { data, error } = await this.client
      .from('transactions')
      .insert({
        user_id: this.currentUser.id,
        description: tx.description,
        amount: amountCents,
        type: tx.type,
        account_id: tx.account_id,
        destination_account_id: tx.destination_account_id || null,
        category_id: tx.category_id || null,
        date: tx.date,
        status: tx.status || 'completed',
        is_recurring: tx.is_recurring || false,
        installment_current: 1,
        installment_total: tx.installments || 1
      })
      .select();

    if (error) throw error;

    // Trigger balance update in account
    await this.recalculateBalances();
    return { created_ids: [data[0].id], message: 'Lançamento salvo no Supabase!' };
  }

  async deleteTransaction(txId) {
    if (!this.client || !this.currentUser) return null;
    const { error } = await this.client
      .from('transactions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', txId);

    if (error) throw error;
    await this.recalculateBalances();
    return { message: 'Transação excluída' };
  }

  async toggleStatus(txId) {
    if (!this.client || !this.currentUser) return null;
    const { data: current } = await this.client
      .from('transactions')
      .select('status')
      .eq('id', txId)
      .single();

    const newStatus = current.status === 'completed' ? 'pending' : 'completed';
    const { error } = await this.client
      .from('transactions')
      .update({ status: newStatus })
      .eq('id', txId);

    if (error) throw error;
    await this.recalculateBalances();
    return { status: newStatus };
  }

  async recalculateBalances() {
    if (!this.client || !this.currentUser) return;
    const { data: accounts } = await this.client.from('accounts').select('id, initial_balance, type');
    if (!accounts) return;

    for (const acc of accounts) {
      const { data: txs } = await this.client
        .from('transactions')
        .select('amount, type, account_id, destination_account_id')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .or(`account_id.eq.${acc.id},destination_account_id.eq.${acc.id}`);

      let bal = Number(acc.initial_balance);
      (txs || []).forEach(t => {
        const amt = Number(t.amount);
        if (t.type === 'income' && t.account_id === acc.id) bal += amt;
        else if (t.type === 'expense' && t.account_id === acc.id) bal -= amt;
        else if (t.type === 'transfer') {
          if (t.account_id === acc.id) bal -= amt;
          if (t.destination_account_id === acc.id) bal += amt;
        }
      });

      await this.client.from('accounts').update({ current_balance: bal }).eq('id', acc.id);
    }
  }
}

window.cloudManager = new CloudManager();
