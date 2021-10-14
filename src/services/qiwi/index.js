const axios = require("axios")

const { config } = require("../../config")

async function createPayment(amount) {
  try {
    const { data } = await axios.default.post(config.PAYMENT_SERVER_URI + "/qiwi/payment", { amount })
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
  createPayment,
  getPaymentStatus,
  cancelPayment,
}