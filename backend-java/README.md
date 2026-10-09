# Freshbite JDK backend

This backend uses the JDK 21 built-in HTTP server and does not need Maven or external libraries.
It matches the frontend API at `http://localhost:5000/api`.

## Run

From PowerShell or Command Prompt:

```text
cd backend-java
run.bat
```

The frontend already requests this API from `frontend/script.js`. Open `frontend/index.html` with
Live Server (or serve the `frontend` directory on port 5500). The API provides:

- `GET /api/health`
- `GET /api/foods` (optional `category` and `search` query parameters)
- `POST /api/orders`
- `GET /api/orders`

Open `http://127.0.0.1:5000/shop` for the frontend served by Java, and
`http://127.0.0.1:5000/admin` for the separate backend orders website. It shows customer names,
phone numbers, delivery addresses, full product details, notes, totals, status, and order time. The
dashboard refreshes automatically while the backend is running.

Orders are validated and saved to `backend-java/data/orders.json`, so they remain after the Java
process stops. Each order includes a server-checked product snapshot (name, category, description,
image, rating, tag, unit price, and quantity). The backend binds to this computer's loopback address.
