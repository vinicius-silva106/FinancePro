# 🚀 FinancePro - Gerenciador Financeiro Pessoal Inteligente

Sistema completo de finanças pessoais desenvolvido com foco em facilidade de uso tanto no **PC (Desktop)** quanto no **Celular (Mobile / PWA)**, com projeções futuras de fluxo de caixa, gestão de cartões de crédito, parcelamentos, importação de extratos bancários e suporte completo para nuvem (**Vercel + Supabase**).

---

## 📱 Como Rodar e Acessar

### ☁️ Modo Nuvem (Vercel + Supabase) - Acesso Global 24/7 sem PC ligado
Para colocar o sistema na nuvem de forma 100% gratuita e acessar no celular de qualquer lugar:
- Siga o passo a passo completo no arquivo [`guia_deploy_vercel_supabase.md`](./guia_deploy_vercel_supabase.md).
- O script SQL de banco já está pronto em [`supabase_schema.sql`](./supabase_schema.sql).
- O arquivo de rotas da Vercel já está pronto em [`vercel.json`](./vercel.json).

### 💻 Modo Local (No seu computador)
Basta abrir o terminal nesta pasta e executar:
```bash
python run.py
```
O navegador será aberto automaticamente em:
- **💻 No PC:** [http://localhost:8000](http://localhost:8000)
- **📱 No Celular:** Conecte na mesma rede Wi-Fi e acesse o endereço IP local mostrado no terminal (ex: `http://192.168.0.x:8000`).

---

## ✨ Principais Funcionalidades

1. **Dashboard Financeiro Inteligente**:
   - Saldo Líquido consolidado (contas correntes, poupança e dinheiro vivo).
   - Faturas de Cartão de Crédito acumuladas a pagar.
   - Entradas e Saídas do mês com cálculo instantâneo do balanço líquido.
   - **Linha do Tempo de Despesas Diárias:** Gráfico de evolução dia a dia com barras e linha acumulada.
   - **Insights Financeiros Automáticos:** Diagnósticos em tempo real de taxa de poupança, maior categoria e contas a vencer.
   - Gráfico de Previsão de Saldo para os próximos 45 dias com detector de risco de saldo negativo.
   - Barra de distribuição proporcional de despesas por categoria.

2. **Extrato e Lançamentos Flexíveis**:
   - Cadastro ágil de Receitas, Despesas e Transferências entre contas.
   - **Parcelamento Automático**: Divide compras em até 24x e distribui mês a mês.
   - **Despesas e Receitas Recorrentes**: Marcação de contas fixas (aluguel, salário, assinaturas).
   - Alternância de status com 1 clique (**Pago** / **Pendente**).

3. **Motor de Previsão Futura (Runway de Caixa)**:
   - Projeção dia a dia para 30, 60 ou 90 dias com linha de perigo em R$ 0.

4. **Contas e Cartões de Crédito**:
   - Gestão individualizada de Contas Correntes, Poupanças, Dinheiro e Cartões com limites e datas de fatura.

5. **Metas & Orçamentos por Categoria**:
   - Acompanhamento de tetos mensais com barras de progresso (verde, amarelo e vermelho).

6. **Importação de Extratos Bancários (OFX / CSV)**:
   - Leitura e conciliação automática de extratos bancários.
