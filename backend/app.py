import os
import sys
import io
import csv
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional, List
import datetime

from backend.database import init_db
from backend.seed_data import seed
from backend.models import (
    AccountCreate, AccountUpdate, CategoryCreate, CategoryUpdate, 
    TransactionCreate, TransactionUpdate
)
from backend.services import finance_service
from backend.services.ofx_parser import parse_ofx_content, parse_csv_content

app = FastAPI(
    title="FinancePro",
    description="Sistema inteligente de finanças pessoais com previsões futuras e suporte a PC e Mobile",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

@app.on_event("startup")
def on_startup():
    init_db()
    seed()

@app.get("/api/accounts")
def list_accounts():
    return finance_service.get_accounts()

@app.post("/api/accounts")
def create_account(account: AccountCreate):
    acc_id = finance_service.create_account(account.model_dump())
    return {"id": acc_id, "message": "Conta criada com sucesso"}

@app.get("/api/categories")
def list_categories():
    return finance_service.get_categories()

@app.post("/api/categories")
def create_category(category: CategoryCreate):
    cat_id = finance_service.create_category(category.model_dump())
    return {"id": cat_id, "message": "Categoria criada com sucesso"}

@app.get("/api/transactions")
def list_transactions(
    month: Optional[int] = None,
    year: Optional[int] = None,
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    type: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    return finance_service.get_transactions(
        month=month,
        year=year,
        account_id=account_id,
        category_id=category_id,
        tx_type=type,
        status=status,
        search=search,
        limit=limit,
        offset=offset
    )

@app.post("/api/transactions")
def create_transaction(tx: TransactionCreate):
    tx_ids = finance_service.create_transaction(tx.model_dump())
    return {"created_ids": tx_ids, "count": len(tx_ids), "message": "Transação registrada com sucesso"}

@app.delete("/api/transactions/{tx_id}")
def delete_transaction(tx_id: int):
    success = finance_service.delete_transaction(tx_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return {"message": "Transação excluída com sucesso"}

@app.patch("/api/transactions/{tx_id}/toggle-status")
def toggle_status(tx_id: int):
    new_status = finance_service.toggle_transaction_status(tx_id)
    if not new_status:
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    return {"status": new_status, "message": f"Status alterado para {new_status}"}

@app.get("/api/dashboard")
def get_dashboard(
    month: Optional[int] = None,
    year: Optional[int] = None
):
    now = datetime.date.today()
    m = month or now.month
    y = year or now.year
    return finance_service.get_dashboard_summary(month=m, year=y)

@app.get("/api/forecast")
def get_forecast(days: int = Query(60, ge=7, le=365)):
    return finance_service.get_forecast(days=days)

@app.post("/api/import/file")
async def import_file(file: UploadFile = File(...)):
    filename = file.filename.lower()
    content_bytes = await file.read()
    
    try:
        content_text = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content_text = content_bytes.decode("latin-1", errors="replace")

    if filename.endswith(".ofx"):
        parsed = parse_ofx_content(content_text)
    elif filename.endswith(".csv"):
        parsed = parse_csv_content(content_text)
    else:
        raise HTTPException(status_code=400, detail="Formato não suportado. Envie arquivos .OFX ou .CSV")

    return {
        "filename": file.filename,
        "count": len(parsed),
        "transactions": parsed
    }

@app.post("/api/import/confirm")
def confirm_import(payload: dict):
    account_id = payload.get("account_id")
    items = payload.get("transactions", [])
    if not account_id:
        raise HTTPException(status_code=400, detail="Conta obrigatória para importação")
    
    saved_count = 0
    for item in items:
        finance_service.create_transaction({
            "description": item["description"],
            "amount": item["amount"],
            "type": item["type"],
            "account_id": account_id,
            "category_id": item.get("category_id"),
            "date": item["date"],
            "status": "completed",
            "notes": "Importado via extrato bancário"
        })
        saved_count += 1

    return {"message": f"{saved_count} transações importadas com sucesso!"}

@app.get("/api/export/csv")
def export_csv():
    txs = finance_service.get_transactions(limit=5000)
    output = io.StringIO()
    writer = csv.writer(output, delimiter=';')
    writer.writerow(["ID", "Data", "Tipo", "Descricao", "Valor (R$)", "Conta", "Categoria", "Status", "Parcela"])

    for t in txs:
        writer.writerow([
            t["id"],
            t["date"],
            "Receita" if t["type"] == "income" else "Despesa" if t["type"] == "expense" else "Transferência",
            t["description"],
            f"{t['amount']:.2f}".replace(".", ","),
            t.get("account_name") or "",
            t.get("category_name") or "Sem Categoria",
            "Concluído" if t["status"] == "completed" else "Pendente",
            f"{t['installment_current']}/{t['installment_total']}" if t['installment_total'] > 1 else "-"
        ])

    output.seek(0)
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=extrato_financas.csv"
    return response

STATIC_DIR = ROOT_DIR if (ROOT_DIR / "index.html").exists() else FRONTEND_DIR
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="frontend")
