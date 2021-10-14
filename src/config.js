const IS_PRODUCTION = process.env.NODE_ENV === "production"

if (!IS_PRODUCTION) {
  require("dotenv").config()
}

const config = {
  IS_PRODUCTION,
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  PAYMENT_SERVER_URI: process.env.PAYMENT_SERVER_URI,
}

function isConfigValid() {
  return true
}

module.exports = {
  config,
  isConfigValid,
}