const { Markup } = require("telegraf")

const { MESSAGES } = require("./messages")

const { shop } = require("./config.json")

const startKeyboard = Markup.keyboard([
  [MESSAGES.YES],
  [MESSAGES.NO]
]).oneTime().resize()

function mainKeyboard(ctx) {
  const buttons = [
    [MESSAGES.PROFILE],
    [MESSAGES.PLAY],
    [MESSAGES.SHOP, MESSAGES.WITHDRAW],
  ]
  const user = ctx.state.user
  if (user.isDeveloper()) {
    buttons.push([MESSAGES.DEVELOPER_MODE])
  }
  const keyboard = Markup.keyboard(buttons).resize()
  return keyboard
}

function paymentInlineKeyboard(paymentUrl) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url("Оплатить", paymentUrl)],
    [Markup.button.callback("Проверить", "payment:check")],
    [Markup.button.callback("Отказаться", "payment:cancel")],
  ])
  return keyboard
}

function paymentItemsInlineKeyboard(ctx) {
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