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
    history: [String],
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
  const { text, answers } = this.quiz.current.questions[index]

  return {
    text,
    answers
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
    console.log("error when checking")
    return {
      active: false
    } 
  }

  const { status, amount, payUrl } = response.data
  const active = status.value === "WAITING"
  return {
    active,
    status,
    amount,
    payUrl,
  }
}

schema.methods.generateBill = async function(amount) {
  const bill = await this.hasActiveBill()
  if (bill.active) {
    const { payUrl } = bill
    return {
      payUrl
    }
  }
  else {
    const response = await payments.createPayment(amount)

    if (!response.ok) {
      return console.log("error when fetching payment status")
    }

    const { billId, payUrl } = response.data
    
    this.payments.current = billId
    await this.save()

    return {
      payUrl
    }
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
  // todo: should I check time first?
  const { active } = await this.hasActiveBill()
  if (!active) return false

  const id = this.payments.current
  const response = await payments.getPaymentStatus(id)

  if (!response.ok) {
    return console.log("error when fetching payment status")
  }

  const { status, amount } = response.data
  
  if (status.value === "PAID") {
    // todo: check if first payment has active promo, if true - add more points to balance
    this.payments.balance += parseInt(amount.value) * 2
    this.payments.history.push(id)
    this.payments.current = ""

    await this.save()
    return true
  }
  // else if (status.value === "WAITING") {
  //   return false
  // }

  return false
}

module.exports = model("User", schema)