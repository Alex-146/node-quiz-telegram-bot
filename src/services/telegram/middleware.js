const { findUserByChatId } = require("../../db/mongo")

function fetchUser(showMessage = true) {
  return async (ctx, next) => {
    const user = await findUserByChatId(ctx.chat.id)
    if (user) {
      ctx.state.user = user
      next()
    }
    else {
      if (showMessage) {
        const text = ctx.i18n.t("errors.fetchUser")
        ctx.reply(text)
      }
    }
  }
}

function developerAccess(showMessage = true) {
  return (ctx, next) => {
    const user = ctx.state.user
    if (user.isDeveloper()) {
      next()
    }
    else {
      if (showMessage) {
        const text = ctx.i18n.t("errors.developerAccess")
        ctx.reply(text)
      }
    }
  }
}

module.exports = {
  fetchUser,
  developerAccess
}