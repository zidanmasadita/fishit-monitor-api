import fs from "node:fs";
import path from "node:path";

export async function onRequestPost(context) {
  const body = await context.request.json().catch(() => null);

  if (!body || !body.player || !body.player.username) {
    return Response.json(
      {
        success: false,
        message: "Missing username",
      },
      { status: 400 }
    );
  }

  const username = body.player.username;
  const dataDir = "./data";

  // Ensure directory exists
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const accFile = path.join(dataDir, "accounts.json");
  const invFile = path.join(dataDir, "inventory.json");

  // Ensure files exist
  if (!fs.existsSync(accFile)) fs.writeFileSync(accFile, "{}");
  if (!fs.existsSync(invFile)) fs.writeFileSync(invFile, "{}");

  const accounts = JSON.parse(fs.readFileSync(accFile));
  const inventory = JSON.parse(fs.readFileSync(invFile));

  accounts[username] = {
    username,
    displayName: body.player.displayName ?? username,
    level: body.player.level ?? 1,
    levelProgress: body.player.levelProgress ?? 0,
    fishCaught: body.player.fishCaught ?? 0,
    playtime: body.player.playtime ?? 0,
    rod: body.equipment?.rod ?? "Unknown Rod",
    bobber: body.equipment?.bobber ?? "Unknown Bobber",
    status: "active",
    lastActive: new Date().toISOString(),
    timestamp: Math.floor(Date.now() / 1000),
  };

  fs.writeFileSync(accFile, JSON.stringify(accounts, null, 2));

  inventory[username] = body.inventory ?? [];
  fs.writeFileSync(invFile, JSON.stringify(inventory, null, 2));

  return Response.json({
    success: true,
    message: "Data updated",
    username,
  });
}
