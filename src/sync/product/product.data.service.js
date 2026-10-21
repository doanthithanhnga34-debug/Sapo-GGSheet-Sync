const productMapper = require("./product.mapper");

function buildDataMaps({ products, inventoryItems, inventoryLevels }) {
  return {
    productMap: new Map(
      products.map((product) => [String(product.id), product]),
    ),
    inventoryItemMap: new Map(
      inventoryItems.map((item) => [String(item.id), item]),
    ),

    inventoryLevelMap: new Map(
      inventoryLevels.map((level) => [
        `${level.inventory_item_id}_${level.location_id}`,
        level,
      ]),
    ),
  };
}
function buildBranchRows({ branch, dataMaps }) {
  const locationId = String(branch.locationId);
  const rows = [];

  const { productMap, inventoryItemMap, inventoryLevelMap } = dataMaps;

  if (!Array.isArray(branch.variants)) {
    throw new Error(`Invalid variants for location ${locationId}`);
  }

  for (const variant of branch.variants) {
    const product = productMap.get(String(variant.product_id));

    const inventoryItem = inventoryItemMap.get(
      String(variant.inventory_item_id),
    );

    const inventoryLevel = inventoryLevelMap.get(
      `${variant.inventory_item_id}_${locationId}`,
    );

    if (!product) {
      throw new Error(`Product not found: ${variant.product_id}`);
    }

    if (!inventoryItem) {
      throw new Error(`Inventory Item not found: ${variant.inventory_item_id}`);
    }

    if (!inventoryLevel) {
      throw new Error(
        `Inventory Level not found: ` +
          `${variant.inventory_item_id}, location ${locationId}`,
      );
    }

    // Kiểm tra thêm để tránh ghép nhầm giá vốn.
    if (String(inventoryItem.variant_id) !== String(variant.id)) {
      throw new Error(`Inventory Item mismatch: variant ${variant.id}`);
    }
   
    rows.push(
      productMapper.mapVariantToRow(
        variant,
        locationId,
        product,
        inventoryItem,
        inventoryLevel,
      ),
    );
  }

  return {
    locationId,
    locationName: branch.locationName,
    total: rows.length,
    rows,
  };
}

module.exports = {
  buildDataMaps,
  buildBranchRows,
};
