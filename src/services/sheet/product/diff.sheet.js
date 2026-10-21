const productMapper = require("../../../sync/product/product.mapper");

function normalize(value) {
  return value === null || value === undefined
    ? ""
    : String(value).trim();
}

function buildDiff(mappedRows, sheetIndex){
  const inserts = [];
  const updates =[];
  const seen = new Set();

  let skipped = 0;
  for(const row of mappedRows){
    const uniqueId = String(row[0]);
    if(seen.has(uniqueId)){
      throw new Error(`Duplicate mapped ID: ${uniqueId}`);
    }
    seen.add(uniqueId);

    const existing = sheetIndex.get(uniqueId);
    if(!existing){
      inserts.push(row);
      continue;
    }
    const changes = [];
    for(const header of productMapper.SYNC_HEADERS){
      const columnIndex = productMapper.COLUMN_INDEX[header];
      const oldValue = existing.values[columnIndex];
      const newValue = row[columnIndex];

      if(String(normalize(oldValue)) !== String(normalize(newValue))){
        changes.push({
          header,
          columnIndex,
          oldValue,
          newValue
        })
      }
      if(changes.length === 0){
        skipped++;
        continue;
      }
      updates.push({
        uniqueId,
        rowNo:existing.rowNo,
        changes
      })
    }
  }
   return {
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
  buildDiff,
};