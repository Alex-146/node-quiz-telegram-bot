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

function generateQuiz(quizArray) {
  const shuffled = shuffle(quizArray).map(entry => {
    const correctAnswer = entry.answers[entry.correctIndex]
    entry.answers = shuffle(entry.answers)
    entry.correctIndex = entry.answers.indexOf(correctAnswer)
    return entry
  })
  return shuffled
}

function paragraphMessage(...entries) {
  return entries.join("\n")
}

/**
* Generate lifetime in format
* @param {number} hours - Hours of lifetime
* @return {string} Lifetime in ISO
*/
function getLifetimeByHours(hours = 2) {
  const date = new Date()
  const timePlused = date.getTime() + hours * 60 * 60 * 1000
  date.setTime(timePlused)
  return normalizeDate(date)
}

/**
* Normalize date in api format
* @param {Date} date - Date object
* @returns {string} Date in api format
*/
function normalizeDate(date) {
  const tzo = -date.getTimezoneOffset()
  const dif = tzo >= 0 ? '+' : '-'
  const pad = function (num) {
    const norm = Math.floor(Math.abs(num))
    return (norm < 10 ? '0' : '') + norm
  };
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    dif + pad(tzo / 60) +
    ':' + pad(tzo % 60)
}

module.exports = {
  sleep,
  shuffle,
  generateQuiz,
  paragraphMessage,
  getLifetimeByHours
}