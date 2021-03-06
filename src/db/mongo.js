const mongoose = require("mongoose")

const User = require("../models/User")

const { generateQuiz } = require("../utils")
const { getConfig } = require("../services/telegram/config")

function connect() {
  const uri = process.env.NODE_ENV === "production" ? process.env.MONGO_URI_PROD : process.env.MONGO_URI_DEV
  return mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
}

function close() {
  return mongoose.connection.close()
}

async function createUser(id) {
  const config = getConfig()
  const user = new User({
    client: {
      id
    },
    roles: ["user"],
    payments: {
      balance: config.user.startBalance
    }
  })
  await user.save()
  return user
}

function findUserByChatId(id) {
  return User.findOne({ "client.id": id })
}

function getUsersCount() {
  return User.estimatedDocumentCount()
}

// done in schema methods
async function generateQuizForUser(id) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }

  user.quiz.current.index = 0
  user.quiz.current.questions = generateQuiz()
  
  await user.save()
  return user
}

// done in schema methods
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

// done in schema methods
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

// done in schema methods
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

// done in schema methods
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

// done in schema methods
async function isUserCompletedQuiz(id) {
  const user = await findUserByChatId(id)
  if (!user) {
    return
  }
  return user.quiz.current.index === user.quiz.current.questions.length
}

module.exports = {
  User,
  connect,
  close,
  createUser,
  findUserByChatId,
  getUsersCount,
  
  generateQuizForUser,
  restoreQuizForUser,
  userVoteInQuiz,
  getUserScore,
  getUserCurrentQuestion,
  isUserCompletedQuiz,
}