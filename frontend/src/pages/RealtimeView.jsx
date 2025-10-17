import React, { useEffect, useState, useMemo } from "react";
import MetricCard from "../components/MetricCard";


// ✅ Formateador de moneda en pesos colombianos
function formatCurrency(value) {
  if (value == null || isNaN(value)) return "$0";
  return value.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function RealtimeView() {
  const [status, setStatus] = useState("Desconectado 🔴");
  const [messages, setMessages] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState(null);
  const [invoiceItems, setInvoicesItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/invoices/today")
    .then((res) =>res.json())
    .then((data) => {
      console.log("Facturas del dia cargadas:", data);
      setMessages(data);
    })
    .catch((err) => console.error("Error cargando facturas", err));
  }, []);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/invoices/today")
      .then((res) => res.json())
      .then((data) =>   {
        console.log(" Facturas del día cargadas:", data.length);
        setMessages(data);
         })
    const ws = new WebSocket("ws://127.0.0.1:8000/ws/FLO");

    ws.onopen = () => {
      setStatus("Conectado 🟢");
      console.log("✅ WebSocket conectado");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("📩 Mensaje recibido:", data);
      
      // verificacion dia factura
      const today = new Date().toISOString().slice(0, 10); // 2025-10-09
      const invoceDay = data.timestamp
        ? data.timestamp.slice(0, 10)
        : today;
      
      // si la factura es de otro dia se reinicia el listado  
      setMessages((prev) =>{
        if (prev.length > 0) {
          const firstDay = prev[0].timestamp
            ? prev[0].timestamp.slice(0, 10)
            : today;
          if (invoceDay !== firstDay) {
            console.log("Nuevo dia detectado - limpiando facturas antiguas");
            return [data];
          }
        }
        return [data, ...prev.slice(0, 5000)];
      });
      };

    ws.onclose = () => {
      setStatus("Desconectado 🔴");
      console.log("⚠️ WebSocket cerrado");
    };

    return () => ws.close();
  }, []);

  async function handleInvoiceClick(invoice_number) {
    if (selectedInvoices === invoice_number) {
      setSelectedInvoices(null);
      setInvoicesItems([]);
      return;
    }

    setLoadingItems(true);
    setSelectedInvoices(invoice_number);
    try {
      const res = await fetch(`http://127.0.0.1:8000/invoices/${invoice_number}/items`);
      const data = await res.json();
      if (data.items) {
        setInvoicesItems(data.items);
      } else {
        setInvoicesItems([]);
      }
    } catch (err) {
      console.error("error cargando items", err);
      setInvoicesItems([]);
    } finally {
      setLoadingItems(false);
    }
  }

  //  Cálculos en tiempo real (ventas totales, promedio, cantidad)
  const summary = useMemo(() => {
    if (messages.length === 0) return { total: 0, count: 0, avg: 0 };
    const total = messages.reduce((sum, f) => sum + (f.total || 0), 0);
    const count = messages.length;
    const avg = total / count;
    return { total, count, avg };
  }, [messages]);

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "Segoe UI, sans-serif",
        background: "#f8f9fa",
        minHeight: "100vh",
      }}
    >
      <p style={{ fontSize: "1.1rem" }}>
        Estado del servidor:{" "}
        <strong
          style={{
            color: status.includes("🟢") ? "green" : "red",
            fontWeight: "bold",
          }}
        >
          {status}
        </strong>
      </p>

      {/*  Metrics Cards */}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 mb-8 ">
        <MetricCard
        title = "Total Ventas"
        value = {formatCurrency(summary.total)}
        color = "text-green-600"
        />
        <MetricCard
        title = "Facturas"
        value = {summary.count}
        color = "text-blue-600"
        />
        <MetricCard
        title = "Promedio"
        value = {formatCurrency(summary.avg)}
        color = "text-yellow-500"
        />
      </div>

{/*  Listado de facturas */}
<h2> Últimas facturas procesadas:</h2>

{messages.length === 0 ? (
  <p>No hay facturas nuevas todavía...</p>
) : (
  <ul style={{ listStyle: "none", paddingLeft: 0 }}>
    {messages.map((msg, i) => (
      <li
        key={i}
        onClick={() => handleInvoiceClick(msg.invoice_number)}
        style={{
          padding: "10px 14px",
          marginBottom: "4px",
          borderBottom: "1px solid #e0e0e0",
          background:
          selectedInvoices === msg.invoice_number ? "#e9f5ff" : i % 2 === 0 ? "#fff" : "#f8f9fa",
          borderRadius: "6px",
          cursor: "pointer",
          display: "flex",
          transition: "background 0.2s",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Primera línea: número, total y hora */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontWeight: "bold",
              color: "#212529",
              flex: "1",
              minWidth: "90px",
            }}
          >
            {msg.invoice_number}
          </span>

          <span
            style={{
              color: "#007bff",
              fontWeight: "600",
              flex: "1",
              textAlign: "center",
            }}
          >
            {formatCurrency(msg.total)}
          </span>

          <span
            style={{
              color: "#666",
              fontSize: "0.95rem",
              flex: "1",
              textAlign: "right",
              minWidth: "120px",
            }}
          >
            {msg.invoice_date
              ? new Date(msg.invoice_date).toLocaleString("es-CO", {
                  dateStyle: "short",
                  timeStyle: "short",
                })
              : ""}
          </span>
        </div>

        {/* Segunda línea: ítems */}
        <div
          style={{
            color: "#888",
            fontSize: "0.9rem",
            marginTop: "4px",
            paddingLeft: "2px",
          }}
        >
          Ítems: <strong>{msg.items}</strong>
        </div>

        {/* items desplegables*/}
        {selectedInvoices === msg.invoice_number && (
          <div
            style={{
              marginTop: "8px",
              paddingLeft: "10px",
              fontSize: "0.95rem",
              color: "#333",
            }}
          >
            {loadingItems ? (
              <em>Cargando items...</em>
            ) : invoiceItems.length > 0 ? (
              <div 
                style={{
                  marginTop: "8px",
                  paddingLeft: "10px",
                  fontSize: "0.95rem",
                  color: "#333",
                  overflow: "hidden",
                  transition: "all 0.4s ease",
                  opacity: selectedInvoices === msg.invoice_number ? 1 : 0,
                  transform:
                    selectedInvoices === msg.invoice_number
                      ? "translateY(0px)"
                      : "translateY()"
                }}>
              <ul style={{ listStyle: "none", paddingLeft: 0, marginTop: "6px" }} >
                {/* Encabezados de las columnas */}
                <li style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 70px 100px 110px",
                  fontWeight: "600",
                  color: "#444",
                  borderBottom: "2px solid #ccc",
                  paddingBottom: "6px",
                  fontSize: "0.9rem",
                }} 
                >
                  <span>Producto</span>
                  <span style={{ textAlign: "right" }} >Cant.</span>
                  <span style={{ textAlign: "right" }} >Unitario</span>
                  <span style={{ textAlign: "right" }} >Subtotal</span>
                </li>

                {/* filas productos */}
                {invoiceItems.map((it,idx) => (
                  <li
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 70px 100px 110px",
                      alignItems: "center",
                      fontSize: "0.9rem",
                      color: "#333",
                      padding: "2px 0",
                      borderBottom: "1px solid #eee",
                    }}
                  >
                    <span style={{ paddingRight: "8px"}}> {it.description} </span>
                    <span style={{ textAlign: "right", color: "#666"}} >
                      {it.quantity.toFixed(2)}
                    </span>
                    <span style={{ textAlign: "right", color: "#666"}} >
                      {formatCurrency(it.unit_price)}
                    </span>
                    <span
                      style={{
                        textAlign: "right",
                        fontWeight: "600",
                        color: "#007bff"
                      }}
                    >
                      {formatCurrency(it.subtotal)}
                    </span>
                  </li>
                ))}

                {/* Total General */}
                <li
                  style={{
                    marginTop: "6px",
                    paddingTop: "6px",
                    borderTop: "2px solid #ccc",
                    display: "flex",
                    justifyContent: "space-between",
                    fontWeight: "bold",
                    color: "#222",
                    fontSize: "1rem"
                  }}
                  >
                    <span>Total items: {invoiceItems.length}</span>
                    <span>
                      Total factura:{" "}
                      <span style={{color: "#007bff"}} >
                        {formatCurrency(
                          invoiceItems.reduce((sum, i) => sum + (i.subtotal || 0), 0)
                        )}
                      </span>
                    </span>
                  </li>
              </ul>
              </div>
            ) : (
              <em>Sin items</em>
            )}
          </div>
        )}
      </li>
    ))}
  </ul>
)}

    </div>
  );
}

export default RealtimeView;
