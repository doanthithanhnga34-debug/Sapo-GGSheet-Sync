const { text } = require("../../utils/sheet.helper");
const { formatNumberAmount } = require("../../utils/formatDate");
const HEADERS = [
  "Id",
  "Mã đơn hàng",
  "Ngày đặt hàng",
  "Chi nhánh tạo đơn",
  "Tên khách hàng",
  "Tổng tiền",
  "Phương thức thanh toán",
  "Trạng thái thanh toán ",
  "Nguồn đơn",
  "Ngày cập nhật",
];
function isoToGoogleSheetDateTime(isoString) {
  if (!isoString) return "";

  const timestamp = Date.parse(isoString);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const vietnamTimestamp = timestamp + 7 * 60 * 60 * 1000;

  return vietnamTimestamp / 86400000 + 25569;
}

function getBranchCreatedOrder(order) {
  const firstName = order?.user?.first_name ?? "";
  const lastName = order?.user?.last_name ?? "";

  const fullName = [lastName, firstName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || "";
}
function getCustomerName(order){
    const firstName = order?.customer?.first_name ?? "";
  const lastName = order?.customer?.last_name ?? "";
  const fullName = [lastName, firstName].filter(Boolean).join(" ").trim();

  return fullName || ""
}

function handleFinancialStatus(status) {
  switch (status) {
    case "paid":
      return "Đã thanh toán";
    case "pending":
      return "Chưa thanh toán";
    case "authorized":
      return "Chờ xác nhận";
    case "partially_paid":
      return "Thanh toán một phần";
    case "partially_refunded":
      return "Hoàn tiền một phần";
    case "refunded":
      return "Đã hoàn tiền";
    default:
      return "";
  }
}
async function orderToRow(order) {
  const row = [
    text(order.id) || "",
    text(order.name) || "",
    isoToGoogleSheetDateTime(order.created_on) || "",
    getBranchCreatedOrder(order),
    getCustomerName(order),
    formatNumberAmount(order.original_total_price) ?? 0,
    text(order.gateway) || '',
    handleFinancialStatus(order.financial_status),
    text(order.source_name) || "",
    isoToGoogleSheetDateTime(order.modified_on),
  ];
  return row;
}

const orderMapper = {
  HEADERS,
  orderToRow,
};
module.exports = orderMapper;
