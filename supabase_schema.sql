-- ==============================================================================
-- FINANCEPRO - SCHEMA COMPLETO PARA O SUPABASE (POSTGRESQL + AUTH + RLS)
-- Cole este script no SQL Editor do seu projeto no Supabase (supabase.com)
-- ==============================================================================

-- 1. Tabela de Contas e Cartões
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('checking', 'credit_card', 'savings', 'cash', 'investment')),
    initial_balance BIGINT NOT NULL DEFAULT 0, -- em centavos
    current_balance BIGINT NOT NULL DEFAULT 0, -- em centavos
    color TEXT DEFAULT '#6366F1',
    icon TEXT DEFAULT 'wallet',
    credit_limit BIGINT DEFAULT 0, -- em centavos
    closing_day INT DEFAULT 1,
    due_day INT DEFAULT 10,
    archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de Categorias e Orçamentos
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    color TEXT DEFAULT '#64748B',
    icon TEXT DEFAULT 'tag',
    budget_limit BIGINT DEFAULT 0 -- em centavos
);

-- 3. Tabela de Transações (Receitas, Despesas, Transferências, Parcelas)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount BIGINT NOT NULL, -- em centavos (sempre positivo)
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    destination_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending')),
    notes TEXT,
    installment_current INT DEFAULT 1,
    installment_total INT DEFAULT 1,
    installment_group_id TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_period TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_tx_user_date ON public.transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_tx_user_account ON public.transactions(user_id, account_id);
CREATE INDEX IF NOT EXISTS idx_tx_user_category ON public.transactions(user_id, category_id);

-- ==============================================================================
-- 4. SEGURANÇA MÁXIMA: ROW LEVEL SECURITY (RLS)
-- Garante que NENHUM usuário consiga ler ou alterar dados de outros usuários.
-- ==============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas para Contas
CREATE POLICY "Usuário gerencia apenas suas próprias contas"
    ON public.accounts FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para Categorias
CREATE POLICY "Usuário gerencia apenas suas próprias categorias"
    ON public.categories FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Políticas para Transações
CREATE POLICY "Usuário gerencia apenas suas próprias transações"
    ON public.transactions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 5. TRIGGER AUTOMÁTICO: ONBOARDING DE NOVO USUÁRIO
-- Ao criar uma conta nova pelo app, o Supabase já cria automaticamente
-- as contas e categorias padrão com cores e limites!
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    acc_checking UUID;
    acc_card UUID;
    acc_savings UUID;
    cat_salario UUID;
    cat_moradia UUID;
    cat_alimentacao UUID;
    cat_transporte UUID;
    cat_lazer UUID;
    cat_saude UUID;
    cat_assinaturas UUID;
BEGIN
    -- 1. Contas Padrão
    INSERT INTO public.accounts (user_id, name, type, initial_balance, current_balance, color, icon)
    VALUES (NEW.id, 'Conta Corrente Principal', 'checking', 0, 0, '#6366F1', 'landmark')
    RETURNING id INTO acc_checking;

    INSERT INTO public.accounts (user_id, name, type, initial_balance, current_balance, credit_limit, closing_day, due_day, color, icon)
    VALUES (NEW.id, 'Cartão de Crédito', 'credit_card', 0, 0, 500000, 20, 27, '#8B5CF6', 'credit-card')
    RETURNING id INTO acc_card;

    INSERT INTO public.accounts (user_id, name, type, initial_balance, current_balance, color, icon)
    VALUES (NEW.id, 'Reserva de Emergência', 'savings', 0, 0, '#10B981', 'piggy-bank')
    RETURNING id INTO acc_savings;

    -- 2. Categorias de Receita
    INSERT INTO public.categories (user_id, name, type, color, icon)
    VALUES (NEW.id, 'Salário & Renda', 'income', '#10B981', 'dollar-sign');

    INSERT INTO public.categories (user_id, name, type, color, icon)
    VALUES (NEW.id, 'Rendimentos & Investimentos', 'income', '#06B6D4', 'trending-up');

    -- 3. Categorias de Despesa com Orçamento Base
    INSERT INTO public.categories (user_id, name, type, color, icon, budget_limit)
    VALUES (NEW.id, 'Moradia (Aluguel/Contas)', 'expense', '#3B82F6', 'home', 200000);

    INSERT INTO public.categories (user_id, name, type, color, icon, budget_limit)
    VALUES (NEW.id, 'Alimentação & Mercado', 'expense', '#F59E0B', 'shopping-cart', 120000);

    INSERT INTO public.categories (user_id, name, type, color, icon, budget_limit)
    VALUES (NEW.id, 'Transporte (Uber/Combustível)', 'expense', '#6366F1', 'car', 50000);

    INSERT INTO public.categories (user_id, name, type, color, icon, budget_limit)
    VALUES (NEW.id, 'Lazer & Restaurantes', 'expense', '#EC4899', 'coffee', 60000);

    INSERT INTO public.categories (user_id, name, type, color, icon, budget_limit)
    VALUES (NEW.id, 'Saúde & Farmácia', 'expense', '#EF4444', 'activity', 35000);

    INSERT INTO public.categories (user_id, name, type, color, icon, budget_limit)
    VALUES (NEW.id, 'Assinaturas & Serviços', 'expense', '#8B5CF6', 'film', 15000);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dispara o trigger sempre que um usuário se cadastra
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
