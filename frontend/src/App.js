import React from "react";
import OrderBoard from "./components/OrderBoard";

export default function App(){
  return (
    <div style={{ padding: 20 }}>
      <h1>WhatsApp Orders Dashboard</h1>
      <OrderBoard />
    </div>
  );
}
