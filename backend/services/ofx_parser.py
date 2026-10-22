import re
import csv
import io
from datetime import datetime
from typing import List, Dict, Any

def parse_ofx_content(content: str) -> List[Dict[str, Any]]:
    transactions = []
    stmt_pattern = re.compile(r"<STMTTRN>(.*?)</STMTTRN>", re.DOTALL | re.IGNORECASE)
    matches = stmt_pattern.findall(content)

    if not matches:
        blocks = content.split("<STMTTRN>")
        matches = blocks[1:]

    for block in matches:
        def extract_tag(tag):
            m = re.search(rf"<{tag}>([^<\r\n]+)", block, re.IGNORECASE)
            return m.group(1).strip() if m else ""

        trntype = extract_tag("TRNTYPE")
        dtposted = extract_tag("DTPOSTED")
        trnamt_str = extract_tag("TRNAMT").replace(",", ".")
        memo = extract_tag("MEMO") or extract_tag("NAME") or "Transação Bancária"

        if not trnamt_str:
            continue

        try:
            amount_val = float(trnamt_str)
        except ValueError:
            continue

        date_str = ""
        if len(dtposted) >= 8:
            date_str = f"{dtposted[0:4]}-{dtposted[4:6]}-{dtposted[6:8]}"
        else:
            date_str = datetime.today().strftime("%Y-%m-%d")

        tx_type = "income" if amount_val > 0 else "expense"
        abs_amount = round(abs(amount_val), 2)

        transactions.append({
            "date": date_str,
            "description": memo.strip(),
            "amount": abs_amount,
            "type": tx_type,
            "raw_type": trntype
        })

    return transactions

def parse_csv_content(content: str) -> List[Dict[str, Any]]:
    transactions = []
    f = io.StringIO(content)
    sample = content[:1024]
    delimiter = ';' if ';' in sample else ','
    reader = csv.reader(f, delimiter=delimiter)

    rows = list(reader)
    if not rows:
        return []

    header = [h.strip().lower() for h in rows[0]]
    date_idx, desc_idx, amount_idx = -1, -1, -1

    for idx, col in enumerate(header):
        if any(k in col for k in ["data", "date"]):
            date_idx = idx
        elif any(k in col for k in ["descri", "hist", "memo", "name", "detalhe"]):
            desc_idx = idx
        elif any(k in col for k in ["valor", "amount", "quant"]):
            amount_idx = idx

    start_row = 1 if (date_idx != -1 or amount_idx != -1) else 0
    if date_idx == -1: date_idx = 0
    if desc_idx == -1: desc_idx = 1
    if amount_idx == -1: amount_idx = 2

    for row in rows[start_row:]:
        if len(row) <= max(date_idx, desc_idx, amount_idx):
            continue
        raw_date = row[date_idx].strip()
        raw_desc = row[desc_idx].strip()
        raw_amount = row[amount_idx].strip().replace("R$", "").replace(" ", "")

        if not raw_amount or not raw_date:
            continue

        clean_amount_str = raw_amount
        if "," in clean_amount_str and "." in clean_amount_str:
            clean_amount_str = clean_amount_str.replace(".", "").replace(",", ".")
        elif "," in clean_amount_str:
            clean_amount_str = clean_amount_str.replace(",", ".")

        try:
            val = float(clean_amount_str)
        except ValueError:
            continue

        dt_formatted = ""
        if "/" in raw_date:
            parts = raw_date.split("/")
            if len(parts) == 3:
                dt_formatted = f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        elif "-" in raw_date:
            dt_formatted = raw_date[:10]
        else:
            dt_formatted = datetime.today().strftime("%Y-%m-%d")

        transactions.append({
            "date": dt_formatted,
            "description": raw_desc or "Transação CSV",
            "amount": round(abs(val), 2),
            "type": "income" if val > 0 else "expense"
        })

    return transactions
