const config = require("../../../config/config");
const { sleep } = require("../../../infrastructure/retry");
const { sapoGet } = require("../sapo.service");

async function getOrders({ 
  page = 1, 
  limit = config.sapo.orderLimit,
 }) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("query", "");

  const data = await sapoGet(
    `/admin/orders/search.json?${params.toString()}`,
  );
  await sleep(config.sync.requestDelay);

  return Array.isArray(data?.orders)
    ? data.orders
    : [];
}

const orderService = {
    getOrders
}

module.exports = orderService