const config = require("../../../config/config");
const { sleep } = require("../../../infrastructure/retry");
const { chunk } = require("../../../utils/chunk");
const { sapoGet } = require("../sapo.service");

const BATCH_SIZE = 50;
const CONCURRENCY = 3;
async function getByIds(productIds) {
  if (!Array.isArray(productIds)) {
    throw new Error("productIds must be an array");
  }
  const ids = [
    ...new Set(
      productIds
        .filter(
          (id) => id !== null && id !== undefined && String(id).trim() !== "",
        )
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
          ids: batch.join(","),
          limit: String(BATCH_SIZE),
        });

        const data = await sapoGet(`/admin/products.json?${params.toString()}`);

        if (!Array.isArray(data?.products)) {
          throw new Error("[products] Invalid API response");
        }

        const items = data.products;

        // Phát hiện trường hợp API bỏ qua tham số ids.
        const requestedIds = new Set(batch);

        const unexpectedIds = items
          .map((item) => String(item.id))
          .filter((id) => !requestedIds.has(id));

        if (unexpectedIds.length > 0) {
          throw new Error(
            `[InventoryItem] API returned unexpected IDs: ` +
              unexpectedIds.slice(0, 5).join(", "),
          );
        }

        return items;
      }),
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
      throw new Error(`[InventoryItem] Duplicate ID: ${id}`);
    }

    itemMap.set(id, item);
  }

  const missingIds = ids.filter((id) => !itemMap.has(id));

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

async function getProducts({ page = 1, limit = config.sapo.productLimit }) {
  const params = new URLSearchParams({
    page: page,
    limit: limit,
  });

  const data = await sapoGet(`/admin/products.json?${params.toString()}`);
  await sleep(config.sync.requestDelay);
  return Array.isArray(data?.products) ? data.products : [];
}

async function getAllProduct(){
  let page = 1;
  const limit = config.sapo.productLimit;
  const products =[]
  while(true){
    const data = await getProducts({page, limit});

    products.push(...data);

    if(data.length < limit){
      break;
    }
    page++
  }
  return products;

}
const productServices = { getByIds, getProducts, getAllProduct };
module.exports = productServices;
