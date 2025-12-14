import express from "express";
import fs from "fs";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Make data folder
const DATA_DIR = path.join(process.cwd(), "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const accountsFile = path.join(DATA_DIR, "accounts.json");
const inventoryFile = path.join(DATA_DIR, "inventory.json");

if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, "{}");
if (!fs.existsSync(inventoryFile)) fs.writeFileSync(inventoryFile, "{}");

// Helpers
function loadJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file));
  } catch {
    return {};
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// TEST
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "Fishit Monitor API (Render) is running",
    time: Date.now()
  });
});

// UPDATE
app.post("/api/update", (req, res) => {
  const body = req.body;

  if (!body?.player?.username) {
    return res.status(400).json({
      success: false,
      message: "Missing username"
    });
  }

  const user = body.player.username;

  let accounts = loadJSON(accountsFile);

  accounts[user] = {
    username: user,
    displayName: body.player.displayName ?? user,
    level: body.player.level ?? 1,
    levelProgress: body.player.levelProgress ?? 0,
    fishCaught: body.player.fishCaught ?? 0,
    playtime: body.player.playtime ?? 0,
    rod: body.equipment?.rod ?? "Unknown Rod",
    bobber: body.equipment?.bobber ?? "Unknown Bobber",
    status: "active",
    lastActive: new Date().toISOString(),
    timestamp: Math.floor(Date.now() / 1000)
  };

  saveJSON(accountsFile, accounts);

  // Save inventory
  let inv = loadJSON(inventoryFile);
  inv[user] = body.inventory ?? [];
  saveJSON(inventoryFile, inv);

  res.json({
    success: true,
    message: "Data updated",
    username: user
  });
});

// GET accounts
app.get("/api/accounts", (req, res) => {
  const accounts = loadJSON(accountsFile);
  const now = Math.floor(Date.now() / 1000);

  for (const user in accounts) {
    accounts[user].status =
      now - accounts[user].timestamp > 60
        ? "disconnected"
        : "active";
  }

  res.json({
    success: true,
    accounts: Object.values(accounts)
  });
});

// Inventory summary
app.get("/api/inventory", (req, res) => {
  const inv = loadJSON(inventoryFile);
  const all = {};

  for (const user in inv) {
    for (const fish of inv[user]) {
      if (!all[fish.name]) {
        all[fish.name] = {
          name: fish.name,
          quantity: 0,
          rarity: fish.rarity ?? "common",
          value: fish.value ?? 0
        };
      }
      all[fish.name].quantity += fish.quantity;
    }
  }

  res.json({
    success: true,
    inventory: Object.values(all)
  });
});

// Stats
app.get("/api/stats", (req, res) => {
  const accounts = loadJSON(accountsFile);
  const now = Math.floor(Date.now() / 1000);

  let active = 0;
  let disc = 0;
  let fish = 0;

  for (const name in accounts) {
    if (now - accounts[name].timestamp <= 60) active++;
    else disc++;

    fish += accounts[name].fishCaught ?? 0;
  }

  res.json({
    success: true,
    stats: {
      totalAccounts: Object.keys(accounts).length,
      activeAccounts: active,
      disconnectedAccounts: disc,
      totalFish: fish
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log("API Running on port " + PORT);
});
