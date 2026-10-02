function columnNumberToLetter(column) {
  let result = "";

  while (column > 0) {
    const remainder = (column - 1) % 26;

    result =
      String.fromCharCode(65 + remainder) +
      result;

    column =
      Math.floor((column - 1) / 26);
  }

  return result;
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
module.exports={
    columnNumberToLetter,
    text
}