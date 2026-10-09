require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(",") : true }));
app.use(express.json({ limit: "100kb" }));

const foodSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  category: { type: String, required: true, enum: ["Pizza", "Burgers", "Bowls", "Desserts"] },
  price: { type: Number, required: true, min: 1 },
  rating: { type: Number, default: 4.5, min: 0, max: 5 },
  description: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  tag: { type: String, default: "FRESH PICK" },
  available: { type: Boolean, default: true }
}, { timestamps: true });

const orderSchema = new mongoose.Schema({
  customerName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  phone: { type: String, required: true, trim: true, maxlength: 20 },
  address: { type: String, required: true, trim: true, minlength: 8, maxlength: 300 },
  notes: { type: String, default: "", maxlength: 500 },
  items: [{
    foodId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1, max: 50 }
  }],
  total: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ["Received", "Preparing", "Out for delivery", "Delivered", "Cancelled"], default: "Received" }
}, { timestamps: true });

const Food = mongoose.model("Food", foodSchema);
const Order = mongoose.model("Order", orderSchema);

const seedFoods = [
  { name: "Garden Fresh Pizza", category: "Pizza", price: 249, rating: 4.8, description: "Crispy crust, fresh vegetables and melted cheese.", image: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=700&q=80", tag: "BESTSELLER" },
  { name: "Classic Smash Burger", category: "Burgers", price: 189, rating: 4.7, description: "Juicy patty, crunchy lettuce and house sauce.", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80", tag: "POPULAR" },
  { name: "Green Goddess Bowl", category: "Bowls", price: 219, rating: 4.6, description: "A colorful bowl packed with greens and grains.", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80", tag: "FRESH PICK" },
  { name: "Chocolate Brownie", category: "Desserts", price: 119, rating: 4.9, description: "Rich chocolate brownie for your sweet tooth.", image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80", tag: "SWEET TREAT" },
  { name: "Margherita Pizza", category: "Pizza", price: 199, rating: 4.7, description: "Tomato, basil and mozzarella on a golden crust.", image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80", tag: "CLASSIC" },
  { name: "Crispy Chicken Burger", category: "Burgers", price: 209, rating: 4.6, description: "Crispy chicken with slaw and creamy dressing.", image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=700&q=80", tag: "CRUNCHY" },
  { name: "Paneer Power Bowl", category: "Bowls", price: 229, rating: 4.8, description: "Spiced paneer, rice and a bright herb dressing.", image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80", tag: "VEG FAVORITE" },
  { name: "Berry Cheesecake", category: "Desserts", price: 149, rating: 4.8, description: "Creamy cheesecake topped with sweet berries.", image: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=80", tag: "DESSERT" }
];

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "Freshbite API" }));

app.get("/api/foods", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.json(seedFoods.map((food, index) => ({ ...food, _id: `demo-${index + 1}` })));
    const { category, search } = req.query;
    const filter = { available: true };
    if (category && category !== "All") filter.category = category;
    if (search) filter.name = { $regex: String(search).slice(0, 60), $options: "i" };
    const foods = await Food.find(filter).sort({ createdAt: -1 }).lean();
    res.json(foods.length ? foods : seedFoods.map((food, index) => ({ ...food, _id: `demo-${index + 1}` })));
  } catch (error) { next(error); }
});

app.post("/api/orders", async (req, res, next) => {
  try {
    const { customerName, phone, address, notes = "", items } = req.body;
    if (typeof customerName !== "string" || customerName.trim().length < 2 ||
        typeof phone !== "string" || !/^[0-9 +()-]{8,20}$/.test(phone.trim()) ||
        typeof address !== "string" || address.trim().length < 8 ||
        !Array.isArray(items) || items.length < 1 || items.length > 30) {
      return res.status(400).json({ message: "Please provide valid contact details and at least one item." });
    }

    // Recalculate prices on the server; never trust prices sent by the browser.
    const normalizedItems = [];
    for (const item of items) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
        return res.status(400).json({ message: "Each quantity must be between 1 and 50." });
      }
      let food = null;
      if (mongoose.connection.readyState === 1 && mongoose.isValidObjectId(item.foodId)) {
        food = await Food.findById(item.foodId).lean();
      }
      if (!food) food = seedFoods.find(row => `demo-${seedFoods.indexOf(row) + 1}` === String(item.foodId));
      if (!food) return res.status(400).json({ message: "A selected food item was not found. Refresh the menu and try again." });
      normalizedItems.push({ foodId: String(item.foodId), name: food.name, price: Number(food.price), quantity: qty });
    }
    const total = normalizedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderData = {
      customerName: customerName.trim(), phone: phone.trim(), address: address.trim(),
      notes: String(notes).slice(0, 500), items: normalizedItems, total
    };

    if (mongoose.connection.readyState !== 1) {
      // Safe demo mode: no database is connected, so nothing is persisted.
      return res.status(201).json({ message: "Demo order validated; connect MongoDB to save orders.", orderId: `DEMO-${Date.now()}`, total, persisted: false });
    }
    const order = await Order.create(orderData);
    res.status(201).json({ message: "Order created successfully.", orderId: order._id, total: order.total, persisted: true });
  } catch (error) { next(error); }
});

// Basic admin-ready endpoint. Add authentication before using it with real customers.
app.get("/api/orders", async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: "Connect MongoDB to view saved orders." });
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(orders);
  } catch (error) { next(error); }
});

app.use((req, res) => res.status(404).json({ message: "Route not found." }));
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: "Unexpected server error." });
});

async function start() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("MongoDB connected.");
    } catch (error) {
      console.error("MongoDB connection failed. API will run in demo mode:", error.message);
    }
  } else {
    console.log("MONGODB_URI not set. Running in demo mode (orders are not persisted).");
  }
  app.listen(PORT, () => console.log(`Freshbite API running at http://localhost:${PORT}`));
}
start();
