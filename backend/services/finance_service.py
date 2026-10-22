import uuid
import datetime
from datetime import timedelta
from dateutil.relativedelta import relativedelta
from typing import Optional, List, Dict, Any
from backend.database import get_connection

def to_cents(amount_reais: float) -> int:
    return int(round(amount_reais * 100))

def to_reais(amount_cents: int) -> float:
    return round(amount_cents / 100.0, 2)

# --- ACCOUNTS ---

def get_accounts():
    conn = get_connection()
    recalculate_account_balances(conn)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM accounts 
        WHERE archived = 0 
        ORDER BY CASE type 
            WHEN 'checking' THEN 1 
            WHEN 'credit_card' THEN 2 
            WHEN 'savings' THEN 3 
            WHEN 'investment' THEN 4 
            ELSE 5 END, name ASC
    """)
    rows = cursor.fetchall()
    accounts = []
    for r in rows:
        acc = dict(r)
        acc["initial_balance"] = to_reais(acc["initial_balance"])
        acc["current_balance"] = to_reais(acc["current_balance"])
        acc["credit_limit"] = to_reais(acc["credit_limit"])
        accounts.append(acc)
    conn.close()
    return accounts

def create_account(data: dict):
    conn = get_connection()
    cursor = conn.cursor()
    init_cents = to_cents(data.get("initial_balance", 0.0))
    limit_cents = to_cents(data.get("credit_limit", 0.0))
    
    cursor.execute("""
        INSERT INTO accounts (name, type, initial_balance, current_balance, color, icon, credit_limit, closing_day, due_day)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data["name"],
        data.get("type", "checking"),
        init_cents,
        init_cents,
        data.get("color", "#4F46E5"),
        data.get("icon", "wallet"),
        limit_cents,
        data.get("closing_day", 1),
        data.get("due_day", 10)
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

def recalculate_account_balances(conn=None):
    should_close = False
    if conn is None:
        conn = get_connection()
        should_close = True

    cursor = conn.cursor()
    cursor.execute("SELECT id, initial_balance, type FROM accounts")
    accounts = cursor.fetchall()

    for acc in accounts:
        acc_id = acc["id"]
        init_bal = acc["initial_balance"]
        acc_type = acc["type"]

        # Calculate income directly to this account
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM transactions 
            WHERE account_id = ? AND type = 'income' AND status = 'completed' AND deleted_at IS NULL
        """, (acc_id,))
        income_sum = cursor.fetchone()[0]

        # Calculate expenses from this account
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM transactions 
            WHERE account_id = ? AND type = 'expense' AND status = 'completed' AND deleted_at IS NULL
        """, (acc_id,))
        expense_sum = cursor.fetchone()[0]

        # Transfers OUT
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM transactions 
            WHERE account_id = ? AND type = 'transfer' AND status = 'completed' AND deleted_at IS NULL
        """, (acc_id,))
        transfer_out = cursor.fetchone()[0]

        # Transfers IN
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM transactions 
            WHERE destination_account_id = ? AND type = 'transfer' AND status = 'completed' AND deleted_at IS NULL
        """, (acc_id,))
        transfer_in = cursor.fetchone()[0]

        if acc_type == 'credit_card':
            current_bal = init_bal - expense_sum + transfer_in
        else:
            current_bal = init_bal + income_sum - expense_sum - transfer_out + transfer_in

        cursor.execute("UPDATE accounts SET current_balance = ? WHERE id = ?", (current_bal, acc_id))

    conn.commit()
    if should_close:
        conn.close()

# --- CATEGORIES ---

def get_categories():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories ORDER BY type ASC, name ASC")
    rows = cursor.fetchall()
    
    now = datetime.date.today()
    start_of_month = now.replace(day=1).strftime("%Y-%m-%d")
    end_of_month = (now.replace(day=1) + relativedelta(months=1) - timedelta(days=1)).strftime("%Y-%m-%d")

    categories = []
    for r in rows:
        cat = dict(r)
        cat["budget_limit"] = to_reais(cat["budget_limit"])
        
        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) FROM transactions 
            WHERE category_id = ? AND type = 'expense' AND date BETWEEN ? AND ? AND deleted_at IS NULL
        """, (cat["id"], start_of_month, end_of_month))
        spent = cursor.fetchone()[0]
        cat["spent_this_month"] = to_reais(spent)
        categories.append(cat)

    conn.close()
    return categories

def create_category(data: dict):
    conn = get_connection()
    cursor = conn.cursor()
    budget_cents = to_cents(data.get("budget_limit", 0.0))
    cursor.execute("""
        INSERT INTO categories (name, type, parent_id, color, icon, budget_limit)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        data["name"],
        data.get("type", "expense"),
        data.get("parent_id"),
        data.get("color", "#64748B"),
        data.get("icon", "tag"),
        budget_cents
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return new_id

# --- TRANSACTIONS ---

def create_transaction(data: dict):
    conn = get_connection()
    cursor = conn.cursor()

    total_amount = data["amount"]
    installments = data.get("installments", 1) or 1
    base_date_str = data["date"]
    base_date = datetime.datetime.strptime(base_date_str, "%Y-%m-%d").date()
    
    created_ids = []

    if installments > 1 and data["type"] == "expense":
        group_id = str(uuid.uuid4())[:8]
        total_cents = to_cents(total_amount)
        part_cents = total_cents // installments
        remainder = total_cents % installments

        for i in range(1, installments + 1):
            inst_amount = part_cents + (1 if i <= remainder else 0)
            inst_date = base_date + relativedelta(months=i-1)
            inst_desc = f"{data['description']} ({i}/{installments})"
            
            today = datetime.date.today()
            status = "pending" if inst_date > today else data.get("status", "completed")

            cursor.execute("""
                INSERT INTO transactions (
                    description, amount, type, account_id, destination_account_id,
                    category_id, date, due_date, status, notes,
                    installment_current, installment_total, installment_group_id,
                    is_recurring, recurrence_period
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                inst_desc,
                inst_amount,
                data["type"],
                data["account_id"],
                data.get("destination_account_id"),
                data.get("category_id"),
                inst_date.strftime("%Y-%m-%d"),
                data.get("due_date") or inst_date.strftime("%Y-%m-%d"),
                status,
                data.get("notes"),
                i,
                installments,
                group_id,
                1 if data.get("is_recurring") else 0,
                data.get("recurrence_period")
            ))
            created_ids.append(cursor.lastrowid)
    else:
        amount_cents = to_cents(total_amount)
        cursor.execute("""
            INSERT INTO transactions (
                description, amount, type, account_id, destination_account_id,
                category_id, date, due_date, status, notes,
                installment_current, installment_total, installment_group_id,
                is_recurring, recurrence_period
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["description"],
            amount_cents,
            data["type"],
            data["account_id"],
            data.get("destination_account_id"),
            data.get("category_id"),
            data["date"],
            data.get("due_date") or data["date"],
            data.get("status", "completed"),
            data.get("notes"),
            1,
            1,
            None,
            1 if data.get("is_recurring") else 0,
            data.get("recurrence_period")
        ))
        created_ids.append(cursor.lastrowid)

    recalculate_account_balances(conn)
    conn.commit()
    conn.close()
    return created_ids

def get_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    tx_type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            t.*,
            a.name as account_name,
            da.name as destination_account_name,
            c.name as category_name,
            c.color as category_color,
            c.icon as category_icon
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN accounts da ON t.destination_account_id = da.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.deleted_at IS NULL
    """
    params = []

    if year and month:
        start_date = f"{year:04d}-{month:02d}-01"
        end_date = (datetime.date(year, month, 1) + relativedelta(months=1) - timedelta(days=1)).strftime("%Y-%m-%d")
        query += " AND t.date BETWEEN ? AND ?"
        params.extend([start_date, end_date])
    elif year:
        query += " AND t.date LIKE ?"
        params.append(f"{year:04d}-%")

    if account_id:
        query += " AND (t.account_id = ? OR t.destination_account_id = ?)"
        params.extend([account_id, account_id])

    if category_id:
        query += " AND t.category_id = ?"
        params.append(category_id)

    if tx_type:
        query += " AND t.type = ?"
        params.append(tx_type)

    if status:
        query += " AND t.status = ?"
        params.append(status)

    if search:
        query += " AND (t.description LIKE ? OR t.notes LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])

    query += " ORDER BY t.date DESC, t.id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    transactions = []
    for r in rows:
        item = dict(r)
        item["amount"] = to_reais(item["amount"])
        transactions.append(item)

    conn.close()
    return transactions

def delete_transaction(tx_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE transactions SET deleted_at = datetime('now', 'localtime') WHERE id = ?", (tx_id,))
    recalculate_account_balances(conn)
    conn.commit()
    conn.close()
    return True

def toggle_transaction_status(tx_id: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status FROM transactions WHERE id = ?", (tx_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return None
    new_status = "completed" if row["status"] == "pending" else "pending"
    cursor.execute("UPDATE transactions SET status = ? WHERE id = ?", (new_status, tx_id))
    recalculate_account_balances(conn)
    conn.commit()
    conn.close()
    return new_status

# --- DASHBOARD & SUMMARY ---

def get_dashboard_summary(month: int, year: int):
    conn = get_connection()
    cursor = conn.cursor()

    recalculate_account_balances(conn)

    start_date = f"{year:04d}-{month:02d}-01"
    end_date = (datetime.date(year, month, 1) + relativedelta(months=1) - timedelta(days=1)).strftime("%Y-%m-%d")

    # Liquid balances (excluding credit cards)
    cursor.execute("""
        SELECT COALESCE(SUM(current_balance), 0) FROM accounts 
        WHERE type != 'credit_card' AND archived = 0
    """)
    total_liquid = to_reais(cursor.fetchone()[0])

    # Total credit card debt
    cursor.execute("""
        SELECT COALESCE(SUM(ABS(current_balance)), 0) FROM accounts 
        WHERE type = 'credit_card' AND archived = 0 AND current_balance < 0
    """)
    total_credit_debt = to_reais(cursor.fetchone()[0])

    # Total Income this month
    cursor.execute("""
        SELECT 
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as completed,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending
        FROM transactions 
        WHERE type = 'income' AND date BETWEEN ? AND ? AND deleted_at IS NULL
    """, (start_date, end_date))
    inc_row = cursor.fetchone()
    month_income_completed = to_reais(inc_row["completed"])
    month_income_pending = to_reais(inc_row["pending"])

    # Total Expense this month
    cursor.execute("""
        SELECT 
            COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as completed,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending
        FROM transactions 
        WHERE type = 'expense' AND date BETWEEN ? AND ? AND deleted_at IS NULL
    """, (start_date, end_date))
    exp_row = cursor.fetchone()
    month_expense_completed = to_reais(exp_row["completed"])
    month_expense_pending = to_reais(exp_row["pending"])

    # Expenses by Category
    cursor.execute("""
        SELECT 
            c.id, c.name, c.color, c.icon,
            COALESCE(SUM(t.amount), 0) as total_amount
        FROM categories c
        JOIN transactions t ON t.category_id = c.id
        WHERE t.type = 'expense' AND t.date BETWEEN ? AND ? AND t.deleted_at IS NULL
        GROUP BY c.id
        ORDER BY total_amount DESC
    """, (start_date, end_date))
    cat_rows = cursor.fetchall()
    categories_breakdown = []
    total_cat_sum = sum(r["total_amount"] for r in cat_rows) or 1
    for r in cat_rows:
        amount_r = to_reais(r["total_amount"])
        categories_breakdown.append({
            "id": r["id"],
            "name": r["name"],
            "color": r["color"],
            "icon": r["icon"],
            "amount": amount_r,
            "percentage": round((r["total_amount"] / total_cat_sum) * 100, 1)
        })

    # Daily Expenses Timeline (Day-by-Day throughout the month)
    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    
    cursor.execute("""
        SELECT strftime('%d', date) as day_num, date, COALESCE(SUM(amount), 0) as day_total, COUNT(*) as tx_count
        FROM transactions
        WHERE type = 'expense' AND date BETWEEN ? AND ? AND deleted_at IS NULL
        GROUP BY date
        ORDER BY date ASC
    """, (start_date, end_date))
    daily_rows = {int(r["day_num"]): {"amount": to_reais(r["day_total"]), "date": r["date"], "count": r["tx_count"]} for r in cursor.fetchall()}

    daily_expenses_timeline = []
    accumulated_expense = 0.0
    for d in range(1, days_in_month + 1):
        dt_str = f"{year:04d}-{month:02d}-{d:02d}"
        day_info = daily_rows.get(d, {"amount": 0.0, "date": dt_str, "count": 0})
        accumulated_expense = round(accumulated_expense + day_info["amount"], 2)
        daily_expenses_timeline.append({
            "day": d,
            "date": dt_str,
            "amount": day_info["amount"],
            "accumulated": accumulated_expense,
            "count": day_info["count"]
        })

    # Recent 6 transactions
    cursor.execute("""
        SELECT 
            t.*,
            a.name as account_name,
            c.name as category_name,
            c.color as category_color,
            c.icon as category_icon
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.deleted_at IS NULL
        ORDER BY t.date DESC, t.id DESC LIMIT 6
    """)
    recent_txs = []
    for r in cursor.fetchall():
        item = dict(r)
        item["amount"] = to_reais(item["amount"])
        recent_txs.append(item)

    # Smart Financial Insights
    today = datetime.date.today()
    next_7_days = today + datetime.timedelta(days=7)
    cursor.execute("""
        SELECT COUNT(*), COALESCE(SUM(amount), 0)
        FROM transactions
        WHERE type = 'expense' AND status = 'pending' 
          AND date BETWEEN ? AND ? AND deleted_at IS NULL
    """, (today.strftime("%Y-%m-%d"), next_7_days.strftime("%Y-%m-%d")))
    up_row = cursor.fetchone()
    upcoming_count = up_row[0]
    upcoming_sum = to_reais(up_row[1])

    conn.close()

    net_balance = round(month_income_completed - month_expense_completed, 2)

    insights = []

    # 1. Savings Rate / Balance Health
    if month_income_completed > 0:
        savings_rate = round((net_balance / month_income_completed) * 100, 1)
        if savings_rate >= 20:
            insights.append({
                "type": "success",
                "icon": "📈",
                "title": f"Taxa de Poupança Excelente ({savings_rate}%)",
                "description": f"Você está poupando R$ {net_balance:,.2f} da sua renda este mês. Meta recomendada (20%) superada com sucesso!".replace(",", "X").replace(".", ",").replace("X", ".")
            })
        elif savings_rate > 0:
            insights.append({
                "type": "info",
                "icon": "💡",
                "title": f"Saldo Positivo ({savings_rate}% poupado)",
                "description": f"Suas receitas superam as despesas em R$ {net_balance:,.2f}. Busque atingir 20% de economia reduzindo gastos em categorias secundárias.".replace(",", "X").replace(".", ",").replace("X", ".")
            })
        else:
            insights.append({
                "type": "danger",
                "icon": "⚠️",
                "title": "Atenção: Mês com Déficit",
                "description": f"Suas despesas ultrapassaram suas receitas em R$ {abs(net_balance):,.2f}. Revise gastos recentes para equilibrar o caixa.".replace(",", "X").replace(".", ",").replace("X", ".")
            })

    # 2. Top Category Cost
    if categories_breakdown:
        top_cat = categories_breakdown[0]
        insights.append({
            "type": "warning" if top_cat["percentage"] > 40 else "info",
            "icon": "🎯",
            "title": f"Maior Centro de Custo: {top_cat['name']}",
            "description": f"Concentra R$ {top_cat['amount']:,.2f} ({top_cat['percentage']}% do total de despesas deste mês).".replace(",", "X").replace(".", ",").replace("X", ".")
        })

    # 3. Upcoming Bills in 7 Days
    if upcoming_count > 0:
        insights.append({
            "type": "warning",
            "icon": "⏰",
            "title": f"{upcoming_count} conta(s) a vencer nos próximos 7 dias",
            "description": f"Total programado de R$ {upcoming_sum:,.2f} em pagamentos para esta semana. Garanta saldo disponível em conta.".replace(",", "X").replace(".", ",").replace("X", ".")
        })
    else:
        insights.append({
            "type": "success",
            "icon": "✨",
            "title": "Sem contas para os próximos 7 dias",
            "description": "Nenhum compromisso financeiro pendente agendado para a semana atual."
        })

    # 4. Daily Spend Velocity
    day_ref = today.day if (today.month == month and today.year == year) else days_in_month
    avg_daily = round(month_expense_completed / max(1, day_ref), 2)
    insights.append({
        "type": "info",
        "icon": "⚡",
        "title": "Ritmo de Gasto Diário",
        "description": f"Sua média de consumo é de R$ {avg_daily:,.2f} por dia neste mês.".replace(",", "X").replace(".", ",").replace("X", ".")
    })

    # 5. Credit Card Open Invoices
    if total_credit_debt > 0:
        insights.append({
            "type": "warning",
            "icon": "💳",
            "title": "Fatura Aberta do Cartão",
            "description": f"Você possui R$ {total_credit_debt:,.2f} acumulados em cartões de crédito aguardando fechamento/vencimento.".replace(",", "X").replace(".", ",").replace("X", ".")
        })

    return {
        "total_liquid": total_liquid,
        "total_credit_debt": total_credit_debt,
        "month_income": month_income_completed,
        "month_income_pending": month_income_pending,
        "month_expense": month_expense_completed,
        "month_expense_pending": month_expense_pending,
        "net_balance": net_balance,
        "categories_breakdown": categories_breakdown,
        "recent_transactions": recent_txs,
        "daily_expenses_timeline": daily_expenses_timeline,
        "insights": insights
    }

# --- FUTURE FORECAST (RUNWAY) ---

def get_forecast(days: int = 60):
    conn = get_connection()
    cursor = conn.cursor()

    recalculate_account_balances(conn)

    cursor.execute("""
        SELECT COALESCE(SUM(current_balance), 0) FROM accounts 
        WHERE type != 'credit_card' AND archived = 0
    """)
    starting_liquid_cents = cursor.fetchone()[0]

    today = datetime.date.today()
    end_date = today + timedelta(days=days)

    cursor.execute("""
        SELECT date, amount, type, description, status
        FROM transactions
        WHERE date BETWEEN ? AND ? AND deleted_at IS NULL
        ORDER BY date ASC
    """, (today.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d")))
    upcoming = cursor.fetchall()
    conn.close()

    day_map: Dict[str, Dict[str, Any]] = {}
    for d in range(days + 1):
        dt = (today + timedelta(days=d)).strftime("%Y-%m-%d")
        day_map[dt] = {
            "date": dt,
            "income": 0,
            "expense": 0,
            "events": []
        }

    for tx in upcoming:
        dt = tx["date"]
        if dt in day_map:
            amt = tx["amount"]
            if tx["type"] == "income":
                day_map[dt]["income"] += amt
                day_map[dt]["events"].append(f"+ R$ {to_reais(amt):.2f}: {tx['description']}")
            elif tx["type"] == "expense":
                day_map[dt]["expense"] += amt
                day_map[dt]["events"].append(f"- R$ {to_reais(amt):.2f}: {tx['description']}")

    timeline = []
    current_cents = starting_liquid_cents
    min_cents = starting_liquid_cents
    min_date = today.strftime("%Y-%m-%d")

    for dt, info in sorted(day_map.items()):
        current_cents += info["income"] - info["expense"]
        if current_cents < min_cents:
            min_cents = current_cents
            min_date = dt

        timeline.append({
            "date": dt,
            "balance": to_reais(current_cents),
            "income": to_reais(info["income"]),
            "expense": to_reais(info["expense"]),
            "events": info["events"]
        })

    end_balance = to_reais(current_cents)
    min_balance = to_reais(min_cents)
    start_balance = to_reais(starting_liquid_cents)

    return {
        "start_balance": start_balance,
        "end_balance": end_balance,
        "min_balance": min_balance,
        "min_date": min_date,
        "risk_negative": min_balance < 0,
        "days_projected": days,
        "timeline": timeline
    }
