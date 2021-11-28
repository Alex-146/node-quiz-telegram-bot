async function addBalance(ctx) {
  const { developer } = ctx.getConfig()
  const user = ctx.state.user
  user.payments.balance += developer.balance
  await user.save()
  ctx.answerCbQuery()
  return ctx.reply(user.payments.balance)
}

async function resetBalance(ctx) {
  const user = ctx.state.user
  user.payments.balance = 0
  await user.save()
  ctx.answerCbQuery()
  return ctx.reply("Обнулено")
}

async function resetHistory(ctx) {
  const user = ctx.state.user
  user.quiz.history = []
  await user.save()
  ctx.answerCbQuery()
  return ctx.reply("Очищено")
}

async function showConfig(ctx) {
  const json = JSON.stringify(ctx.getConfig(), null, 2)
  const text = `<code>${json}</code>`
  await ctx.answerCbQuery()
  return ctx.replyWithHTML(text)
}

async function printUsersCount(ctx) {
  const count = await ctx.db.getUsersCount()
  await ctx.answerCbQuery()
  return ctx.reply(count)
}

module.exports = {
  addBalance,
  resetBalance,
  resetHistory,
  showConfig,
  printUsersCount
}