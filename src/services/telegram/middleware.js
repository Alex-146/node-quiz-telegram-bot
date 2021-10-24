const { findUserByChatId } = require("../../db/mongo")

function fetchUser(message) {
  return async (ctx, next) => {
    const user = await findUserByChatId(ctx.chat.id)
    if (user) {
      ctx.state.user = user
      next()
    }
    else {
      if (message) {
        ctx.reply(message)
      }
    }
  }
}

function developerAccess(message) {
  return (ctx, next) => {
    const user = ctx.state.user
    if (user.isDeveloper()) {
      next()
    }
    else {
      if (message) {
        ctx.reply(message)
      }
    }
  }
}

module.exports = {
  fetchUser,
  developerAccess
}