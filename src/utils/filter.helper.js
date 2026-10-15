const config = require("../config/config");

function excludeOrder(order) {
  const normalize = (value) =>
    String(value ?? "").trim().toLowerCase();

  const source = normalize(order?.source_name);

  const firstName = normalize(order?.customer?.first_name);
  const lastName = normalize(order?.customer?.last_name);

  const excludeSources = config.filterOrder.map(normalize);

  const excludeCustomerNames = ["grabmart", "now"];

  const isExcludedSource = excludeSources.includes(source);

  const isExcludedCustomer =
    excludeCustomerNames.includes(firstName) ||
    excludeCustomerNames.includes(lastName);

  return isExcludedSource || isExcludedCustomer;
}

module.exports = { excludeOrder };
