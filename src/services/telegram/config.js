const fs = require("fs")
const path = require("path")

function getConfig() {
  const pathToJson = path.resolve("src", "config.json")
  return JSON.parse(fs.readFileSync(pathToJson))
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