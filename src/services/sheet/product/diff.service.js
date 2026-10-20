function normalize(value) {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}
function compareBranchVariants({
  variants,
  sheetIndex,
  sheetName,
  locationId,
}) {
  const inserts = [];
  const updates = [];
  const seen = new Set();

  let skipped = 0;

  for (const variant of variants) {
    const row =productMapper.mapVariantToRow(variant);
    const id = String(
      row[productMapper.COLUMN_INDEX["hss_unique_id"]]
    );

    if (!id || id === "undefined") {
      throw new Error(
        `Variant không có ID tại location ${locationId}`
      );
    }

    if (seen.has(id)) {
      throw new Error(
        `Variant ID ${id} bị trùng trong response Sapo`
      );
    }

    seen.add(id);

    const existing = sheetIndex.get(id);

    if (!existing) {
      inserts.push({
        variantId: id,
        values: row,
      });

      continue;
    }

    const changes = [];

    for (const header of productMapper.SYNC_HEADERS) {
      const columnIndex =productMapper.COLUMN_INDEX[header];

      const oldValue = existing.values[columnIndex];
      const newValue = row[columnIndex];

      if (normalize(oldValue) !== normalize(newValue)) {
        changes.push({
          header,
          columnIndex,
          oldValue,
          newValue,
        });
      }
    }

    if (changes.length === 0) {
      skipped++;
      continue;
    }

    updates.push({
      variantId: id,
      rowNo: existing.rowNo,
      changes,
    });
  }

  return {
    locationId,
    sheetName,
    total: variants.length,
    inserts,
    updates,
    skipped,
    stats: {
      inserted: inserts.length,
      updated: updates.length,
      skipped,
    },
  };
}
module.exports = {
  compareBranchVariants,
};