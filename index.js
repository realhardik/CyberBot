const { Client, MessageMedia, Buttons } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
// const mongoose = require('mongoose');
const path = require('path');
const categories = require('./Questions/categories.json')

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
                //     contact: this.senderNumber
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
        this.categories = categories[0].opt
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
                this.categories()
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
                opt = questions[c].opt;

            if (!opt || opt.length === 0) {
                question = question
            } else {
                var options = Array.from({ length: opt.length }, (v, i) => {
                    return `${i+1}. ${opt[i]}`
                }).join('\n')
                question = question + '\n' + options
            }

            this.bot.sendMessage(sender, question)
            response = await this.bot.receiveMessage()

            if (question.includes("E-mail")) {
                
                var email = res.body.toLowerCase(),
                    regex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|.(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
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
                    response = await this.bot.receiveMessage('verify')
                    email = response.body.toLowerCase()
                    attempts++
                }

                let verification = await this.verifyEmail(email, sender)
                if (verification) {
                    user[questions[c].id] = email
                    // db.createUser(user)
                    console.log(user)
                    this.categories()
                }
            } else {
                user[questions[c].id] = response.body
            }
        }
    }

    categories() {
        
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