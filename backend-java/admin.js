const loginPanel = document.getElementById("login-panel");
const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const loginButton = document.getElementById("login-button");
const dashboard = document.getElementById("dashboard");
const statusElement = document.getElementById("status");
const listElement = document.getElementById("orders");
const refreshButton = document.getElementById("refresh");
const formatMoney = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
let authorization = null;

function text(parent, tag, value, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = value ?? "";
  parent.appendChild(element);
  return element;
}

function orderCard(order) {
  const card = document.createElement("article");
  card.className = "order";
  const head = document.createElement("div");
  head.className = "order-head";
  const identity = document.createElement("div");
  text(identity, "div", `Order ${order._id || "—"}`, "order-id");
  const placedAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : "Date unavailable";
  const eta = order.estimatedDeliveryAt ? new Date(order.estimatedDeliveryAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
  text(identity, "div", `Placed ${placedAt} · Estimated delivery ${eta}`, "order-date");
  head.appendChild(identity);
  text(head, "span", order.status || "Received", "state");
  card.appendChild(head);

  const columns = document.createElement("div");
  columns.className = "columns";
  const customerSection = document.createElement("section");
  customerSection.className = "section";
  text(customerSection, "h2", "Customer details");
  const customer = document.createElement("div");
  customer.className = "customer";
  text(customer, "div", order.customerName || "Name unavailable");
  text(customer, "div", `Phone: ${order.phone || "Not provided"}`);
  text(customer, "div", `Delivery address: ${order.address || "Not provided"}`);
  customerSection.appendChild(customer);

  const productSection = document.createElement("section");
  productSection.className = "section";
  text(productSection, "h2", "Products ordered");
  const items = document.createElement("ul");
  items.className = "items";
  (Array.isArray(order.items) ? order.items : []).forEach(item => {
    const row = document.createElement("li");
    row.className = "item";
    if (item.image) {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.name || "Product";
      image.loading = "lazy";
      row.appendChild(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "placeholder";
      row.appendChild(placeholder);
    }
    const detail = document.createElement("div");
    text(detail, "div", item.name || "Item", "item-name");
    text(detail, "div", `${item.category || "Category unavailable"} · ${item.tag || "Menu item"}`, "item-meta");
    text(detail, "div", item.description || "No description provided.", "item-desc");
    text(detail, "div", `Rating: ${item.rating ?? "—"} · ${item.quantity || 0} × ${formatMoney(item.price)}`, "item-meta");
    row.appendChild(detail);
    text(row, "div", formatMoney(Number(item.price) * Number(item.quantity)), "item-price");
    items.appendChild(row);
  });
  productSection.appendChild(items);
  columns.append(customerSection, productSection);
  card.appendChild(columns);

  const total = document.createElement("div");
  total.className = "total";
  text(total, "span", "Order total");
  text(total, "b", formatMoney(order.total));
  card.appendChild(total);
  text(card, "div", order.notes ? `Customer note: ${order.notes}` : "No customer note.", "note");
  return card;
}

function showLogin(message = "") {
  authorization = null;
  dashboard.hidden = true;
  loginPanel.hidden = false;
  loginStatus.textContent = message;
  document.getElementById("password").value = "";
}

function showOrders(orders) {
  listElement.replaceChildren();
  if (orders.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No customer orders yet. Orders submitted through the Freshbite frontend will appear here.";
    listElement.appendChild(empty);
  } else {
    orders.forEach(order => listElement.appendChild(orderCard(order)));
  }
  statusElement.className = "status";
  statusElement.textContent = `${orders.length} order${orders.length === 1 ? "" : "s"} found · Updated ${new Date().toLocaleTimeString()}.`;
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

function errorMessage(status, data) {
  if (status === 401) return "That username or password is incorrect. Please try again.";
  if (status === 503) return "Admin login is not configured on the server. Contact the site administrator.";
  return data.message || "Could not connect to the backend.";
}

async function loadOrders(auth = authorization, isLogin = false) {
  if (!auth) return;
  if (isLogin) loginButton.disabled = true;
  else refreshButton.disabled = true;
  if (!isLogin) {
    statusElement.className = "status";
    statusElement.textContent = "Refreshing orders...";
  }
  try {
    const response = await fetch("/api/orders", { cache: "no-store", headers: { Authorization: auth } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = errorMessage(response.status, data);
      if (response.status === 401 && !isLogin) showLogin("Your sign-in expired. Please sign in again.");
      else if (isLogin) loginStatus.textContent = message;
      else {
        statusElement.className = "status error";
        statusElement.textContent = message;
      }
      return;
    }
    authorization = auth;
    loginStatus.textContent = "";
    showOrders(Array.isArray(data) ? data : []);
  } catch (error) {
    const message = error.message || "Could not connect to the backend.";
    if (isLogin) loginStatus.textContent = message;
    else {
      statusElement.className = "status error";
      statusElement.textContent = message;
    }
  } finally {
    loginButton.disabled = false;
    refreshButton.disabled = false;
  }
}

loginForm.addEventListener("submit", event => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join("");
  loadOrders(`Basic ${btoa(binary)}`, true);
});
refreshButton.addEventListener("click", () => loadOrders());
document.getElementById("logout").addEventListener("click", () => showLogin("You have signed out."));
window.setInterval(() => { if (authorization) loadOrders(); }, 10000);