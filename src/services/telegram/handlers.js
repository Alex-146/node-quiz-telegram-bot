async function start(ctx) {
  const id = ctx.chat.id
  const candidate = await ctx.db.findUserByChatId(id)
  if (!candidate) {
    // todo: add startPayload
    await ctx.db.createUser(id)
    ctx.logger.info("user created")
    return ctx.scene.enter("startScene") // was as const before
  }
  else {
    ctx.state.user = candidate
    const config = ctx.getConfig()
    const text = ctx.i18n.t("rules", { config })
    return ctx.reply(text, ctx.keyboards.mainKeyboard(ctx))
  }
}

function help(ctx) {
  return ctx.reply("Используй команду /start и следуй инструкциям!")
}

function displayProfile(ctx) {
  const user = ctx.state.user
  const text = ctx.i18n.t("profile", { user })
  return ctx.replyWithHTML(text, ctx.keyboards.mainKeyboard(ctx))
}

function withdraw(ctx) {
  const user = ctx.state.user
  const { payments } = ctx.getConfig()
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
    return ctx.reply(text, ctx.keyboards.paymentItemsInlineKeyboard(ctx))
  }
  else {
    // send bill that user already has
    ctx.state.bill = bill
    return showCurrentPayment(ctx)
  }
}

async function newPayment(ctx) {
  const user = ctx.state.user

  // todo: check for EXPIRED status?
  const bill = user.payments.current

  if (!bill) {
    // create new bill according to clicked item
    const item = ctx.state.item

    const config = ctx.getConfig()
    const hourDuration = config.payments.durationInHours

    const customFields = {
      itemId: item.id
    }

    const response = await ctx.payments.createBill(item.price, hourDuration, customFields)

    if (!response.ok) {
      ctx.logger.error(response.error, {
        msg: "something went wrong when creating bill",
      })
      const text = ctx.i18n.t("errors.payment")
      return ctx.editMessageText(text)
    }

    const { billId, amount, status, payUrl } = response.data
    const bill = {
      method: ctx.payments.type,
      payUrl,
      billId,
      amount,
      status,
      customFields
    }
    user.payments.current = bill
    await user.save()

    const text = ctx.i18n.t("payments.new", { item, hourDuration })
    return ctx.editMessageText(text, ctx.keyboards.paymentInlineKeyboard(ctx.i18n, payUrl))
  }
  else {
    // send bill that user already has
    ctx.state.bill = bill
    return showCurrentPayment(ctx)
  }
}

async function cancelPayment(ctx) {
  const user = ctx.state.user
  const bill = user.payments.current
  if (bill) {
    // todo: check if bill already paid
    const response = await ctx.payments.rejectBill(bill.billId)
    
    if (!response.ok) {
      ctx.logger.error(response.error, {
        msg: "smth went wrong when cancelling payment"
      })
      const text = ctx.i18n.t("errors.payment")
      return ctx.editMessageText(text)
    }

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
}

async function checkPayment(ctx) {
  const user = ctx.state.user
    
  const bill = user.payments.current
  if (!bill) {
    // todo: use i18n
    return ctx.editMessageText("⚠️user has no bill when validating payment")
  }

  const response = await ctx.payments.getBillStatus(bill.billId)
  if (!response.ok) {
    ctx.logger.error(response.error, {
      msg: "smth went wrong when getting bill status"
    })
    const text = ctx.i18n.t("errors.payment")
    return ctx.editMessageText(text)
  }

  const { status, customFields } = response.data

  // ! I'm lazy to write dev payment system, so just uncomment this line for success payment verification
  if (process.env.NODE_ENV !== "production") {
    status.value = ctx.payments.status.PAID
  }

  if (status.value === ctx.payments.status.PAID) {
  // disable dublicates - only unique
    const uniquePayment = !user.payments.history.find(p => p.billId === bill.billId)
    if (uniquePayment) {
      bill.status.value = ctx.payments.status.PAID
      user.payments.history.push(bill)
      user.payments.current = null
      await user.save()
      return successHandler(customFields.itemId)
    }
    else {
      // ! this code never gonna executed since current payment becames null when checking for first time
      // todo: use i18n
      return ctx.editMessageText("⚠️already paid")
    }
  }
  else if (status.value === ctx.payments.status.EXPIRED) {
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
    const item = ctx.db.getItemById(itemId)
    // check if first payment has active promo, if true - add more points to balance
    const { promocode } = ctx.getConfig()

    ctx.logger.info("user payment", {
      bill
    })

    if (user.payments.promocode.active) {
      const amount = item.amount + promocode.bonusAmount
      user.payments.promocode.active = false
      user.payments.balance += amount
      await user.save()
      const text = ctx.i18n.t("payments.success-promo", { balance: user.payments.balance })
      await ctx.editMessageText(text)
    }
    else {
      user.payments.balance += item.amount
      await user.save()
      const text = ctx.i18n.t("payments.success", { balance: user.payments.balance })
      await ctx.editMessageText(text)
    }

    try {
      // ! notify with new payment
      for(const id in JSON.parse(process.env.NOTIFY)) {
        await ctx.telegram.sendMessage(id, `🤑 payment from ${user.client.id} — 💰${item.price} (${item.id})`)
      }
    }
    catch(error) {
      ctx.logger.error("error when notify new payment")
    }
  }
}

function showCurrentPayment(ctx) {
  const { status, payUrl, customFields } = ctx.state.bill
  if (status.value === ctx.payments.status.WAITING) {
    const item = ctx.db.getItemById(customFields.itemId)
    const text = ctx.i18n.t("payments.waiting", { item })
    const kb = ctx.keyboards.paymentInlineKeyboard(ctx.i18n, payUrl)
    if (ctx.message) {
      return ctx.reply(text, kb)
    }
    else {
      return ctx.editMessageText(text, kb)
    }
  }
  else if (status.value === ctx.payments.status.PAID) {
    const text = ctx.i18n.t("payments.completed")
    if (ctx.message) {
      return ctx.reply(text)
    }
    else {
      return ctx.editMessageText(text)
    }
  }
}

async function playQuiz(ctx) {
  const user = ctx.state.user
  const config = ctx.getConfig()

  if (user.payments.balance < config.quiz.playPrice) {
    const text = ctx.i18n.t("quiz.not-allowed", { user, config })
    return ctx.reply(text)
  }
  
  user.payments.balance -= config.quiz.playPrice

  const p = user.quiz.history.length > 0 ? config.quiz.pathToJson : config.quiz.pathToJsonEasy
  const allQuestions = require(p)

  // получить все вопросы викторин у которых проголосовал пользователь
  const used = user.quiz.history.map(entry => entry.questions.filter(q => q.answerIndex !== -1).map(q => q.text)).flat()

  // получить все вопросы с общего списка который будут новыми для пользователя
  const unused = allQuestions.filter(q => !used.includes(q.text)).map(({ text, answers, correctIndex }) => ({ text, answers, correctIndex }))

  if (unused.length < config.quiz.amountOfQuestions) {
    const text = ctx.i18n.t("quiz.out-of-questions")
    return ctx.reply(text)
  }
  
  user.quiz.current = {
    index: 0,
    questions: ctx.utils.generateQuiz(ctx.utils.shuffle(unused).slice(0, config.quiz.amountOfQuestions)),
  }
  await user.save()

  await ctx.reply("Приготовься!", ctx.keyboards.remove)
  sendNextQuestionToUser(ctx)
}

async function sendNextQuestionToUser(ctx)  {
  const { quiz } = ctx.getConfig()
  const seconds = quiz.voteTimeInSeconds

  const user = ctx.state.user
  const chatId = user.client.id
  const { text, answers, correctIndex } = user.getCurrentQuestion()

  // developer role
  const displayAnswers = user.isDeveloper() ? answers.map((t, i) => i === correctIndex ? "😎" + t : t) : answers

  const message = await ctx.telegram.sendPoll(chatId, text, displayAnswers, {
    is_anonymous: false,
    open_period: seconds,
  })

  const wait = (seconds - 1) * 1000
  const stopHandler = async () => {
    try {
      const poll = await ctx.telegram.stopPoll(chatId, message.message_id)
      if (poll.total_voter_count === 0) {
        await user.restoreQuiz()
        const text = ctx.i18n.t("quiz.timeout")
        ctx.telegram.sendMessage(chatId, text, ctx.keyboards.mainKeyboard(ctx))
      }
      else if (poll.total_voter_count > 1) {
        // может ли пользователь переслать сообщение чтобы проголосовал кто-то другой?
        ctx.logger.warn("poll.total_voter_count > 1", { poll })
      }
    }
    catch(error) {
      // Error: 400: Bad Request: poll has already been closed
      ctx.logger.warn(error.message)
    }
  }
  return ctx.utils.sleep(wait).then(stopHandler)

  // setTimeout(stopHandler, wait)
}

async function pollAnswer(ctx) {
  const pollId = ctx.pollAnswer.poll_id
  const userId = ctx.pollAnswer.user.id
  const answerIndex = ctx.pollAnswer.option_ids[0]

  ctx.logger.info("poll_answer", { pollId, userId, answerIndex })

  const user = await ctx.db.findUserByChatId(userId)
  if (!user) {
    return ctx.logger.warn("poll_answer from undefined user")
  }

  await user.voteInQuiz(answerIndex)
  ctx.state.user = user

  const { quiz } = ctx.getConfig()

  if (user.isQuizCompleted()) {
    const { correct, total } = user.getQuizScore()

    if (correct === total) {
      user.payments.balance += quiz.successRewardPrice
      await user.save()
      const text = ctx.i18n.t("quiz.success", { correct, total, userBalance: user.payments.balance })
      await ctx.telegram.sendMessage(userId, text, ctx.keyboards.mainKeyboard(ctx))
    }
    else {
      const text = ctx.i18n.t("quiz.failed", { correct, total })
      await ctx.telegram.sendMessage(userId, text, ctx.keyboards.mainKeyboard(ctx))
    }
    await user.restoreQuiz()
  }
  else {
    ctx.state.user = user
    sendNextQuestionToUser(ctx)
  }
}

module.exports = {
  start,
  help,
  displayProfile,
  displayShop,
  withdraw,
  newPayment,
  cancelPayment,
  checkPayment,
  playQuiz,
  pollAnswer,
}