const { Telegraf, session } = require("telegraf")
const { SCENE_NAMES, stage } = require("./telegram/scenes")
const { config } = require("../config")
const { paymentDurationInHours, getItemById } = require("./telegram/config")
const { findUserByChatId } = require("../db/mongo")
const { fetchUser } = require("./telegram/middleware")
const { getPaymentKeyboard, generateShopKeyboard } = require("./telegram/keyboards")
const { getLifetimeByHours } = require("../utils")

function createBot() {
  const bot = new Telegraf(config.TELEGRAM_TOKEN)
  bot.use(session())
  bot.use(stage.middleware())

  /*
  const startMiddleware = async (ctx, next) => {
    const id = ctx.message.from.id
    const candidate = await findUserByChatId(id)
    if (!candidate) {
      await createUser(id)
    }
    next()
  }

  bot.start(startMiddleware, (ctx) => {
    if (ctx.startPayload) {
      ctx.reply(ctx.startPayload)
    }
    else {
      ctx.reply("Welcome!")
    }
  })
  */

  bot.start((ctx) => {
    ctx.scene.enter(SCENE_NAMES.START)
  })

  const sendNextQuestionToUser = async (chatId) => {
    const user = await findUserByChatId(chatId)
    const seconds = 10
    // const quizEntry = await getUserCurrentQuestion(chatId)
    const quizEntry = user.getCurrentQuestion()

    const message = await bot.telegram.sendPoll(chatId, quizEntry.text, quizEntry.answers, {
      is_anonymous: false,
      open_period: seconds,
    })

    const wait = (seconds - 1) * 1000
    const stopHandler = async () => {
      try {
        const poll = await bot.telegram.stopPoll(chatId, message.message_id)
        if (poll.total_voter_count === 0) {
          // await restoreQuizForUser(chatId)
          await user.restoreQuiz()
          bot.telegram.sendMessage(chatId, "Ты не успел ответить вовремя на этот вопрос, поэтому ты дисквалифицирован! Попробуй начать заново и у тебя всё получится")
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
    setTimeout(stopHandler, wait)
  }

  function showCurrentPayment(ctx) {
    const { status, payUrl, customFields } = ctx.state.bill
    if (status.value === "WAITING") {
      const item = getItemById(customFields.itemId)
      const text = `У вас есть активный товар,  оплата: ${item.title}`
      const kb = getPaymentKeyboard(payUrl)
      if (ctx.message) {
        ctx.reply(text, kb)
      }
      else {
        ctx.editMessageText(text, kb)
      }
    }
    else if (status.value === "PAID") {
      const text = "Вы уже оплатили этот товар"
      if (ctx.message) {
        ctx.reply(text)
      }
      else {
        ctx.editMessageText(text)
      }
    }
  }

  /*
  bot.command("poll", async (ctx) => {
    const id = ctx.from.id
    // todo: move use to separate scene
    await generateQuizForUser(id)
    sendNextQuestionToUser(id)
  })

  bot.on("poll", (ctx) => {
    // this will shown in 2 cases (AFAIK)
    // when users clicks answer in anpnymous poll
    // when poll is closed via 'ctx.stopPoll'
    //console.log("1", ctx.poll)
  })
  */

  bot.on("poll_answer", async (ctx) => {
    const pollId = ctx.pollAnswer.poll_id
    const userId = ctx.pollAnswer.user.id
    const answerIndex = ctx.pollAnswer.option_ids[0]

    console.log("poll_answer", pollId, userId, answerIndex)

    const user = await findUserByChatId(userId)
    await user.voteInQuiz(answerIndex)

    if (user.isQuizCompleted()) {
      const { correct, total } = user.getQuizScore()
      await user.restoreQuiz()
      bot.telegram.sendMessage(userId, `Твой результат: ${correct}/${total}`)
    }
    else {
      sendNextQuestionToUser(userId)
    }
  })

  bot.command("pay", fetchUser(), async (ctx) => {
    const user = ctx.state.user
    const bill = await user.hasActiveBill()

    if (!bill) {
      // show shop items to user
      ctx.reply("Магазин товаров", generateShopKeyboard())
    }
    else {
      // send bill that user already has
      ctx.state.bill = bill
      showCurrentPayment(ctx)
    }
  })

  const paymentRegex = /payment:new:(.+)/
  bot.action(paymentRegex, fetchUser(), async (ctx) => {
    await ctx.answerCbQuery()

    const user = ctx.state.user
    const bill = await user.hasActiveBill()

    if (!bill) {
      // create new bill according to clicked item
      const itemId = paymentRegex.exec(ctx.callbackQuery.data)[1]
      const item = getItemById(itemId)
  
      const { payUrl } = await user.generateBill({
        billId: `${ctx.from.id}-${Date.now()}`,
        amount: item.price,
        currency: "RUB",
        comment: "Оплата товара",
        expirationDateTime: getLifetimeByHours(paymentDurationInHours),
        customFields: {
          itemId: item.id
        }
      })
      const text = `Новая оплата: ${item.title}, счет действителен: ${paymentDurationInHours} час(а)`
      ctx.editMessageText(text, getPaymentKeyboard(payUrl))
    }
    else {
      // send bill that user already has
      ctx.state.bill = bill
      showCurrentPayment(ctx)
    }
  })

  // todo: использовать middleware для обработки покупки если она завершена (как в payment:check)
  bot.action("payment:cancel", fetchUser(), async (ctx) => {
    const user = ctx.state.user
    await user.cancelPayment()
    // todo: check if bill already paid
    ctx.editMessageText("Вы отказались")
  })

  bot.action("payment:check", fetchUser(), async (ctx) => {
    const user = ctx.state.user
    const response = await user.validateBillPayment()

    if (response.error) {
      return ctx.editMessageText(response.error)
    }

    const { success, customFields } = response
    if (success) {
      const item = getItemById(customFields.itemId)
      // todo: check if first payment has active promo, if true - add more points to balance
      user.payments.balance += item.amount
      await user.save()
      ctx.editMessageText(`Успешно пополнено, на счету: ${user.payments.balance}`)
    }
    else {
      ctx.answerCbQuery("Не оплачено")
    }
  })

  /*
  bot.hears("Играть", (ctx) => {
    const id = ctx.chat.id
    // todo: check for empty user?
    const user = await findUserByChatId(id)
    await user.generateQuiz()

    const quizEntry = user.getCurrentQuestion()
  })
  */

  bot.on("text", ctx => {
    ctx.reply(`echo: ${ctx.message.text}`)
  })

  return bot
}

module.exports = {
  createBot,
}