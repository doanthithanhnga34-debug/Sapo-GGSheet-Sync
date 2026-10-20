

function quoteSheetName(name){
    return `'${String(name).replace(/'/g, "''")}'`;
}
function buildTabIndex(rows, sheetName) {
  const index = new Map();

  rows.forEach((row, i) => {
    const id = String(
      row[productMapper.COLUMN_INDEX["hss_unique_id"]] ?? ""
    ).trim();

    if (!id) return;

    if (index.has(id)) {
      throw new Error(
        `Duplicate hss_unique_id=${id} in ${sheetName}`
      );
    }

    index.set(id, {
      rowNo: i + 2,
      values: Array.from(
        { length: productMapper.HEADERS.length },
        (_, column) => row[column] ?? ""
      ),
    });
  });

  return index;
}
async function buildAllSheetIndexes({
  sheets,
  spreadsheetId,
  locations,
}) {
  const ranges = locations.map((location) => {
    const sheetName = location.sheetName || location.name;
    return `${quoteSheetName(sheetName)}!A2:AE`;
  });

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  const valueRanges = response.data.valueRanges || [];
  const sheetIndexes = new Map();

  if (valueRanges.length !== locations.length) {
    throw new Error("Không đọc đủ dữ liệu của 7 tab");
  }

  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];
    const sheetName = location.sheetName || location.name;

    sheetIndexes.set(String(location.id), {
      sheetName,
      index: buildTabIndex(
        valueRanges[i].values || [],
        sheetName
      ),
    });
  }

  return sheetIndexes;
}

module.exports = {
  buildAllSheetIndexes,
};