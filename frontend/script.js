const API_BASE = window.location.port === "5500"
  ? "http://127.0.0.1:5000/api"
  : "/api";
const fallbackFoods = [
  { _id: "pizza-1", name: "Garden Fresh Pizza", category: "Pizza", price: 249, rating: 4.8, description: "Crispy crust, fresh vegetables and melted cheese.", image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=700&q=80", tag: "BESTSELLER" },
  { _id: "burger-1", name: "Classic Smash Burger", category: "Burgers", price: 189, rating: 4.7, description: "Juicy patty, crunchy lettuce and house sauce.", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80", tag: "POPULAR" },
  { _id: "bowl-1", name: "Green Goddess Bowl", category: "Bowls", price: 219, rating: 4.6, description: "A colorful bowl packed with greens and grains.", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80", tag: "FRESH PICK" },
  { _id: "dessert-1", name: "Chocolate Brownie", category: "Desserts", price: 119, rating: 4.9, description: "Rich chocolate brownie for your sweet tooth.", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80", tag: "SWEET TREAT" },
  { _id: "pizza-2", name: "Margherita Pizza", category: "Pizza", price: 199, rating: 4.7, description: "Tomato, basil and mozzarella on a golden crust.", image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80", tag: "CLASSIC" },
  { _id: "burger-2", name: "Crispy Chicken Burger", category: "Burgers", price: 209, rating: 4.6, description: "Crispy chicken with slaw and creamy dressing.", image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=700&q=80", tag: "CRUNCHY" },
  { _id: "bowl-2", name: "Paneer Power Bowl", category: "Bowls", price: 229, rating: 4.8, description: "Spiced paneer, rice and a bright herb dressing.", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80", tag: "VEG FAVORITE" },
  { _id: "dessert-2", name: "Berry Cheesecake", category: "Desserts", price: 149, rating: 4.8, description: "Creamy cheesecake topped with sweet berries.", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=80", tag: "DESSERT" }
];
let foods = [...fallbackFoods];
let cart = [];
let activeCategory = "All";
const foodGrid = document.getElementById("food-grid");
const statusEl = document.getElementById("api-status");
const money = amount => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

async function loadFoods() {
  try {
    const response = await fetch(`${API_BASE}/foods`);
    if (!response.ok) throw new Error("API unavailable");
    const data = await response.json();
    if (Array.isArray(data) && data.length) foods = data;
    statusEl.textContent = "Menu loaded from the Freshbite backend.";
  } catch {
    statusEl.textContent = "Preview menu shown. Start the backend to load menu data from the API.";
  }
  renderFoods();
}
function renderFoods() {
  const term = document.getElementById("search-input").value.trim().toLowerCase();
  const visible = foods.filter(food => (activeCategory === "All" || food.category === activeCategory) &&
    `${food.name} ${food.description} ${food.category}`.toLowerCase().includes(term));
  foodGrid.innerHTML = "";
  if (!visible.length) {
    foodGrid.innerHTML = '<div class="empty-state">No food found. Try another search or category.</div>';
    return;
  }
  visible.forEach(food => {
    const card = document.createElement("article");
    card.className = "food-card";
    card.innerHTML = `<div class="food-image"><img loading="lazy" src="${escapeHtml(food.image)}" alt="${escapeHtml(food.name)}"><span class="food-tag">${escapeHtml(food.tag || food.category)}</span></div>
      <div class="food-info"><div class="food-title-row"><h3>${escapeHtml(food.name)}</h3><span class="price">${money(Number(food.price))}</span></div>
      <p>${escapeHtml(food.description)}</p><div class="food-actions"><span>★ ${Number(food.rating || 4.7).toFixed(1)} · ${escapeHtml(food.category)}</span><button class="add-btn" data-add="${escapeHtml(food._id)}">+ Add</button></div></div>`;
    foodGrid.appendChild(card);
  });
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function addToCart(id) {
  const food = foods.find(item => String(item._id) === String(id));
  if (!food) return;
  const existing = cart.find(item => String(item.food._id) === String(id));
  existing ? existing.quantity++ : cart.push({ food, quantity: 1 });
  renderCart(); showToast(`${food.name} added to your basket`);
}
function updateQuantity(id, delta) {
  const item = cart.find(row => String(row.food._id) === String(id));
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(row => String(row.food._id) !== String(id));
  renderCart();
}
function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + Number(item.food.price) * item.quantity, 0);
  document.getElementById("cart-count").textContent = count;
  document.getElementById("cart-total").textContent = money(total);
  const list = document.getElementById("cart-items");
  if (!cart.length) { list.innerHTML = '<div class="empty-state">Your basket is empty.<br>Find something delicious on the menu.</div>'; }
  else list.innerHTML = cart.map(item => `<div class="cart-row"><img src="${escapeHtml(item.food.image)}" alt=""><div><b>${escapeHtml(item.food.name)}</b><small>${money(item.food.price)} each</small><div class="quantity"><button data-qty="${escapeHtml(item.food._id)}" data-delta="-1">−</button><span>${item.quantity}</span><button data-qty="${escapeHtml(item.food._id)}" data-delta="1">+</button></div></div><b>${money(item.food.price * item.quantity)}</b></div>`).join("");
  document.getElementById("checkout-btn").disabled = !cart.length;
}
function openCart(open) {
  document.getElementById("cart-drawer").classList.toggle("open", open);
  document.getElementById("drawer-backdrop").classList.toggle("show", open);
  document.getElementById("cart-drawer").setAttribute("aria-hidden", String(!open));
}
let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message; toast.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function showOrderConfirmation(order, result) {
  document.getElementById("confirmation-order-id").textContent = result.orderId || result._id || "Saved";
  document.getElementById("confirmation-status").textContent = result.status || "Received";
  document.getElementById("confirmation-customer").textContent = order.customerName;
  document.getElementById("confirmation-phone").textContent = order.phone;
  document.getElementById("confirmation-address").textContent = order.address;
  document.getElementById("confirmation-total").textContent = money(result.total ?? order.items.reduce((sum, item) => sum + item.price * item.quantity, 0));

  const etaMinutes = Number(result.deliveryEstimateMinutes) || 40;
  const etaTime = result.estimatedDeliveryAt ? new Date(result.estimatedDeliveryAt) : null;
  const etaText = etaTime && !Number.isNaN(etaTime.valueOf())
    ? `About ${etaMinutes} minutes · around ${etaTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : `About ${etaMinutes} minutes`;
  document.getElementById("confirmation-eta-value").textContent = etaText;

  const itemList = document.getElementById("confirmation-items");
  itemList.replaceChildren();
  order.items.forEach(item => {
    const row = document.createElement("div");
    row.className = "confirmation-item";
    const title = document.createElement("b");
    title.textContent = `${item.name} × ${item.quantity}`;
    const details = document.createElement("small");
    details.textContent = `${item.category} · ${item.description} · ${money(item.price)} each`;
    const lineTotal = document.createElement("strong");
    lineTotal.textContent = money(item.price * item.quantity);
    row.append(title, details, lineTotal);
    itemList.appendChild(row);
  });
  document.getElementById("order-confirmation").showModal();
}

foodGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (button) addToCart(button.dataset.add);
});
document.getElementById("cart-items").addEventListener("click", event => {
  const button = event.target.closest("[data-qty]");
  if (button) updateQuantity(button.dataset.qty, Number(button.dataset.delta));
});
document.getElementById("search-input").addEventListener("input", renderFoods);
document.getElementById("category-filters").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  activeCategory = button.dataset.category;
  document.querySelectorAll(".filter").forEach(filter => filter.classList.toggle("active", filter === button));
  renderFoods();
});
document.getElementById("cart-open").addEventListener("click", () => openCart(true));
document.getElementById("cart-close").addEventListener("click", () => openCart(false));
document.getElementById("drawer-backdrop").addEventListener("click", () => openCart(false));
document.getElementById("checkout-btn").addEventListener("click", () => {
  if (!cart.length) return;
  openCart(false); document.getElementById("checkout-dialog").showModal();
});
document.getElementById("checkout-close").addEventListener("click", () => document.getElementById("checkout-dialog").close());
document.getElementById("checkout-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!cart.length) return;
  const checkoutForm = event.currentTarget;
  const submitButton = checkoutForm.querySelector('[type="submit"]');
  const form = new FormData(checkoutForm);
  const order = {
    customerName: form.get("customerName").trim(),
    phone: form.get("phone").trim(),
    address: form.get("address").trim(),
    notes: form.get("notes").trim(),
    items: cart.map(item => ({ foodId: item.food._id, name: item.food.name, price: Number(item.food.price), quantity: item.quantity }))
  };
  const cartSnapshot = cart.map(item => ({
    name: item.food.name,
    category: item.food.category,
    description: item.food.description,
    price: Number(item.food.price),
    quantity: item.quantity
  }));
  submitButton.disabled = true;
  submitButton.textContent = "Placing order…";
  try {
    const response = await fetch(`${API_BASE}/orders`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(order)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not place order");
    cart = [];
    renderCart();
    checkoutForm.reset();
    document.getElementById("checkout-dialog").close();
    showOrderConfirmation({ ...order, items: cartSnapshot }, result);
  } catch (error) {
    showToast(error.message || "Could not place the order. Please try again.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Place demo order →";
  }
});
document.getElementById("confirmation-close").addEventListener("click", () => document.getElementById("order-confirmation").close());
document.getElementById("confirmation-done").addEventListener("click", () => document.getElementById("order-confirmation").close());
document.getElementById("year").textContent = new Date().getFullYear();
renderCart(); loadFoods();
