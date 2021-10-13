
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const { config, isConfigValid } = require("./config")

const telegram = require("./services/telegram")
const db = require("./db/mongo")

async function main() {
  
  if (!isConfigValid()) {
    throw new Error("config is not valid")
  }

  try {
    await db.connect()
    const bot = telegram.createBot()
    await bot.launch()

    console.log("application started")

    process.once("SIGINT", () => bot.stop("SIGINT"))
    process.once("SIGTERM", () => bot.stop("SIGTERM"))
  }
  catch(error) {
    console.log(error)
  }
}

main()