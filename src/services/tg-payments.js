const { Markup } = require("telegraf")

const items = [
  // { icon: "🍏", id: "item:greenApple", price: 10},
  // { icon: "🍎", id: "item:redApple", price: 11 },
  { icon: "🥒", id: "item:cucumber", price: 146 },
  { icon: "🍺", id: "item:beer", price: 42 },
]

const shopKeyboard = Markup.inlineKeyboard([
  ...items.map(item => Markup.button.callback(item.icon, item.id))
])

function generateInvoice(chat_id, price, currency, payload, title = "InvoiceTitle", description = "InvoiceDescription") {
  // https://core.telegram.org/bots/api#payments
  return {
    chat_id,
    title,
    description,
    payload,
    provider_token: process.env.LIQPAY_KEY,
    currency, // Трехбуквенный код валюты ISO 4217
    prices: [{ label: 'Invoice Label', amount: price * 100 }], // Разбивка цен, сериализованный список компонентов в формате JSON 100 копеек * 100 = 100 рублей
    start_parameter: 'get_access', //Уникальный параметр глубинных ссылок. Если оставить поле пустым, переадресованные копии отправленного сообщения будут иметь кнопку «Оплатить», позволяющую нескольким пользователям производить оплату непосредственно из пересылаемого сообщения, используя один и тот же счет. Если не пусто, перенаправленные копии отправленного сообщения будут иметь кнопку URL с глубокой ссылкой на бота (вместо кнопки оплаты) со значением, используемым в качестве начального параметра.
  }
}

module.exports = function(bot) {
  bot.command("pay", ctx => {
    ctx.reply("items", shopKeyboard)
    // ctx.replyWithInvoice(generateInvoice(cxt.from.id, 10, "RUB"))
  })

  const regex = new RegExp(/item:(.+)/)

  bot.action(regex, ctx => {
    // unnecessary to `regex.exec` because `ctx.callbackQuery.data` contains id
    // ['item:apple', 'apple', index: 0, input: 'item:apple', groups: undefined]
    const id = regex.exec(ctx.callbackQuery.data)[0]
    
    const item = items.find(i => i.id == id)
    const invoice = generateInvoice(ctx.from.id, item.price, "RUB", { id }, item.icon, "Buy it!")
    ctx.replyWithInvoice(invoice)
  })

  // ответ на предварительный запрос по оплате
  bot.on('pre_checkout_query', ctx => {
    ctx.answerPreCheckoutQuery(true)
  })

  // ответ в случае положительной оплаты
  bot.on('successful_payment', (ctx) => {
    // https://core.telegram.org/bots/api#successfulpayment
    const { id } = JSON.parse(ctx.message.successful_payment.invoice_payload)
    const item = items.find(i => i.id === id)
    ctx.reply(`Thx for purchasing ${item.icon}!`)
  })
}