import re


def clean_number(value: str) -> float:
    """Convierte números colombianos como '1.234,56' o '1,234.56' a float seguro."""
    if not value:
        return 0.0

    value = value.strip()

    # Elimina todo lo que no sea número, coma o punto
    value = re.sub(r"[^\d,\.]", "", value)

    # Si hay ambos símbolos (coma y punto)
    if "," in value and "." in value:
        if value.find(",") > value.find("."):
            # Ej: 1.234,56 → 1234.56
            value = value.replace(".", "").replace(",", ".")
        else:
            # Ej: 1,234.56 → 1234.56
            value = value.replace(",", "")
    elif "," in value:
        # Si solo hay coma, se asume decimal (colombiano)
        value = value.replace(",", ".")
    elif "." in value:
        # Si solo hay punto, se asume decimal (anglosajón)
        pass

    try:
        return float(value)
    except ValueError:
        return 0.0


def parse_invoice(content: str) -> dict:
    lines = content.splitlines()
    header, items, totals = {}, [], {}

    # === (Opcional) Header si el P02 trae "Numero:" y "Fecha:" ===
    for line in lines:
        if "Numero" in line and "number" not in header:
            m = re.search(r"Numero\s*:\s*([0-9A-Z]+)", line, re.IGNORECASE)
            if m:
                header["number"] = m.group(1).strip()
        if "Fecha" in line and "date" not in header:
            m = re.search(r"Fecha\s*:\s*([0-9A-Z\-: ]+)", line, re.IGNORECASE)
            if m:
                header["date"] = m.group(1).strip()

    # === ÍTEMS ===
    # Patrón robusto: tolera espacios variables, IVA con/sin '*', y unidades en mayúsc/minúsc.
    item_pattern = re.compile(
        r"""
        ^\|\s*
        (?P<line>\d{1,4})\s+                 # N° de línea (001, 015, etc.)
        (?P<code>\d{3,10})\s+                # Código producto
        (?P<desc>[^|]+?)\s{2,}               # Descripción (no cruza '|'), al menos 2 espacios antes de unidad
        (?P<unit>[A-Za-z]{1,5})\s+           # Unidad (kg, KG, UND, und...)
        (?P<qty>[.\d,]+)\s+                  # Cantidad (.565, 1.040, 2,000.00)
        (?P<unit_price>[.\d,]+)\s+           # Precio unitario (1,590.00)
        (?P<iva>[.\d,]+)\s*\*?\s+            # IVA (19.00* / 19.00 * / 0.00)
        (?P<subtotal>[.\d,]+)\s*             # Subtotal/Base (11,130.00)
        \|$
        """,
        re.VERBOSE | re.IGNORECASE
    )

    for line in lines:
        # Saltar líneas de paginado
        if "|Reg.|" in line or "* V I E N E *" in line or "* P A S A *" in line:
            continue

        m = item_pattern.search(line)
        if m:
            items.append({
                "line_number": int(m.group("line")),
                "product_code": m.group("code").strip(),
                "description": m.group("desc").strip(),
                "unit": m.group("unit").strip(),
                "quantity": clean_number(m.group("qty")),
                "unit_price": clean_number(m.group("unit_price")),
                "iva": clean_number(m.group("iva")),
                "subtotal": clean_number(m.group("subtotal")),
            })

    # === TOTALES (al pie) ===
    for line in reversed(lines):
        if "TOTAL A PAGAR" in line and "RETENCIONES" not in line and "total" not in totals:
            m = re.search(r"TOTAL A PAGAR\s+([\d.,]+)", line)
            if m:
                totals["total"] = clean_number(m.group(1))
        if "SUBTOTAL" in line and "subtotal" not in totals:
            m = re.search(r"SUBTOTAL\s+([\d.,]+)", line)
            if m:
                totals["subtotal"] = clean_number(m.group(1))
        if "IMPUESTOS" in line and "iva" not in totals:
            m = re.search(r"IMPUESTOS\s+([\d.,]+)", line)
            if m:
                totals["iva"] = clean_number(m.group(1))
        if "DESCUENTO" in line and "discount" not in totals:
            m = re.search(r"DESCUENTO\s+([\d.,]+)", line)
            if m:
                totals["discount"] = clean_number(m.group(1))
        if len(totals) >= 4:
            break

    # Nota: si tu pipeline toma el número de factura del *nombre de archivo*, está bien que header["number"] no venga.
    if not items:
        print("⚠️ Advertencia: no se detectaron ítems con el patrón actual.")

    return {"header": header, "items": items, "totals": totals}
