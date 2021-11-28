const { getItemById } = require("./config")

function fetchUser(showMessage = true) {
  return async (ctx, next) => {
    const user = await ctx.db.findUserByChatId(ctx.chat.id)
    if (user) {
      ctx.state.user = user
      return next()
    }
    else {
      if (showMessage) {
        const text = ctx.i18n.t("errors.fetchUser")
        return ctx.reply(text)
      }
    }
  }
}

function developerAccess(showMessage = true) {
  return (ctx, next) => {
    const user = ctx.state.user
    if (user.isDeveloper()) {
      return next()
    }
    else {
      if (showMessage) {
        const text = ctx.i18n.t("errors.developerAccess")
        return ctx.reply(text)
      }
    }
  }
}

function fetchItem() {
  // ! regex.exec(ctx.callbackQuery.data)[1]
  return (ctx, next) => {
    const id = ctx.match[1]
    const item = getItemById(id)
    if (item) {
      ctx.state.item = item
      return next()
    }
    else {
      const text = ctx.i18n.t("errors.itemNotFound")
      return ctx.reply(text)
    }
  }
}

module.exports = {
  fetchUser,
  developerAccess,
  fetchItem
}