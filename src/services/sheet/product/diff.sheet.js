const productMapper = require("../../../sync/product/product.mapper");

function normalize(value) {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}


function buildDiff(mappedRows, sheetIndex) {
  const inserts = [];
  const updates = [];

  let skipped = 0;

  const seenIds = new Set();

  for (const row of mappedRows) {
    const uniqueId = String(row[0]);

    if (seenIds.has(uniqueId)) {
      throw new Error(
        `[Product Diff] Duplicate uniqueId: ${uniqueId}`
      );
    }

    seenIds.add(uniqueId);

    const existing = sheetIndex.get(uniqueId);

    // Sản phẩm mới
    if (!existing) {
      inserts.push(row);
      continue;
    }

    const changes = [];

    // So sánh các cột cần đồng bộ
    for (const header of productMapper.SYNC_HEADERS) {
      const columnIndex =
        productMapper.COLUMN_INDEX[header];

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

    // Mỗi sản phẩm chỉ được phân loại một lần
    if (changes.length > 0) {
      updates.push({
        uniqueId,
        rowNo: existing.rowNo,
        changes,
      });
    } else {
      skipped++;
    }
  }

  const total =
    inserts.length +
    updates.length +
    skipped;

  if (total !== mappedRows.length) {
    throw new Error(
      `[Product Diff] Invalid total: ${total}/${mappedRows.length}`
    );
  }

  return {
    inserts,
    updates,
    skipped,
    stats: {
      inserted: inserts.length,
      updated: updates.length,
      skipped,
      updateCells: updates.reduce(
        (sum, item) => sum + item.changes.length,
        0
      ),
    },
  };
}
module.exports = {
  buildDiff,
};