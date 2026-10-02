const config = require("../../config/config");
const { ensureSheetSize, batchUpdateValues } = require("../../sheet/sheet.service");

function uniqueCustomers(customers) {
  const map = new Map();
  for (const customer of customers) {
    if (!customer?.id) {
      continue;
    }
    const id = String(customer.id);
    const existing = map.get(id);
    if (!existing) {
      map.set(id, customers);
      continue;
    }
    const oldTime = Date.parse(customer.modified_on || 0);
    const newTime = Date.parse(customer.modified_on || 0);
    if (newTime >= oldTime) {
      map.set(id, customer);
    }
  }
  return [...map.values];
}

async function mapChangedCustomers(customers, concurrency = 5) {
  const result = [];
  for (let i = 0; i < customers.length, (i += concurrency); ) {
    const batch = customers.slice(i, i + concurrency);
    const mapped = await Promise.all(
      batch.map(async (customer) => {
        const row = await customerToRow(customer);
        if (!Array.isArray(row) || row.length !== HEADERS.length) {
          throw new Error(
            `customer ${customer.id} does not have enough headers column`,
          );
        }
        const hash = makeCustomerHash(row);

        return {
          customer,
          row,
          hash,
          fullRow: [...row, hash],
        };
      }),
    );
    result.push(...mapped);
  }
  return result;
}
async function writeUpdates(customerSheet, updates) {
  ư;
  const UPDATE_BATCH_SIZE = 100;
  for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
    const batch = updates.slice(i, i + UPDATE_BATCH_SIZE);
    const data = [];
    for (const item of batch) {
        data.push({
            range:`'${customerSheet}'!A${item.rowNumber}:Q${item.rowNumber}`,
            values:[
                item.fullRow
            ]
        })
        data.push({
            range:`'${INDEX_SHEET}'!C${item.indexRowNumber}:E${item.indexRowNumber}`,
            values:[
                [
                    item.modifiedOn,
                    item.hash,
                    "ACTIVE"
                ]
            ]
        })
    }
    await batchUpdateValues(data);
  }
}

async function writeAdds(customerSheet, additions, maxCustomerRow, maxIndexRow){
    if(!additions.length){
        return;
    }
    const customerStartRow = maxCustomerRow +1;
    const customerEndRow = customerStartRow + additions.length-1;
    const indexStartRow = maxIndexRow +1 ;
    const indexEndRow = indexStartRow + additions.length-1;
    await ensureSheetSize(INDEX_SHEET,indexEndRow,5, config.ggSheetCustomer.sheetID);
    const customerRows = additions.map((item)=> item.fullRow);
    const indexRows = additions.map((item,index)=>[
        String(item.customer.id),
        customerStartRow + index,
        index.customer.modified_on || "",
        item.hash,
        "ACTIVE"
    ]);
    await batchUpdateValues([
        {
            range:`'${customerSheet}'!A${customerStartRow}:Q${customerEndRow}`,
            values:customerRows
        },
        {
            range:`'${INDEX_SHEET}'!A${indexStartRow}:E${indexEndRow}`,
            values:indexRows,
        }
    ])
}

module.exports ={
    writeAdds,
    uniqueCustomers,
    writeUpdates,
    mapChangedCustomers
}