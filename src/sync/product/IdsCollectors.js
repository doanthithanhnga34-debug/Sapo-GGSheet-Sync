function collectIds(branches) {
  const productIds = new Set();
  const inventoryItemIds = new Set();
  const locationInventoryMap = new Map();

  for (const branch of branches) {
    if (branch.success === false) continue;

    if (!Array.isArray(branch.variants)) {
      throw new Error(
        `Location ${branch.locationId} không có mảng variants. ` +
          `Kiểm tra buildTestVariantAllBranch().`,
      );
    }

    const locationId = String(branch.locationId);
    const branchInventoryIds = new Set();

    for (const variant of branch.variants) {
      if (variant.product_id != null) {
        productIds.add(String(variant.product_id));
      }

      if (variant.inventory_item_id != null) {
        const inventoryItemId = String(variant.inventory_item_id);

        inventoryItemIds.add(inventoryItemId);
        branchInventoryIds.add(inventoryItemId);
      }
    }

    locationInventoryMap.set(locationId, [...branchInventoryIds]);
  }

  return {
    productIds: [...productIds],
    inventoryItemIds: [...inventoryItemIds],
    locationInventoryMap,
  };
}


module.exports = {
  collectIds,
};
