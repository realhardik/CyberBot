const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mongoose = require('mongoose');
const path = require('path');

const db = new class {
    constructor() {

    }

    async connectToMongo(database) {
        const url = `mongodb://localhost:27017/${database}`;
    
        try {
            await mongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
            console.log('Connected to MongoDB successfully');
            return true;
        } catch (err) {
            console.error('MongoDB connection error:', err);
            return false;
        }
    }

    async search(query, collection, m) {
        var schema = new mongoose.Schema({
                userId: String,
                name: String,
                age: Number,
                email: String,
                contact: Number
            }),
            searchCollection = mongoose.model(collection, schema),
            method = m in ["find", "findOne", "findById"] ? m : "find",
            result = await searchCollection[method](query)
        return result
    }
}

class cyberBot {
    constructor() {
        this.client = new Client();
    }

    generateQR() {
        this.client.on('qr', qr => {
            qrcode.generate(qr, {small: true});
            console.log('Scan the above qr with Chatbot\'s Whatsapp account')
        });
        this.client.on('ready', async () => {

            var connected = await db.connectToMongo() || !0

            if (connected) {
                console.log('Chatbot is live!')
                this.handleIntro()
            }
        });
    }

    handleIntro() {
        this.client.on('message', async (message) => {
            senderNumber = message.from.split['@'][0]
            // this.user = db.search({
            //     contact: this.senderNumber
            // }, 'user_ref', 'findOne')

            // if (this.user) {
                //var reply = `Hello ${exists.name}! How can I help you today?`
                // await client.sendMessage(message.from, reply)
                // this.sendMessage('categories')
            // }
            var reply = `Hi, \nBefore we get started, we\'d like to gather a few details to better assist you.\n
            Could you please provide the following information?`
            // await client.sendMessage(message.from, reply)
            // this.sendMessage('starters', senderNumber)
        })
    }

    sendMessage(type, sender) {
        const qPath = path.join(__dirname, 'Questions', `${type}.json`)

        try {
            const questions = require(qPath)
            for (var c = 0; c<questions.length; c++) {
                var question = questions[c].q,
                    opt = 0 === question[c].opt
                if (opt) {
                    
                } else {

                }
            }
        } catch (err) {
            console.error('Error with the chatbot. \nError: ', err)
        }
    }

    storeMessages(msg) {

    }
}

client.on('message', async message => {
    console.log(message.body)
    if (msg.hasMedia) {
        const media = await msg.downloadMedia();
        // do something with the media data here
        console.log(media)  
    }
})

client.initialize();
