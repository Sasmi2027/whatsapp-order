import React, { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

const menu = {
  parota: 30,
  parotta: 30,
  dosa: 40,
  idli: 20,
  biryani: 120,
  "fried rice": 90,
  rice: 90,
};

export default function OrderBoard() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem("messages");
    return saved ? JSON.parse(saved) : [];
  });

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem("orders");
    return saved ? JSON.parse(saved) : [];
  });

  // Fetch all orders on mount and merge with saved orders (avoid duplicates)
useEffect(() => {
  fetch("http://localhost:5000/api/orders")
    .then((r) => r.json())
    .then((fetchedOrders) => {
      if (fetchedOrders.length > 0) {
        setOrders((prevOrders) => {
          // merge saved orders and fetched orders without duplicates
          const combined = [...fetchedOrders, ...prevOrders];
          const unique = combined.filter(
            (order, index, self) =>
              index === self.findIndex((o) => o.id === order.id)
          );
          return unique;
        });
      }
    })
    .catch(console.error);
}, []);


  // Save messages and orders to localStorage when they change
  useEffect(() => {
    localStorage.setItem("messages", JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("orders", JSON.stringify(orders));
  }, [orders]);

  // Listen to live socket events and keep all orders (no duplicates)
  useEffect(() => {
    socket.on("message", (m) => {
      setMessages((prev) => [m, ...prev].slice(0, 50));
    });

    socket.on("order", (newOrder) => {
      setOrders((prevOrders) => {
        if (prevOrders.some((order) => order.id === newOrder.id)) {
          return prevOrders; // ignore duplicates
        }
        return [newOrder, ...prevOrders];
      });
    });

    return () => {
      socket.off("message");
      socket.off("order");
    };
  }, []);

  // Clear old data function
  const clearOldData = () => {
    localStorage.removeItem("messages");
    localStorage.removeItem("orders");
    setMessages([]);
    setOrders([]);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 20,
        fontFamily: "Arial, sans-serif",
        padding: 20,
        height: 550,
      }}
    >
      {/* Menu Panel */}
      <div
        style={{
          width: 220,
          background: "#f0f0f0",
          borderRadius: 8,
          boxShadow: "0 0 8px rgba(0,0,0,0.05)",
          padding: 15,
          overflowY: "auto",
        }}
      >
        <h3
          style={{
            marginTop: 0,
            borderBottom: "1px solid #ddd",
            paddingBottom: 10,
          }}
        >
          Menu
        </h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {Object.entries(menu).map(([item, price]) => (
            <li
              key={item}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #ddd",
                textTransform: "capitalize",
              }}
            >
              <span>{item}</span>
              <span>₹{price}</span>
            </li>
          ))}
        </ul>

        {/* Clear Data Button */}
        <button
          onClick={clearOldData}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "10px",
            backgroundColor: "#d9534f",
            color: "white",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          Clear Old Data
        </button>
      </div>

      {/* Incoming Messages Panel */}
      <div
        style={{
          flex: 1,
          background: "#f9f9f9",
          borderRadius: 8,
          boxShadow: "0 0 8px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "100%",
        }}
      >
        <h3
          style={{
            padding: "10px 15px",
            borderBottom: "1px solid #ddd",
            margin: 0,
          }}
        >
          Incoming Messages
        </h3>
        <div
          style={{ overflowY: "auto", padding: 15, flexGrow: 1 }}
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div style={{ color: "#999", fontStyle: "italic" }}>
              No messages yet.
            </div>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid #eee",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#666",
                    marginBottom: 4,
                    wordBreak: "break-word",
                  }}
                >
                  {m.from}
                </div>
                <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Latest Orders Panel */}
      <div
        style={{
          width: 380,
          background: "#fefefe",
          borderRadius: 8,
          boxShadow: "0 0 8px rgba(0,0,0,0.05)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "100%",
        }}
      >
        <h3
          style={{
            padding: "10px 15px",
            borderBottom: "1px solid #ddd",
            margin: 0,
          }}
        >
          Latest Orders
        </h3>
        <div
          style={{ overflowY: "auto", padding: 15, flexGrow: 1 }}
          aria-live="polite"
        >
          {orders.length === 0 ? (
            <div style={{ color: "#999", fontStyle: "italic" }}>
              No orders yet.
            </div>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                style={{
                  paddingBottom: 12,
                  borderBottom: "1px solid #eee",
                  wordBreak: "break-word",
                }}
              >
                <div
                  style={{
                    fontWeight: "bold",
                    fontSize: 16,
                    marginBottom: 6,
                  }}
                >
                  #{o.id} — {o.item} × {o.quantity}
                </div>
                <div style={{ color: "#444", marginBottom: 4 }}>
                  From: {o.from}
                </div>
                <div style={{ color: "#444", marginBottom: 4 }}>
                  Total: ₹{o.total}
                </div>
                <div style={{ fontSize: 12, color: "#999" }}>
                  {new Date(o.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
