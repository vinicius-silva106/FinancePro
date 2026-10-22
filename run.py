import os
import sys
import socket
import webbrowser
import threading
import time
from pathlib import Path

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

ROOT_DIR = Path(__file__).parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

import uvicorn

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def open_browser():
    time.sleep(1.5)
    try:
        webbrowser.open("http://localhost:8000")
    except Exception:
        pass

def main():
    local_ip = get_local_ip()
    port = 8000

    print("=" * 65)
    print("        FINANCEPRO - GERENCIADOR PESSOAL INTELIGENTE")
    print("=" * 65)
    print(f"  [PC / Desktop]   Acesse: http://localhost:{port}")
    print(f"  [Celular/Mobile] Acesse: http://{local_ip}:{port}")
    print("=" * 65)
    print("  Dica Celular: Conecte no mesmo Wi-Fi, abra o link no Chrome/Safari")
    print("  e toque em 'Adicionar a tela inicial' para instalar o App!")
    print("=" * 65)
    print("  Pressione Ctrl + C para encerrar o servidor.")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn.run("backend.app:app", host="0.0.0.0", port=port, reload=False)

if __name__ == "__main__":
    main()
