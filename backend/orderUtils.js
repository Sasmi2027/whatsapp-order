let orders = [];
let orderId = 1;


//
    
export function addOrder(from, order) {
    orders.push({
        id: orderId++,
        from,
        ...order
    });
}

export function getOrders() {
    return orders;
}
