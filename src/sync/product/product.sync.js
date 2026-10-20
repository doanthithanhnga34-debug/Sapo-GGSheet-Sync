const config = require("../../config/config");
const locationFS = require("../../services/firestore/location.firestore");
const inventoryItemService = require("../../services/sapo/product/inventory-item.service");
const inventoryLevelService = require("../../services/sapo/product/inventory-levels.service");
const locationService = require("../../services/sapo/product/location.service");
const productServices = require("../../services/sapo/product/product.service");
const variantService = require("../../services/sapo/product/variant.service");
const { collectIds } = require("./IdsCollectors");
const { buildBranchRows, buildDataMaps } = require("./product.data.service");

async function buildLocations() {
  const data = await locationService.getAllLocations({
    page: 0,
    limit: config.sapo.limit,
  });
  const locations = data.map((item) => ({
    id: item.id,
    name: item.name,
  }));

  await Promise.all(
    locations.map((location) => locationFS.set(String(location.id), location)),
  );
  return locations;
}

async function buildProductSync() {
  const page = 1;
  const limit = config.sapo.limit;

  const products = await productServices.getProducts({ page, limit });

  console.log("Products", products);
}

async function buildTestVariant() {
  const location = await locationFS.get("924281");
  const startedAt = Date.now();

  let page = 1;
  const variants = [];

  while (true) {
    const data = await variantService.getVariants({
      locationId: location.id,
      page,
      limit: config.sapo.productLimit,
    });

    // Giả sử getVariants trả về mảng
    variants.push(...data);
    console.log(data.length);

    if (data.length < config.sapo.productLimit) {
      break;
    }

    page++;
  }

  return {
    locationId: location.id,
    locationName: location.name,
    variants,
    total: variants.length,
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
  };
}

async function buildTestVariantAllBranch() {
  const startedAt = Date.now();

  // Lấy toàn bộ locations từ Firestore
  const locations = await locationFS.getAll();

  const CONCURRENCY = 3;

  async function fetchBranchVariants(location) {
    const branchStartedAt = Date.now();

    let page = 1;
    const variants = [];

    while (true) {
      const data = await variantService.getVariants({
        locationId: location.id,
        page,
        limit: config.sapo.productLimit,
      });

      variants.push(...data);

      console.log(`[${location.name}] Page ${page}: ${data.length} variants`);

      if (data.length < config.sapo.productLimit) {
        break;
      }

      page++;
    }

    return {
      locationId: location.id,
      locationName: location.name,
      total: variants.length,
      durationSeconds: Math.round((Date.now() - branchStartedAt) / 1000),
      variants,
    };
  }

  const results = [];

  // Chạy theo từng nhóm tối đa 3 chi nhánh
  for (let i = 0; i < locations.length; i += CONCURRENCY) {
    const batch = locations.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.allSettled(
      batch.map((location) => fetchBranchVariants(location)),
    );

    batchResults.forEach((result, index) => {
      const location = batch[index];

      if (result.status === "fulfilled") {
        results.push({
          ...result.value,
          success: true,
        });
      } else {
        console.error(`[${location.name}] Sync failed:`, result.reason);

        results.push({
          locationId: location.id,
          locationName: location.name,
          success: false,
          total: 0,
          error: result.reason?.message || String(result.reason),
        });
      }
    });
  }

  return {
    totalLocations: locations.length,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    totalVariants: results.reduce((sum, r) => sum + r.total, 0),
    durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    branches: results,
  };
}

// async function testInventoryLevels(){
//   const variantResults = await buildTestVariantAllBranch();
//    const branches = variantResults.branches;
//     const { locationInventoryMap } = collectIds(branches);

//     const locationId = "925710";
//     const inventoryItemIds =
//       locationInventoryMap.get(locationId) || [];

//     const startedAt = Date.now();

//     const levels = await inventoryLevelService.getByIds({
//       inventoryItemIds,
//       locationId,
//     });

//     const inventoryLevelMap = new Map(
//       levels.map((level) => [
//         `${level.inventory_item_id}_${level.location_id}`,
//         level,
//       ])
//     );
//     const requestedIds = new Set(ids);
// const returnedIds = new Set();

// for (const level of results) {
//   const itemId = String(level.inventory_item_id);
//   const levelLocationId = String(level.location_id);

//   if (levelLocationId !== String(locationId)) {
//     throw new Error(
//       `[InventoryLevel] Wrong location: expected=${locationId}, received=${levelLocationId}`
//     );
//   }

//   if (!requestedIds.has(itemId)) {
//     throw new Error(
//       `[InventoryLevel] Unexpected inventoryItemId=${itemId}`
//     );
//   }

//   if (returnedIds.has(itemId)) {
//     throw new Error(
//       `[InventoryLevel] Duplicate inventoryItemId=${itemId}, location=${locationId}`
//     );
//   }

//   returnedIds.add(itemId);
// }

// const missingIds = ids.filter(
//   (id) => !returnedIds.has(id)
// );

// if (missingIds.length > 0) {
//   console.warn("[InventoryLevel] Missing IDs", {
//     locationId,
//     requested: ids.length,
//     returned: results.length,
//     missing: missingIds.length,
//     sample: missingIds.slice(0, 10),
//   });
// }

//     return {
//       locationId,
//       requestedIds: inventoryItemIds.length,
//       returnedLevels: returnedIds,
//       durationSeconds: (Date.now() - startedAt) / 1000,
//       sample: levels.slice(0,5),
//     };
// }

async function fetchEnrichmentData(branches) {
  const { productIds, inventoryItemIds, locationInventoryMap } =
    collectIds(branches);

  const [products, inventoryItems, inventoryLevels] = await Promise.all([
    productService.getByIds(productIds),

    inventoryItemService.getByIds(inventoryItemIds),

    inventoryLevelService.getByLocations(locationInventoryMap),
  ]);

  return {
    products,
    inventoryItems,
    inventoryLevels,
  };
}

async function testInventoryLevels() {
  const startedAt = Date.now();

  const variantResults = await buildTestVariantAllBranch({
    includeVariants: true,
  });

  const { productIds } = collectIds(variantResults.branches);

  console.log("inventoryItemIds LENGTH  ", productIds.length);

  const items = await productServices.getByIds(productIds);

  const returnedIds = new Set(items.map((item) => String(item.id)));

  return {
    requestedIds: productIds.length,
    returnedItems: items.length,
    uniqueItems: returnedIds.size,
    missingItems: productIds.filter((id) => !returnedIds.has(String(id)))
      .length,
    durationSeconds: (Date.now() - startedAt) / 1000,
    sample: items.slice(0, 5),
  };
}
async function testProductMapping() {
  const startedAt = Date.now();

  // 1. Lấy Variants một lần.
  const variantResults = await buildTestVariantAllBranch({
    includeVariants: true,
  });

  // 2. Chỉ chọn chi nhánh muốn test.
  const locationId = "924281";

  const branch = variantResults.branches.find(
    (item) => String(item.locationId) === locationId,
  );

  if (!branch || !branch.success) {
    throw new Error(`Cannot fetch variants for location ${locationId}`);
  }

  // 3. Gom ID từ chính chi nhánh cần test.
  const { productIds, inventoryItemIds, locationInventoryMap } = collectIds([
    branch,
  ]);

  // 4. Gọi ba API độc lập.
  const products = await productServices.getByIds(productIds);

  const inventoryItems = await inventoryItemService.getByIds(inventoryItemIds);

  const inventoryLevels = await inventoryLevelService.getByIds({
    inventoryItemIds,
    locationId,
  });
  // 5. Kiểm tra số lượng.
  console.log("[Product Mapping]", {
    variants: branch.variants.length,
    products: products.length,
    inventoryItems: inventoryItems.length,
    inventoryLevels: inventoryLevels.length,
  });

  // 6. Tạo Map.
  const dataMaps = buildDataMaps({
    products,
    inventoryItems,
    inventoryLevels,
  });

  // 7. Ghép dữ liệu thành các dòng 31 cột.
  const result = buildBranchRows({
    branch,
    dataMaps,
  });

  return {
    locationId,
    locationName: branch.locationName,
    totalRows: result.total,
    columnCount: result.rows[0]?.length ?? 0,
    durationSeconds: (Date.now() - startedAt) / 1000,
    sample: result.rows.slice(0, 3),
  };
}
const productSync = {
  buildProductSync,
  buildLocations,
  buildTestVariant,
  buildTestVariantAllBranch,
  testInventoryLevels,
  testProductMapping,
};

module.exports = productSync;
