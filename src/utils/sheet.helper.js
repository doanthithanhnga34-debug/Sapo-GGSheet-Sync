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

module.exports={
    columnNumberToLetter
}