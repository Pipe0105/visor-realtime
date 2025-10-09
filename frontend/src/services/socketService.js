// src/services/socketService.js
export function connectToBranch(branchCode, onMessage) {
  const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${branchCode}`);

  ws.onopen = () => {
    console.log(` Connected to branch ${branchCode}`);
  };

  ws.onclose = () => {
    console.log(` Disconnected from branch ${branchCode}`);
  };

  ws.onerror = (err) => {
    console.error(" WebSocket error:", err);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onMessage) onMessage(data);
    } catch (e) {
      console.warn("Unknown message:", event.data);
    }
  };

  return ws;
}
