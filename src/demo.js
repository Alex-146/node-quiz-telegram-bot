const db = require("./db/mongo")

require("dotenv").config()

async function main() {
  try {
    await db.connect()

    // console.log(await db.restoreQuizForUser(146))
    // console.log(await db.generateQuizForUser(146))

    // await db.userVoteInQuiz(146, 1)
    // await db.userVoteInQuiz(146, 2)
    // await db.userVoteInQuiz(146, 3)
    // await db.userVoteInQuiz(146, 4)
    // await db.userVoteInQuiz(146, 5)

    // const { correct, total } = await db.getUserScore(146)
    // console.log(correct, total)

    // db.createUser(146, "615de14d48fd51004dc118c8")
    // console.log(await db.findUserByChatId(146).populate("invitedBy"))
  }
  catch(error) {
    console.log(error)
  }
}

main()