const { isConfigValid } = require("./config")

const telegram = require("./services/telegram")
const db = require("./db/mongo")

async function main() {
  
  if (!isConfigValid()) {
    throw new Error("config is not valid")
  }

  const bot = telegram.createBot()

  try {
    await db.connect()
    await bot.launch()
    console.log("application started")

    process.once("SIGINT", () => bot.stop("SIGINT"))
    process.once("SIGTERM", () => bot.stop("SIGTERM"))
  }
  catch(error) {
    console.log(error)

    bot.stop()
  }
}

main()