const isProd = process.env.NODE_ENV === "production"

const config = {
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN
}

function isConfigValid() {
  return true
}

module.exports = {
  config,
  isConfigValid,
}