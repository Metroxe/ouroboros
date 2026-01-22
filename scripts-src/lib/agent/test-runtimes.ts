import { getAvailableRuntimes, getAllRuntimes } from "./index.js";

async function testRuntimes() {
  console.log("--- Testing Agent CLI Wrappers ---\n");

  const allRuntimes = getAllRuntimes();
  console.log(`Found ${allRuntimes.length} runtimes in registry:`, allRuntimes.map(r => r.displayName).join(", "));

  console.log("\nChecking availability...");
  const available = await getAvailableRuntimes();
  console.log("Available runtimes:", available.length > 0 ? available.map(r => r.displayName).join(", ") : "None");

  for (const runtime of allRuntimes) {
    console.log(`\n--- Testing Runtime: ${runtime.displayName} ---`);
    
    const isAvailable = await runtime.isAvailable();
    console.log(`Is available: ${isAvailable}`);

    try {
      console.log(`Fetching models for ${runtime.displayName}...`);
      const models = await runtime.listModels();
      console.log(`Found ${models.length} models:`);
      models.slice(0, 3).forEach(m => console.log(`  - ${m.name} (${m.id})`));
      if (models.length > 3) console.log(`  ... and ${models.length - 3} more`);
    } catch (error) {
      console.error(`Error listing models for ${runtime.name}:`, error);
    }

    if (isAvailable) {
      console.log(`Testing runPrompt (dry run/version check) for ${runtime.displayName}...`);
      try {
        // We use a very simple prompt that shouldn't trigger expensive operations
        // or we just check if we can run the command at all.
        const result = await runtime.runPrompt("echo 'test connection'", {
          automated: true,
          streamOutput: false
        });
        console.log(`Prompt result success: ${result.success}`);
        console.log(`Duration: ${result.durationMs}ms`);
        if (result.tokenUsage) {
          console.log(`Token usage:`, result.tokenUsage);
        }
      } catch (error) {
        console.error(`Error running prompt for ${runtime.name}:`, error);
      }
    } else {
      console.log(`Skipping prompt test for ${runtime.displayName} as it is not available.`);
    }
  }
}

testRuntimes().catch(console.error);
