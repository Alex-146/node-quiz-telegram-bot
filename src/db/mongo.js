const mongoose = require("mongoose")

const User = require("../models/User")

const { shuffle } = require("../utils")

function connect(uri) {
  return mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
}

function close() {
  return mongoose.connection.close()
}
async function createUser(id, invitedBy) {
  const user = new User({
    client: {
      id
    },
    invitedBy,
    roles: ["user"]
  })
  await user.save()
}

function findUserByChatId(id) {
  return User.findOne({ "client.id": id })
}

async function generateQuizForUser(id) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }

  const quizArray = require("../data/quiz.json")
  const shuffled = shuffle(quizArray).map(entry => {
    const correctAnswer = entry.answers[entry.correctIndex]
    entry.answers = shuffle(entry.answers)
    entry.correctIndex = entry.answers.indexOf(correctAnswer)
    return entry
  })

  user.quiz.current.index = 0
  user.quiz.current.questions = shuffled
  
  await user.save()
  return user
}

async function restoreQuizForUser(id) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }

  user.quiz.current.index = 0
  user.quiz.current.questions = []

  await user.save()
  return user
}

async function userVoteInQuiz(id, answerIndex) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }

  const index = user.quiz.current.index++
  user.quiz.current.questions[index].answerIndex = answerIndex

  await user.save()
  return user
}

async function getUserScore(id) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }

  const data = {
    correct: 0,
    total: user.quiz.current.questions.length
  }

  for (let i = 0; i < data.total; i++) {
    const entry = user.quiz.current.questions[i]
    if (entry.answerIndex === entry.correctIndex) {
      data.correct += 1
    }
  }

  return data
}

async function getUserCurrentQuestion(id) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }

  const index = user.quiz.current.index
  const { text, answers } = user.quiz.current.questions[index]

  return {
    text,
    answers
  }
}

async function isUserCompletedQuiz(id) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }
  return user.quiz.current.index === user.quiz.current.questions.length
}

module.exports = {
  connect,
  close,
  createUser,
  findUserByChatId,
  generateQuizForUser,
  restoreQuizForUser,
  userVoteInQuiz,
  getUserScore,
  getUserCurrentQuestion,
  isUserCompletedQuiz,
}