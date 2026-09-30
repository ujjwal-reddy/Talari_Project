// Business settings — edit these to match your company.
window.SITE_CONFIG = {
  businessName: "Talari Eco Packaging",
  phone: "+91 90000 00000",
  email: "orders@talaripackaging.com",
  address: "Industrial Area, Hyderabad, Telangana, India",
  currency: "INR",
  gstRate: 0.18,              // 18% GST applied at checkout
  freeDeliveryAbove: 5000,    // orders above this amount ship free
  deliveryCharge: 250,

  // UPI payments: put your business UPI ID here (e.g. "talari@okhdfcbank").
  upiId: "yourbusiness@upi",

  // Razorpay online payments (cards / netbanking / wallets / UPI).
  // Leave empty to run checkout in demo mode. For live payments, add your
  // Key ID here AND create orders from a backend (see README).
  razorpayKeyId: "",
};
