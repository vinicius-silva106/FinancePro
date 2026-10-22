from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date

class AccountBase(BaseModel):
    name: str
    type: str = "checking" # checking, savings, credit_card, cash, investment
    initial_balance: float = 0.0 # in reais, converted to cents internally
    color: Optional[str] = "#4F46E5"
    icon: Optional[str] = "wallet"
    credit_limit: Optional[float] = 0.0
    closing_day: Optional[int] = 1
    due_day: Optional[int] = 10

class AccountCreate(AccountBase):
    pass

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    credit_limit: Optional[float] = None
    closing_day: Optional[int] = None
    due_day: Optional[int] = None
    archived: Optional[bool] = None

class AccountOut(BaseModel):
    id: int
    name: str
    type: str
    initial_balance: float
    current_balance: float
    color: str
    icon: str
    credit_limit: float
    closing_day: int
    due_day: int
    archived: int
    created_at: str

class CategoryBase(BaseModel):
    name: str
    type: str = "expense" # expense, income
    parent_id: Optional[int] = None
    color: Optional[str] = "#64748B"
    icon: Optional[str] = "tag"
    budget_limit: Optional[float] = 0.0

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    parent_id: Optional[int] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    budget_limit: Optional[float] = None

class CategoryOut(BaseModel):
    id: int
    name: str
    type: str
    parent_id: Optional[int]
    color: str
    icon: str
    budget_limit: float
    spent_this_month: Optional[float] = 0.0

class TransactionCreate(BaseModel):
    description: str
    amount: float # in reais
    type: str # income, expense, transfer
    account_id: int
    destination_account_id: Optional[int] = None
    category_id: Optional[int] = None
    date: str # YYYY-MM-DD
    due_date: Optional[str] = None
    status: str = "completed" # pending, completed
    notes: Optional[str] = None
    installments: Optional[int] = 1 # if > 1, generates installment group
    is_recurring: Optional[bool] = False
    recurrence_period: Optional[str] = "monthly"

class TransactionUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    account_id: Optional[int] = None
    destination_account_id: Optional[int] = None
    category_id: Optional[int] = None
    date: Optional[str] = None
    due_date: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class TransactionOut(BaseModel):
    id: int
    description: str
    amount: float
    type: str
    account_id: int
    account_name: Optional[str] = None
    destination_account_id: Optional[int] = None
    destination_account_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    category_icon: Optional[str] = None
    date: str
    due_date: Optional[str] = None
    status: str
    notes: Optional[str] = None
    installment_current: int
    installment_total: int
    installment_group_id: Optional[str] = None
    is_recurring: int
    recurrence_period: Optional[str] = None
    created_at: str
