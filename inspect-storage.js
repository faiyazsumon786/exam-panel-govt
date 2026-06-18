const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgresql://postgres.jbgtaaoapatuncociokf:Jahid4GPT5Plus01@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres",
  });

  await client.connect();
  console.log("Connected to database successfully!");

  // List all users
  const usersRes = await client.query("SELECT id, full_name, email, role, status, profile_picture FROM public.users");
  console.log("\n--- All Users ---");
  console.log(usersRes.rows);

  await client.end();
}

main().catch(console.error);
