import fs from "node:fs";
import path from "node:path";

export async function onRequest() {
  const file = path.join("./data", "inventory.json");

  if (!fs.existsSync(file)) {
    return Response.json({ success: true, inventory: [] });
  }

  const inv = JSON.parse(fs.readFileSync(file));
  const combined = {};

  for (const username in inv) {
    for (const item of inv[username]) {
      if (!combined[item.name]) {
        combined[item.name] = {
          name: item.name,
          quantity: 0,
          rarity: item.rarity ?? "common",
          value: item.value ?? 0,
        };
      }
      combined[item.name].quantity += item.quantity;
    }
  }

  return Response.json({
    success: true,
    inventory: Object.values(combined),
  });
}
