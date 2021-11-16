const { Schema, model } = require("mongoose")

const { shuffle, generateQuiz } = require("../utils")

const paymentSchema = {
  _id: false,
  type: {
    method: String,
    payUrl: String,
    billId: String,
    amount: {
      currency: String,
      value: String,
    },
    status: {
      value: String,
      changedDateTime: String
    },
    customFields: Object
  },
  default: null,
}

const quizEntrySchema = {
  type: {
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
  default: null
}

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
    current: quizEntrySchema,
    history: [quizEntrySchema],
  },
  payments: {
    balance: {
      type: Number,
      default: 0,
    },
    current: paymentSchema,
    history: [paymentSchema],
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

/*
schema.methods.generateQuiz = function(amount) {
  // const pathToQuestions = "../data/quiz.json" 
  const pathToQuestions = "../data/200-work.json"
  const allQuestions = require(pathToQuestions)

  // получить все вопросы викторин у которых проголосовал пользователь
  const used = this.quiz.history.map(entry => entry.questions.filter(q => q.answerIndex !== -1).map(q => q.text)).flat()

  // получить все вопросы с общего списка который будут новыми для пользователя
  const unused = allQuestions.filter(q => !used.includes(q.text)).map(({ text, answers, correctIndex }) => ({ text, answers, correctIndex }))

  if (unused.length < amount) {
    // новых вопросов доступно меньше чем нужно
    // quiz.questions = generateQuiz(unused)
  }
  else {
    // // todo: сейчас следующие вопросы идут в такой же очереди как в БД только между собой перемешаны
    return {
      index: 0,
      questions: generateQuiz(shuffle(unused).slice(0, amount)),
    }
  }
}
*/

schema.methods.generateQuizTemp = function() {
  const quizArray = require("../data/quiz.json")
  const shuffled = generateQuiz(quizArray)

  this.quiz.current = {
    index: 0,
    questions: shuffled,
  }
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