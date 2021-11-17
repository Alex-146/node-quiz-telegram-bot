require("dotenv").config()

const telegram = require("./services/telegram")
const db = require("./db/mongo")
const logger = require("./utils/logger")

async function main() {

  const bot = telegram.createBot()

  try {
    await db.connect()
    await bot.telegram.deleteWebhook({ drop_pending_updates: true })
    await bot.launch()
    
    logger.info("application started")

    process.once("SIGINT", () => bot.stop("SIGINT"))
    process.once("SIGTERM", () => bot.stop("SIGTERM"))
  }
  catch(error) {
    logger.error(error)

    bot.stop()
  }
}

main()