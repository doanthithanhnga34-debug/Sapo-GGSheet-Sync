const config = require("../../config/config");
const { retry } = require("../../infrastructure/retry");

function buildAuthHeader(){
    const raw = config.sapo.apiKey+":"+config.sapo.apiSecret;
    return "Basic " + Buffer.from(raw).toString("base64");
}


async function sapoGet(path) {
  return retry(async () => {
    const response = await fetch(config.sapo.baseUrl + path, {
      method: "GET",
      headers: {
        Authorization: buildAuthHeader(),
        Accept: "application/json",
      },
    });
    console.log(' url', config.sapo.baseUrl + path);
    if(response.status === 404){
      const error = new Error("Sapo API 404");
      error.status = 404;
      error.retryable = false;
      throw error;
    }
    if (response.status === 429 || response.status > 500) {
      throw new Error(`Sapo http ${response.status}`);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Sapo http ${response.status}: ${text}`);
    }
    return response.json();
  });
}

module.exports = {
    sapoGet
}