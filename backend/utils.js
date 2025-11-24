// parsing + helpers (simple menu + parser)
export function parseOrderFromText(text) {
  if (!text) return null;
  const menu = {
    parota: 30,
    parotta: 30,
    parotta: 30,
    dosa: 40,
    idli: 20,
    biryani: 120,
    "fried rice": 90,
    rice: 90
  };

  const lower = text.toLowerCase();

  // try to find item and qty
  // strategy: find a menu item appears in text, then find a number near it; otherwise default qty=1
  for (const rawItem of Object.keys(menu)) {
    if (lower.includes(rawItem)) {
      // qty first: look for digits
      const digitMatch = lower.match(/(\d+)\s*(?=.+)/g) || lower.match(/(\d+)/);
      // sometimes user says "one", "two" etc. map words to digits
      const wordToNum = {
        one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
      };
      let qty = 1;
      // try digits
      const qtyMatchDigits = lower.match(new RegExp("(\\d+)\\s*(?=\\s*"+rawItem+")"));
      if (qtyMatchDigits && qtyMatchDigits[1]) qty = parseInt(qtyMatchDigits[1], 10);
      else {
        // try number words
        for (const w in wordToNum) {
          const re = new RegExp(`\\b${w}\\b\\s*(?=\\s*${rawItem})`);
          if (re.test(lower)) { qty = wordToNum[w]; break; }
        }
        // fallback: any digit anywhere
        if (qty === 1) {
          const anyDigit = lower.match(/(\d+)/);
          if (anyDigit) qty = parseInt(anyDigit[1], 10);
        }
      }
      const price = menu[rawItem];
      return { item: capitalizeWords(rawItem), quantity: qty, total: qty * price };
    }
  }
  return null;
}

export function formatOrderConfirmation(order) {
  return `✅ Order confirmed!\nOrder #${order.id}\n${order.quantity} × ${order.item}\nTotal: ₹${order.total}\nWe will notify you when ready.`;
}

function capitalizeWords(s) {
  return s.split(" ").map(p => p[0].toUpperCase()+p.slice(1)).join(" ");
}
