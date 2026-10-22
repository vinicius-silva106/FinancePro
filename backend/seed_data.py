import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import datetime
from dateutil.relativedelta import relativedelta
from backend.database import get_connection, init_db
from backend.services.finance_service import create_account, create_category, create_transaction

def seed():
    init_db()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM accounts")
    if cursor.fetchone()[0] > 0:
        conn.close()
        return

    conn.close()

    acc_nubank = create_account({
        "name": "Nubank Conta Corrente",
        "type": "checking",
        "initial_balance": 3850.00,
        "color": "#8A05BE",
        "icon": "landmark"
    })

    acc_card = create_account({
        "name": "Cartão Nubank Ultravioleta",
        "type": "credit_card",
        "initial_balance": 0.0,
        "credit_limit": 8000.00,
        "closing_day": 20,
        "due_day": 27,
        "color": "#6B21A8",
        "icon": "credit-card"
    })

    acc_reserva = create_account({
        "name": "Reserva de Emergência",
        "type": "savings",
        "initial_balance": 15000.00,
        "color": "#059669",
        "icon": "piggy-bank"
    })

    acc_wallet = create_account({
        "name": "Carteira Dinheiro Vivo",
        "type": "cash",
        "initial_balance": 180.00,
        "color": "#D97706",
        "icon": "wallet"
    })

    cat_salario = create_category({"name": "Salário & Renda", "type": "income", "color": "#10B981", "icon": "dollar-sign"})
    cat_freela = create_category({"name": "Projetos Extras", "type": "income", "color": "#34D399", "icon": "briefcase"})
    cat_invest = create_category({"name": "Rendimentos", "type": "income", "color": "#06B6D4", "icon": "trending-up"})

    cat_moradia = create_category({"name": "Moradia (Aluguel/Contas)", "type": "expense", "color": "#3B82F6", "icon": "home", "budget_limit": 2000.0})
    cat_alim = create_category({"name": "Alimentação & Mercado", "type": "expense", "color": "#F59E0B", "icon": "shopping-cart", "budget_limit": 1200.0})
    cat_transporte = create_category({"name": "Transporte (Combustível/Uber)", "type": "expense", "color": "#6366F1", "icon": "car", "budget_limit": 500.0})
    cat_lazer = create_category({"name": "Lazer & Restaurantes", "type": "expense", "color": "#EC4899", "icon": "coffee", "budget_limit": 600.0})
    cat_saude = create_category({"name": "Saúde & Farmácia", "type": "expense", "color": "#EF4444", "icon": "activity", "budget_limit": 350.0})
    cat_assinaturas = create_category({"name": "Assinaturas & Serviços", "type": "expense", "color": "#8B5CF6", "icon": "film", "budget_limit": 200.0})
    cat_educacao = create_category({"name": "Educação & Cursos", "type": "expense", "color": "#14B8A6", "icon": "book", "budget_limit": 300.0})

    today = datetime.date.today()
    this_month_start = today.replace(day=5)
    
    create_transaction({
        "description": "Salário Mensal",
        "amount": 6500.00,
        "type": "income",
        "account_id": acc_nubank,
        "category_id": cat_salario,
        "date": this_month_start.strftime("%Y-%m-%d"),
        "status": "completed",
        "is_recurring": True
    })

    create_transaction({
        "description": "Aluguel Apartamento",
        "amount": 1650.00,
        "type": "expense",
        "account_id": acc_nubank,
        "category_id": cat_moradia,
        "date": (today.replace(day=10)).strftime("%Y-%m-%d"),
        "status": "completed",
        "is_recurring": True
    })

    create_transaction({
        "description": "Supermercado Semanal",
        "amount": 420.50,
        "type": "expense",
        "account_id": acc_nubank,
        "category_id": cat_alim,
        "date": (today - datetime.timedelta(days=4)).strftime("%Y-%m-%d"),
        "status": "completed"
    })

    create_transaction({
        "description": "Posto de Gasolina Shell",
        "amount": 180.00,
        "type": "expense",
        "account_id": acc_nubank,
        "category_id": cat_transporte,
        "date": (today - datetime.timedelta(days=2)).strftime("%Y-%m-%d"),
        "status": "completed"
    })

    create_transaction({
        "description": "Jantar em Restaurante Japonês",
        "amount": 165.00,
        "type": "expense",
        "account_id": acc_card,
        "category_id": cat_lazer,
        "date": (today - datetime.timedelta(days=1)).strftime("%Y-%m-%d"),
        "status": "completed"
    })

    create_transaction({
        "description": "Netflix + Spotify",
        "amount": 79.80,
        "type": "expense",
        "account_id": acc_card,
        "category_id": cat_assinaturas,
        "date": today.strftime("%Y-%m-%d"),
        "status": "completed",
        "is_recurring": True
    })

    create_transaction({
        "description": "Smartphone 5G Novo",
        "amount": 3200.00,
        "type": "expense",
        "account_id": acc_card,
        "category_id": cat_educacao,
        "date": today.strftime("%Y-%m-%d"),
        "installments": 8,
        "status": "completed"
    })

    future_date = today + datetime.timedelta(days=8)
    create_transaction({
        "description": "Internet Fibra Óptica 600MB",
        "amount": 129.90,
        "type": "expense",
        "account_id": acc_nubank,
        "category_id": cat_moradia,
        "date": future_date.strftime("%Y-%m-%d"),
        "status": "pending",
        "is_recurring": True
    })

    future_income_date = today + datetime.timedelta(days=15)
    create_transaction({
        "description": "Recebimento Projeto Web Freelance",
        "amount": 1800.00,
        "type": "income",
        "account_id": acc_nubank,
        "category_id": cat_freela,
        "date": future_income_date.strftime("%Y-%m-%d"),
        "status": "pending"
    })

if __name__ == "__main__":
    seed()
    print("Seed complete!")
