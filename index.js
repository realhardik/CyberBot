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
        this.client = new Client();
        this.client.initialize()
        this.categories = categories[0].opt
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
                this.receiveMessage()
            }
        });
    }

    receiveMessage(d) {
        return new Promise((resolve) => {
            this.client.once('message', async (message) => {
                var sender = message.from.split('@')[0],
                    user = null
    
                // this.user = db.search({
                //     contact: this.senderNumber
                // }, 'user_ref', 'findOne')
    
                // this.storeMessages(message, sender)
                console.log(sender)
                if (d)
                    return
                
                if (message in this.categories) {
                    this.sendMessage(message, message.from)
                } else if (null == user) {
                    var reply = `Hi, \nBefore we get started, we\'d like to gather a few details to better assist you.\nCould you please provide the following information?`
                    await this.client.sendMessage(message.from, reply)
                    this.sendMessage('starters', message.from)
                } else {
                    var reply = `Hello ${user}! How can I help you today?`
                    await this.client.sendMessage(message.from, reply)
                    this.sendMessage('categories', message.from)
                }
                resolve(message.body)
            })
        })
        
    }

    async sendMessage(type, sender) {
        const qPath = path.join(__dirname, 'Questions', `${type}.json`)
        try {
            const questions = require(qPath)
            console.log(questions)

            for (var c = 0; c<questions.length; c++) {
                var question = questions[c].q,
                    opt = questions[c].opt
                console.log(question)
                console.log(opt)

                if (!opt || opt.length === 0) {
                    var message = question
                } else {
                    var buttons = Array.from({ length: opt.length }, (v, i) => {
                        return { body: opt[i] };
                    })
                    console.log(buttons)
                    var message = new Buttons(question, buttons, 'title', 'footer');
                    console.log(message)
                }

                await this.client.sendMessage(sender, message);

                if (question.includes("E-mail for verification")) {
                    await this.receiveMessage('verify')
                } else {
                    await this.receiveMessage('data')
                }
            }
        } catch (err) {
            console.error('Error with the chatbot. \nError: ', err)
        }
    }

    storeMessages(msg) {

    }
}

new class {
    constructor() {
        new cyberBot
    }
}