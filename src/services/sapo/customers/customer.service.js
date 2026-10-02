
const config = require("../../../config/config");
const { sleep } = require("../../../infrastructure/retry");

const { sapoGet } = require("../sapo.service");


async function getCustomerGroup(id) {
  const data = await sapoGet(`/admin/customer_groups.json?customer_id=${id}`);

  const groups = data.customer_groups || [];

  if (!groups.length) {
    return "";
  }

  return groups.map(group => group?.name).filter(Boolean).join(",");
}
async function getInvoiceInfo(id) {
  const emptyInvoiceInfo = {
    company_name: "",
    tax_code: "",
    address: "",
    email: "",
  };
  const data = await sapoGet(
    `/admin/customers/${id}/invoice_informations.json?is_default=true`,
  );
    const invoiceInfo =
    data.invoice_informations || [];

  if (!invoiceInfo.length) {
    return emptyInvoiceInfo;
  }

  const info = invoiceInfo[0];


  return {
    company_name: info.company_name || "",
    tax_code: info.tax_code || "",
    address: info.address || "",
    email: info.email || "",
  };;
}

async function getCustomer(id) {
  const customerId = String(id ?? "").trim();

  const data = await sapoGet(`/admin/customers/${customerId}.json`);
  
  const customer = data?.customer;
  return customer;
}


async function getCustomers({
  page = 1,
  limit = config.sapo.customerLimit,
  modifiedFrom = null,
  sortKey=""
}) {
  const params = new URLSearchParams();

  params.set("query", "");
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("sort_key", String(sortKey));
  params.set("reverse", "false");

  if(modifiedFrom){
    params.set("modified_on_min",modifiedFrom)
  }
  const data = await sapoGet(`/admin/customers.json?${params.toString()}`);

  await sleep(config.sync.requestDelay);

  return data.customers || [];
}

async function getAllCustomers({ modifiedFrom = null, onPage = null } = {}) {
  const customers = [];
  const limit = config.sapo.customerLimit;
  let page = 1;
  while (true) {
    const items = await getCustomers({ page, limit,modifiedFrom, sortKey:"id" });
    if (!items.length) {
      break;
    }
    customers.push(...items);
    console.log(
      `Sapo customer: page = ${page}, fetch = ${items.length}, total Customers = ${customers.length}`,
    );

    if (onPage) {
      await onPage({
        page,
        items,
        total: customers.length,
      });
    }
    if (items.length < limit) {
      break;
    }
    page++;
  }
  return customers;
}

const customerService = {
  sapoGet,
  getInvoiceInfo,
  getCustomerGroup,
  getCustomers,
  getAllCustomers,
  getCustomer
};
module.exports = customerService
