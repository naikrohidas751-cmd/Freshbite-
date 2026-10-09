const statusElement = document.getElementById("status");
const listElement = document.getElementById("orders");
const formatMoney = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);

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

async function loadOrders() {
  const refreshButton = document.getElementById("refresh");
  refreshButton.disabled = true;
  statusElement.className = "status";
  statusElement.textContent = "Refreshing orders…";
  try {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not load orders.");
    const orders = Array.isArray(data) ? data : [];
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
  } catch (error) {
    statusElement.className = "status error";
    statusElement.textContent = error.message || "Could not connect to the backend.";
  } finally {
    refreshButton.disabled = false;
  }
}

loadOrders();
window.setInterval(loadOrders, 10000);
