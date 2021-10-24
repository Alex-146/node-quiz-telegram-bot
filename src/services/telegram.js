const { Telegraf, session, Markup } = require("telegraf")
const { SCENE_NAMES, stage } = require("./telegram/scenes")
const { config } = require("../config")

const { getItemById } = require("./telegram/config")
const { quiz, promocode, payments } = require("./telegram/config.json")

const { createUser, findUserByChatId } = require("../db/mongo")
const { fetchUser, developerAccess } = require("./telegram/middleware")
const {
  paymentInlineKeyboard,
  paymentItemsInlineKeyboard,
  mainKeyboard,
} = require("./telegram/keyboards")
const { MESSAGES } = require("./telegram/messages")
const { getLifetimeByHours, paragraphMessage } = require("../utils")

function createBot() {
  const bot = new Telegraf(config.TELEGRAM_TOKEN)
  bot.use(session())
  bot.use(stage.middleware())

  bot.start(async (ctx) => {
    const id = ctx.chat.id
    const candidate = await findUserByChatId(id)
    if (!candidate) {
      await createUser(id)
      ctx.scene.enter(SCENE_NAMES.START)
    }
    else {
      ctx.state.user = candidate
      ctx.reply("todo: display rules", mainKeyboard(ctx))
    }
  })

  const sendNextQuestionToUser = async (ctx) => {
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
          bot.telegram.sendMessage(chatId, "Ты не успел ответить вовремя на этот вопрос, поэтому ты дисквалифицирован! Попробуй начать заново и у тебя всё получится", mainKeyboard(ctx))
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
      const kb = paymentInlineKeyboard(payUrl)
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

  bot.on("poll_answer", async (ctx) => {
    const pollId = ctx.pollAnswer.poll_id
    const userId = ctx.pollAnswer.user.id
    const answerIndex = ctx.pollAnswer.option_ids[0]

    console.log("poll_answer", pollId, userId, answerIndex)

    const user = await findUserByChatId(userId)
    await user.voteInQuiz(answerIndex)
    ctx.state.user = user

    if (user.isQuizCompleted()) {
      const { correct, total } = user.getQuizScore()

      if (correct === total) {
        user.payments.balance += quiz.successRewardPrice
        await user.save()
        const text = paragraphMessage(`Твой результат: ${correct}/${total}`, `Начислено ${quiz.successRewardPrice} баллов`, `На счету ${user.payments.balance} баллов`)
        ctx.telegram.sendMessage(userId, text, mainKeyboard(ctx))
      }
      else {
        const text = paragraphMessage(`Твой результат: ${correct}/${total}`, `Попробуй еще, у тебя всё получится!`)
        ctx.telegram.sendMessage(userId, text, mainKeyboard(ctx))
      }
      await user.restoreQuiz()
    }
    else {
      ctx.state.user = user
      sendNextQuestionToUser(ctx)
    }
  })

  bot.hears(MESSAGES.SHOP, fetchUser(), async (ctx) => {
    const user = ctx.state.user
    const bill = await user.hasActiveBill()

    if (!bill) {
      // show shop items to user
      ctx.reply("Пополнение баланса", paymentItemsInlineKeyboard(ctx))
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
        expirationDateTime: getLifetimeByHours(payments.durationInHours),
        customFields: {
          itemId: item.id
        }
      })
      const text = `Новая оплата: ${item.title}, счет действителен: ${payments.durationInHours} час(а)`
      ctx.editMessageText(text, paymentInlineKeyboard(payUrl))
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
      let amount = item.amount
      // check if first payment has active promo, if true - add more points to balance
      if (user.payments.promocode.active) {
        amount += promocode.bonusAmount
        user.payments.promocode.active = false
      }
      user.payments.balance += amount
      await user.save()
      ctx.editMessageText(`Успешно пополнено, на счету: ${user.payments.balance}`)
    }
    else {
      ctx.answerCbQuery("Не оплачено")
    }
  })

  bot.hears(MESSAGES.PLAY, fetchUser(), async (ctx) => {
    const user = ctx.state.user
    if (user.payments.balance < quiz.playPrice) {
      const text = paragraphMessage("Недостаточно баллов на счету", `У тебя: ${user.payments.balance}`, `Требуется: ${quiz.playPrice}`)
      return ctx.reply(text)
    }
    
    user.payments.balance -= quiz.playPrice
    await user.save()

    await ctx.reply("Be ready!", Markup.removeKeyboard())
    await user.generateQuiz()
    sendNextQuestionToUser(ctx)
  })

  bot.hears(MESSAGES.PROFILE, fetchUser(), (ctx) => {
    const user = ctx.state.user

    const id = user.client.id
    const balance = user.payments.balance

    const text = paragraphMessage(`id: ${id}`, `balance: ${balance}`)
    ctx.reply(text)
  })

  bot.hears(MESSAGES.WITHDRAW, fetchUser(), (ctx) => {
    const user = ctx.state.user
    const { success, total } = user.getQuizStats()
    if (success < payments.minWinsInQuiz) {
      const text = paragraphMessage(`Для вывода нужно иметь как минимум ${payments.minWinsInQuiz} побед`, `У вас ${success} (всего ${total})`)
      ctx.reply(text)
    }
    else {
      ctx.reply("Вывод временно отключен")
    }
  })

  bot.hears(MESSAGES.DEVELOPER_MODE, fetchUser(), developerAccess(), (ctx) => {
    ctx.reply("⚙️", Markup.inlineKeyboard([
      [Markup.button.callback("Добавить 100 баллов", "developer:balance")]
    ]))
  })

  bot.action("developer:balance", fetchUser(), developerAccess(), async (ctx) => {
    const user = ctx.state.user
    user.payments.balance += 100
    await user.save()
    ctx.deleteMessage()
    ctx.reply(user.payments.balance)
    ctx.answerCbQuery()
  })

  bot.on("text", ctx => {
    ctx.reply(`echo: ${ctx.message.text}`)
  })

  return bot
}

module.exports = {
  createBot,
}