const { Scenes, Markup } = require("telegraf")
const TelegrafI18n = require("telegraf-i18n")

const { startKeyboard, mainKeyboard } = require("./keyboards")
const { fetchUser } = require("./middleware")
const { getConfig } = require("./config")

const SCENE_NAMES = {
  START: "startScene",
  PROMOCODE: "promocodeScene",
}

const stage = new Scenes.Stage([startScene(), promocodeScene()])

function startScene() {
  const scene = new Scenes.BaseScene(SCENE_NAMES.START)
  
  scene.enter(async (ctx) => {
    const text = ctx.i18n.t("greeting")
    ctx.reply(text, startKeyboard(ctx))
  })

  scene.hears(TelegrafI18n.match("keyboard.yes"), (ctx) => {
    ctx.scene.enter(SCENE_NAMES.PROMOCODE)
  })

  scene.hears(TelegrafI18n.match("keyboard.no"), (ctx) => {
    const text = ctx.i18n.t("promocode.later")
    ctx.reply(text)
    ctx.scene.leave()
  })

  scene.on("message", (ctx) => {
    const text = ctx.i18n.t("promocode.question")
    ctx.reply(text)
  })

  return scene
}

function promocodeScene() {
  const scene = new Scenes.BaseScene(SCENE_NAMES.PROMOCODE)

  scene.enter((ctx) => {
    const text = ctx.i18n.t("promocode.enter")
    ctx.reply(text)
  })

  scene.hears(TelegrafI18n.match("keyboard.return"), fetchUser(), (ctx) => {
    ctx.scene.leave()
    const config = getConfig()
    ctx.reply(ctx.i18n.t("rules", { config }), mainKeyboard(ctx))
  })

  scene.on("text", fetchUser(), async (ctx) => {
    const user = ctx.state.user

    const enteredCode = ctx.message.text

    const { promocode } = getConfig()

    if (promocode.values.includes(enteredCode)) {
      await user.activatePromocode(enteredCode)
      const text = ctx.i18n.t("promocode.activated")
      ctx.reply(text, mainKeyboard(ctx))
      ctx.scene.leave()
    }
    else {
      const k = Markup.keyboard([
        [ctx.i18n.t("keyboard.return")]
      ]).oneTime().resize()

      const text = ctx.i18n.t("promocode.invalid")
      ctx.reply(text, k)
    }
  })
  
  scene.on("message", (ctx) => {
    const text = ctx.i18n.t("promocode.unrecognized")
    ctx.reply(text)
  })

  return scene
}

module.exports = {
  SCENE_NAMES,
  stage,
}
