
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config()
}

const telegram = require("./services/telegram")
const db = require("./db/mongo")

const token = process.env.TELEGRAM_TOKEN_MONDI

async function main() {
  if (!token) {
    throw new Error("telegram token does not found")
  }

  try {
    await db.connect(process.env.MONGO_URI)
    const bot = telegram.createBot(token)
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