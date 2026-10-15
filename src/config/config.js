require("dotenv").config();


const config = {
  port: Number(process.env.PORT || 8080),
  filterOrder:[
    'shopee',
    'tiktokshop',
    'ShopeeFood',
    'facebook',
    'tiktok-personal',
    'tiktok-for-business',
    'lazada',
    'grabmart',
    'marketplace',
    'zalo-oa',
    'tiki',
    'instagram',
    'facebook_shopping',
    'sendo'
  ],
  sapo: {
    apiKey: process.env.SAPO_API_KEY,
    apiSecret: process.env.SAPO_API_SECRET,
    hostName: process.env.HOST_NAME,
    baseUrl: process.env.SAPO_BASE_URL,
    customerLimit: 250,
    cashFundLimit:250,
    orderLimit:250
  },
  ggSheetCustomer: {
    sheetID: process.env.GG_SHEET_ID_CUSTOMER,
    customerSheetName: process.env.GG_SHEET_NAME_CUSTOMER || "Khách Hàng"
  },
  ggSheetCashFund:{
    sheetID:process.env.GG_SHEET_ID_ACCOUNTANT,
    cashFundSheetName:process.env.GG_SHEET_NAME_CASH_FUND
  },
  sheetOrder:{
    id:process.env.GG_SHEET_ID_ACCOUNTANT,
    name:process.env.SHEET_NAME_ORDER
  },
  sync: {
    sapoSizePage: 250,
    sheetBatchSize: 5000,
    requestDelay: 50,
    customerConcurrency: 3,
  },
};

module.exports = config;
