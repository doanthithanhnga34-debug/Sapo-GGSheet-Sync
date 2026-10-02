const express = require("express");
const config = require("./config/config");
const app = express();

const customerRouter = require("./routes/customer.route");
const cashFundRouter = require("./routes/cashFund.route");

app.use(express.json());
app.use('/sync/customers',customerRouter);
app.use('/cashFund', cashFundRouter);
app.get("/health", (req, res) => {
  res.json({
    success: true,
    service: "sapo-customer-sync",
    time: new Date().toISOString(),
  });
});




const PORT =
  process.env.PORT ||
  config.server?.port ||
  8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running port local host http://localhost:${config.port}`);
});
