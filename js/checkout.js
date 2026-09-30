(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const cfg = window.SITE_CONFIG;
  const COD_LIMIT = 10000;
  let customer = null;

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function setStep(n) {
    $$(".step-panel").forEach((p) => (p.hidden = +p.dataset.panel !== n));
    $$("#progress li").forEach((li) => {
      li.classList.toggle("active", +li.dataset.step === n);
      li.classList.toggle("done", +li.dataset.step < n);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---------- Summary ----------
  function renderSummary(items = Cart.items(), totals = Cart.totals()) {
    $("#summaryItems").innerHTML = items
      .map(
        (i) => `<div class="sum-item">
          <div><strong>${escapeHtml(i.name)}</strong><span class="muted small">${escapeHtml(i.size)} · ${i.qty.toLocaleString("en-IN")} pcs${i.custom ? " · custom print" : ""}</span></div>
          <span>${Cart.format(i.price * i.qty)}</span>
        </div>`
      )
      .join("");
    $("#sumSubtotal").textContent = Cart.format(totals.subtotal);
    $("#sumGst").textContent = Cart.format(totals.gst);
    $("#sumDelivery").textContent = totals.delivery ? Cart.format(totals.delivery) : "Free";
    $("#sumTotal").textContent = Cart.format(totals.total);
    $$(".pay-amount").forEach((el) => (el.textContent = Cart.format(totals.total)));
  }

  // ---------- Step 1 ----------
  $("#detailsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.checkValidity()) {
      $("#detailsMsg").textContent = "Please fill in all required fields correctly (6-digit PIN, valid phone and email).";
      f.reportValidity();
      return;
    }
    $("#detailsMsg").textContent = "";
    customer = Object.fromEntries(new FormData(f).entries());
    $("#deliverTo").textContent = `Delivering to ${customer.name}, ${customer.address}, ${customer.city} – ${customer.pin}`;
    setupPayment();
    setStep(2);
  });

  $("#backToDetails").addEventListener("click", () => setStep(1));

  // ---------- Step 2 ----------
  function upiUri(amount, orderId) {
    const params = new URLSearchParams({
      pa: cfg.upiId,
      pn: cfg.businessName,
      am: amount.toFixed(2),
      cu: "INR",
      tn: `Order ${orderId}`,
    });
    return `upi://pay?${params.toString()}`;
  }

  let pendingOrderId = null;

  function setupPayment() {
    const { total } = Cart.totals();
    pendingOrderId = pendingOrderId || "TEP" + Date.now().toString().slice(-8);
    const uri = upiUri(total, pendingOrderId);
    $("#upiId").textContent = cfg.upiId;
    $("#upiLink").href = uri;
    const qr = $("#upiQr");
    qr.innerHTML = "";
    if (window.QRCode) {
      new QRCode(qr, { text: uri, width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
    } else {
      qr.textContent = "QR unavailable — use the UPI ID";
    }

    $("#demoNote").textContent = cfg.razorpayKeyId
      ? ""
      : "Demo mode: no Razorpay key is configured, so this will simulate a successful payment.";

    const hasCustom = Cart.items().some((i) => i.custom);
    const codInput = $('input[value="cod"]');
    const codAllowed = !hasCustom && total <= COD_LIMIT;
    codInput.disabled = !codAllowed;
    codInput.closest(".pay-option").classList.toggle("disabled", !codAllowed);
    if (!codAllowed && codInput.checked) $('input[value="upi"]').checked = true;
    showMethod();
  }

  function method() {
    return $('input[name="pay"]:checked').value;
  }

  function showMethod() {
    const m = method();
    $$(".pay-detail").forEach((d) => (d.hidden = d.dataset.method !== m));
    $$(".pay-option").forEach((o) => o.classList.toggle("selected", o.querySelector("input").checked));
    const amount = Cart.format(Cart.totals().total);
    $("#payBtn").innerHTML =
      m === "cod" ? "Place order" : m === "upi" || m === "bank" ? "I've paid — place order" : `Pay ${amount}`;
  }

  $$('input[name="pay"]').forEach((r) => r.addEventListener("change", showMethod));

  $("#payBtn").addEventListener("click", () => {
    const msg = $("#payMsg");
    msg.textContent = "";
    if (!$("#agree").checked) return (msg.textContent = "Please confirm the order details to continue.");

    const m = method();
    if (m === "upi") {
      const utr = $("#utr").value.trim();
      if (!/^\d{12}$/.test(utr)) return (msg.textContent = "Enter the 12-digit UPI transaction ID (UTR) from your payment app.");
      return completeOrder({ method: "UPI", reference: utr, status: "Payment verification pending" });
    }
    if (m === "bank") {
      const ref = $("#bankRef").value.trim();
      if (ref.length < 6) return (msg.textContent = "Enter the bank transfer reference number.");
      return completeOrder({ method: "Bank transfer", reference: ref, status: "Payment verification pending" });
    }
    if (m === "cod") {
      return completeOrder({ method: "Cash on delivery", reference: "—", status: "To be paid on delivery" });
    }
    payOnline();
  });

  function payOnline() {
    const { total } = Cart.totals();
    const btn = $("#payBtn");

    if (!cfg.razorpayKeyId) {
      // Demo: simulate the gateway so the full flow can be tested without an account.
      btn.disabled = true;
      btn.textContent = "Processing payment…";
      setTimeout(() => {
        btn.disabled = false;
        completeOrder({ method: "Card / Net banking (demo)", reference: "demo_" + Date.now().toString(36), status: "Paid" });
      }, 1400);
      return;
    }

    loadScript("https://checkout.razorpay.com/v1/checkout.js")
      .then(() => {
        const rzp = new window.Razorpay({
          key: cfg.razorpayKeyId,
          amount: Math.round(total * 100), // paise
          currency: "INR",
          name: cfg.businessName,
          description: `Order ${pendingOrderId}`,
          // order_id: "<order id created by your backend>",
          prefill: { name: customer.name, email: customer.email, contact: customer.phone },
          notes: { order: pendingOrderId },
          theme: { color: "#2f7a4f" },
          handler: (res) =>
            completeOrder({ method: "Razorpay", reference: res.razorpay_payment_id, status: "Paid" }),
        });
        rzp.on("payment.failed", (r) => ($("#payMsg").textContent = "Payment failed: " + r.error.description));
        rzp.open();
      })
      .catch(() => ($("#payMsg").textContent = "Could not load the payment gateway. Check your connection and try again."));
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ---------- Step 3 ----------
  function completeOrder(payment) {
    const items = Cart.items();
    const totals = Cart.totals();
    const order = {
      id: pendingOrderId,
      placedAt: new Date().toISOString(),
      customer,
      items,
      totals,
      payment,
    };
    try {
      const orders = JSON.parse(localStorage.getItem("talari_orders") || "[]");
      orders.push(order);
      localStorage.setItem("talari_orders", JSON.stringify(orders));
    } catch (e) {
      /* ignore */
    }

    Cart.clear();
    renderSummary(items, totals); // keep the paid order visible in the summary

    const paid = payment.status === "Paid";
    $("#confirmTitle").textContent = paid ? "Payment successful — order confirmed!" : "Order placed!";
    $("#confirmText").textContent = paid
      ? `Thank you, ${customer.name}. We've received your payment and started processing your order. A confirmation will be sent to ${customer.email}.`
      : `Thank you, ${customer.name}. Your order is booked. ${payment.status === "To be paid on delivery" ? "Please keep the amount ready at delivery." : "We'll confirm once your payment is verified (usually within a few hours)."}`;
    const rows = [
      ["Order ID", order.id],
      ["Amount", Cart.format(totals.total)],
      ["Payment", payment.method],
      ["Reference", payment.reference],
      ["Status", payment.status],
    ];
    if (items.some((i) => i.custom)) rows.push(["Design proof", "Sent to your email/WhatsApp within 24 hours"]);
    $("#confirmMeta").innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join("");
    setStep(3);
  }

  // ---------- Init ----------
  if (!Cart.count()) {
    $("#detailsForm").hidden = true;
    $("#summary").hidden = true;
    $("#progress").hidden = true;
    $("#emptyState").hidden = false;
    $("#checkoutGrid").classList.add("single");
  } else {
    renderSummary();
  }
})();
