(function () {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const cfg = window.SITE_CONFIG;
  let activeCat = "all";

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove("show"), 2400);
  }

  // ---------- Product catalogue ----------
  function renderFilters() {
    $("#filters").innerHTML = CATEGORIES.map(
      (c) => `<button role="tab" class="chip${c.id === activeCat ? " active" : ""}" data-cat="${c.id}" aria-selected="${c.id === activeCat}">${c.label}</button>`
    ).join("");
  }

  function renderProducts() {
    const list = PRODUCTS.filter((p) => activeCat === "all" || p.category === activeCat);
    $("#productGrid").innerHTML = list
      .map((p) => {
        const tag =
          p.category === "bio" ? '<span class="tag eco">Biodegradable</span>' :
          p.customisable ? '<span class="tag">Customisable</span>' : "";
        return `
        <article class="product card" data-id="${p.id}">
          <div class="product-art">${PRODUCT_ICONS[p.icon]}${tag}</div>
          <div class="product-body">
            <h3>${p.name}</h3>
            <p class="muted">${p.desc}</p>
            <label class="small">Size
              <select class="size">${p.sizes
                .map((s, i) => `<option value="${i}">${s.label} — ${Cart.format(s.price)}/pc</option>`)
                .join("")}</select>
            </label>
            <div class="buy-row">
              <div class="qty">
                <button type="button" class="step" data-step="-1" aria-label="Decrease">−</button>
                <input type="number" class="qty-input" min="${p.minQty}" step="${p.minQty}" value="${p.minQty}" aria-label="Quantity" />
                <button type="button" class="step" data-step="1" aria-label="Increase">+</button>
              </div>
              <strong class="line-price"></strong>
            </div>
            <p class="small muted">Minimum order: ${p.minQty} pcs</p>
            ${
              p.customisable
                ? `<a href="#custom" class="btn btn-ghost full customise" data-id="${p.id}">Customise design</a>`
                : `<button type="button" class="btn btn-primary full add">Add to order</button>`
            }
          </div>
        </article>`;
      })
      .join("");
    $$(".product").forEach(updateLinePrice);
  }

  function updateLinePrice(card) {
    const p = PRODUCTS.find((x) => x.id === card.dataset.id);
    const size = p.sizes[+$(".size", card).value];
    const qty = Math.max(0, parseInt($(".qty-input", card).value, 10) || 0);
    $(".line-price", card).textContent = Cart.format(size.price * qty);
  }

  function bindProducts() {
    $("#filters").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      activeCat = btn.dataset.cat;
      renderFilters();
      renderProducts();
    });

    // Category shortcuts elsewhere on the page.
    $$('a[data-cat]').forEach((a) =>
      a.addEventListener("click", () => {
        activeCat = a.dataset.cat;
        renderFilters();
        renderProducts();
      })
    );

    const grid = $("#productGrid");
    grid.addEventListener("input", (e) => {
      const card = e.target.closest(".product");
      if (card) updateLinePrice(card);
    });
    grid.addEventListener("change", (e) => {
      const card = e.target.closest(".product");
      if (card) updateLinePrice(card);
    });
    grid.addEventListener("click", (e) => {
      const card = e.target.closest(".product");
      if (!card) return;
      const p = PRODUCTS.find((x) => x.id === card.dataset.id);
      const input = $(".qty-input", card);

      if (e.target.matches(".step")) {
        const next = (parseInt(input.value, 10) || 0) + p.minQty * +e.target.dataset.step;
        input.value = Math.max(p.minQty, next);
        updateLinePrice(card);
      }

      if (e.target.matches(".customise")) {
        $("#customProduct").value = p.id;
        fillCustomSizes();
        $("#customSize").value = $(".size", card).value;
        updateEstimate();
      }

      if (e.target.matches(".add")) {
        const qty = parseInt(input.value, 10) || 0;
        if (qty < p.minQty) {
          input.value = p.minQty;
          updateLinePrice(card);
          return toast(`Minimum order for ${p.name} is ${p.minQty} pcs`);
        }
        const size = p.sizes[+$(".size", card).value];
        Cart.add({ productId: p.id, name: p.name, size: size.label, price: size.price, qty, minQty: p.minQty });
        toast(`Added ${qty} × ${p.name} (${size.label})`);
      }
    });
  }

  // ---------- Custom order form ----------
  const customProducts = () => PRODUCTS.filter((p) => p.customisable);

  function fillCustomSizes() {
    const p = PRODUCTS.find((x) => x.id === $("#customProduct").value);
    $("#customSize").innerHTML = p.sizes
      .map((s, i) => `<option value="${i}">${s.label} — ${Cart.format(s.price)}/pc</option>`)
      .join("");
    $("#customQty").min = p.minQty;
  }

  const COLOUR_SURCHARGE = { "1 colour": 0, "2 colours": 0.3, "Full colour": 0.6 };

  function customPrice() {
    const form = $("#customForm");
    const p = PRODUCTS.find((x) => x.id === form.product.value);
    const size = p.sizes[+form.size.value];
    return { p, size, unit: size.price + (COLOUR_SURCHARGE[form.colours.value] || 0) };
  }

  function updateEstimate() {
    const { unit } = customPrice();
    const qty = parseInt($("#customQty").value, 10) || 0;
    $("#customEstimate").textContent = `${Cart.format(unit * qty)} (${Cart.format(unit)}/pc)`;
  }

  function bindCustomForm() {
    $("#customProduct").innerHTML = customProducts()
      .map((p) => `<option value="${p.id}">${p.name}</option>`)
      .join("");
    fillCustomSizes();
    updateEstimate();

    const form = $("#customForm");
    form.addEventListener("change", (e) => {
      if (e.target.name === "product") fillCustomSizes();
      updateEstimate();
    });
    form.addEventListener("input", updateEstimate);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const msg = $("#customMsg");
      const { p, size, unit } = customPrice();
      const qty = parseInt(form.qty.value, 10) || 0;
      if (qty < p.minQty) {
        msg.textContent = `Minimum quantity for custom printing is ${p.minQty} pcs.`;
        msg.className = "form-msg error";
        return;
      }
      const file = form.artwork.files[0];
      Cart.add({
        productId: p.id,
        name: p.name,
        size: size.label,
        price: unit,
        qty,
        minQty: p.minQty,
        custom: {
          colours: form.colours.value,
          printText: form.printText.value.trim(),
          eventDate: form.eventDate.value,
          artwork: file ? file.name : "",
          notes: form.notes.value.trim(),
        },
      });
      msg.textContent = "Added to your order. We'll send a design proof after checkout.";
      msg.className = "form-msg ok";
      toast("Custom order added to cart");
      openCart();
    });
  }

  // ---------- Cart drawer ----------
  function renderCart() {
    const items = Cart.items();
    $("#cartCount").textContent = items.length;
    $("#cartSubtotal").textContent = Cart.format(Cart.totals().subtotal);
    $("#checkoutBtn").classList.toggle("disabled", items.length === 0);

    if (!items.length) {
      $("#cartItems").innerHTML = `<div class="empty"><p>Your cart is empty.</p><a href="#products" class="btn btn-ghost" data-close>Browse products</a></div>`;
      return;
    }
    $("#cartItems").innerHTML = items
      .map(
        (i) => `
      <div class="cart-line" data-line="${i.lineId}">
        <div class="cart-line-info">
          <strong>${escapeHtml(i.name)}</strong>
          <span class="muted small">${escapeHtml(i.size)} · ${Cart.format(i.price)}/pc</span>
          ${i.custom ? `<span class="small tag-inline">Custom: ${escapeHtml(i.custom.colours)}${i.custom.printText ? " · “" + escapeHtml(i.custom.printText) + "”" : ""}</span>` : ""}
          <div class="qty small-qty">
            <button type="button" class="step" data-dir="-1" aria-label="Decrease">−</button>
            <input type="number" value="${i.qty}" min="${i.minQty}" step="${i.minQty}" aria-label="Quantity" />
            <button type="button" class="step" data-dir="1" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="cart-line-side">
          <strong>${Cart.format(i.price * i.qty)}</strong>
          <button class="link remove">Remove</button>
        </div>
      </div>`
      )
      .join("");
  }

  function openCart() {
    $("#cartDrawer").classList.add("open");
    $("#cartDrawer").setAttribute("aria-hidden", "false");
    $("#drawerBackdrop").hidden = false;
  }
  function closeCart() {
    $("#cartDrawer").classList.remove("open");
    $("#cartDrawer").setAttribute("aria-hidden", "true");
    $("#drawerBackdrop").hidden = true;
  }

  function bindCart() {
    $("#cartOpen").addEventListener("click", openCart);
    $("#cartClose").addEventListener("click", closeCart);
    $("#drawerBackdrop").addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => e.key === "Escape" && closeCart());
    document.addEventListener("cart:change", renderCart);

    $("#cartItems").addEventListener("click", (e) => {
      if (e.target.closest("[data-close]")) return closeCart();
      const line = e.target.closest(".cart-line");
      if (!line) return;
      const item = Cart.items().find((i) => i.lineId === line.dataset.line);
      if (e.target.matches(".remove")) Cart.remove(item.lineId);
      if (e.target.matches(".step")) Cart.setQty(item.lineId, item.qty + item.minQty * +e.target.dataset.dir);
    });
    $("#cartItems").addEventListener("change", (e) => {
      const line = e.target.closest(".cart-line");
      if (line && e.target.matches("input")) Cart.setQty(line.dataset.line, parseInt(e.target.value, 10) || 0);
    });
    $("#checkoutBtn").addEventListener("click", (e) => {
      if (!Cart.count()) {
        e.preventDefault();
        toast("Add a product to your order first");
      }
    });
    renderCart();
  }

  // ---------- Misc ----------
  function bindMisc() {
    $("#year").textContent = new Date().getFullYear();
    $$(".art-card").forEach((el) => (el.innerHTML = PRODUCT_ICONS[el.dataset.icon]));

    $("#menuBtn").addEventListener("click", () => $("#navLinks").classList.toggle("open"));
    $$("#navLinks a").forEach((a) => a.addEventListener("click", () => $("#navLinks").classList.remove("open")));

    const waNumber = cfg.phone.replace(/\D/g, "");
    $("#contactList").innerHTML = `
      <li><span>Phone</span><a href="tel:${waNumber}">${cfg.phone}</a></li>
      <li><span>WhatsApp</span><a href="https://wa.me/${waNumber}" target="_blank" rel="noopener">Chat with us</a></li>
      <li><span>Email</span><a href="mailto:${cfg.email}">${cfg.email}</a></li>
      <li><span>Factory</span>${cfg.address}</li>`;

    // Static site: enquiries are sent through WhatsApp with the message pre-filled.
    $("#enquiryForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = e.target;
      if (!f.checkValidity()) return f.reportValidity();
      const text = `Enquiry from ${f.name.value} (${f.phone.value}):\n${f.message.value}`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      $("#enquiryMsg").textContent = "Opening WhatsApp to send your enquiry…";
      $("#enquiryMsg").className = "form-msg ok";
      f.reset();
    });
  }

  renderFilters();
  renderProducts();
  bindProducts();
  bindCustomForm();
  bindCart();
  bindMisc();
})();
