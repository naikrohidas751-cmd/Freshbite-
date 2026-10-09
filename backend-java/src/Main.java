import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.Duration;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Pattern;

public class Main {
    private static final int PORT = Integer.parseInt(System.getenv().getOrDefault("PORT", "5000"));
    private static final boolean RUNNING_ON_RENDER = "true".equalsIgnoreCase(System.getenv("RENDER"));
    private static final String HOST = RUNNING_ON_RENDER ? "0.0.0.0" : System.getenv().getOrDefault("HOST", "127.0.0.1");
    private static final int DELIVERY_ESTIMATE_MINUTES = 40;
    private static final Pattern PHONE = Pattern.compile("^[0-9 +()\\-]{8,20}$");
    private static final List<Map<String, Object>> FOODS = seedFoods();
    private static final List<Map<String, Object>> ORDERS = new CopyOnWriteArrayList<>();
    private static final Path ORDERS_FILE = Path.of(System.getenv().getOrDefault("DATA_DIR", "data")).resolve("orders.json");

    public static void main(String[] args) throws IOException {
        loadOrders();
        HttpServer server = HttpServer.create(new InetSocketAddress(HOST, PORT), 0);
        server.createContext("/", Main::handleAdminSite);
        server.createContext("/api", Main::handle);
        server.setExecutor(null);
        server.start();
        System.out.println("Freshbite JDK API listening on " + HOST + ":" + PORT);
        System.out.println("Customer orders are saved in " + ORDERS_FILE.toAbsolutePath());
    }

    private static void handleAdminSite(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        boolean adminPage = "/admin".equals(path) || "/admin/".equals(path) || "/admin.js".equals(path);
        if (adminPage && !requireAdminAccess(exchange)) return;
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod()) && !"HEAD".equalsIgnoreCase(exchange.getRequestMethod())) {
            send(exchange, 405, Map.of("message", "Method not allowed."));
            return;
        }
        if ("/".equals(path) || "/shop".equals(path) || "/shop/".equals(path)
                || "/index.html".equals(path) || "/freshbite-home.html".equals(path)) {
            sendFile(exchange, Path.of("..", "frontend", "freshbite-home.html"), "text/html; charset=utf-8");
        } else if ("/admin".equals(path) || "/admin/".equals(path)) {
            sendFile(exchange, Path.of("admin.html"), "text/html; charset=utf-8");
        } else if ("/admin.js".equals(path)) {
            sendFile(exchange, Path.of("admin.js"), "text/javascript; charset=utf-8");
        } else if ("/style.css".equals(path)) {
            sendFile(exchange, Path.of("..", "frontend", "style.css"), "text/css; charset=utf-8");
        } else if ("/freshbite-redesign.css".equals(path)) {
            sendFile(exchange, Path.of("..", "frontend", "freshbite-redesign.css"), "text/css; charset=utf-8");
        } else if ("/script.js".equals(path)) {
            sendFile(exchange, Path.of("..", "frontend", "script.js"), "text/javascript; charset=utf-8");
        } else {
            send(exchange, 404, Map.of("message", "Page not found."));
        }
    }

    private static boolean requireAdminAccess(HttpExchange exchange) throws IOException {
        String username = System.getenv("ADMIN_USERNAME");
        String password = System.getenv("ADMIN_PASSWORD");
        boolean runningOnRender = "true".equalsIgnoreCase(System.getenv("RENDER"));
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            if (!runningOnRender) return true;
            send(exchange, 503, Map.of("message", "Admin authentication is not configured."));
            return false;
        }

        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, "Basic ", 0, 6)) {
            try {
                String supplied = new String(Base64.getDecoder().decode(authorization.substring(6).trim()), StandardCharsets.UTF_8);
                String expected = username + ":" + password;
                if (MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), supplied.getBytes(StandardCharsets.UTF_8))) return true;
            } catch (IllegalArgumentException ignored) {
                // Reject malformed Basic credentials below.
            }
        }

        exchange.getResponseHeaders().set("WWW-Authenticate", "Basic realm=\"Freshbite Admin\", charset=\"UTF-8\"");
        send(exchange, 401, Map.of("message", "Sign in to view the orders dashboard."));
        return false;
    }
    private static void sendFile(HttpExchange exchange, Path file, String contentType) throws IOException {
        if (!Files.isRegularFile(file)) {
            send(exchange, 500, Map.of("message", "Backend dashboard file is missing."));
            return;
        }
        byte[] bytes = Files.readAllBytes(file);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        boolean headRequest = "HEAD".equalsIgnoreCase(exchange.getRequestMethod());
        if (headRequest) { exchange.sendResponseHeaders(200, -1); exchange.close(); return; }
        exchange.sendResponseHeaders(200, bytes.length);
        try (var output = exchange.getResponseBody()) { output.write(bytes); }
    }

    private static void handle(HttpExchange exchange) throws IOException {
        cors(exchange.getResponseHeaders());
        if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }
        String path = exchange.getRequestURI().getPath();
        String method = exchange.getRequestMethod();
        if ("HEAD".equalsIgnoreCase(method)) method = "GET";
        try {
            if ("GET".equals(method) && "/api/health".equals(path)) {
                send(exchange, 200, Map.of("status", "ok", "service", "Freshbite JDK API"));
            } else if ("GET".equals(method) && "/api/foods".equals(path)) {
                send(exchange, 200, getFoods(exchange.getRequestURI().getRawQuery()));
            } else if ("POST".equals(method) && "/api/orders".equals(path)) {
                createOrder(exchange);
            } else if ("GET".equals(method) && "/api/orders".equals(path)) {
                if (!requireAdminAccess(exchange)) return;
                send(exchange, 200, refreshOrdersFromDisk());
            } else {
                send(exchange, 404, Map.of("message", "Route not found."));
            }
        } catch (IllegalArgumentException error) {
            send(exchange, 400, Map.of("message", error.getMessage()));
        } catch (Exception error) {
            error.printStackTrace();
            send(exchange, 500, Map.of("message", "Unexpected server error."));
        }
    }

    private static List<Map<String, Object>> getFoods(String rawQuery) {
        Map<String, String> query = parseQuery(rawQuery);
        String category = query.getOrDefault("category", "All");
        String search = query.getOrDefault("search", "");
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> food : FOODS) {
            if (!"All".equals(category) && !category.equals(food.get("category"))) continue;
            if (!String.valueOf(food.get("name")).toLowerCase().contains(search.toLowerCase())) continue;
            result.add(food);
        }
        return result;
    }

    private static void createOrder(HttpExchange exchange) throws IOException {
        byte[] body = exchange.getRequestBody().readNBytes(100_001);
        if (body.length > 100_000) throw new IllegalArgumentException("Request body is too large.");
        Object parsed = Json.parse(new String(body, StandardCharsets.UTF_8));
        if (!(parsed instanceof Map<?, ?> input)) throw new IllegalArgumentException("Request body must be a JSON object.");

        String customerName = string(input.get("customerName")).trim();
        String phone = string(input.get("phone")).trim();
        String address = string(input.get("address")).trim();
        String notes = string(input.get("notes"));
        if (customerName.length() < 2 || customerName.length() > 80
                || !PHONE.matcher(phone).matches()
                || address.length() < 8 || address.length() > 300
                || notes.length() > 500) {
            throw new IllegalArgumentException("Please provide valid contact details and at least one item.");
        }
        if (!(input.get("items") instanceof List<?> items) || items.isEmpty() || items.size() > 30) {
            throw new IllegalArgumentException("Please provide valid contact details and at least one item.");
        }

        List<Map<String, Object>> normalizedItems = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Object rawItem : items) {
            if (!(rawItem instanceof Map<?, ?> item)) throw new IllegalArgumentException("Each item must be an object.");
            String foodId = string(item.get("foodId"));
            int quantity = integer(item.get("quantity"));
            if (quantity < 1 || quantity > 50) throw new IllegalArgumentException("Each quantity must be between 1 and 50.");
            Map<String, Object> food = FOODS.stream().filter(row -> foodId.equals(row.get("_id"))).findFirst().orElse(null);
            if (food == null) throw new IllegalArgumentException("A selected food item was not found. Refresh the menu and try again.");
            BigDecimal price = new BigDecimal(String.valueOf(food.get("price")));
            Map<String, Object> normalized = new LinkedHashMap<>();
            normalized.put("foodId", foodId);
            normalized.put("name", food.get("name"));
            normalized.put("price", price);
            normalized.put("quantity", quantity);
            normalized.put("category", food.get("category"));
            normalized.put("description", food.get("description"));
            normalized.put("image", food.get("image"));
            normalized.put("rating", food.get("rating"));
            normalized.put("tag", food.get("tag"));
            normalizedItems.add(normalized);
            total = total.add(price.multiply(BigDecimal.valueOf(quantity)));
        }

        Map<String, Object> order = new LinkedHashMap<>();
        order.put("_id", UUID.randomUUID().toString());
        order.put("customerName", customerName);
        order.put("phone", phone);
        order.put("address", address);
        order.put("notes", notes);
        order.put("items", normalizedItems);
        order.put("total", total);
        order.put("status", "Received");
        Instant orderedAt = Instant.now();
        Instant estimatedDeliveryAt = orderedAt.plus(Duration.ofMinutes(DELIVERY_ESTIMATE_MINUTES));
        order.put("createdAt", orderedAt.toString());
        order.put("estimatedDeliveryAt", estimatedDeliveryAt.toString());
        order.put("deliveryEstimateMinutes", DELIVERY_ESTIMATE_MINUTES);
        synchronized (ORDERS) {
            ORDERS.add(0, order);
            try {
                persistOrders();
            } catch (IOException error) {
                ORDERS.remove(order);
                throw error;
            }
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Order created successfully.");
        response.put("orderId", order.get("_id"));
        response.put("total", total);
        response.put("persisted", true);
        response.put("status", "Received");
        response.put("estimatedDeliveryAt", estimatedDeliveryAt.toString());
        response.put("deliveryEstimateMinutes", DELIVERY_ESTIMATE_MINUTES);
        send(exchange, 201, response);
    }

    private static int integer(Object value) {
        try {
            if (value instanceof BigDecimal number) return number.intValueExact();
            if (value instanceof Number number) return number.intValue();
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ignored) {
            throw new IllegalArgumentException("Each quantity must be a whole number.");
        }
    }

    private static void loadOrders() {
        if (!Files.exists(ORDERS_FILE)) return;
        try {
            Object stored = Json.parse(Files.readString(ORDERS_FILE, StandardCharsets.UTF_8));
            if (stored instanceof List<?> list) {
                for (Object item : list) {
                    if (item instanceof Map<?, ?> map) {
                        @SuppressWarnings("unchecked") Map<String, Object> order = (Map<String, Object>) map;
                        ORDERS.add(order);
                    }
                }
            }
            System.out.println("Loaded " + ORDERS.size() + " saved order(s).");
        } catch (Exception error) {
            System.err.println("Could not read saved orders: " + error.getMessage());
        }
    }

    private static List<Map<String, Object>> refreshOrdersFromDisk() throws IOException {
        synchronized (ORDERS) {
            if (!Files.exists(ORDERS_FILE)) return List.copyOf(ORDERS);
            Object stored;
            try {
                stored = Json.parse(Files.readString(ORDERS_FILE, StandardCharsets.UTF_8));
            } catch (RuntimeException error) {
                throw new IOException("Saved orders could not be read.", error);
            }
            if (!(stored instanceof List<?> list)) throw new IOException("Saved orders file has an invalid format.");
            List<Map<String, Object>> diskOrders = new ArrayList<>();
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> map)) throw new IOException("Saved order entry has an invalid format.");
                @SuppressWarnings("unchecked") Map<String, Object> order = (Map<String, Object>) map;
                diskOrders.add(order);
            }
            ORDERS.clear();
            ORDERS.addAll(diskOrders);
            return List.copyOf(ORDERS);
        }
    }

    private static void persistOrders() throws IOException {
        Files.createDirectories(ORDERS_FILE.getParent());
        Path temporary = ORDERS_FILE.resolveSibling(ORDERS_FILE.getFileName() + ".tmp");
        Files.writeString(temporary, Json.stringify(ORDERS), StandardCharsets.UTF_8);
        try {
            Files.move(temporary, ORDERS_FILE, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException ignored) {
            Files.move(temporary, ORDERS_FILE, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static String string(Object value) { return value == null ? "" : String.valueOf(value); }

    private static Map<String, String> parseQuery(String raw) {
        Map<String, String> result = new LinkedHashMap<>();
        if (raw == null || raw.isEmpty()) return result;
        for (String pair : raw.split("&")) {
            String[] parts = pair.split("=", 2);
            result.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                    parts.length > 1 ? URLDecoder.decode(parts[1], StandardCharsets.UTF_8) : "");
        }
        return result;
    }

    private static void cors(Headers headers) {
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
    }

    private static void send(HttpExchange exchange, int status, Object body) throws IOException {
        byte[] bytes = Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        if ("HEAD".equalsIgnoreCase(exchange.getRequestMethod())) { exchange.sendResponseHeaders(status, -1); exchange.close(); return; }
        exchange.sendResponseHeaders(status, bytes.length);
        try (var output = exchange.getResponseBody()) { output.write(bytes); }
    }

    private static List<Map<String, Object>> seedFoods() {
        String[][] rows = {
                {"Garden Fresh Pizza", "Pizza", "249", "4.8", "Crispy crust, fresh vegetables and melted cheese.", "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=700&q=80", "BESTSELLER"},
                {"Classic Smash Burger", "Burgers", "189", "4.7", "Juicy patty, crunchy lettuce and house sauce.", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80", "POPULAR"},
                {"Green Goddess Bowl", "Bowls", "219", "4.6", "A colorful bowl packed with greens and grains.", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=700&q=80", "FRESH PICK"},
                {"Chocolate Brownie", "Desserts", "119", "4.9", "Rich chocolate brownie for your sweet tooth.", "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80", "SWEET TREAT"},
                {"Margherita Pizza", "Pizza", "199", "4.7", "Tomato, basil and mozzarella on a golden crust.", "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=700&q=80", "CLASSIC"},
                {"Crispy Chicken Burger", "Burgers", "209", "4.6", "Crispy chicken with slaw and creamy dressing.", "https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=700&q=80", "CRUNCHY"},
                {"Paneer Power Bowl", "Bowls", "229", "4.8", "Spiced paneer, rice and a bright herb dressing.", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=700&q=80", "VEG FAVORITE"},
                {"Berry Cheesecake", "Desserts", "149", "4.8", "Creamy cheesecake topped with sweet berries.", "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=700&q=80", "DESSERT"}
        };
        List<Map<String, Object>> foods = new ArrayList<>();
        for (int i = 0; i < rows.length; i++) {
            String[] row = rows[i];
            Map<String, Object> food = new LinkedHashMap<>();
            food.put("_id", "demo-" + (i + 1));
            food.put("name", row[0]);
            food.put("category", row[1]);
            food.put("price", Integer.parseInt(row[2]));
            food.put("rating", Double.parseDouble(row[3]));
            food.put("description", row[4]);
            food.put("image", row[5]);
            food.put("tag", row[6]);
            foods.add(food);
        }
        return List.copyOf(foods);
    }

    private static final class Json {
        private final String source;
        private int at;
        private Json(String source) { this.source = source; }

        static Object parse(String source) {
            Json parser = new Json(source);
            Object value = parser.value();
            parser.space();
            if (parser.at != source.length()) throw new IllegalArgumentException("Invalid JSON request.");
            return value;
        }

        private Object value() {
            space();
            if (at >= source.length()) throw new IllegalArgumentException("Invalid JSON request.");
            char ch = source.charAt(at);
            if (ch == '{') return object();
            if (ch == '[') return array();
            if (ch == '"') return stringValue();
            if (ch == 't' && literal("true")) return true;
            if (ch == 'f' && literal("false")) return false;
            if (ch == 'n' && literal("null")) return null;
            return number();
        }

        private Map<String, Object> object() {
            at++;
            Map<String, Object> result = new LinkedHashMap<>();
            space();
            if (take('}')) return result;
            do {
                space();
                if (at >= source.length() || source.charAt(at) != '"') throw new IllegalArgumentException("Invalid JSON request.");
                String key = stringValue();
                space();
                if (!take(':')) throw new IllegalArgumentException("Invalid JSON request.");
                result.put(key, value());
                space();
                if (take('}')) return result;
            } while (take(','));
            throw new IllegalArgumentException("Invalid JSON request.");
        }

        private List<Object> array() {
            at++;
            List<Object> result = new ArrayList<>();
            space();
            if (take(']')) return result;
            do {
                result.add(value());
                space();
                if (take(']')) return result;
            } while (take(','));
            throw new IllegalArgumentException("Invalid JSON request.");
        }

        private String stringValue() {
            at++;
            StringBuilder out = new StringBuilder();
            while (at < source.length()) {
                char ch = source.charAt(at++);
                if (ch == '"') return out.toString();
                if (ch != '\\') { out.append(ch); continue; }
                if (at >= source.length()) break;
                char escape = source.charAt(at++);
                switch (escape) {
                    case '"', '\\', '/' -> out.append(escape);
                    case 'b' -> out.append('\b');
                    case 'f' -> out.append('\f');
                    case 'n' -> out.append('\n');
                    case 'r' -> out.append('\r');
                    case 't' -> out.append('\t');
                    case 'u' -> {
                        if (at + 4 > source.length()) throw new IllegalArgumentException("Invalid JSON request.");
                        try { out.append((char) Integer.parseInt(source.substring(at, at + 4), 16)); }
                        catch (NumberFormatException error) { throw new IllegalArgumentException("Invalid JSON request."); }
                        at += 4;
                    }
                    default -> throw new IllegalArgumentException("Invalid JSON request.");
                }
            }
            throw new IllegalArgumentException("Invalid JSON request.");
        }

        private BigDecimal number() {
            int start = at;
            if (at < source.length() && source.charAt(at) == '-') at++;
            while (at < source.length() && Character.isDigit(source.charAt(at))) at++;
            if (at < source.length() && source.charAt(at) == '.') { at++; while (at < source.length() && Character.isDigit(source.charAt(at))) at++; }
            if (at < source.length() && (source.charAt(at) == 'e' || source.charAt(at) == 'E')) {
                at++; if (at < source.length() && (source.charAt(at) == '+' || source.charAt(at) == '-')) at++;
                while (at < source.length() && Character.isDigit(source.charAt(at))) at++;
            }
            try { return new BigDecimal(source.substring(start, at)); }
            catch (NumberFormatException error) { throw new IllegalArgumentException("Invalid JSON request."); }
        }

        private boolean literal(String expected) {
            if (!source.startsWith(expected, at)) return false;
            at += expected.length();
            return true;
        }
        private void space() { while (at < source.length() && Character.isWhitespace(source.charAt(at))) at++; }
        private boolean take(char expected) { if (at < source.length() && source.charAt(at) == expected) { at++; return true; } return false; }

        static String stringify(Object value) {
            if (value == null) return "null";
            if (value instanceof String text) return quote(text);
            if (value instanceof Number || value instanceof Boolean) return value.toString();
            if (value instanceof Map<?, ?> map) {
                List<String> entries = new ArrayList<>();
                map.forEach((key, item) -> entries.add(quote(String.valueOf(key)) + ":" + stringify(item)));
                return "{" + String.join(",", entries) + "}";
            }
            if (value instanceof Iterable<?> list) {
                List<String> entries = new ArrayList<>();
                for (Object item : list) entries.add(stringify(item));
                return "[" + String.join(",", entries) + "]";
            }
            return quote(String.valueOf(value));
        }

        private static String quote(String text) {
            StringBuilder out = new StringBuilder("\"");
            for (char ch : text.toCharArray()) {
                switch (ch) {
                    case '"' -> out.append("\\\"");
                    case '\\' -> out.append("\\\\");
                    case '\b' -> out.append("\\b");
                    case '\f' -> out.append("\\f");
                    case '\n' -> out.append("\\n");
                    case '\r' -> out.append("\\r");
                    case '\t' -> out.append("\\t");
                    default -> { if (ch < 0x20) out.append(String.format("\\u%04x", (int) ch)); else out.append(ch); }
                }
            }
            return out.append('"').toString();
        }
    }
}
