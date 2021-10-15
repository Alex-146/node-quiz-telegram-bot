const axios = require("axios")

const { config } = require("../../config")

const { getLifetimeByHours } = require("../../utils")

async function createDemoPayment() {
  return createPayment({
    billId: `demo-${Date.now()}`,
    amount: "1",
    currency: "RUB",
    comment: "demo payment",
    expirationDateTime: getLifetimeByHours(1),
  })
}

async function createPayment({ billId, amount, currency, comment, expirationDateTime, customFields}) {
  try {
    const { data } = await axios.default.post(config.PAYMENT_SERVER_URI + "/qiwi/payment", {
      billId,
      amount,
      currency,
      comment,
      expirationDateTime,
      customFields
    })
    return {
      ok: true,
      data
    }
  }
  catch(error) {
    return {
      ok: false
    }
  }
}

async function getPaymentStatus(id) {
  try {
    const { data } = await axios.default.get(config.PAYMENT_SERVER_URI + "/qiwi/" + id)
    return {
      ok: true,
      data
    }
  }
  catch(error) {
    return {
      ok: false
    }
  }
}

async function cancelPayment(id) {
  try {
    const { data } = await axios.default.delete(config.PAYMENT_SERVER_URI + "/qiwi/" + id)
    return {
      ok: true,
      data
    }
  }
  catch(error) {
    return {
      ok: false
    }
  }
}

module.exports = {
  createDemoPayment,
  createPayment,
  getPaymentStatus,
  cancelPayment,
}