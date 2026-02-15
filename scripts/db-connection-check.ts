import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/timeflow";

async function check() {
  const sql = postgres(connectionString, { max: 1 });

  try {
    await sql`SELECT 1`;
    console.log("✅ Database connection OK");
    process.exit(0);
  } catch (err) {
    console.error("❌ Database connection failed:", (err as Error).message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

check();
