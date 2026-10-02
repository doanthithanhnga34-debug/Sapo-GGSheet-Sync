const config = require("../../config/config");
const customerService = require("../../services/sapo/customers/customer.service");
const { updateValues, ensureSheet, ensureHeaders, getValues, appendValue, batchUpdateValues } = require("../../services/sheet/sheet.service");
const customerSyncState = require("../../services/syncState/customerSyncState.service");
const { columnNumberToLetter } = require("../../utils/sheet.helper");
const customerMapper = require("./customer.mapper");
const { customerToRow } = require("./customer.mapper");

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


async function buildOneCustomer(id) {
  const customerId = String(id ?? "").trim();

  const customer = await customerService.getCustomer(customerId);
  const row = await customerMapper.customerToRow(customer);
  if (!Array.isArray(row) || row.length !== customerMapper.HEADERS.length) {
    throw new Error(`Data customer is not matched ${customerMapper.HEADERS.length} cột`);
  }

  console.log(`customer test successfully, number of column  = ${row.length}`);
  return {
    customer: customer,
    row,
  };
}


async function writeOneCustomerToSheet(id) {
  const customerId = String(id ?? "").trim();
  const baseNameSheet = config.ggSheetCustomer?.customerSheetName;
  const { row } = await buildOneCustomer(customerId);

  const cells = row.map((value, index) => {
    if (value == null) return "";

    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      return value;
    }
    throw new Error(`Invalid value at column ${HEADERS[index]}`);
  });

  const sheetName = `${baseNameSheet.trim()} TEST`;
  const escapedName = sheetName.replace(/'/g, "''");
  const range = `'${escapedName}'!A1:P2`;

  await updateValues(range, [customerMapper.HEADERS, cells], config.ggSheetCustomer.sheetID);
  return {
    success: true,
    customerId,
    sheetName,
    range,
    customersWritten: 1,
    totalColumns: cells.length,
  };
}

async function buildCustomerIdIndex() {
  const sheetName =
    config.ggSheetCustomer.customerSheetName;

  const spreadsheetId =
    config.ggSheetCustomer.sheetID;

  const lastColumn =
    columnNumberToLetter(
     customerMapper.HEADERS.length
    );

  const values =
    await getValues(
      `'${sheetName}'!A2:${lastColumn}`,
      spreadsheetId
    );

  const idIndex =
   customerMapper.HEADERS.indexOf(
      "Mã khách hàng"
    );

  const hashIndex =
   customerMapper.HEADERS.indexOf(
      "Sync_hash"
    );

  if (idIndex === -1) {
    throw new Error(
      "Not found Mã khách hàng"
    );
  }

  if (hashIndex === -1) {
    throw new Error(
      "Not found Sync_hash"
    );
  }

  const index = new Map();
  const duplicates = [];

  values.forEach((row, i) => {
    const id =
      String(
        row[idIndex] ?? ""
      ).trim();

    if (!id) {
      return;
    }

    const sheetRow =
      i + 2;

    const hash =
      String(
        row[hashIndex] ?? ""
      ).trim();

    if (index.has(id)) {
      duplicates.push({
        id,
        firstRow:
          index.get(id).row,
        duplicateRow:
          sheetRow,
      });

      return;
    }

    index.set(id, {
      row: sheetRow,
      hash,
    });
  });

  return {
    index,
    duplicates,
  };
}

async function buildBatchCustomerSync() {
  const limit = config.sapo.customerLimit;

  const syncState = await customerSyncState.get();

  console.log("sync_state", syncState);
  const page = Number(syncState.nextPage || 1);
  console.log(`Customer start batch page =${page}, limit =${limit}`);

  try {
    await customerSyncState.set({
      status: "running",
    });
    const customers = await customerService.getCustomers({ page, limit, sortKey:"id" });
    if (!customers.length) {
      await customerSyncState.markCustomerSyncStateDone();
      return {
        success: true,
        done: true,
        page,
        customerCount: 0,
        message: "Customer full sync completed",
      };
    }

    const rows = [];
    for (const customer of customers) {
      const row = await customerMapper.customerToRow(customer);
      if (!Array.isArray(row) || row.length !== customerMapper.HEADERS.length) {
        throw new Error(`Data customer is not matched ${HEADERS.length}`);
      }
      rows.push(row);
    }
    const sheetName = String(config.ggSheetCustomer.customerSheetName).trim();
    const sheetID = String(config.ggSheetCustomer.sheetID);
    const startRow = (page - 1) * limit + 2;
    const endRow = startRow + rows.length - 1;
    await ensureSheet(
      sheetName,
      Math.max(endRow, 1000),
     customerMapper.HEADERS.length,
      sheetID,
    );  
    await ensureHeaders(sheetName,customerMapper.HEADERS, sheetID);
    await ensureSheetSize(sheetName, endRow,customerMapper.HEADERS.length, sheetID);

    const lastColumn = columnNumberToLetter(HEADERS.length);

    await updateValues(
      `'${sheetName}'!A${startRow}:${lastColumn}${endRow}`,
      rows,
      config.ggSheetCustomer.sheetID,
    );

    console.log(`[customer] page =${page}, wrote = ${rows.length}`);

    const done = customers.length < limit;
    await customerSyncState.set({
      page: page,
      nextPage: page + 1,
      status: done ? "done" : "idle",
    });

    return {
      success: true,
      done,
      page,
      nextPage: page + 1,
      customerCount: customers.length,
      rows: rows,
      startRow,
      endRow,
    };
  } catch (e) {
    await customerSyncState.set({
      status: "error",
    });
    throw e;
  }
}

async function incremental() {
  const limit = config.sapo.customerLimit;
  const sheetName = config.ggSheetCustomer.customerSheetName;
  const spreadsheetId = config.ggSheetCustomer.sheetID;
  const state = await customerSyncState.get();
  const runStartedAt = new Date().toISOString();

  const checkpoint =
    state.lastModifiedOn ||
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const modifiedFrom = new Date(
    new Date(checkpoint).getTime() - 60 * 60 * 1000,
  ).toISOString();
  console.log(`incremental from = ${modifiedFrom}`);
  const { index: customerIndex } = await buildCustomerIdIndex();
  const pendingNew = new Map();
  const updateData = [];
  const lastColumn = columnNumberToLetter(customerMapper.HEADERS.length);
  const hashIndex =customerMapper.HEADERS.indexOf("Sync_hash");

  let page = 1;
  let totalSapo = 0;
  let totalAdd = 0;
  let totalUpdate = 0;
  let totalSkip = 0;

  while (true) {
    const customers = await customerService.getCustomers({
      page,
      limit,
      modifiedFrom,
      sortKey: "modified_on",
    });

    console.log(`incremental page =${page}, count=${customers.length}`);
    if (!customers.length) {
      break;
    }
    totalSapo += customers.length;

    for (const customer of customers) {
      const id = String(customer.id ?? "").trim();

      if (!id) {
        continue;
      }
      const row = await customerToRow(customer);
      const newHash = String(row[hashIndex] ?? "").trim();
      const existing = customerIndex.get(id);

      if (!existing) {
        pendingNew.set(id, row);
        continue;
      }
      if (existing.hash === newHash) {
        totalSkip++;
        continue;
      }
      updateData.push({
        range: `'${sheetName}'!A${existing.row}:${lastColumn}${existing.row}`,
        values: [row],
      });
      customerIndex.set(id, {
        row: existing.row,
        hash: newHash,
      });
      totalUpdate++;
    }
    if (customers.length < limit) {
      break;
    }
    page++;
  }

  if (updateData.length > 0) {
    await batchUpdateValues(updateData, spreadsheetId);
  }

  const newRows = [...pendingNew.values()];
  if (newRows.length > 0) {
    await appendValue(`'${sheetName}'!A:${lastColumn}`, newRows, spreadsheetId);
    totalAdd = newRows.length;
  }

  await customerSyncState.set({
    lastModifiedOn: runStartedAt,
    status: "idle",
  });
  console.log(
    `[INCREMENTAL DONE] ` +
      `sapo=${totalSapo}, ` +
      `add=${totalAdd}, ` +
      `update=${totalUpdate}, ` +
      `skip=${totalSkip}`,
  );

  return {
    success: true,
    modifiedFrom,
    checkpoint: runStartedAt,
    sapo: totalSapo,
    added: totalAdd,
    updated: totalUpdate,
    skipped: totalSkip,
  };
}

const customerSync = {
    writeAdds,
    uniqueCustomers,
    writeUpdates,
    mapChangedCustomers,

    buildOneCustomer,
    writeOneCustomerToSheet,

    buildCustomerIdIndex,
    buildBatchCustomerSync,
    incremental

}

module.exports =customerSync