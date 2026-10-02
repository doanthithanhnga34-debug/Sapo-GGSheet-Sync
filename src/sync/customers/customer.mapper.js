const HEADERS = [
  "Mã khách hàng",
  "Tên khách hàng",
  "Số điện thoại",
  "Email",
  "Giới tính",
  "Nhóm khách hàng",
  "Tổng chi tiêu",
  "Số đơn hàng",
  "Địa chỉ",
  "Tên công ty",
  "MST công ty",
  "Email công ty",
  "Địa chỉ công ty",
  "Ngày tạo",
  "Ngày cập nhật",
  "Trạng thái",
  "Sync_hash"
];
const crypto = require("crypto");
const { getInvoiceInfo, getCustomerGroup } = require("../../sapo/customers/customer.service");



function makeCustomerHash(row){
  const normalized = row.map(value =>{
    if(value == null){
      return ""
    }
    return String(value).trim()
  })
  return crypto.createHash("sha256").update(JSON.stringify(normalized)).digest("hex")
}
function text(value) {
  if (value == null) {
    return "";
  }
  if (!["string", "number", "boolean"].includes(typeof value)) {
    throw new Error("Expected a scalar cell value");
  }
  return String(value).trim();
}

function number(value, field) {
  if (value == null || value === "") return 0;
  if (!["string", "number"].includes(typeof value)) {
    throw new Error("Invalid numeric field:", field);
  }
  const result = Number(value);
  if (!Number.isFinite(result))
    throw new Error(`Invalid numeric field: ${field}`);
  return result;
}

function getTotalSpent(customer) {
  return customer.total_spent ?? 0;
}

function getOrderCount(customer) {
  return customer.orders_count ?? 0;
}

function getAddress(addresses){
  if(!Array.isArray(addresses) || !addresses.length){
    return "";
  }
  const address = addresses.find(item => item?.default) || addresses[0];
  return [
    address.address1,
    address.address2,
    address.ward,
    address.district,
    address.city,
    address.province,
    address.country
  ].map(val => val?.trim?.() || val).filter(Boolean).join(",")
}

async function customerToRow(customer) {
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
    throw new Error("Customer must be an object");
  }

  const name =
    text(customer.name) ||
    [customer.first_name, customer.last_name]
      .map(text)
      .filter(Boolean)
      .join(" ");

  const [customerGroup, company] = await Promise.all([
    getCustomerGroup(customer.id),
    getInvoiceInfo(customer.id),
  ]);

  const row = [
    text(customer.id),
    name,
    text(customer.phone),
    text(customer.email) || "",
    text(customer.gender) || "",
    customerGroup,
    getTotalSpent(customer),
    getOrderCount(customer),
    getAddress(customer.addresses),
    company.company_name || "",
    company.tax_code || "",
    company.email || "",
    company.address || "",
    customer.created_on,
    customer.modified_on,
    customer.status || "Active",
    
  ];
  const syncHash= makeCustomerHash(row);

  return [
    ...row,
    syncHash
  ];
}

module.exports = {
  HEADERS,
  customerToRow,
  makeCustomerHash,
  text
};
