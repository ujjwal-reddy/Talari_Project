// Cart stored in the browser so it survives page reloads and carries over to checkout.
(function () {
  const KEY = "talari_cart_v1";

  function read() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
      /* storage unavailable — cart lives for this page only */
    }
    document.dispatchEvent(new CustomEvent("cart:change"));
  }

  const money = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: (window.SITE_CONFIG && SITE_CONFIG.currency) || "INR",
    maximumFractionDigits: 2,
  });

  window.Cart = {
    items: read,
    format: (n) => money.format(n),

    add(item) {
      const items = read();
      // Merge with an identical line (same product, size and customisation).
      const key = JSON.stringify([item.productId, item.size, item.custom || null]);
      const existing = items.find(
        (i) => JSON.stringify([i.productId, i.size, i.custom || null]) === key
      );
      if (existing) existing.qty += item.qty;
      else items.push({ ...item, lineId: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
      write(items);
    },

    setQty(lineId, qty) {
      const items = read();
      const line = items.find((i) => i.lineId === lineId);
      if (!line) return;
      line.qty = Math.max(line.minQty || 1, qty);
      write(items);
    },

    remove(lineId) {
      write(read().filter((i) => i.lineId !== lineId));
    },

    clear() {
      write([]);
    },

    count() {
      return read().length;
    },

    totals() {
      const cfg = window.SITE_CONFIG;
      const subtotal = read().reduce((sum, i) => sum + i.price * i.qty, 0);
      const delivery = subtotal === 0 || subtotal >= cfg.freeDeliveryAbove ? 0 : cfg.deliveryCharge;
      const gst = Math.round(subtotal * cfg.gstRate * 100) / 100;
      const total = Math.round((subtotal + gst + delivery) * 100) / 100;
      return { subtotal, gst, delivery, total };
    },
  };
})();
