const { shop } = require("./config.json")

function getItemById(id) {
  // todo: is default user can access to dev item?
  const items = [...shop.devItems, ...shop.items]
  return items.filter(item => item.id === id)[0]
}

module.exports = {
  shop,
  getItemById
}