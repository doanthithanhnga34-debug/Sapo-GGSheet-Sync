const HEADERS = [
  "ID",
  "Mã phiếu",
  "Ngày ghi nhận",
  "Tên đối tượng",
  "Lý do thu chi",
  "Mã chứng từ gốc",
  "Số tiền",
  "Diễn giải",
  "Chi nhánh xuất quỹ",
  "Ngày cập nhật",
];

const crypto = require("crypto");
const { formatNumberAmount } = require("../../utils/formatDate");
const { text } = require("../../utils/sheet.helper");

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
    isoToGoogleSheetDateTime(cashFund.voucher_date) || "",
    text(cashFund.object?.object_name) || "",
    text(cashFund.reason?.reason_name) || "",
    text(cashFund.document_root_codes) || "",
    formatNumberAmount(cashFund.origin_amount) ?? 0,
    text(cashFund.memo),
    text(cashFund.created_by),
    text(cashFund.modified_on),
  ];

  return row;
}
const cashFundMapper = {
  HEADERS,
  cashFundToRow,
};

module.exports = cashFundMapper;
