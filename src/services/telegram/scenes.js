const { Scenes, Markup } = require("telegraf")

const { startKeyboard, mainKeyboard } = require("./keyboards")
const { MESSAGES } = require("./messages")
const { fetchUser } = require("./middleware")
const { promocode } = require("./config.json")

const SCENE_NAMES = {
  START: "startScene",
  PROMOCODE: "promocodeScene",
}

const stage = new Scenes.Stage([startScene(), promocodeScene()])

function startScene() {
  const scene = new Scenes.BaseScene(SCENE_NAMES.START)
  
  scene.enter(async (ctx) => {
    ctx.reply(MESSAGES.WELCOME, startKeyboard)
  })

  scene.hears(MESSAGES.YES, (ctx) => {
    ctx.scene.enter(SCENE_NAMES.PROMOCODE)
  })

  scene.hears(MESSAGES.NO, (ctx) => {
    ctx.reply("Не волнуйся, ты можешь активировать промокод позже")
    ctx.scene.leave()
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
    // ctx.reply("play", mainKeyboard)
    ctx.scene.leave()
  })

  scene.on("text", fetchUser(), async (ctx) => {
    const user = ctx.state.user

    const enteredCode = ctx.message.text

    if (promocode.values.includes(enteredCode)) {
      await user.activatePromocode(enteredCode)
      ctx.reply(MESSAGES.PROMOCODE_ACTIVATED, mainKeyboard)
      ctx.scene.leave()
    }
    else {
      const k = Markup.keyboard([
        [MESSAGES.RETURN]
      ]).oneTime().resize()

      ctx.reply("Недействительный промокод, попробуй еще или вернись в главное меню", k)
    }
  })
  
  scene.on("message", (ctx) => {
    ctx.reply("Это не промокод!")
  })

  return scene
}

module.exports = {
  SCENE_NAMES,
  stage,
}
