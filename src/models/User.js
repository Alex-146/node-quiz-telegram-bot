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
  invitedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
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
    },
    history: [{
      date: {
        type: Date
      },
      questions: []
    }]
  }
})

module.exports = model("User", schema)