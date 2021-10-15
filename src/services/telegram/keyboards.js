const { Markup } = require("telegraf")

const { MESSAGES } = require("./messages")

const { getItems } = require("./config")

const startKeyboard = Markup.keyboard([
  [MESSAGES.YES],
  [MESSAGES.NO]
]).oneTime().resize()

const mainKeyboard = Markup.keyboard([
  [MESSAGES.PROFILE],
  [MESSAGES.PLAY],
]).resize()

function getPaymentKeyboard(paymentUrl) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url("Оплатить", paymentUrl)],
    [Markup.button.callback("Проверить", "payment:check")],
    [Markup.button.callback("Отказаться", "payment:cancel")],
  ])
  return keyboard
}

function generateShopKeyboard() {
  const items = getItems()

  const keyboard = Markup.inlineKeyboard([
    ...items.map(item => [Markup.button.callback(item.title, `payment:new:${item.id}`)])
  ])
  return keyboard
}

module.exports = {
  startKeyboard,
  mainKeyboard,
  getPaymentKeyboard,
  generateShopKeyboard,
}