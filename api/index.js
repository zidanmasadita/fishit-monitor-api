import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import serverless from "serverless-http";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

// Use __dirname alternative for Vercel ES Modules
const __dirname = path.dirname(new URL(import.meta.url).pathname);

// Correct data folder path
const DATA_DIR = path.join(__dirname, "../data");

const accountsFile = path.join(DATA_DIR, "accounts.json");
const inventoryFile = path.join(DATA_DIR, "inventory.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Ensure json files exist
if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, "{}");
if (!fs.existsSync(inventoryFile)) fs.writeFileSync(inventoryFile, "{}");

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    console.error("JSON Read Error:", e);
    return {};
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// TEST ROUTE
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Fishit Monitor API (NodeJS) is running!",
    timestamp: new Date().toISOString()
  });
});

// UPDATE
app.post("/api/update", (req, res) => {
  const body = req.body;

  if (!body || !body.player?.username) {
    return res.status(400).json({ success: false, message: "Invalid body" });
  }

  const username = body.player.username;

  const accounts = readJson(accountsFile);

  accounts[username] = {
    username,
    displayName: body.player.displayName ?? username,
    status: "active",
    level: body.player.level ?? 1,
    levelProgress: body.player.levelProgress ?? 0,
    fishCaught: body.player.fishCaught ?? 0,
    playtime: body.player.playtime ?? 0,
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

// ACCOUNTS
app.get("/api/accounts", (req, res) => {
  const accounts = readJson(accountsFile);
  const now = Date.now() / 1000;

  for (const name in accounts) {
    accounts[name].status =
      now - accounts[name].timestamp > 60
        ? "disconnected"
        : "active";
  }

  res.json({ success: true, accounts: Object.values(accounts) });
});

// INVENTORY
app.get("/api/inventory", (req, res) => {
  const inventories = readJson(inventoryFile);
  const result = {};

  for (const user in inventories) {
    for (const fish of inventories[user]) {
      result[fish.name] ??= {
        name: fish.name,
        quantity: 0,
        rarity: fish.rarity ?? "common",
        value: fish.value ?? 10
      };
      result[fish.name].quantity += fish.quantity;
    }
  }

  res.json({ success: true, inventory: Object.values(result) });
});

// STATS
app.get("/api/stats", (req, res) => {
  const accounts = readJson(accountsFile);

  const stats = {
    totalAccounts: Object.keys(accounts).length,
    activeAccounts: 0,
    disconnectedAccounts: 0,
    totalFish: 0
  };

  const now = Date.now() / 1000;

  for (const user in accounts) {
    const acc = accounts[user];

    stats.totalFish += acc.fishCaught ?? 0;

    if (now - acc.timestamp <= 60) stats.activeAccounts++;
    else stats.disconnectedAccounts++;
  }

  res.json({ success: true, stats });
});

// EXPORT
export const config = {
  api: {
    bodyParser: false
  }
};

export default serverless(app);
