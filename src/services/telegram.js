const { Telegraf, session, Markup } = require("telegraf")
const TelegrafI18n = require("telegraf-i18n")
const path = require("path")
const { SCENE_NAMES, stage } = require("./telegram/scenes")
const { getConfig, getItemById } = require("./telegram/config")
const { createUser, findUserByChatId, getUsersCount } = require("../db/mongo")
const { fetchUser, developerAccess, fetchItem } = require("./telegram/middleware")
const {
  paymentInlineKeyboard,
  paymentItemsInlineKeyboard,
  mainKeyboard,
} = require("./telegram/keyboards")
const payments = require("./qiwi/local")
const logger = require("../utils/logger")
const devHandlers = require("./telegram/developerHandlers")
const handlers = require("./telegram/handlers")
const { sleep, shuffle, generateQuiz } = require("../utils")

// todo: separate file
const actions = {
  developer: {
    addBalance: "developer:addBalance",
    resetBalance: "developer:resetBalance",
    resetHistory: "developer:resetHistory",
    printUsersCount: "developer:usersCount",
    showConfig: "developer:showConfig",
  }
}

function createBot() {
  const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

  const i18n = new TelegrafI18n({
    defaultLanguage: "ru",
    directory: path.resolve("src", "locales")
  })

  bot.use((ctx, next) => {
    ctx.db = {
      createUser,
      findUserByChatId,
      getUsersCount,
      getItemById
    },
    ctx.keyboards = {
      mainKeyboard,
      paymentItemsInlineKeyboard,
      paymentInlineKeyboard,
      remove: Markup.removeKeyboard()
    }
    ctx.utils = {
      sleep,
      shuffle,
      generateQuiz
    }
    ctx.logger = logger
    ctx.getConfig = getConfig,
    ctx.payments = payments
    return next()
  })

  bot.use(i18n.middleware())

  bot.use(session())
  bot.use(stage.middleware())

  /*
  bot.telegram.setMyCommands([
    { command: "start", description: "🤑" },
    { command: "help", description: "🆘" }
  ])
  */

  function showDeveloperKeyboard(ctx) {
    const text = ctx.i18n.t("developer.keyboard-title")
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("Добавить money", actions.developer.addBalance)],
      [Markup.button.callback("Обнулить money", actions.developer.resetBalance)],
      [Markup.button.callback("Очистить историю", actions.developer.resetHistory)],
      [Markup.button.callback("Показать конфиг", actions.developer.showConfig)],
      [Markup.button.callback("Кол-во юзеров", actions.developer.printUsersCount)],
    ])
    return ctx.reply(text, keyboard)
  }

  bot.start(handlers.start)
  
  bot.help(handlers.help)

  bot.on("poll_answer", handlers.pollAnswer)

  bot.hears(TelegrafI18n.match("keyboard.shop"), fetchUser(), handlers.displayShop)

  bot.action(/^payment:new:(.+)/, fetchUser(), fetchItem(), handlers.newPayment)

  bot.action("payment:cancel", fetchUser(), handlers.cancelPayment)

  bot.action("payment:check", fetchUser(), handlers.checkPayment)

  bot.hears(TelegrafI18n.match("keyboard.play"), fetchUser(), handlers.playQuiz)

  bot.hears(TelegrafI18n.match("keyboard.profile"), fetchUser(), handlers.displayProfile)

  bot.hears(TelegrafI18n.match("keyboard.withdraw"), fetchUser(), handlers.withdraw)

  bot.hears(TelegrafI18n.match("keyboard.developer"), fetchUser(), developerAccess(), showDeveloperKeyboard)

  bot.action(actions.developer.addBalance, fetchUser(), developerAccess(), devHandlers.addBalance)

  bot.action(actions.developer.resetBalance, fetchUser(), developerAccess(), devHandlers.resetBalance)

  bot.action(actions.developer.resetHistory, fetchUser(), developerAccess(), devHandlers.resetHistory)

  bot.action(actions.developer.showConfig, fetchUser(), developerAccess(), devHandlers.showConfig)

  bot.action(actions.developer.printUsersCount, fetchUser(), developerAccess(), devHandlers.printUsersCount)

  // bot.on("text", fetchUser(), ctx => {
  //   throw new Error("foo")
  //   return ctx.reply(`echo: ${ctx.message.text}`)
  // })

  bot.on("message", (ctx) => {
    return ctx.reply("Я тебя не понимаю!")
  })

  bot.catch((error, ctx) => {
    logger.error(error, {
      msg: "error catched",
      update: {
        type: ctx.updateType,
        id: ctx.update.update_id,
      }
    })
  })

  return bot
}

module.exports = {
  createBot,
}