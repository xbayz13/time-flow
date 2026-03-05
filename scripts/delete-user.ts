import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

const email = process.argv[2] ?? "ikhsanpahdian@gmail.com";

async function deleteUser() {
  const [deleted] = await db
    .delete(users)
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (deleted) {
    console.log(`✅ User deleted: ${deleted.email} (${deleted.id})`);
  } else {
    console.log(`⚠️ User not found: ${email}`);
  }
  process.exit(deleted ? 0 : 1);
}

deleteUser().catch((err) => {
  console.error("❌ Error:", (err as Error).message);
  process.exit(1);
});
