const { Markup } = require("telegraf")

const { getConfig } = require("./config")

function startKeyboard(ctx) {
  return Markup.keyboard([
    [ctx.i18n.t("keyboard.yes")],
    [ctx.i18n.t("keyboard.no")]
  ]).oneTime().resize()
}

function mainKeyboard(ctx) {
  const buttons = [
    [ctx.i18n.t("keyboard.profile")],
    [ctx.i18n.t("keyboard.play")],
    [ctx.i18n.t("keyboard.shop"), ctx.i18n.t("keyboard.withdraw")],
  ]
  const user = ctx.state.user
  if (user.isDeveloper()) {
    buttons.push([ctx.i18n.t("keyboard.developer")])
  }
  const keyboard = Markup.keyboard(buttons).resize()
  return keyboard
}

function paymentInlineKeyboard(i18n, paymentUrl) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url(i18n.t("payments.keyboard.pay"), paymentUrl)],
    [Markup.button.callback(i18n.t("payments.keyboard.check"), "payment:check")],
    [Markup.button.callback(i18n.t("payments.keyboard.reject"), "payment:cancel")],
  ])
  return keyboard
}

function paymentItemsInlineKeyboard(ctx) {
  const { shop } = getConfig()
  const items = []
  if (ctx.state.user.isDeveloper()) {
    items.push(...shop.devItems)
  }
  items.push(...shop.items)

  const buttons = items.map(item => Markup.button.callback(item.title, `payment:new:${item.id}`))

  const keyboard = Markup.inlineKeyboard([
    ...buttons.map(button => [button])
  ])
  return keyboard
}

module.exports = {
  startKeyboard,
  mainKeyboard,
  paymentInlineKeyboard,
  paymentItemsInlineKeyboard,
}