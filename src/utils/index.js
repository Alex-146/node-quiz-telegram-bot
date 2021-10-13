function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array
}

function generateQuiz() {
  const quizArray = require("../data/quiz.json")
  const shuffled = shuffle(quizArray).map(entry => {
    const correctAnswer = entry.answers[entry.correctIndex]
    entry.answers = shuffle(entry.answers)
    entry.correctIndex = entry.answers.indexOf(correctAnswer)
    return entry
  })
  return shuffled
}

module.exports = {
  sleep,
  shuffle,
  generateQuiz
}