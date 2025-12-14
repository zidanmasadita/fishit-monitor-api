import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  const method = req.method;
  const url = req.url;

  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const DATA_DIR = path.join(__dirname, "../data");

  const accountsFile = path.join(DATA_DIR, "accounts.json");
  const inventoryFile = path.join(DATA_DIR, "inventory.json");

  // make sure folder exists
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // make sure JSON files exist
  if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, "{}");
  if (!fs.existsSync(inventoryFile)) fs.writeFileSync(inventoryFile, "{}");

  const readJSON = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  };

  const writeJSON = (file, data) => {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  };

  // ---------------------------
  // TEST ENDPOINT
  // ---------------------------
  if (url.startsWith("/api")) {
    if (url === "/api" && method === "GET") {
      return res.status(200).json({
        success: true,
        message: "API Running (Node no-express)",
        time: new Date().toISOString()
      });
    }

    // ---------------------------
    // POST /api/update
    // ---------------------------
    if (url === "/api/update" && method === "POST") {
      let body = "";

      for await (const chunk of req) {
        body += chunk;
      }

      const data = JSON.parse(body || "{}");

      if (!data?.player?.username) {
        return res.status(400).json({ success: false, message: "Invalid body" });
      }

      const username = data.player.username;

      const accounts = readJSON(accountsFile);
      accounts[username] = {
        username,
        displayName: data.player.displayName ?? username,
        level: data.player.level ?? 1,
        fishCaught: data.player.fishCaught ?? 0,
        timestamp: Math.floor(Date.now() / 1000)
      };
      writeJSON(accountsFile, accounts);

      const inv = readJSON(inventoryFile);
      inv[username] = data.inventory ?? [];
      writeJSON(inventoryFile, inv);

      return res.status(200).json({
        success: true,
        message: "Updated",
        username
      });
    }

    // ---------------------------
    // GET /api/accounts
    // ---------------------------
    if (url === "/api/accounts" && method === "GET") {
      const accounts = readJSON(accountsFile);
      return res.status(200).json({
        success: true,
        accounts: Object.values(accounts)
      });
    }

    // ---------------------------
    // GET /api/inventory
    // ---------------------------
    if (url === "/api/inventory" && method === "GET") {
      const inventories = readJSON(inventoryFile);
      const combined = {};

      for (const user in inventories) {
        for (const item of inventories[user]) {
          combined[item.name] ??= { name: item.name, quantity: 0 };
          combined[item.name].quantity += item.quantity;
        }
      }

      return res.status(200).json({
        success: true,
        inventory: Object.values(combined)
      });
    }
  }

  // Fallback
  return res.status(404).json({
    success: false,
    message: "Invalid endpoint"
  });
}
