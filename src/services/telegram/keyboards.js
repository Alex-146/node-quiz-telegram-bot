const { Markup } = require("telegraf")

const { MESSAGES } = require("./messages")

const { config } = require("../../config")
const { shop } = require("./config.json")

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
  const items = []
  if (!config.IS_PRODUCTION) {
    items.push(...shop.devItems)
  }
  items.push(...shop.items)

  const keyboard = Markup.inlineKeyboard([
    ...items.map(item => [Markup.button.callback(item.title, `payment:new:${JSON.stringify(item)}`)])
  ])
  return keyboard
}

module.exports = {
  startKeyboard,
  mainKeyboard,
  getPaymentKeyboard,
  generateShopKeyboard,
}