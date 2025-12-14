import fs from "fs";
import path from "path";

export const config = {
  runtime: "edge"
};

function jsonResponse(obj) {
  return new Response(JSON.stringify(obj), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// PATH FIX for Vercel Edge
const dataDir = path.join(process.cwd(), "data");
const accountsFile = path.join(dataDir, "accounts.json");
const inventoryFile = path.join(dataDir, "inventory.json");

// Ensure folder
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Ensure files
if (!fs.existsSync(accountsFile)) fs.writeFileSync(accountsFile, "{}");
if (!fs.existsSync(inventoryFile)) fs.writeFileSync(inventoryFile, "{}");

// Read JSON helper
const readJson = (file) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return {}; }
};

// Write JSON helper
const writeJson = (file, data) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

// MAIN HANDLER
export default async function handler(req) {

  const url = new URL(req.url);
  const pathName = url.pathname;

  // ----------------------
  // TEST
  // ----------------------
  if (pathName.endsWith("/api")) {
    return jsonResponse({
      success: true,
      message: "Fishit Monitor API (EDGE) Running!",
      time: new Date().toISOString()
    });
  }

  // ----------------------
  // UPDATE (POST)
  // ----------------------
  if (pathName.endsWith("/api/update")) {
    const body = await req.json();

    if (!body?.player?.username) {
      return jsonResponse({ success: false, message: "Invalid body" });
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

    return jsonResponse({ success: true, message: "Updated", username });
  }

  // ----------------------
  // ACCOUNTS
  // ----------------------
  if (pathName.endsWith("/api/accounts")) {
    const accounts = readJson(accountsFile);
    return jsonResponse({ success: true, accounts: Object.values(accounts) });
  }

  // ----------------------
  // INVENTORY
  // ----------------------
  if (pathName.endsWith("/api/inventory")) {
    const inventories = readJson(inventoryFile);
    const combined = {};

    for (const user in inventories) {
      for (const item of inventories[user]) {
        combined[item.name] ??= { name: item.name, quantity: 0 };
        combined[item.name].quantity += item.quantity;
      }
    }

    return jsonResponse({
      success: true,
      inventory: Object.values(combined)
    });
  }

  // ----------------------
  // STATS
  // ----------------------
  if (pathName.endsWith("/api/stats")) {
    const accounts = readJson(accountsFile);

    const stats = {
      totalAccounts: Object.keys(accounts).length,
      totalFish: Object.values(accounts).reduce(
        (s, a) => s + (a.fishCaught ?? 0), 0
      )
    };

    return jsonResponse({ success: true, stats });
  }

  // DEFAULT
  return jsonResponse({
    success: false,
    message: "Invalid endpoint"
  });
}
