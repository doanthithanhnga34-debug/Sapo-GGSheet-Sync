const config = require("../../config/config");
const {
  getCustomers,
  getCustomer,
} = require("../../sapo/customers/customer.service");
const { deleteRowsBatch } = require("../../sheet/sheet.service");
const { buildCustomerIdIndex } = require("../customers/buildCustomer.sync");

async function getAllSapoCustomersIds() {
  const limit = config.sapo.customerLimit;
  const ids = new Set();

  let page = 1;
  while (true) {
    const customers = await getCustomers({
      page,
      limit,
      sortKey: "id",
    });

    console.log(`delete check page =${page}, count=${customers.length}`);

    if (!customers.length) {
      break;
    }
    for (const customer of customers) {
      const id = String(customer.id ?? "").trim();
      if (id) {
        ids.add(id);
      }
    }
    if (customers.length < limit) {
      break;
    }
    page++;
  }
  console.log(`delete check total sapo ids = ${ids.size}`);
  return ids;
}

async function customerExistsOnSapo(customerId) {
  try {
    const customer = await getCustomer(customerId);
    return !!customer;
  } catch (e) {
    if (e.status === 404) {
      return false;
    }
    throw e;
  }
}

async function reconcileDeletedCustomers() {
  console.log(`delete reconcile start`);
  const { index: customerIndex } = await buildCustomerIdIndex();

  console.log(`delete reconcile sheet unique ids =${customerIndex.size}`);
  const sapoCustomersIds = await getAllSapoCustomersIds();
  const candidates = [];

  for (const [id, data] of customerIndex.entries()) {
    if (!sapoCustomersIds.has(id)) {
      candidates.push({
        id,
        row: data.row,
      });
    }
  }
  console.log(`delete reconcile candidates = ${candidates.length}`);
  if (!candidates.length) {
    return {
      success: true,
      sheetCustomers: customerIndex.size,
      sapoCustomers: sapoCustomersIds.size,
      candidates: 0,
      deleted: 0,
    };
  }

  const rowsToDelete = [];


  for (const candidate of candidates) {

    const exists = await customerExistsOnSapo(candidate.id);

    if (!exists) {
      console.log(`confirm deleted id =${candidate.id}`);
      rowsToDelete.push(candidate.row);
    } else {
      console.log(`keep id = ${candidate.id} still exist on Sapo`);
    }
  }
  if (rowsToDelete.length > 0) {
    await deleteRowsBatch(
      rowsToDelete,
      config.ggSheetCustomer.customerSheetName,
      config.ggSheetCustomer.sheetID,
    );
  }
  console.log(`Delete reconcile done deleted = ${rowsToDelete.length}`);

  return {
    success: true,
    sheetCustomers: customerIndex.size,
    sapoCustomers: sapoCustomersIds.size,
    candidates: candidates.length,
    deleted: rowsToDelete.length,
  };
}

module.exports = {
  reconcileDeletedCustomers,
};
