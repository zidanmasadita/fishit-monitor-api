import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import serverless from "serverless-http";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cors());

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// DATA DIR (Node supported)
const DATA_DIR = path.join(__dirname, "../data");
const accountsFile = path.join(DATA_DIR, "accounts.json");
const inventoryFile = path.join(DATA_DIR, "inventory.json");

// Ensure data folder
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Ensure files
if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, "{}");
if (!fs.existsSync(inventoryFile)) fs.writeFileSync(inventoryFile, "{}");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ========================
// ROUTES
// ========================

app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Fishit Monitor API Running (NodeJS)",
    time: new Date().toISOString()
  });
});

app.post("/api/update", (req, res) => {
  const body = req.body;
  if (!body?.player?.username) {
    return res.json({ success: false, message: "Invalid body" });
  }

  const username = body.player.username;

  const accounts = readJson(accountsFile);
  accounts[username] = {
    username,
    displayName: body.player.displayName ?? username,
    level: body.player.level ?? 1,
    fishCaught: body.player.fishCaught ?? 0,
    rod: body.equipment?.rod ?? "Unknown Rod",
    bobber: body.equipment?.bobber ?? "Unknown Bobber",
    timestamp: Math.floor(Date.now() / 1000),
    lastActive: new Date().toISOString()
  };
  writeJson(accountsFile, accounts);

  const inv = readJson(inventoryFile);
  inv[username] = body.inventory ?? [];
  writeJson(inventoryFile, inv);

  res.json({ success: true, message: "Updated", username });
});

app.get("/api/accounts", (req, res) => {
  const accounts = readJson(accountsFile);
  res.json({ success: true, accounts: Object.values(accounts) });
});

app.get("/api/inventory", (req, res) => {
  const inventories = readJson(inventoryFile);
  const combined = {};

  for (const user in inventories) {
    for (const item of inventories[user]) {
      combined[item.name] ??= {
        name: item.name,
        quantity: 0
      };
      combined[item.name].quantity += item.quantity;
    }
  }

  res.json({ success: true, inventory: Object.values(combined) });
});

app.get("/api/stats", (req, res) => {
  const accounts = readJson(accountsFile);
  const stats = {
    totalAccounts: Object.keys(accounts).length,
    totalFish: Object.values(accounts).reduce(
      (sum, acc) => sum + (acc.fishCaught ?? 0), 
      0
    )
  };

  res.json({ success: true, stats });
});

// EXPORT FOR VERCEL NODE
export default serverless(app);
