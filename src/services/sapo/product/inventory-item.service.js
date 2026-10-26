const { chunk } = require("../../../utils/chunk");
const { sapoGet } = require("../sapo.service");


const BATCH_SIZE = 50;
const CONCURRENCY = 3;

async function getByIds(inventoryItemIds) {
  if (!Array.isArray(inventoryItemIds)) {
    throw new Error("inventoryItemIds must be an array");
  }

  // Loại bỏ null, undefined, chuỗi rỗng và ID trùng.
  const ids = [
    ...new Set(
      inventoryItemIds
        .filter(
          (id) =>
            id !== null &&
            id !== undefined &&
            String(id).trim() !== ""
        )
        .map(String)
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
          ids: batch.join(","),
          limit: String(BATCH_SIZE),
        });

        const data = await sapoGet(
          `/admin/inventory_items.json?${params.toString()}`
        );

        if (!Array.isArray(data?.inventory_items)) {
          throw new Error(
            "[InventoryItem] Invalid API response"
          );
        }

        const items = data.inventory_items;

        // Phát hiện trường hợp API bỏ qua tham số ids.
        const requestedIds = new Set(batch);

        const unexpectedIds = items
          .map((item) => String(item.id))
          .filter((id) => !requestedIds.has(id));

        if (unexpectedIds.length > 0) {
          throw new Error(
            `[InventoryItem] API returned unexpected IDs: ` +
            unexpectedIds.slice(0, 5).join(", ")
          );
        }

        return items;
      })
    );

    for (const items of responses) {
      results.push(...items);
    }
  }

  // Loại trùng và kiểm tra tính đầy đủ.
  const itemMap = new Map();

  for (const item of results) {
    const id = String(item.id);

    if (itemMap.has(id)) {
      throw new Error(
        `[InventoryItem] Duplicate ID: ${id}`
      );
    }

    itemMap.set(id, item);
  }

  const missingIds = ids.filter(
    (id) => !itemMap.has(id)
  );

  if (missingIds.length > 0) {
    console.warn("[InventoryItem] Missing IDs", {
      requested: ids.length,
      returned: itemMap.size,
      missing: missingIds.length,
      sample: missingIds.slice(0, 10),
    });
  }

  return [...itemMap.values()];
}

async function inventoryItemMapping(products){
  const mappings = new Map();
  for(const product of products){
    for(const variant of product.variants){
         if (variant.type !== "normal") {
        continue;
      }
      if(variant.id == null || variant.inventory_item_id == null){
        continue;
      }
      const inventoryItemId = String(variant.inventory_item_id);
      mappings.set(inventoryItemId,{
        inventoryItemId,
        variantId:String(variant.id),
        productId:String(product.id)
      });
    }
  }
  return [...mappings.values()]
}

const inventoryItemService ={
    getByIds,
    inventoryItemMapping
}

module.exports = inventoryItemService