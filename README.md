# Talari Eco Packaging — Website

Online storefront for a manufacturer of disposable plates, paper cups, aluminium food containers, custom-printed tableware and biodegradable products (areca leaf, bagasse, PLA).

## Pages

- **`index.html`** is the landing page. It has the hero, the product categories, a catalogue you can filter (every product comes in several sizes and has a minimum order quantity), a form for custom printing (product, size, quantity, print colours, text, logo upload), the biodegradable range, event use cases and a contact/enquiry form. The enquiry form sends through WhatsApp.
- **`checkout.html`** is the order and payment page, in 3 steps:
  1. Delivery details (name, phone, email, address, PIN, delivery date, optional GSTIN)
  2. Payment:
     - **UPI**: shows a QR code and a "pay in app" link with the amount filled in, then asks for the UTR number
     - **Card / Net banking / Wallet** through Razorpay
     - **Bank transfer** (NEFT/RTGS)
     - **Cash on delivery** (up to ₹10,000; not offered for custom-printed orders)
  3. Confirmation with the order ID, payment reference and a printable receipt

The cart is saved in the browser and adds 18% GST. Delivery is free above ₹5,000.

## Run locally

It's a static site with no build step:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

To host it for free, use GitHub Pages (Settings → Pages → deploy from branch), Netlify or Vercel.

## Customise

| What | Where |
|---|---|
| Business name, phone, email, address, UPI ID, GST rate, delivery charges | `js/config.js` |
| Products, sizes, prices, minimum quantities | `js/products.js` |
| Bank account details | `checkout.html` (the bank transfer section) |
| Colours and styling | `css/styles.css` (variables in `:root`) |

## Taking real payments

- **UPI**: set `upiId` in `js/config.js` to your business UPI ID. Payments go straight to your account, and you check the UTR the customer enters against your bank statement.
- **Razorpay**: with `razorpayKeyId` left empty, checkout runs in **demo mode** and only simulates a successful card payment. To go live:
  1. Create a Razorpay account and get your Key ID.
  2. Add a small backend (for example a Node or Firebase function) that creates a Razorpay order for the cart total and passes back `order_id`. Then set `order_id` in `js/checkout.js` (it's marked with a comment).
  3. On the backend, verify the payment signature before you confirm the order.

## Next steps

Orders are currently stored only in the customer's browser (`localStorage`). For production:

- Add a backend or database (Firebase, Supabase or a Node API) so orders reach you.
- Send order emails or WhatsApp notifications.
- Add an admin page to see orders and update their status.
