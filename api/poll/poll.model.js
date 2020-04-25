const { mongoose } = require('../../db/connection');

const pollSchema = new mongoose.Schema({
    questions: [
        {
            text: String,
            options: [{
                type: String,
            }],
            answerType: {
                type: String,
                enum: [
                    'binary',
                    'rating',
                    'yesNoMaybe',
                    'slider',
                    'radioButton',
                    'checkbox',
                    'smiley',
                    'text',
                    'dropdown'
                ],
                default: 'binary'
            }
        }
    ],

    status: {
        type: String,
        enum: ['open', 'terminated', 'deleted'],
        default: 'open'
    },
    title: String,
    description: String,
    privateNote: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    allowNames: Boolean,
    allowComments: Boolean,
    password: String,
    inactiveComment: String,
    activeComment: String,
    shortId: {
        type: String,
        unique: true,
    }
}, {
    timestamps: true
});

// generating a non-duplicate Code
pollSchema.pre('save', function(next){  // can't use arror function, or this will be undefinded. fat arrow is lexically scoped.
  let ctx = this;
  attempToGenerate(ctx, next);
});

function attempToGenerate(ctx, callback) {
    let newCode = generateBase58Id();
    ctx.constructor.findOne({'shortId': newCode}).then((poll) => {
      if (poll) {
        attempToGenerate(ctx, callback);
      }
      else {
        ctx.shortId = newCode;
        callback();
      }
    }, (err) => {
        callback(err);
    });
}

const generateBase58Id = () => {
    const alphabet = "123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ"
    let output = "";

    for (let i = 0; i < 8; i ++) {
        const index = Math.floor(Math.random() * (alphabet.length - 1)) + 1;
        output = output + alphabet[index];
    }
    return output;
}

const Poll = mongoose.model('Poll', pollSchema);
module.exports = {
    Poll
};