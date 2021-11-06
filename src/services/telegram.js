const { Telegraf, session, Markup } = require("telegraf")
const TelegrafI18n = require("telegraf-i18n")
const path = require("path")
const { SCENE_NAMES, stage } = require("./telegram/scenes")
const { getConfig, getItemById } = require("./telegram/config")
const { createUser, findUserByChatId } = require("../db/mongo")
const { fetchUser, developerAccess, fetchItem } = require("./telegram/middleware")
const {
  paymentInlineKeyboard,
  paymentItemsInlineKeyboard,
  mainKeyboard,
} = require("./telegram/keyboards")
const payments = require("./qiwi/local")
const { sleep } = require("../utils")

// todo: separate file
const actions = {
  developer: {
    addBalance: "developer:addBalance",
    resetBalance: "developer:resetBalance",
    resetHistory: "developer:resetHistory"
  }
}

function createBot() {
  const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

  const i18n = new TelegrafI18n({
    defaultLanguage: "ru",
    directory: path.resolve("src", "locales")
  })

  bot.use(i18n.middleware())

  bot.use(session())
  bot.use(stage.middleware())

  /*
  bot.telegram.setMyCommands([
    { command: "start", description: "1. start" },
    { command: "help", description: "2. help" }
  ])
  */

  async function startHandler(ctx) {
    const id = ctx.chat.id
    const candidate = await findUserByChatId(id)
    if (!candidate) {
      // todo: add startPayload
      await createUser(id)
      return ctx.scene.enter(SCENE_NAMES.START)
    }
    else {
      ctx.state.user = candidate
      const config = getConfig()
      const text = ctx.i18n.t("rules", { config })
      return ctx.reply(text, mainKeyboard(ctx))
    }
  }
  
  //todo:
  async function helpHandler(ctx) {}

  //todo:
  async function pollAnswerHandler(ctx) {}

  function displayProfile(ctx) {
    const user = ctx.state.user
    const text = ctx.i18n.t("profile", { user })
    return ctx.replyWithHTML(text, mainKeyboard(ctx))
  }

  async function playQuizHandler(ctx) {
    const user = ctx.state.user
    const { quiz } = getConfig()

    if (user.payments.balance < quiz.playPrice) {
      const text = ctx.i18n.t("quiz.not-allowed", { user, quiz })
      return ctx.reply(text)
    }
    
    user.payments.balance -= quiz.playPrice
    await user.save()

    await ctx.reply("Be ready!", Markup.removeKeyboard())
    user.generateQuiz(quiz.amountOfQuestions)
    await user.save()
    sendNextQuestionToUser(ctx)
  }

  function withdrawHandler(ctx) {
    const user = ctx.state.user
    const { payments } = getConfig()
    const { success, total } = user.getQuizStats()
    if (success < payments.minWinsInQuiz) {
      const text = ctx.i18n.t("withdraw.not-allowed", { minCount: payments.minWinsInQuiz, userCount: success })
      return ctx.reply(text)
    }
    else {
      const text = ctx.i18n.t("withdraw.scammed")
      return ctx.reply(text)
    }
  }

  async function displayShop(ctx) {
    const user = ctx.state.user

    // todo: check for EXPIRED status?
    const bill = user.payments.current

    if (!bill) {
      // show shop items to user
      const text = ctx.i18n.t("payments.shop")
      return ctx.reply(text, paymentItemsInlineKeyboard(ctx))
    }
    else {
      // send bill that user already has
      ctx.state.bill = bill
      return showCurrentPayment(ctx)
    }
  }

  function showDeveloperKeyboard(ctx) {
    const text = ctx.i18n.t("developer.keyboard-title")
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback("Добавить money", actions.developer.addBalance)],
      [Markup.button.callback("Обнулить money", actions.developer.resetBalance)],
      [Markup.button.callback("Очистить историю", actions.developer.resetHistory)],
    ])
    return ctx.reply(text, keyboard)
  }

  async function developerAddBalance(ctx) {
    const { developer } = getConfig()
    const user = ctx.state.user
    user.payments.balance += developer.balance
    await user.save()
    ctx.answerCbQuery()
    return ctx.reply(user.payments.balance)
  }
  
  async function developerResetBalance(ctx) {
    const user = ctx.state.user
    user.payments.balance = 0
    await user.save()
    ctx.answerCbQuery()
    return ctx.reply("Обнулено")
  }

  async function developerResetHistory(ctx) {
    const user = ctx.state.user
    user.quiz.history = []
    await user.save()
    ctx.answerCbQuery()
    return ctx.reply("Очищено")
  }

  const sendNextQuestionToUser = async (ctx) => {
    const { quiz } = getConfig()
    const seconds = quiz.voteTimeInSeconds

    const user = ctx.state.user
    const chatId = user.client.id
    const { text, answers, correctIndex } = user.getCurrentQuestion()

    // developer role
    const displayAnswers = user.isDeveloper() ? answers.map((t, i) => i === correctIndex ? "😎" + t : t) : answers

    const message = await bot.telegram.sendPoll(chatId, text, displayAnswers, {
      is_anonymous: false,
      open_period: seconds,
    })

    const wait = (seconds - 1) * 1000
    const stopHandler = async () => {
      try {
        const poll = await bot.telegram.stopPoll(chatId, message.message_id)
        if (poll.total_voter_count === 0) {
          await user.restoreQuiz()
          const text = ctx.i18n.t("quiz.timeout")
          bot.telegram.sendMessage(chatId, text, mainKeyboard(ctx))
        }
        else if (poll.total_voter_count > 1) {
          // может ли пользователь переслать сообщение чтобы проголосовал кто-то другой?
        }
      }
      catch(error) {
        // Error: 400: Bad Request: poll has already been closed
        console.log(error.message)
      }
    }
    return sleep(wait).then(stopHandler)

    // setTimeout(stopHandler, wait)
  }

  function showCurrentPayment(ctx) {
    const { status, payUrl, customFields } = ctx.state.bill
    if (status.value === payments.status.WAITING) {
      const item = getItemById(customFields.itemId)
      const text = ctx.i18n.t("payments.waiting", { item })
      const kb = paymentInlineKeyboard(ctx.i18n, payUrl)
      if (ctx.message) {
        return ctx.reply(text, kb)
      }
      else {
        return ctx.editMessageText(text, kb)
      }
    }
    else if (status.value === payments.status.PAID) {
      const text = ctx.i18n.t("payments.completed")
      if (ctx.message) {
        return ctx.reply(text)
      }
      else {
        return ctx.editMessageText(text)
      }
    }
  }

  bot.start(startHandler)

  bot.on("poll_answer", async (ctx) => {
    const pollId = ctx.pollAnswer.poll_id
    const userId = ctx.pollAnswer.user.id
    const answerIndex = ctx.pollAnswer.option_ids[0]

    console.log("poll_answer", pollId, userId, answerIndex)

    const user = await findUserByChatId(userId)
    await user.voteInQuiz(answerIndex)
    ctx.state.user = user

    const { quiz } = getConfig()

    if (user.isQuizCompleted()) {
      const { correct, total } = user.getQuizScore()

      if (correct === total) {
        user.payments.balance += quiz.successRewardPrice
        await user.save()
        const text = ctx.i18n.t("quiz.success", { correct, total, userBalance: user.payments.balance })
        await ctx.telegram.sendMessage(userId, text, mainKeyboard(ctx))
      }
      else {
        const text = ctx.i18n.t("quiz.failed", { correct, total })
        await ctx.telegram.sendMessage(userId, text, mainKeyboard(ctx))
      }
      await user.restoreQuiz()
    }
    else {
      ctx.state.user = user
      sendNextQuestionToUser(ctx)
    }
  })

  bot.hears(TelegrafI18n.match("keyboard.shop"), fetchUser(), displayShop)

  bot.action(/^payment:new:(.+)/, fetchUser(), fetchItem(), async (ctx) => {
    const user = ctx.state.user

    // todo: check for EXPIRED status?
    const bill = user.payments.current

    if (!bill) {
      // create new bill according to clicked item
      const item = ctx.state.item

      const config = getConfig()
      const hourDuration = config.payments.durationInHours

      const customFields = {
        itemId: item.id
      }
  
      const response = await payments.createBill(item.price, hourDuration, customFields)

      if (!response.ok) {
        const err = response.error
        console.log(err)
        return ctx.editMessageText(`${err.name}⚠️something went wrong when creating bill`)
      }

      const { billId, amount, status, payUrl } = response.data
      const bill = {
        method: payments.type,
        payUrl,
        billId,
        amount,
        status,
        customFields
      }
      user.payments.current = bill
      await user.save()

      const text = ctx.i18n.t("payments.new", { item, hourDuration })
      return ctx.editMessageText(text, paymentInlineKeyboard(ctx.i18n, payUrl))
    }
    else {
      // send bill that user already has
      ctx.state.bill = bill
      return showCurrentPayment(ctx)
    }
  })

  // todo: использовать middleware для обработки покупки если она завершена (как в payment:check)
  bot.action("payment:cancel", fetchUser(), async (ctx) => {
    const user = ctx.state.user
    const bill = user.payments.current
    if (bill) {
      // todo: check if bill already paid
      const response = await payments.rejectBill(bill.billId) //todo: ok check
      bill.status.value = response.data.status.value
      user.payments.history.push(bill)
      user.payments.current = null
      await user.save()
      const text = ctx.i18n.t("payments.rejected")
      return ctx.editMessageText(text)
    }
    else {
      return ctx.editMessageText("⚠️no bill when cancelling payment")
    }
  })

  bot.action("payment:check", fetchUser(), async (ctx) => {
    const user = ctx.state.user
    
    // todo: make each step as middleware?

    const bill = user.payments.current
    if (!bill) {
      return ctx.editMessageText("⚠️user has no bill when validating payment")
    }

    const response = await payments.getBillStatus(bill.billId)
    if (!response.ok) {
      const err = response.error
      console.log(err)
      return ctx.editMessageText(`${err.name}⚠️smth went wrong when getting bill status`)
    }

    const { status, customFields } = response.data

    if (status.value === payments.status.PAID) {
      const uniquePayment = true //todo: disable dublicates - only unique
      if (uniquePayment) {
        bill.status.value = payments.status.PAID
        user.payments.history.push(bill)
        user.paymnets.current = null
        await user.save()
        return successHandler(customFields.itemId)
      }
      else {
        // todo: use i18n
        return ctx.editMessageText("⚠️already paid")
      }
    }
    else if (status.value === payments.status.EXPIRED) {
      // ! в браузере <Счет просрочен> но здесь WAITING
      // todo: push to history
      // todo: use i18n
      return ctx.editMessageText("⚠️expired")
    }
    else {
      const text = ctx.i18n.t("payments.wait-notify")
      return ctx.answerCbQuery(text)
    }

    async function successHandler(itemId) {
      const item = getItemById(itemId)
      let amount = item.amount
      // check if first payment has active promo, if true - add more points to balance
      const { promocode } = getConfig()
      if (user.payments.promocode.active) {
        amount += promocode.bonusAmount
        user.payments.promocode.active = false
      }
      user.payments.balance += amount
      await user.save()
      const text = ctx.i18n.t("payments.success", { balance: user.payments.balance })
      return ctx.editMessageText(text)
    }
  })

  bot.hears(TelegrafI18n.match("keyboard.play"), fetchUser(), playQuizHandler)

  bot.hears(TelegrafI18n.match("keyboard.profile"), fetchUser(), displayProfile)

  bot.hears(TelegrafI18n.match("keyboard.withdraw"), fetchUser(), withdrawHandler)

  bot.hears(TelegrafI18n.match("keyboard.developer"), fetchUser(), developerAccess(), showDeveloperKeyboard)

  bot.action(actions.developer.addBalance, fetchUser(), developerAccess(), developerAddBalance)

  bot.action(actions.developer.resetBalance, fetchUser(), developerAccess(), developerResetBalance)

  bot.action(actions.developer.resetHistory, fetchUser(), developerAccess(), developerResetHistory)

  bot.on("text", fetchUser(), ctx => {
    throw new Error("foo")
    return ctx.reply(`echo: ${ctx.message.text}`)
  })

  bot.catch((err, ctx) => {
    console.log(err)
  })

  return bot
}

module.exports = {
  createBot,
}