const { initializeDatabase, seedSampleOfficeAllocations } = require('../database');

async function seed() {
  const pool = await initializeDatabase();
  try {
    const result = await seedSampleOfficeAllocations(pool);
    if (!result.seeded.length) {
      console.log(`No eligible inventory items were available for sample allocations in ${result.allocationYear}.`);
    } else {
      console.log(`Sample allocations saved for ${result.seeded.length} inventory items across ${result.officeCount} offices in ${result.allocationYear}.`);
      result.seeded.forEach(item => {
        console.log(`${item.itemCode} - ${item.itemName}: ${item.stock} units across ${item.officeCount} offices.`);
      });
    }
    if (result.skipped.length) {
      console.log(`Skipped ${result.skipped.length} items with existing budgets, allocations, or active requests.`);
    }
  } finally {
    await pool.end();
  }
}

seed().catch(error => {
  console.error('Sample office allocations could not be seeded.', error);
  process.exitCode = 1;
});
