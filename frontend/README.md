# Freshbite — Online Food Delivery

## Current JDK setup

This project now uses the JDK 21 backend in `backend-java` for the running frontend. Run `cd
backend-java` and then `run.bat` to compile and start the API at `http://127.0.0.1:5000`.
Open `http://127.0.0.1:5000/shop` to place orders (or use Live Server). Use the separate backend
website at `http://127.0.0.1:5000/admin` to view customer contact details plus each ordered product's name,
category, description, image, rating, tag, price, and quantity. Orders are saved in
`backend-java/data/orders.json`.

The older Node.js and MongoDB instructions below describe the original backend; use the JDK setup
above with the Java orders dashboard.

A responsive full-stack portfolio project built with HTML, CSS, vanilla JavaScript, Node.js, Express and MongoDB.

## Features

- Responsive food menu with search and category filters
- Add-to-cart, quantity controls and subtotal calculation
- Checkout form with client-side and server-side validation
- REST API for menu and orders
- Optional MongoDB persistence
- Demo mode so the site and API can be explored without MongoDB
- Ready for GitHub version control

## Requirements

- Node.js (LTS recommended)
- Visual Studio Code
- VS Code Live Server extension (for the frontend)
- Optional: MongoDB Community Server or a MongoDB Atlas connection

## Run in VS Code

### 1. Start the backend

Open the `Freshbite` folder in VS Code. Open Terminal → New Terminal, then run:

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and adjust values if needed. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Start the API:

```bash
npm run dev
```

You should see `Freshbite API running at http://localhost:5000`.

Test the API by opening `http://localhost:5000/api/health` in your browser.

### 2. Start the frontend

In VS Code, right-click `frontend/index.html` and choose **Open with Live Server**. If you do not have Live Server, install it from the Extensions view in VS Code.

The menu works using sample data even when the backend is not running. With the backend running, the menu and checkout use the API.

### 3. Enable MongoDB persistence (optional)

Install/run MongoDB locally, or create a MongoDB Atlas database. In `backend/.env`, set:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/freshbite
PORT=5000
FRONTEND_ORIGIN=http://127.0.0.1:5500
```

Restart the backend after changing `.env`. The app uses demo mode if MongoDB is not connected; demo orders are validated but not saved. The first run uses fallback menu data. To manage a persistent menu, add documents to the `foods` collection using the schema in `server.js`.

## Project structure

```text
Freshbite/
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── .gitignore
└── README.md
```

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check server status |
| GET | `/api/foods` | List available foods |
| POST | `/api/orders` | Validate and create an order |
| GET | `/api/orders` | List recent saved orders (database required) |

## Publish to GitHub

Create a **public** repository on GitHub named `Freshbite` (do not add a README/license from GitHub if you already have this project README). In the VS Code terminal at the project root:

```bash
git init
git add .
git commit -m "Build Freshbite food delivery project"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/Freshbite.git
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username. If Git asks you to sign in, complete the browser authentication. Do not upload your `.env` file, passwords, database credentials, or private customer data.

## Resume description

**Freshbite — Online Food Delivery Web Application**  
Built a responsive food ordering application using HTML5, CSS3, JavaScript, Node.js, Express.js and MongoDB. Implemented menu search and filtering, shopping cart management, checkout validation and REST APIs for food and order management. Designed a modular frontend/backend structure and prepared the project for GitHub version control.

**Important:** Before calling this production-ready, add authentication and authorization for admin routes, payment gateway integration, rate limiting, stronger security controls, deployment configuration, and tests. This portfolio demo does not collect payment and the order-list endpoint is not protected for production use.
