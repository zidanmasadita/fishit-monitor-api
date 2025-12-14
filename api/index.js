import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors());

// Absolute path
const DATA_DIR = path.join(process.cwd(), "data");

const accountsFile = path.join(DATA_DIR, "accounts.json");
const inventoryFile = path.join(DATA_DIR, "inventory.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Ensure json files exist
if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, "{}");
if (!fs.existsSync(inventoryFile)) fs.writeFileSync(inventoryFile, "{}");

function readJson(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return data || {};
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

// Test Endpoint
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Fishit Monitor API (NodeJS) is running!",
    timestamp: new Date().toISOString(),
    accounts_file: fs.existsSync(accountsFile),
    inventory_file: fs.existsSync(inventoryFile)
  });
});

// Update Player
app.post("/update", (req, res) => {
  const body = req.body;

  if (!body || !body.player || !body.player.username) {
    return res.status(400).json({
      success: false,
      message: "Invalid body"
    });
  }

  const username = body.player.username;

  // Load accounts
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

  // Update inventory
  const inventories = readJson(inventoryFile);
  inventories[username] = body.inventory ?? [];
  writeJson(inventoryFile, inventories);

  res.json({
    success: true,
    message: "Data updated",
    username
  });
});

// Get Accounts
app.get("/accounts", (req, res) => {
  const accounts = readJson(accountsFile);
  const now = Math.floor(Date.now() / 1000);

  for (const name in accounts) {
    const acc = accounts[name];
    acc.status = now - acc.timestamp > 60 ? "disconnected" : "active";
  }

  res.json({
    success: true,
    accounts: Object.values(accounts)
  });
});

// Inventory Summary
app.get("/inventory", (req, res) => {
  const inventories = readJson(inventoryFile);
  const combined = {};

  for (const username in inventories) {
    for (const fish of inventories[username]) {
      if (!combined[fish.name]) {
        combined[fish.name] = {
          name: fish.name,
          quantity: 0,
          rarity: fish.rarity ?? "common",
          value: fish.value ?? 10
        };
      }
      combined[fish.name].quantity += fish.quantity ?? 0;
    }
  }

  res.json({
    success: true,
    inventory: Object.values(combined)
  });
});

// Stats
app.get("/stats", (req, res) => {
  const accounts = readJson(accountsFile);
  const now = Math.floor(Date.now() / 1000);

  let active = 0, disconnected = 0, totalFish = 0;

  for (const name in accounts) {
    const acc = accounts[name];
    if (now - acc.timestamp <= 60) active++;
    else disconnected++;

    totalFish += acc.fishCaught ?? 0;
  }

  res.json({
    success: true,
    stats: {
      totalAccounts: Object.keys(accounts).length,
      activeAccounts: active,
      disconnectedAccounts: disconnected,
      totalFish
    }
  });
});

// Export for Vercel
export default app;
