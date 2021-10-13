const { Schema, model } = require("mongoose")

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

schema.methods.hasActiveBill = function() {
  // todo: validate time using qiwi service
  return this.payments.current.length > 0
}

schema.methods.generateBill = async function(amount) {
  if (this.hasActiveBill()) {
    return this.payments.current
  }
  else {
    // todo: qiwi service generate id and get link to it
    const id = `payment:${amount}:${this.client.id}:${Date.now()}`
    this.payments.current = id
    
    await this.save()
    return id
  }
}

schema.methods.cancelPayment = function() {
  this.payments.current = ""
  return this.save()
}

schema.methods.validateBillPayment = async function() {

  // todo: qiwi validate bill for payment
  // todo: check if first payment has active promo, if true - add more points to balance

  if (!this.hasActiveBill()) return

  const id = this.payments.current
  
  if (true) {
    const amount = +id.split(":")[1]
    this.payments.balance += amount
    this.payments.history.push(id)
    this.payments.current = ""

    await this.save()
    return true
  }

  return false
}

module.exports = model("User", schema)