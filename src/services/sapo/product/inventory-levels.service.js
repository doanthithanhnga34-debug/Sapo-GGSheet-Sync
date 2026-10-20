const { chunk } = require("../../../utils/chunk");
const { sapoGet } = require("../sapo.service");

const BATCH_SIZE = 50;
const CONCURRENCY = 3;


async function getByIds({ inventoryItemIds, locationId }) {
  if (!locationId) {
    throw new Error("locationId is required");
  }

  const ids = [
    ...new Set(
      inventoryItemIds
        .filter((id) => id !== null && id !== undefined)
        .map(String),
    ),
  ];

  if (ids.length === 0) return [];

  const batches = chunk(ids, BATCH_SIZE);
  const results = [];

  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const group = batches.slice(i, i + CONCURRENCY);

    const responses = await Promise.all(
      group.map(async (batch) => {
        const params = new URLSearchParams({
          inventory_item_ids: batch.join(","),
          location_ids: String(locationId),
        });

        const data = await sapoGet(
          `/admin/inventory_levels.json?${params.toString()}`,
        );

        if (!Array.isArray(data?.inventory_levels)) {
          throw new Error(`Invalid Inventory Levels response: ${locationId}`);
        }

        return data.inventory_levels;
      }),
    );

    for (const levels of responses) {
      results.push(...levels);
    }
  }
  const returnedIds = new Set(
    results.map((level) => String(level.inventory_item_id)),
  );

  const missingIds = ids.filter((id) => !returnedIds.has(id));

  if (missingIds.length > 0) {
    console.warn("[InventoryLevel] Missing IDs", {
      locationId,
      requested: ids.length,
      returned: results.length,
      missing: missingIds.length,
      sample: missingIds.slice(0, 10),
    });
  }

  return results;
}
const inventoryLevelService = { getByIds };
module.exports = inventoryLevelService;
