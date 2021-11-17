function getConfig() {
  return require("../../config.json")
}

function getItemById(id) {
  const { shop } = getConfig()
  // todo: is default user can access to dev item?
  const items = [...shop.devItems, ...shop.items]
  return items.filter(item => item.id === id)[0]
}

module.exports = {
  getConfig,
  getItemById
}