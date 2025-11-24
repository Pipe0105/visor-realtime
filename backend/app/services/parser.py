from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Union
import xml.etree.ElementTree as ET


NS = {
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
}


def _to_float(value: Optional[str]) -> float:
    if value is None:
        return 0.0

    value = value.strip()

    if not value:
        return 0.0

    try:
        return float(Decimal(value))
    except (InvalidOperation, ValueError):
        return 0.0


def _find_text(element: Optional[ET.Element], path: str) -> Optional[str]:
    if element is None:
        return None
    result = element.findtext(path, namespaces=NS)
    return result.strip() if result else None


def parse_invoice(content: Union[str, bytes]) -> dict:
    """Parsea una factura UBL 2.1 y retorna su información estructurada."""

    if isinstance(content, (bytes, bytearray)):
        source = content
    else:
        source = content.encode("utf-8")

    root = ET.fromstring(source)

    header: Dict[str, Optional[Union[str, float]]] = {}
    items: List[Dict[str, Optional[Union[str, float]]]] = []
    totals: Dict[str, float] = {}

    invoice_number = _find_text(root, "cbc:ID")
    if invoice_number:
        header["number"] = invoice_number

    currency = _find_text(root, "cbc:DocumentCurrencyCode")
    if currency:
        header["currency"] = currency

    issue_date = _find_text(root, "cbc:IssueDate")
    issue_time = _find_text(root, "cbc:IssueTime")
    if issue_date and issue_time:
        header["issue_date"] = f"{issue_date}T{issue_time}"
    elif issue_date:
        header["issue_date"] = issue_date

    if header.get("issue_date"):
        header["date"] = header["issue_date"]

    customer_party = root.find("cac:AccountingCustomerParty/cac:Party", namespaces=NS)
    supplier_party = root.find("cac:AccountingSupplierParty/cac:Party", namespaces=NS)

    customer_name = _find_text(customer_party, "cac:PartyName/cbc:Name") if customer_party is not None else None
    if customer_name:
        header["customer_name"] = customer_name

    customer_tax_id = _find_text(customer_party, "cac:PartyIdentification/cbc:ID") if customer_party is not None else None
    if customer_tax_id:
        header["customer_tax_id"] = customer_tax_id

    supplier_name = _find_text(supplier_party, "cac:PartyName/cbc:Name") if supplier_party is not None else None
    if supplier_name:
        header["supplier_name"] = supplier_name

    payable_amount_el = root.find("cac:LegalMonetaryTotal/cbc:PayableAmount", namespaces=NS)
    if payable_amount_el is not None and payable_amount_el.text:
        totals["total"] = _to_float(payable_amount_el.text)
        header["total_payable"] = totals["total"]
        if currency is None:
            currency_attr = payable_amount_el.get("currencyID")
            if currency_attr:
                header["currency"] = currency_attr

    line_extension_el = root.find("cac:LegalMonetaryTotal/cbc:LineExtensionAmount", namespaces=NS)
    if line_extension_el is not None and line_extension_el.text:
        totals["subtotal"] = _to_float(line_extension_el.text)

    allowance_el = root.find("cac:LegalMonetaryTotal/cbc:AllowanceTotalAmount", namespaces=NS)
    if allowance_el is not None and allowance_el.text:
        totals["discount"] = _to_float(allowance_el.text)

    tax_total_amount = 0.0
    for tax_total in root.findall("cac:TaxTotal", namespaces=NS):
        tax_total_amount += _to_float(_find_text(tax_total, "cbc:TaxAmount"))
    if tax_total_amount:
        totals["iva"] = tax_total_amount

    if "total" not in totals:
        totals["total"] = totals.get("subtotal", 0.0) + totals.get("iva", 0.0) - totals.get("discount", 0.0)

    for line in root.findall("cac:InvoiceLine", namespaces=NS):
        line_number_text = _find_text(line, "cbc:ID")
        try:
            line_number = int(line_number_text) if line_number_text else len(items) + 1
        except ValueError:
            line_number = len(items) + 1

        quantity_el = line.find("cbc:InvoicedQuantity", namespaces=NS)
        quantity = _to_float(quantity_el.text) if quantity_el is not None and quantity_el.text else 0.0
        unit_code = quantity_el.get("unitCode") if quantity_el is not None else None

        product_code = _find_text(line, "cac:Item/cac:StandardItemIdentification/cbc:ID")
        if product_code is None:
            product_code = _find_text(line, "cac:Item/cbc:Name")

        description = _find_text(line, "cac:Item/cbc:Description")
        if description is None:
            description = _find_text(line, "cac:Item/cbc:Name")

        unit_price = _to_float(_find_text(line, "cac:Price/cbc:PriceAmount"))
        line_extension_amount = _to_float(_find_text(line, "cbc:LineExtensionAmount"))

        iva_percent = None
        iva_amount = 0.0
        for tax_subtotal in line.findall("cac:TaxTotal/cac:TaxSubtotal", namespaces=NS):
            percent_text = _find_text(tax_subtotal, "cac:TaxCategory/cbc:Percent")
            if iva_percent is None and percent_text is not None:
                try:
                    iva_percent = float(Decimal(percent_text))
                except (InvalidOperation, ValueError):
                    iva_percent = 0.0
            iva_amount += _to_float(_find_text(tax_subtotal, "cbc:TaxAmount"))

        item_data: Dict[str, Optional[Union[str, float]]] = {
            "line_number": line_number,
            "product_code": product_code,
            "description": description,
            "unit": unit_code,
            "quantity": quantity,
            "unit_price": unit_price,
            "subtotal": line_extension_amount,
            "iva_percent": iva_percent if iva_percent is not None else 0.0,
            "iva_amount": iva_amount,
        }

        items.append(item_data)

    return {"header": header, "items": items, "totals": totals}