const { Client, MessageMedia, Buttons } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
// const mongoose = require('mongoose');
const path = require('path');
const categories = require('./Questions/categories.json')[0]

// const db = new class {
//     constructor() {
        
//     }

//     async connectToMongo(database) {
//         const url = `mongodb://localhost:27017/${database}`;
    
//         try {
//             await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
//             console.log('Connected to MongoDB successfully');
//             return true;
//         } catch (err) {
//             console.error('MongoDB connection error:', err);
//             return false;
//         }
//     }

//     async search(query, collection, m) {
//         var schema = new mongoose.Schema({
//                 userId: String,
//                 name: String,
//                 age: Number,
//                 email: String,
//                 contact: Number
//             }),
//             searchCollection = mongoose.model(collection, schema),
//             method = m in ["find", "findOne", "findById"] ? m : "find",
//             result = await searchCollection[method](query)
//         return result
//     }
// }

const h = {
    bind: (r, e) => {
        var s = e.length;
        for (let t = 0; t < s; t++)
            r[e[t]] = r[e[t]].bind(r)
    },
    options: (q, o, m) => {
        var options = Array.from({ length: o.length }, (v, i) => {
            return `${i+1}. ${o[i]}`
        }).join('\n'),
        temp = `Which questions would you like to answer?\n Provide Option no. separated by comma eg: 1, 2, 3`
        q = q + "\n" + options + "\n" + (m ?  temp : `Provide Option no. [1-${o.length}]`)
        return q
    },
    getOption: (r, i) => {
        var input = i.split(',').map(option => option.trim()),
            uOptions = [...new Set(input.map(Number))].filter(option => option > 0 && option <= r.length)
            return  (uOptions.length > 0 ? r[uOptions[0]-1] : false)
    },
    checkOptions: (i, o) => {
        var max = o,
            input = i.split(',').map(option => option.trim()),
            uOptions = [...new Set(input.map(Number))].filter(option => option > 0 && option <= max)
        return uOptions
    }
}

class cyberBot {
    constructor() {
        this.client = new Client()
        this.client.initialize()
        h.bind(this, ['generateQR', 'receiveMessage', 'sendMessage', 'storeMessages'])
        this.generateQR()
    }

    generateQR() {
        this.client.on('qr', qr => {
            qrcode.generate(qr, {small: true});
            console.log('Scan the above qr with Chatbot\'s Whatsapp account')
        });
        this.client.on('ready', async () => {

            // var connected = await db.connectToMongo()
            var connected = !0

            if (connected) {
                console.log('Chatbot is live!')
            }
        });
    }

    receiveMessage(t, s) {
        return new Promise((resolve) => {
            this.client.once('message', async (message) => {
                var sender = message.from.split('@')[0],
                    user = s || null
    
                // this.user = db.search({
                //     contact: sender
                // }, 'user_ref', 'findOne')
    
                // this.storeMessages(sender, message)
                
                resolve({
                    message: message,
                    sender: message.from,
                    body: message.body.toLowerCase(),
                    user: user || null
                })
            })
        })
        
    }

    async sendMessage(sender, message) {
        try {
            // this.storeMessages('chatbot', message)
            await this.client.sendMessage(sender, message);
            
        } catch (err) {
            console.error('Error sending the message. \nError: ', err)
        }
    }

    storeMessages(msg) {

    }
}

class Flow {
    constructor() {
        this.bot = new cyberBot
        this.flow = ["greet", "categories", "essential", "related", "options"]
        this.greet()
    }

    async greet() {
        let res = await this.bot.receiveMessage(),
            reply;
        if ("hello" === res.body) {

            if (res.user) {
                reply = `Hello ${res.user}! How can I help you today?`
                await this.bot.sendMessage(res.sender, reply)
                this.categories(res.sender)
            } else if (null == res.user) {
                reply = `Hi, \nBefore we get started, we\'d like to gather a few details to better assist you.\nCould you please provide the following information?`
                await this.bot.sendMessage(res.sender, reply)
                this.starters(res)
            }

        } else {
            reply = "Type 'Hello' to start the conversation."
            await this.bot.sendMessage(res.sender, reply)
            this.greet()
        }
    }

    async starters(res) {
        let questions = require("./Questions/starters.json"),
            response,
            sender = res.sender,
            user = {}
            

        for (var c = 0; c<questions.length; c++) {
            let question = questions[c].q,
                opt = questions[c].opt,
                oflag = !1;

            if (!opt || opt.length === 0) {
                question = question
            } else {
                oflag = !0
                question = h.options(question, opt)
            }

            this.bot.sendMessage(sender, question)
            response = await this.bot.receiveMessage()
            response = response.body
            oflag && (response = h.getOption(opt, response))

            if (question.includes("E-mail")) {
                
                var email = response.toLowerCase(),
                    regex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g,
                    format = email.match(regex),
                    attempts = 0;

                while (!format) {
                    if (attempts>3) {
                        await this.bot.sendMessage(sender, 'Failed to validate email.')
                        this.greet()
                        return
                    }
                    format = email.match(regex)
                    var message = "Please provide valid email"
                    await this.bot.sendMessage(sender, message)
                    response = await this.bot.receiveMessage()
                    email = response.body.toLowerCase()
                    attempts++
                }

                let verification = await this.verifyEmail(email, sender)
                if (verification) {
                    user[questions[c].id] = email
                    // db.createUser(user)
                    console.log(user)
                    this.categories(sender)
                }
            } else {
                user[questions[c].id] = response
            }
        }
    }

    async categories(sender) {
        var eQuestions = require("./Questions/essentials.json"),
            category = h.options(categories.q, categories.opt)
        await this.bot.sendMessage(sender, category)
        var response = await this.bot.receiveMessage(),
            sender = response.sender
        response = h.getOption(categories.opt, response.body)
        
        for (var c=0; c<eQuestions.length; c++) {
            var q = eQuestions[c].q,
                opt = eQuestions[c].opt,
                oflag = !1
            
            if (0 < opt.length) {
                oflag = !0
                q = h.options(q, opt)
            }
            await this.bot.sendMessage(sender, q)
            var response = await this.bot.receiveMessage()
            // ---
        }
    }

    async verifyEmail(email, sender) {
        const nodemailer = require('nodemailer'),
            otpGen = require('otp-generator');
        
        let otp = otpGen.generate(6, { upperCaseAlphabets: false, specialChars: false }),
            transporter = nodemailer.createTransport({
                service: 'gmail', // e.g., Gmail
                auth: {
                    user: 'johnwickxh@gmail.com', // Your email
                    pass: 'syky zwhr arud hpnt' // Your email password or app-specific password
                }
            })
        
        let mailOptions = {
            from: '"CyberBot noreply" <your-email@gmail.com>', // sender address
            to: email, // receiver's email
            subject: 'Email Verification - OTP', // Subject
            text: `Your OTP for verification is: ${otp}`, // Plain text body
            html: `<h5>Your OTP for verification is: <b>${otp}</b></h5>` // HTML body
        };

        try {
            let info = await transporter.sendMail(mailOptions);
            await this.bot.sendMessage(sender, "OTP sent on given Email address.\nPlease Enter to proceed.")
            let res = await this.bot.receiveMessage()
            if (res.body == otp) {
                await this.bot.sendMessage(sender, "Email verified successfully.")
                return true
            } else {
                var attempts = 0
                await this.bot.sendMessage(sender, "Invalid OTP. Please Try again.")
                return false
                // while (res != otp) {
                //     if (attempts > 2) {
                //         return false
                //     }
                //     
                //     otp = otpGen.generate(6, { upperCaseAlphabets: false, specialChars: false })
                //     info = await transporter.sendMail(mailOptions);
                //     await this.bot.sendMessage(sender, "New OTP sent")
                //     let res = await this.bot.receiveMessage()
                // }
            }

        } catch (error) {
            console.error('Error sending email:', error);
        }

    }
}

new class {
    constructor() {
        new Flow
    }
}