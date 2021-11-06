const { P2P } = require("qiwi-sdk")

const p2p = new P2P(process.env.QIWI_PRIVATE_KEY, process.env.QIWI_PUBLIC_KEY)

function createBill(price, hours) {
  return p2p.createBill({
    amount: {
      value: price,
      currency: P2P.Currency.RUB
    },
    expirationDateTime: P2P.formatLifetime(hours / 24)
  })
}

function getBillStatus(id) {
  return p2p.billStatus(id)
}

function rejectBill(id) {
  return p2p.rejectBill(id)
}

module.exports = {
  createBill,
  getBillStatus,
  rejectBill
}