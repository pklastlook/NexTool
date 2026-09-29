import { PrismaClient } from "@prisma/client";
import { createApiKey } from "../src/lib/api-keys";
const db = new PrismaClient();
async function main() {
  let user = await db.user.findUnique({ where: { email: "test-api@nextool.local" } });
  if (!user) {
    user = await db.user.create({ data: { email: "test-api@nextool.local", name: "API Test User", role: "user" } });
    console.log("Created user:", user.id);
  } else {
    console.log("Found user:", user.id);
  }
  const result = await createApiKey(user.id, "smoke-test-key");
  console.log("API_KEY=" + result.fullKey);
  console.log("PREFIX=" + result.apiKey.keyPrefix);
}
main().then(() => db.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
