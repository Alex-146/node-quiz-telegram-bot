const { findUserByChatId } = require("../../db/mongo")

async function fetchUser(ctx, next) {
  const user = await findUserByChatId(ctx.from.id)
  if (user) {
    ctx.state.user = user
    next()
  }
  else {
    ctx.reply("error via fetching user")
  }
}

module.exports = {
  fetchUser
}