// very simple in-memory order store (for demo). Replace with DB as needed.
let orders = [];
let nextId = 1;

export function addOrder({ from, item, quantity, total }) {
  const order = { id: nextId++, from, item, quantity, total, createdAt: new Date().toISOString() };
  orders.push(order);
  return order;
}

export function getOrders() {
  return orders.slice().reverse(); // latest first
}



// import fs from "fs";
// const filePath = "./orders.json";

// let orders = [];
// try {
//   const data = fs.readFileSync(filePath, "utf-8");
//   orders = JSON.parse(data);
// } catch {
//   orders = [];
// }

// export function addOrder(order) {
//   order.id = orders.length + 1;
//   order.createdAt = new Date().toISOString();
//   orders.push(order);
//   fs.writeFileSync(filePath, JSON.stringify(orders, null, 2));
//   return order;
// }

// export function getOrders() {
//   return orders;
// }
