const { Schema, model } = require("mongoose")

const payments = require("../services/qiwi")

const schema = new Schema({
  client: {
    id: {
      type: Number,
      requied: true,
    },
  },
  roles: [String],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  quiz: {
    current: {
      index: {
        type: Number,
      },
      questions: [{
        text: {
          type: String,
        },
        answers: [String],
        correctIndex: {
          type: Number
        },
        answerIndex: {
          type: Number,
          default: -1
        },
      }],
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
    history: [{
      index: {
        type: Number,
      },
      questions: [],
      createdAt: {
        type: Date
      },
    }],
  },
  payments: {
    balance: {
      type: Number,
      default: 0,
    },
    current: {
      type: String,
      default: "",
    },
    history: [String], // todo: change to payment entry
    promocode: {
      active: {
        type: Boolean,
        default: false,
      },
      value: {
        type: String,
        default: "",
      },
    },
  },
})

schema.methods.generateQuiz = function() {
  const shuffled = require("../utils").generateQuiz()

  this.quiz.current = {
    index: 0,
    questions: shuffled,
  }

  return this.save()
}

schema.methods.getCurrentQuestion = function() {
  const index = this.quiz.current.index
  const { text, answers, correctIndex } = this.quiz.current.questions[index]

  return {
    text,
    answers,
    correctIndex,
  }
}

schema.methods.voteInQuiz = function(answerIndex) {
  const index = this.quiz.current.index++
  this.quiz.current.questions[index].answerIndex = answerIndex

  return this.save()
}

schema.methods.isQuizCompleted = function() {
  return this.quiz.current.index === this.quiz.current.questions.length
}

schema.methods.getQuizScore = function() {
  const data = {
    correct: 0,
    total: this.quiz.current.questions.length
  }

  for (let i = 0; i < data.total; i++) {
    const entry = this.quiz.current.questions[i]
    if (entry.answerIndex === entry.correctIndex) {
      data.correct += 1
    }
  }

  return data
}

schema.methods.restoreQuiz = function() {
  const quiz = this.quiz.current
  this.quiz.history.push(quiz)
  this.quiz.current = null

  return this.save()
}

schema.methods.hasActiveBill = async function() {
  const id = this.payments.current
  const response = await payments.getPaymentStatus(id)
  if (!response.ok) {
    // if here it means no id
    return false
  }

  const { status, amount, payUrl, customFields } = response.data
  return {
    status,
    amount,
    payUrl,
    customFields
  }
}

schema.methods.generateBill = async function({ billId, amount, currency, comment, expirationDateTime, customFields }) {
  
  const response = await payments.createPayment({ billId, amount, currency, comment, expirationDateTime, customFields })
  if (!response.ok) {
    console.log("error occured when creating payment")
    return
  }

  const { billId: id, payUrl } = response.data
  
  this.payments.current = id
  await this.save()

  return {
    payUrl
  }
}

schema.methods.cancelPayment = async function() {
  const id = this.payments.current
  await payments.cancelPayment(id)
  
  this.payments.history.push(id)
  this.payments.current = ""
  return this.save()
}

schema.methods.validateBillPayment = async function() {
  const bill = await this.hasActiveBill()
  if (!bill) {
    return {
      error: "error - user has no bill when validating payment"
    }
  }

  const { billId, status, customFields } = bill

  if (this.payments.history.includes(billId)) {
    return {
      error: "error - user already paid this bill"
    }
  }
  
  if (status.value === "PAID") {
    this.payments.history.push(billId)
    this.payments.current = ""

    await this.save()
    return {
      success: true,
      customFields
    }
  }

  return {
    success: false
  }
}

schema.methods.isDeveloper = function() {
  return this.roles.includes("developer")
}

schema.methods.activatePromocode = function(value) {
  this.payments.promocode = {
    active: true,
    value
  }
  return this.save()
}

schema.methods.getQuizStats = function() {
  const history = this.quiz.history
  const success = history.filter(entry => entry.questions.every(q => q.answerIndex === q.correctIndex)).length
  const total = history.length
  return {
    success,
    total
  }
}

module.exports = model("User", schema)