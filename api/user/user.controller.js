var { User } = require('./user.model');
const bcrypt = require('bcryptjs');

const signUp = async (req, res) => {
    try {
        const newUser = new User({
            email: req.body.email,
            password: req.body.password,
        });

        const user = await newUser.save();
        const token = await user.generateAuthToken();
        res.header('x-auth', token).send(user);
    }

    catch (error) {
        console.log(error);
        res.status(400).send({
            alreadyExists: error.alreadyExists || 0,
            success: 0
        });
    }
}


const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        bcrypt.compare(oldPassword, req.user.password, async (err, result) => {
            if (result && !err) {
                req.user.password = newPassword;
                await req.user.save();
                return res.status(200).send({ success: 1 });
            } else if (!err) {
                return res.status(400).send({ success: 0, incorrectPassword: true });
            } else {
                throw err;
            }
        });
    } catch (error) {
        console.log(`An error occurred changing the password against ${req.user._id}`, error);
        res.status(400).send({ success: 0 });
    }
}

const login = async (req, res) => {
    try {
        const { email, password, remember } = req.body;
        const user = await User.findByCredentials(email, password);
        const token = await user.generateAuthToken(remember);
        res.header('x-auth', token).send(user);
    } catch (error) {
        console.log(error);
        res.status(400).send({ success: 0, notFound: error.notFound || 0 });
    }
}

const logout = async ({ user, token }, res) => {
    try {
        await user.removeToken(token);
        res.json({
            success: 1
        });
    } catch (error) {
        console.log('An error occurred logging out the user', error);
    }
}

module.exports = {
    login, signUp, logout, changePassword
}