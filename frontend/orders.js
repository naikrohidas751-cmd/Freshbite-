const ORDERS_API = "http://127.0.0.1:5000/api/orders";
const orderList = document.getElementById("orders-list");
const statusMessage = document.getElementById("orders-status");
const countElement = document.getElementById("order-count");
const money = amount => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);

function addText(parent, tag, text, className) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text ?? "";
  parent.appendChild(element);
  return element;
}

function renderOrder(order) {
  const card = document.createElement("article");
  card.className = "order-card";

  const top = document.createElement("div");
  top.className = "order-top";
  const identity = document.createElement("div");
  const idLine = addText(identity, "div", "", "order-id");
  addText(idLine, "b", `Order ${order.orderId || order._id || "—"}`);
  addText(identity, "div", order.createdAt ? new Date(order.createdAt).toLocaleString() : "Date unavailable", "order-date");
  top.appendChild(identity);
  addText(top, "span", order.status || "Received", "order-status");
  card.appendChild(top);

  const columns = document.createElement("div");
  columns.className = "order-columns";
  const customer = document.createElement("section");
  customer.className = "order-section";
  addText(customer, "h2", "Customer details");
  const details = document.createElement("div");
  details.className = "customer-detail";
  addText(details, "div", order.customerName || "Name not provided");
  addText(details, "div", `Phone: ${order.phone || "Not provided"}`);
  addText(details, "div", `Address: ${order.address || "Not provided"}`);
  customer.appendChild(details);

  const purchased = document.createElement("section");
  purchased.className = "order-section";
  addText(purchased, "h2", "Items ordered");
  const items = document.createElement("ul");
  items.className = "order-items";
  (Array.isArray(order.items) ? order.items : []).forEach(item => {
    const row = document.createElement("li");
    if (item.image) {
      const image = document.createElement("img");
      image.className = "ordered-product-image";
      image.src = item.image;
      image.alt = item.name || "Ordered product";
      image.loading = "lazy";
      row.appendChild(image);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "ordered-product-image";
      row.appendChild(placeholder);
    }
    const product = document.createElement("div");
    addText(product, "div", item.name || "Item", "ordered-product-name");
    addText(product, "div", `${item.category || "Category unavailable"} · ${item.tag || "Menu item"}`, "ordered-product-meta");
    addText(product, "div", item.description || "No product description available.", "ordered-product-description");
    addText(product, "div", `Rating: ${item.rating ?? "—"} · ${item.quantity || 0} × ${money(item.price)}`, "ordered-product-meta");
    row.appendChild(product);
    addText(row, "div", money(Number(item.price) * Number(item.quantity)), "ordered-product-price");
    items.appendChild(row);
  });
  purchased.appendChild(items);
  columns.append(customer, purchased);
  card.appendChild(columns);

  const total = document.createElement("div");
  total.className = "order-total";
  addText(total, "span", "Order total");
  addText(total, "b", money(order.total));
  card.appendChild(total);
  const note = document.createElement("div");
  note.className = "order-notes";
  note.textContent = order.notes ? `Customer note: ${order.notes}` : "No customer note.";
  card.appendChild(note);
  return card;
}

async function loadOrders() {
  statusMessage.textContent = "Loading orders…";
  try {
    const response = await fetch(ORDERS_API);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load orders.");
    const orders = Array.isArray(result) ? result : [];
    countElement.textContent = orders.length;
    orderList.replaceChildren();
    if (!orders.length) {
      const empty = document.createElement("div");
      empty.className = "orders-empty";
      empty.textContent = "No customer orders yet. Orders placed through the Freshbite menu will appear here.";
      orderList.appendChild(empty);
      statusMessage.textContent = "Orders are up to date.";
      return;
    }
    orders.forEach(order => orderList.appendChild(renderOrder(order)));
    statusMessage.textContent = `Showing ${orders.length} order${orders.length === 1 ? "" : "s"}.`;
  } catch (error) {
    countElement.textContent = "—";
    statusMessage.textContent = `${error.message || "Could not connect to the backend."} Start the JDK backend and refresh.`;
  }
}

document.getElementById("refresh-orders").addEventListener("click", loadOrders);
loadOrders();
window.setInterval(loadOrders, 10000);
