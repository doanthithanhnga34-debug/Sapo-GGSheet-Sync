const HEADERS_CASH_FUND = [
  "ID",
  "Mã phiếu",
  "Mã chứng từ gốc",
  "Tên đối tượng",
  "Số tiền",
  "Lý do thu chi",
  "Ngày ghi nhận",
  "Chi nhánh xuất quỹ",
  "Sync_hash",
];

const crypto = require("crypto");
const { text } = require("../customers/customer.mapper");
const { formatNumberAmount } = require("../../utils/formatDate");

function makeCashFundHash(row) {
  const normalized = row.map((val) => {
    if (val == null) {
      return "";
    }
    return String(val).trim();
  });
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

function isoToGoogleSheetDateTime(isoString) {
  if (!isoString) return "";

  const timestamp = Date.parse(isoString);

  if (Number.isNaN(timestamp)) {
    return "";
  }

  const vietnamTimestamp = timestamp + 7 * 60 * 60 * 1000;

  return vietnamTimestamp / 86400000 + 25569;
}

function cashFundToRow(cashFund) {
  if (!cashFund) {
    throw new Error("Not found cash found");
  }

  const row = [
    text(cashFund.id ?? ""),
    text(cashFund.code) || "",
    text(cashFund.document_root_codes) || "",
    text(cashFund.object?.object_name) || "",
    formatNumberAmount(cashFund.origin_amount) ?? 0,
    text(cashFund.reason?.reason_name) || "",
    isoToGoogleSheetDateTime(cashFund.voucher_date) || "",
    text(cashFund.created_by),
  ];
  const hash = makeCashFundHash(row);

  return [...row, hash];
}

module.exports = {
  HEADERS_CASH_FUND,
  cashFundToRow,
};
