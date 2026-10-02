async function runPool(items, worker, concurrency = 10) {
  const results = new Array(items.length);
  let index = 0;

  async function runner() {
    while (true) {
      const currentIndex = index++;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(
        items[currentIndex],
        currentIndex
      );
    }
  }

  const workers = Array.from(
    { length: concurrency },
    () => runner()
  );

  await Promise.all(workers);

  return results;
}
async function enrichCustomer(customer) {
  const [groupName, companyInfo] =
    await Promise.all([
      getCustomerGroup(customer.id),
      getInvoiceInfo(customer.id),
    ]);

  return {
    ...customer,

    group_name: groupName,

    company_info: companyInfo,
  };
}
const enrichedCustomers =
  await runPool(
    customers,
    enrichCustomer,
    10
  );
  function customerToRow(customer) {
  const company =
    customer.company_info || {};

  return [
    String(customer.id),
    getCustomerName(customer),
    String(getPhone(customer)),
    customer.email || "",
    customer.gender || "",
    customer.group_name || "",
    getTotalSpent(customer),
    getOrderCount(customer),
    getAddress(customer),

    company.company_name || "",
    company.tax_code || "",
    company.email || "",
    company.address || "",

    customer.created_on || "",
    customer.modified_on || "",
    customer.status || "ACTIVE",
  ];
}