const crypto = require("crypto")

// function calculate(input) {
// 	const hash = crypto.createHash("sha256").update(input).digest("hex")
// 	const value01 = parseInt(hash.substring(0, 2), 16) / 0xff
// 	return value01
// }

function* random01(seed) {
  if (!seed) seed = Date.now().toString()
  let i = 0
  while (true) {
    const _seed = `${seed}-${i++}`
    const hash = crypto.createHash("sha256").update(_seed).digest("hex")
    yield parseInt(hash.substring(0, 2), 16) / 0xff
  }
}

// const randomizer = random01("1")
// console.log(randomizer.next().value)
// console.log(randomizer.next().value)

function shuffle(array, seed) {
  const randomizer = random01(seed)
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(randomizer.next().value * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array
}

const user = {
  id: "146",
  history: {
    questions: []
  },
  generateQuiz() {
    const AMOUNT = 2
    const questions = Array(10).fill().map((_, i) => i.toString())
    const shuffled = shuffle([...questions], this.id)
    const start = this.history.questions.length % questions.length
    const end = start + AMOUNT
    const selected = shuffled.slice(start, end)
    this.history.questions.push(...selected)
    return selected
  }
}
//'2', '3', '8', '9','0', '5', '4', '1','6', '7'

console.log(user.generateQuiz())
console.log(user.generateQuiz())
console.log(user.generateQuiz())
console.log(user.generateQuiz())
console.log(user.generateQuiz())
console.log("-")
console.log(user.generateQuiz())
console.log(user.generateQuiz())
console.log(user.generateQuiz())
console.log(user.generateQuiz())
console.log(user.generateQuiz())
