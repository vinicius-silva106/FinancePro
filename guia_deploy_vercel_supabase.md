# ☁️ Guia Completo de Deploy: Vercel + Supabase (100% Gratuito)

Este guia orienta como colocar o **FinancePro** em produção na nuvem, permitindo que você acesse no celular ou no computador de qualquer lugar do mundo (via 4G/5G ou Wi-Fi), sem depender do PC estar ligado.

---

## 🏗️ Como Funciona a Arquitetura em Nuvem

- **Vercel:** Hospeda o Frontend PWA em uma CDN global ultrarrápida com certificado SSL HTTPS gratuito e domínio próprio ou subdomínio `.vercel.app`.
- **Supabase:** Gerencia o banco de dados relacional **PostgreSQL**, o sistema de **Autenticação (Login/Senha/2FA)** e as políticas de segurança de dados por usuário (**Row Level Security - RLS**).

---

## 🚀 Passo 1: Criar o Banco de Dados no Supabase (Grátis)

1. Acesse **[supabase.com](https://supabase.com)** e crie uma conta gratuita (ou faça login com o GitHub).
2. Clique em **"New Project"**:
   - **Name:** `FinancePro`
   - **Database Password:** Escolha uma senha segura (guarde-a).
   - **Region:** Selecione `South America (São Paulo)` para menor latência no Brasil.
   - Clique em **"Create new project"** (leva ~1 minuto para iniciar).
3. No menu lateral esquerdo do Supabase, clique em **SQL Editor** (ícone `>_`).
4. Clique em **"New Query"**, copie e cole todo o conteúdo do arquivo [`supabase_schema.sql`](./supabase_schema.sql) e clique no botão verde **"Run"**.
   - *O que este script faz:* Cria as tabelas `accounts`, `categories`, `transactions`, ativa a proteção **Row Level Security (RLS)** e configura o trigger que gera suas contas padrão automaticamente no cadastro!
5. No menu lateral esquerdo, vá em **Project Settings** (ícone da engrenagem ⚙️) > **API**:
   - Copie o **Project URL** (ex: `https://abcdefgh.supabase.co`).
   - Copie a chave **anon / public** (chave pública longa).

---

## 🌐 Passo 2: Publicar o Frontend na Vercel (Grátis)

### Opção A: Pelo GitHub (Recomendada)
1. Crie um repositório no seu GitHub (pode ser privado) e suba os arquivos desta pasta.
2. Acesse **[vercel.com](https://vercel.com)** e faça login com seu GitHub.
3. Clique em **"Add New Project"** e selecione o repositório do FinancePro.
4. O arquivo [`vercel.json`](./vercel.json) já está configurado na raiz para servir a aplicação PWA automaticamente.
5. Clique em **"Deploy"**.
6. Em ~30 segundos seu sistema estará online com link próprio e certificado SSL HTTPS gratuito (ex: `https://financepro-seu-usuario.vercel.app`)!

### Opção B: Direto pelo Terminal via Vercel CLI
Se preferir publicar direto pelo terminal sem usar o GitHub:
```bash
npx vercel
```
Basta confirmar os prompts com `Enter` e o link será gerado imediatamente.

---

## 📱 Passo 3: Conectar e Usar no Celular e PC

1. Abra o link gerado pela Vercel no seu celular ou PC:
   - Exemplo: `https://financepro-seu-usuario.vercel.app`
2. No topo da tela, clique no botão **☁️ Nuvem** ou **☁️ Conectar à Nuvem**:
   - Cole o seu **Project URL** e a sua **Anon Public Key** do Supabase.
   - Clique em **"Salvar Credenciais"**.
3. No formulário de acesso:
   - Digite seu e-mail e uma senha e clique em **"Cadastrar"**.
   - O Supabase criará seu usuário e o trigger já criará automaticamente suas contas bancárias e categorias!
4. **Instalar no Celular como App:**
   - No Android (Chrome): Toque em **"Instalar aplicativo"** ou **"Adicionar à tela inicial"**.
   - No iPhone (Safari): Toque em Compartilhar > **"Adicionar à Tela de Início"**.

---

## 🔒 Segurança e Privacidade Garantidas

- **Row Level Security (RLS):** Mesmo que alguém descubra a chave anônima da sua API, as regras de segurança do PostgreSQL impedem qualquer leitura ou escrita de dados que não pertençam ao usuário autenticado (`auth.uid() = user_id`).
- **Precisão Financeira:** Todos os valores continuam armazenados em centavos como números inteiros (`BIGINT`), garantindo que não existam erros de arredondamento.
- **Backups Automáticos:** O Supabase realiza backups diários automatizados do banco de dados na nuvem.
