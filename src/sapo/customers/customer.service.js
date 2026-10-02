const config = require("../../config/config");
const { retry, sleep } = require("../../utils/retry");

function buildAuthHeader() {
  const raw = config.sapo.apiKey + ":" + config.sapo.apiSecret;

  return "Basic " + Buffer.from(raw).toString("base64");
}

async function sapoGet(path) {
  return retry(async () => {
    const response = await fetch(config.sapo.baseUrl + path, {
      method: "GET",
      headers: {
        Authorization: buildAuthHeader(),
        Accept: "application/json",
      },
    });
    console.log(' url', config.sapo.baseUrl + path);
    if(response.status === 404){
      const error = new Error("Sapo API 404");
      error.status = 404;
      error.retryable = false;
      throw error;
    }
    if (response.status === 429 || response.status > 500) {
      throw new Error(`Sapo http ${response.status}`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sapo http ${response.status}: ${text}`);
    }
    return response.json();
  });
}
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

module.exports = {
  sapoGet,
  getInvoiceInfo,
  getCustomerGroup,
  getCustomers,
  getAllCustomers,
  getCustomer
};
