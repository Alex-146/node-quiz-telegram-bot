const { Telegraf } = require("telegraf")
const { 
  createUser,
  findUserByChatId,
  generateQuizForUser,
  restoreQuizForUser,
  userVoteInQuiz,
  getUserScore,
  getUserCurrentQuestion,
  isUserCompletedQuiz,
} = require("../db/mongo")

function createBot(token) {
  const bot = new Telegraf(token)
  
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

  const sendNextQuestionToUser = async (chatId) => {
    const seconds = 10
    const quizEntry = await getUserCurrentQuestion(chatId)

    const message = await bot.telegram.sendPoll(chatId, quizEntry.text, quizEntry.answers, {
      is_anonymous: false,
      open_period: seconds,
    })

    const wait = (seconds - 1) * 1000
    const stopHandler = async () => {
      try {
        const poll = await bot.telegram.stopPoll(chatId, message.message_id)
        if (poll.total_voter_count === 0) {
          await restoreQuizForUser(chatId)
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

  bot.on("poll_answer", async (ctx) => {
    const pollId = ctx.pollAnswer.poll_id
    const userId = ctx.pollAnswer.user.id
    const answerIndex = ctx.pollAnswer.option_ids[0]

    console.log("poll_answer", pollId, userId, answerIndex)

    await userVoteInQuiz(userId, answerIndex)

    if (await isUserCompletedQuiz(userId)) {
      const { correct, total } = await getUserScore(userId)
      bot.telegram.sendMessage(userId, `Твой результат: ${correct}/${total}`)
    }
    else {
      sendNextQuestionToUser(userId)
    }
  })

  bot.on("text", ctx => {
    ctx.reply(`echo: ${ctx.message.text}`)
  })

  return bot
}

module.exports = {
  createBot
}