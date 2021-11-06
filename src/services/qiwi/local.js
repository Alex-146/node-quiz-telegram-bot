const { P2P } = require("qiwi-sdk")

const p2p = new P2P(process.env.QIWI_PRIVATE_KEY, process.env.QIWI_PUBLIC_KEY)

async function createBill(price, hours, customFields) {
  try {
    const data = await p2p.createBill({
      amount: {
        value: price,
        currency: P2P.Currency.RUB
      },
      expirationDateTime: P2P.formatLifetime(hours / 24),
      customFields
    })
    return {
      ok: true,
      data
    }
  }
  catch(error) {
    return {
      ok: false,
      error
    }
  }
}

async function getBillStatus(id) {
  try {
    const data = await p2p.billStatus(id)
    return {
      ok: true,
      data
    }
  }
  catch(error) {
    return {
      ok: false,
      error
    }
  }
}

async function rejectBill(id) {
  try {
    const data = await p2p.rejectBill(id)
    return {
      ok: true,
      data
    }
  }
  catch(error) {
    return {
      ok: false,
      error
    }
  }
}

module.exports = {
  status: P2P.BillStatus,
  type: "qiwi",
  createBill,
  getBillStatus,
  rejectBill
}