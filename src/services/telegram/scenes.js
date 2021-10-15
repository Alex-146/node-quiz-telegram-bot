const { Scenes, Markup } = require("telegraf")

const { startKeyboard, mainKeyboard } = require("./keyboards")
const { MESSAGES } = require("./messages")
const {
  createUser,
  findUserByChatId,
} = require("../../db/mongo")
const { fetchUser } = require("./middleware")

const SCENE_NAMES = {
  START: "startScene",
  PROMOCODE: "promocodeScene",
  MAIN: "mainScene",
  QUIZ: "quizScene"
}

const stage = new Scenes.Stage([startScene(), promocodeScene(), mainScene(), quizScene()])

// todo: mode to separate file
const promocodes = [
  "CUCUMBER146",
  "VERS146"
]

function startScene() {
  const scene = new Scenes.BaseScene(SCENE_NAMES.START)
  
  scene.enter(async (ctx) => {
    const id = ctx.chat.id
    const candidate = await findUserByChatId(id)
    if (!candidate) {
      await createUser(id)
      ctx.reply(MESSAGES.WELCOME, startKeyboard)
    }
    else {
      ctx.scene.enter(SCENE_NAMES.MAIN)
    }
  })

  scene.hears(MESSAGES.YES, (ctx) => {
    ctx.scene.enter(SCENE_NAMES.PROMOCODE)
  })

  scene.hears(MESSAGES.NO, (ctx) => {
    ctx.reply("Не волнуйся, ты можешь активировать промокод позже")
    ctx.scene.enter(SCENE_NAMES.MAIN)
  })

  scene.on("message", (ctx) => {
    ctx.reply("Пожалуйста ответь на вопрос")
  })

  return scene
}

function promocodeScene() {
  const scene = new Scenes.BaseScene(SCENE_NAMES.PROMOCODE)

  scene.enter((ctx) => {
    ctx.reply("Введи промокод")
  })

  scene.hears(MESSAGES.RETURN, (ctx) => {
    ctx.scene.enter(SCENE_NAMES.MAIN)
  })

  scene.on("text", (ctx) => {
    const text = ctx.message.text
    if (promocodes.includes(text)) {
      // todo: store value in db
      ctx.reply(MESSAGES.PROMOCODE_ACTIVATED, Markup.removeKeyboard())
      ctx.scene.enter(SCENE_NAMES.MAIN)
    }
    else {
      const k = Markup.keyboard([
        [MESSAGES.RETURN]
      ]).oneTime().resize()

      ctx.reply("Недействительный промокод, попробуй еще или вернись в главное меню", k)
    }
  })

  return scene
}

function mainScene() {
  const scene = new Scenes.BaseScene(SCENE_NAMES.MAIN)

  scene.enter((ctx) => {
    ctx.reply("Hello", mainKeyboard)
  })

  scene.hears(MESSAGES.PLAY, (ctx) => {
    ctx.scene.enter(SCENE_NAMES.QUIZ)
  })

  // todo: middleware
  scene.hears(MESSAGES.PROFILE, fetchUser(), async (ctx) => {
    const user = ctx.state.user
    const id = user.client.id
    const balance = user.payments.balance
    ctx.reply(`id: ${id}, balance: ${balance}`)
  })

  return scene
}

function quizScene() {
  const scene = new Scenes.BaseScene(SCENE_NAMES.QUIZ)

  // todo: is better to do this in main bot handler

  scene.enter(async (ctx) => {
    // todo: check for empty user - use middleware
    const id = ctx.chat.id
    const user = await findUserByChatId(id)
    await user.generateQuiz()

    const quizEntry = user.getCurrentQuestion()

    // todo: fix - use existing function to send
    const message = await ctx.replyWithPoll(quizEntry.text, quizEntry.answers, {
      open_period: 10,
      is_anonymous: false,
    }, Markup.removeKeyboard())
  })

  return scene
}

module.exports = {
  SCENE_NAMES,
  stage,
}
