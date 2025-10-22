import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.services.file_reader import _is_valid_invoice_file
from app.services.parser import parse_invoice


SAMPLE_XML = """<?xml version=\"1.0\" encoding=\"UTF-8\"?>
<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"
         xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\"
         xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">
  <cbc:ID>INV-001</cbc:ID>
  <cbc:IssueDate>2023-10-05</cbc:IssueDate>
  <cbc:DocumentCurrencyCode>COP</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>Proveedor S.A.</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>900123456</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>Cliente SAS</cbc:Name>
      </cac:PartyName>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount>38.00</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount>200.00</cbc:LineExtensionAmount>
    <cbc:PayableAmount currencyID=\"COP\">238.00</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode=\"EA\">2</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount>200.00</cbc:LineExtensionAmount>
    <cac:Item>
      <cac:StandardItemIdentification>
        <cbc:ID>SKU-01</cbc:ID>
      </cac:StandardItemIdentification>
      <cbc:Description>Producto prueba</cbc:Description>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount>100.00</cbc:PriceAmount>
    </cac:Price>
    <cac:TaxTotal>
      <cac:TaxSubtotal>
        <cbc:TaxAmount>38.00</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:Percent>19</cbc:Percent>
        </cac:TaxCategory>
      </cac:TaxSubtotal>
    </cac:TaxTotal>
  </cac:InvoiceLine>
</Invoice>
"""


def test_parse_invoice_header_and_totals():
    parsed = parse_invoice(SAMPLE_XML)
    header = parsed["header"]
    totals = parsed["totals"]

    assert header["number"] == "INV-001"
    assert header["issue_date"] == "2023-10-05"
    assert header["currency"] == "COP"
    assert header["customer_name"] == "Cliente SAS"
    assert header["customer_tax_id"] == "900123456"
    assert header["supplier_name"] == "Proveedor S.A."

    assert totals["subtotal"] == pytest.approx(200.0)
    assert totals["iva"] == pytest.approx(38.0)
    assert totals["total"] == pytest.approx(238.0)


def test_parse_invoice_items():
    parsed = parse_invoice(SAMPLE_XML)
    items = parsed["items"]

    assert len(items) == 1
    item = items[0]
    assert item["line_number"] == 1
    assert item["product_code"] == "SKU-01"
    assert item["description"] == "Producto prueba"
    assert item["unit"] == "EA"
    assert item["quantity"] == pytest.approx(2.0)
    assert item["unit_price"] == pytest.approx(100.0)
    assert item["subtotal"] == pytest.approx(200.0)
    assert item["iva_percent"] == pytest.approx(19.0)
    assert item["iva_amount"] == pytest.approx(38.0)


def test_is_valid_invoice_file_accepts_single_xml_extension():
    assert _is_valid_invoice_file("010012W12345.xml") is True


def test_is_valid_invoice_file_rejects_double_extension_and_prefix():
    assert _is_valid_invoice_file("010012W12345.xml.xml") is False
    assert _is_valid_invoice_file("99999W12345.xml") is False
    assert _is_valid_invoice_file("010012W12345.txt") is False