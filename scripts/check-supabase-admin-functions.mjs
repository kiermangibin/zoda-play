import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const functions = new Map();
const functionPattern =
  /create\s+or\s+replace\s+function\s+public\.([a-z_][a-z0-9_]*)\s*\([^)]*\)\s*returns\s+table\s*\(([\s\S]*?)\)\s*[\s\S]*?\bas\s+\$\$([\s\S]*?)\$\$/gi;

for (const file of migrationFiles) {
  const sql = readFileSync(join(migrationsDir, file), "utf8");

  for (const match of sql.matchAll(functionPattern)) {
    const [, name, returnColumnsSql, body] = match;
    const returnColumns = returnColumnsSql
      .split(",")
      .map((column) => column.trim().split(/\s+/)[0])
      .filter(Boolean);

    functions.set(name, { body, file, returnColumns });
  }
}

const failures = [];

for (const [name, definition] of functions) {
  for (const column of definition.returnColumns) {
    const unqualifiedReference = new RegExp(
      String.raw`\b(where|and|or|on|using|order\s+by|group\s+by|returning)\s+${column}\b`,
      "i",
    );

    if (unqualifiedReference.test(definition.body)) {
      failures.push(
        `${definition.file}: public.${name} returns column "${column}" and uses it unqualified in a SQL clause.`,
      );
    }
  }
}

const removeAdmin = functions.get("remove_admin_user");

if (!removeAdmin) {
  failures.push("Missing public.remove_admin_user RPC definition.");
} else {
  const requiredSnippets = [
    "public.current_user_is_admin()",
    "You cannot remove your own admin access",
    "At least one admin is required",
    "where admin.email <> normalized_email",
    "where admin.email = normalized_email",
  ];

  for (const snippet of requiredSnippets) {
    if (!removeAdmin.body.includes(snippet)) {
      failures.push(
        `${removeAdmin.file}: public.remove_admin_user is missing required guard: ${snippet}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Supabase admin function checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Supabase admin function checks passed.");
