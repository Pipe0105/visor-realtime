import React, { useEffect, useState, useMemo } from "react";

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
        messagesRef.current = data;
         })
         .catch((err) => console.error("error cargando facturas", err));


    const ws = new WebSocket("ws://127.0.0.1:8000/ws/FLO");

    ws.onopen = () => {
      setStatus("Conectado 🟢");
      console.log("✅ WebSocket conectado");
    };

    // ref y throttle
    let timeout;
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
      <h1 style={{ color: "#222" }}>
         Visor Realtime —{" "}
        <span style={{ color: "#007bff" }}>FLORESTA</span>
      </h1>
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

      {/*  Resumen de ventas */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: "1rem 1.5rem",
            borderRadius: "12px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            flex: 1,
          }}
        >
          <h3 style={{ margin: 0, color: "#28a745" }}> Total Ventas</h3>
          <p style={{ fontSize: "1.4rem", fontWeight: "bold", margin: "0.5rem 0" }}>
            {formatCurrency(summary.total)}
          </p>
        </div>
        <div
          style={{
            background: "#fff",
            padding: "1rem 1.5rem",
            borderRadius: "12px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            flex: 1,
          }}
        >
          <h3 style={{ margin: 0, color: "#007bff" }}>🧾 Facturas</h3>
          <p style={{ fontSize: "1.4rem", fontWeight: "bold", margin: "0.5rem 0" }}>
            {summary.count}
          </p>
        </div>
        <div
          style={{
            background: "#fff",
            padding: "1rem 1.5rem",
            borderRadius: "12px",
            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            flex: 1,
          }}
        >
          <h3 style={{ margin: 0, color: "#ffc107" }}> Promedio</h3>
          <p style={{ fontSize: "1.4rem", fontWeight: "bold", margin: "0.5rem 0" }}>
            {formatCurrency(summary.avg)}
          </p>
        </div>
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
        style={{
          padding: "10px 14px",
          marginBottom: "4px",
          borderBottom: "1px solid #e0e0e0",
          background: i % 2 === 0 ? "#fff" : "#f8f9fa",
          borderRadius: "8px",
          display: "flex",
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
      </li>
    ))}
  </ul>
)}

    </div>
  );
}

export default RealtimeView;
