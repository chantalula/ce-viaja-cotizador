#!/usr/bin/env python3
"""
Import clients from clientes_completos.pdf into Supabase cotizador_clients table.
Columns in PDF: Código | Nombre | Dirección | Contacto | Correo | Tipo | Vendedor
Mapping: name=Nombre, email=Correo (first if multiple), notes=Código
"""

import pdfplumber
import json
import os
import uuid
import re
from datetime import datetime, timezone
from pathlib import Path

# Load SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from .env.local instead of hardcoding secrets here
def _load_env_local():
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, _, value = line.partition('=')
        os.environ.setdefault(key.strip(), value.strip())

_load_env_local()

PDF_PATH = "/Users/chantalperez/Desktop/Claude Coding/Ce viaja cotizador/clientes_completos.pdf"

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def clean_name(raw):
    """Remove PDF watermark artifacts like 'de 2026 19:21:04' from names."""
    name = raw.strip()
    # Remove date-time artifacts that bleed in from watermarks
    name = re.sub(r'\s+de\s+\d{4}\s+\d{2}:\d{2}:\d{2}', '', name)
    name = re.sub(r'\s+\d{2}:\d{2}:\d{2}', '', name)
    # Collapse multiple spaces
    name = re.sub(r'\s{2,}', ' ', name).strip()
    return name


def parse_pdf(path):
    clients = []
    seen_codes = set()

    with pdfplumber.open(path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if not row or len(row) < 2:
                        continue

                    # Row structure: Código | Nombre | Dirección | Contacto | Correo | Tipo | Vendedor
                    codigo = (row[0] or '').strip()
                    nombre = clean_name(row[1] or '')
                    # Skip header rows
                    if not codigo or codigo in ('Código', 'CODIGO', 'Cod', 'Código') or not nombre or nombre in ('Nombre', 'NOMBRE'):
                        continue
                    # Skip rows that are clearly not client data
                    if re.match(r'^[A-Za-záéíóúÁÉÍÓÚñÑ\s]+$', codigo) and not re.match(r'^\d', codigo):
                        continue

                    # Deduplicate by code
                    if codigo in seen_codes:
                        continue
                    seen_codes.add(codigo)

                    # Get email (column index 4)
                    correo_raw = (row[4] if len(row) > 4 else '') or ''
                    # Handle multiple emails separated by semicolons or newlines
                    emails = re.split(r'[;\n]+', correo_raw)
                    email = emails[0].strip().lower() if emails else ''
                    # Basic email validation — discard junk
                    if email and not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                        email = ''

                    if not nombre:
                        continue

                    clients.append({
                        'id': str(uuid.uuid4()),
                        'name': nombre,
                        'email': email,
                        'phone': '',
                        'passport': '',
                        'notes': codigo,
                        'photo_url': '',
                        'created_at': datetime.now(timezone.utc).isoformat()
                    })

    return clients


def bulk_insert(clients):
    import urllib.request

    url = f"{SUPABASE_URL}/rest/v1/cotizador_clients"
    headers = {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': f'Bearer {SERVICE_ROLE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
    }

    # Insert in batches of 200 to avoid request size limits
    batch_size = 200
    total = len(clients)
    inserted = 0

    for i in range(0, total, batch_size):
        batch = clients[i:i + batch_size]
        data = json.dumps(batch).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                if status in (200, 201, 204):
                    inserted += len(batch)
                    print(f"  Batch {i//batch_size + 1}: {len(batch)} clients inserted (total {inserted}/{total})")
                else:
                    body = resp.read().decode()
                    print(f"  Batch {i//batch_size + 1}: unexpected status {status}: {body}")
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"  Batch {i//batch_size + 1}: HTTP error {e.code}: {body}")
            return inserted

    return inserted


def main():
    print(f"Parsing PDF: {PDF_PATH}")
    clients = parse_pdf(PDF_PATH)
    print(f"Parsed {len(clients)} clients from PDF")

    if not clients:
        print("No clients found. Check PDF structure.")
        return

    # Preview first 3
    print("\nSample records:")
    for c in clients[:3]:
        print(f"  {c['notes']} | {c['name']} | {c['email']}")

    # Count how many have emails
    with_email = sum(1 for c in clients if c['email'])
    print(f"\n{with_email}/{len(clients)} clients have a valid email")

    print(f"\nInserting {len(clients)} clients into Supabase...")
    inserted = bulk_insert(clients)
    print(f"\nDone. {inserted}/{len(clients)} clients imported successfully.")


if __name__ == '__main__':
    main()
