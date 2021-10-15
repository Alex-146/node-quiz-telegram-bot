const { config } = require("../../config")

const paymentDurationInHours = 2

const shop = {
  devItems: [
    {
      id: "devItem",
      title: "dev:100🥒-1💲",
      amount: 100,
      price: 1
    }
  ],
  items: [
    {
      id: "item50points",
      title: "50🥒-100💲",
      amount: 50,
      price: 100
    },
    {
      id: "item100points",
      title: "100🥒-200💲",
      amount: 100,
      price: 200
    }
  ]
}

function getItems() {
  const items = []
  if (!config.IS_PRODUCTION) {
    items.push(...shop.devItems)
  }
  items.push(...shop.items)

  return items
}

function getItemById(id) {
  return getItems().filter(item => item.id === id)[0]
}

module.exports = {
  paymentDurationInHours,
  getItems,
  getItemById
}