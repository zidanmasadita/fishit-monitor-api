import fs from "node:fs";
import path from "node:path";

export async function onRequest() {
  const file = path.join("./data", "accounts.json");

  if (!fs.existsSync(file)) {
    return Response.json({ success: true, accounts: [] });
  }

  let accounts = JSON.parse(fs.readFileSync(file));
  const now = Math.floor(Date.now() / 1000);

  for (const user in accounts) {
    accounts[user].status = now - accounts[user].timestamp > 60 ? "disconnected" : "active";
  }

  return Response.json({
    success: true,
    accounts: Object.values(accounts),
  });
}
