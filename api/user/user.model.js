const { mongoose } = require('../../db/connection');
const { getGlobalSettings } = require('../../utility/utility');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const bcrypt = require('bcryptjs');
const moment = require('moment');

const UserSchema = new mongoose.Schema({
    username: {
        unique: true,
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^[a-zA-Z0-9]+$/.test(v);
            },
            minlength: 5,
            message: '{VALUE} is not a valid username',
        },
    },
    email: {
        unique: true,
        type: String,
        required: true,
        validate: {
            validator: validator.isEmail,
            message: '{VALUE} is not a valid email',
        },
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    tokens: [{
        access: {
            type: String,
            required: true
        },
        token: {
            type: String,
            required: true
        },
        lastUse: { type: Date },
        remember: { type: Boolean, default: false }
    }],
    country: String,
    verified: { type: Boolean, default: false },
    verificationToken: String,
    passwordResetToken: String,
    subscription: {
        expires: {
            type: Date
        }
    },
    readonly: Boolean
},{
    timestamps: true
});

UserSchema.methods.toJSON = function () {
    let user = this;
    let userObject = user.toObject();

    return {
        email: userObject.email,
        username: userObject.username,
        country: userObject.country,
        _id: userObject._id,
        subscription: userObject.subscription,
        readonly: userObject.readonly
    };
};

UserSchema.methods.generateAuthToken = function (remember = false) {
    const user = this;
    const access = 'auth';
    const token = jwt.sign({ _id: user._id.toHexString(), access }, process.env.JWT_SECRET).toString();
    user.tokens.push({ access, token, lastUse: Date.now(), remember });
    return user.save().then(() => token);
};

UserSchema.methods.generateToken = function (access, key, expiresIn = '365d') {
    const user = this;
    const token = jwt.sign({ _id: user._id.toHexString(), access }, process.env.JWT_SECRET, { expiresIn }).toString();
    user[key] = token;
    return user.save().then(() => token);
};

UserSchema.statics.findByToken = function (token) {
    let User = this;
    let decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    }
    catch (e) {
        return Promise.reject();
    }

    return User.findOne({
        '_id': decoded._id,
        'tokens.token': token,
        'tokens.access': 'auth',
    });
};

UserSchema.statics.findByCredentials = function (email, password) {
    let User = this;
    return User.findOne({ email }).then((user) => {
        if (!user) {
            return Promise.reject({ notFound: 1 });
        }
        return new Promise((resolve, reject) => {   //we're defining a new promise here since bcrypt doesn't support promises
            bcrypt.compare(password, user.password, (err, res) => {
                if (res) {
                    resolve(user);
                }
                else {
                    reject({ notFound: 1 });
                }
            });
        });
    });
};

UserSchema.pre('save', function (next) {   //mongoose middleware, this is going to run before save is called
    let user = this;
    if (user.isModified('password')) {    //checking to see if password is already hashed
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(user.password, salt, (err, hash) => {
                user.password = hash;
                next();
            });
        });
    } else {
        next();
    }
});

UserSchema.pre('save', async function (next) {
    let user = this;
    if (!user.subscription.expires) {
        const globalSettings = await getGlobalSettings();
        const date = moment(globalSettings.newUserSubscriptionExpDate || null);
        user.subscription.expires = date.isValid() ? date : moment().add(globalSettings.newUserSubscriptionPeriod, 'days');
        next();
    } else {
        next();
    }
});

UserSchema.methods.removeToken = function (token) {
    const user = this;
    return user.updateOne({
      // pull operator lets us pull out a wanted object
      $pull: {
        // pull from token array the token object with the same properties as the token passed
        // into the method
        tokens: {
          // whole token object is remove
          token,
        },
      },
    });
  };

UserSchema.methods.cleanupOldTokens = async function() {
    try {
        const user = this;
        await user.updateOne({
            $pull: {
                tokens: {
                    lastUse: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
                },
            },
        }).exec();
        return true;
    } catch (error) {
        console.log('Error performing token cleanup', error);
        return Promise.reject();
    }
};

const User = mongoose.model('User', UserSchema);
module.exports = { User };