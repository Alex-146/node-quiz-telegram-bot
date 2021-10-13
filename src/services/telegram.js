const { Telegraf, session, Markup } = require("telegraf")
const { SCENE_NAMES, stage } = require("./telegram/scenes")
const { config } = require("../config")
const { findUserByChatId } = require("../db/mongo")
const { fetchUser } = require("./telegram/middleware")

const diceStickers = [
  "CAACAgIAAxkBAAICz2FnAzJlsD44Rf-DqBdEhjF8ujxwAAKODgACRfo5S7ATBZ_SKZynIQQ",
  "CAACAgIAAxkBAAIC0WFnAzT3Xv4x0N1vHOYrTOlKw9g7AAL5EgACXdgwS6puViD8Je1sIQQ",
  "CAACAgIAAxkBAAIC02FnA0WfkBmD_8ZO4WTiRNbrKVFIAAI8FAACVHk5S42vWA7uFhmzIQQ",
  "CAACAgIAAxkBAAIC1WFnA0es6cmYgXegAgAB3gVvbp3vbgAC7xMAAj5GOUtpIklD_W4soyEE",
  "CAACAgIAAxkBAAIC12FnA0nbx4PDaA6ATsh6hJZD5xX8AAIhEgAC-6w5S5GSzp7kLsRhIQQ",
  "CAACAgIAAxkBAAIC2WFnA0slUnjlnlSa8wiQO9P1ZYBwAAJ_EQACwSE5SxrJ1RS2evlXIQQ",
]

// const pointsShop = [
//   { amount: 50, price: 50 },
//   { amount: 100, price: 90 },
//   { amount: 500, price: 400 },
//   { amount: 1000, price: 777 },
// ]

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

  bot.command("pay", fetchUser, async (ctx) => {
    const user = ctx.state.user

    if (user.hasActiveBill()) {
      const k = Markup.inlineKeyboard([
        [Markup.button.url("Оплатить", "https://example.com/?q=" + user.payments.current)],
        [Markup.button.callback("Проверить", "payment:check")],
        [Markup.button.callback("Отказаться", "payment:cancel")],
      ])
      ctx.reply("Оплата: " + user.payments.current, k)
    }
    else {
      // todo: add more items
      const k = Markup.inlineKeyboard([
        [Markup.button.callback("100 очков", "payment:new")],
      ])
      ctx.reply("Оплата", k)
    }
  })

  bot.action("payment:new", fetchUser, async (ctx) => {
    await ctx.answerCbQuery()

    const amount = 100
    const user = ctx.state.user
    const id = await user.generateBill(amount)

    // todo: move same keyboard to other place
    const k = Markup.inlineKeyboard([
      [Markup.button.url("Оплатить", "https://example.com/?q=" + user.payments.current)],
      [Markup.button.callback("Проверить", "payment:check")],
      [Markup.button.callback("Отказаться", "payment:cancel")],
    ])

    ctx.editMessageText(id, k)
  })

  bot.action("payment:cancel", fetchUser, async (ctx) => {
    const user = ctx.state.user
    await user.cancelPayment()
    ctx.editMessageText("Вы отказались")
  })

  bot.action("payment:check", fetchUser, async (ctx) => {
    const user = ctx.state.user
    const success = await user.validateBillPayment()
    if (success) {
      ctx.editMessageText("Успешно пополнено")
    }
    else {
      ctx.editMessageText("Не оплачено")
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

  bot.on("sticker", ctx => {
    ctx.reply(ctx.message.sticker.file_id)
  })

  bot.command("dice", ctx => {
    const value = +ctx.message.text.split(" ")[1]
    if (!Number.isNaN(value)) {
      const index = value - 1
      if (index >= 0 && index < 6) {
        ctx.replyWithSticker(diceStickers[index])
      }
      else {
        ctx.reply("invalid index")
      }
    }
    else {
      ctx.reply("send valid number")
    }
  })

  // bot.on("text", ctx => {
  //   ctx.reply(`echo: ${ctx.message.text}`)
  // })

  return bot
}

module.exports = {
  createBot,
}