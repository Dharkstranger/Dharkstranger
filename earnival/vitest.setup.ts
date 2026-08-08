// Integration tests talk to the real database, so load .env the way `next` does.
if (typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env present (CI provides real env vars) — carry on.
  }
}
