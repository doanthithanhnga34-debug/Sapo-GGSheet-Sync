async function syncOneBranch({
  locationId,
  locationName,
  dryRun = true,
  branch: providedBranch = null,
}) {
  let branch = providedBranch;

  // Nếu chạy riêng một chi nhánh, chỉ lấy chi nhánh đó
  if (!branch) {
    const variants = [];
    let page = 1;
    const limit = config.sapo.productLimit;

    while (true) {
      const data = await variantService.getVariants({
        locationId,
        page,
        limit,
      });

      if (!Array.isArray(data)) {
        throw new Error(
          `[Product Sync] Invalid variants response: ${locationName}`
        );
      }

      variants.push(...data);

      if (data.length < limit) break;
      page++;
    }

    branch = {
      locationId,
      locationName,
      success: true,
      variants,
    };
  }

  const {
    productIds,
    inventoryItemIds,
  } = collectIds([branch]);

  const products = await productServices.getByIds(productIds);

  const inventoryItems =
    await inventoryItemService.getByIds(inventoryItemIds);

  const inventoryLevels = await inventoryLevelService.getByIds({
    inventoryItemIds,
    locationId,
  });

  console.log("[Product Mapping]", {
    locationId,
    variants: branch.variants.length,
    products: products.length,
    inventoryItems: inventoryItems.length,
    inventoryLevels: inventoryLevels.length,
  });

  const dataMaps = buildDataMaps({
    products,
    inventoryItems,
    inventoryLevels,
  });

  if (!dryRun) {
    await sheetServices.ensureSheet(
      locationName,
      1000,
      productMapper.HEADERS.length,
      config.sheetProduct.id
    );
  }

  const mapped = buildBranchRows({
    branch,
    dataMaps,
  });

  return processProductSheet({
    branch,
    mappedRows: mapped.rows,
    spreadsheetId: config.sheetProduct.id,
    dryRun,
  });
}
async function syncAllBranches({ dryRun = true } = {}) {
  const startedAt = Date.now();

  // Chỉ lấy Variants của 7 chi nhánh một lần
  const variantResults = await buildVariantAllBranch();

  const results = [];

  for (const [index, branch] of variantResults.branches.entries()) {
    const branchStartedAt = Date.now();

    console.log(
      `[Product Sync] ${index + 1}/${variantResults.branches.length}` +
      ` - ${branch.locationName}`
    );

    if (!branch.success) {
      results.push({
        locationId: String(branch.locationId),
        locationName: branch.locationName,
        success: false,
        error: branch.error,
      });

      continue;
    }

    try {
      const result = await syncOneBranch({
        locationId: String(branch.locationId),
        locationName: branch.locationName,
        branch,
        dryRun,
      });

      results.push({
        ...result,
        success: true,
        durationSeconds:
          (Date.now() - branchStartedAt) / 1000,
      });
    } catch (error) {
      console.error("[Product Sync] FAILED", {
        locationName: branch.locationName,
        message: error.message,
      });

      results.push({
        locationId: String(branch.locationId),
        locationName: branch.locationName,
        success: false,
        error: error.message,
      });
    }
  }

  return {
    dryRun,
    totalLocations: variantResults.totalLocations,
    successLocations: results.filter((r) => r.success).length,
    failedLocations: results.filter((r) => !r.success).length,
    totalDurationSeconds: (Date.now() - startedAt) / 1000,
    branches: results,
  };
}