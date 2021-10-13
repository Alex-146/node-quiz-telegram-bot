const { Markup } = require("telegraf")

const { MESSAGES } = require("./messages")

const startKeyboard = Markup.keyboard([
  [MESSAGES.YES],
  [MESSAGES.NO]
]).oneTime().resize()

const mainKeyboard = Markup.keyboard([
  [MESSAGES.PROFILE],
  [MESSAGES.PLAY],
]).resize()

module.exports = {
  startKeyboard,
  mainKeyboard,
}