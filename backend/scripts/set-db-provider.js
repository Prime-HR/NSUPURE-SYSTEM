const fs = require("fs");
const path = require("path");

const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma");

// Target provider from CLI argument (e.g. "postgresql" or "sqlite")
// or detected from DATABASE_URL
let targetProvider = process.argv[2];

if (!targetProvider) {
  const dbUrl = process.env.DATABASE_URL || "";
  if (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://")) {
    targetProvider = "postgresql";
  } else {
    targetProvider = "sqlite";
  }
}

if (!["postgresql", "sqlite"].includes(targetProvider)) {
  console.error(`Invalid database provider: ${targetProvider}. Must be 'postgresql' or 'sqlite'.`);
  process.exit(1);
}

try {
  let content = fs.readFileSync(schemaPath, "utf8");
  
  // Replace provider in datasource block
  const updated = content.replace(
    /datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"[^"]+"[\s\S]*?\}/,
    (match) => match.replace(/provider\s*=\s*"[^"]+"/, `provider = "${targetProvider}"`)
  );

  fs.writeFileSync(schemaPath, updated, "utf8");
  console.log(`[Database Provider] Updated schema.prisma datasource provider to: "${targetProvider}"`);
} catch (err) {
  console.error("Failed to update schema.prisma provider:", err);
  process.exit(1);
}
