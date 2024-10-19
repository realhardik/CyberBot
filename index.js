const { Client, Location } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');
const path = require('path');
const { type } = require('os');
const { timeStamp } = require('console');
const { send } = require('process');
const categories = require('./Questions/categories.json')[0]

const h = {
    bind: (r, e) => {
        var s = e.length;
        for (let t = 0; t < s; t++)
            r[e[t]] = r[e[t]].bind(r)
    },
    options: (q, o) => {
        var options = Array.from({ length: o.length }, (v, i) => {
            return `${i+1}. ${o[i]}`
        }).join('\n')
        q = q + "\n" + options + "\n" + `Provide Option no. [1-${o.length}]`
        return q
    },
    getOption: async (options, bot, sender, expected) => {
        let res = await bot.receiveMessage(sender)
        
        if (!expected) {
            res = await h.verify(options, res.body)

            while (!res) {
                await bot.sendMessage(sender, "Please enter a valid numeric option.")
                res = await bot.receiveMessage(sender)
                res = await h.verify(options, res.body)
            }
        } else if (expected) {
            res = expected(res.body)?.trim()?.toLowerCase()
            while (res.length<2 || !res) {
                await bot.sendMessage(sender, "Please enter a valid answer.")
                res = await bot.receiveMessage(sender)
                res = expected(res.body)
            }
        }
        return res
    },
    verify: async (options, input) => {
        const inputArray = input.split(',')
                                .map(option => option.trim())
                                .filter(option => !isNaN(option))
        const validOptions = [...new Set(inputArray.map(Number))]
                            .filter(option => option > 0 && option <= options.length)
        return validOptions.length > 0 ? options[validOptions[0] - 1] : false
    },
    validate: (type, input) => {
        return ("email" === type ? (() => {
            input = input.toLowerCase()
            var regex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,7}$/g,
                test = regex.test(input)
            return test
        })() : "date" === type ? (() => {
            input = input.toLowerCase().split(",");
            const date = input[0]?.trim();
            const time = input[1]?.trim();
            const timeRegex = /^(\d{1,2})(:\d{2})?\s?(am|pm)?$/i;

            if (date && time) {
                const dateParts = date.split("/");

                if (dateParts.length !== 3)
                    return false; 

                const [d, m, y] = dateParts.map(Number);

                if (d && m && y) {
                    const daysInMonth = [31, (y % 4 === 0 ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

                    if (d > daysInMonth[m - 1] || d < 1 || m > 12 || m < 1 || y > 2024 || y < 2000) {
                        return false;
                    }

                    if (timeRegex.test(time)) {
                        let [hours, minutesWithPeriod] = time.includes(":") ? time.split(":") : [time.match(/^\d{1,2}/)[0], ''],
                            h = Number(hours),
                            minutes = minutesWithPeriod ? minutesWithPeriod.slice(0, 2) : '00',
                            period = time.match(/am|pm/i)?.[0]?.toUpperCase() || ''


                        if (h < 1 || h > 12 || Number(minutes) < 0 || Number(minutes) > 59) {
                            return false;
                        }

                        if (period && !['AM', 'PM'].includes(period)) {
                            return false;
                        }

                        return ({
                            date: `${d}/${m}/${y}`,
                            time: `${h}:${minutes} ${period}`
                        })
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            } else {
                return false;
            }
        })()
        : false)
    }
}

const db = new class {
    constructor() {
        this.database = "whatweb";
        this.url = "mongodb://localhost:27017";
        this.client = new MongoClient(this.url);
        this.init();
    }

    async init() {
        try {
            await this.client.connect();
            this.db = this.client.db(this.database);
            const mUrl = this.url + `/${this.database}`;
            await mongoose.connect(mUrl);
            this.createSchema();
            console.log('Connected to MongoDB successfully');
        } catch (err) {
            console.error('MongoDB connection error:', err);
        }
    }

    createSchema() {
        const userSchema = new mongoose.Schema({
            created_at: { type: Date, default: Date.now },
            name: { type: String, required: true },
            age: { type: Number, required: true },
            gender: { type: String, required: true, enum: ["Male", "Female", "Other"] },
            email: { type: String, required: true, unique: true },
            contact: { type: String, required: true, unique: true },
            premium_user: { type: Boolean, default: false }
        });

        const feedbackSchema = new mongoose.Schema({
            timestamp: { type: Date, default: Date.now },
            contact: { type: String, required: true },
            rating: { type: Number, required: true },
            review: { type: String }
        });

        const sessionSchema = new mongoose.Schema({
            sessionId: { type: Number, unique: true, required: true },
            contact: { type: String, required: true },
            startTimestamp: { type: Date, default: Date.now },
            incidentType: { type: String, required: true },
            status: { type: String, enum: ['Active', 'Completed'], default: 'Active' }
        });

        const counterSchema = new mongoose.Schema({
            _id: { type: String, required: true },
            sequence_value: { type: Number, default: 0 }
        });

        const historySchema = new mongoose.Schema({
            timestamp: { type: Date, default: Date.now },
            contact: { type: String, required: true },
            sessionId: { type: Number, required: true },
            author: { type: String, enum: ['Chatbot', 'Client'], required: true },
            message: { type: String, required: true }
        });

        this.userRef = mongoose.model('userRef', userSchema);
        this.feedback = mongoose.model('feedback', feedbackSchema);
        this.sessions = mongoose.model('sessions', sessionSchema);
        this.counter = mongoose.model('Counter', counterSchema);
        this.history = mongoose.model('conversation_history', historySchema);
    }

    async addUser(data) {
        try {
            const newUser = new this.userRef(data);
            await newUser.save();
            console.log("User created successfully");
            return newUser;
        } catch (err) {
            console.error("Error creating user: ", err);
            return false;
        }
    }

    async getNextSessionId() {
        try {
            const counter = await this.counter.findOneAndUpdate(
                { _id: 'sessionId' },
                { $inc: { sequence_value: 1 } },
                { new: true, upsert: true }
            );
            return counter.sequence_value;
        } catch (err) {
            console.error("Error getting next session ID: ", err);
            return false;
        }
    }

    async search(query, collection, m) {
        try {
            const method = m ? ["find", "findOne"].includes(m) ? m : "find" : "find";
            let result;
            if (method === "find") {
                var cursor = this.db.collection(collection)
                    .find(query)
                    .sort({ timestamp: -1 });
                result = await cursor.toArray();
            } else if (method === "findOne") {
                result = this.db.collection(collection)
                    .findOne(query, { sort: { timestamp: -1 } });
            }
            // result = method === "find" ? await cursor.toArray() : cursor;
            if ((method === "find" && result.length === 0) || (method === "findOne" && !result)) {
                return false;
            }
            return result
            // return ((method === "find" && result.length === 0) || (method === "findOne" && !result) ? false : result);
        } catch (err) {
            console.error("Error searching: ", err);
            return false;
        }
    }

    async addFeedback(contact, feedbackData) {
        try {
            const feedback = new this.feedback({
                timestamp: new Date(),
                contact: contact,
                ...feedbackData
            });
            await feedback.save();
            console.log("Feedback added successfully");
        } catch (err) {
            console.error("Error adding feedback: ", err.message);
        }
    }

    async addSession(contact, sessionData) {
        try {
            const id = await this.getNextSessionId();
            if (id === false) {
                throw new Error("Failed to get next session ID");
            }
            const newSession = new this.sessions({
                contact: contact,
                sessionId: id,
                ...sessionData
            });
            await newSession.save();
            console.log("Session added successfully");
        } catch (err) {
            console.error("Error adding session: ", err.message);
        }
    }

    async updateUser(contact, collection, updatedData) {
        try {
            const updatedUser = await this.db.collection(collection).findOneAndUpdate(
                { contact: contact },
                { $set: updatedData },
                { new: true, runValidators: true }
            );
            if (!updatedUser.value) {
                console.log("User not found.");
                return false;
            }
            console.log("User updated successfully:", updatedUser.value);
            return updatedUser.value;
        } catch (err) {
            console.error("Error updating user: ", err.message);
            return false;
        }
    }

    async addConversation(contact, author, conversation) {
        try {

            const msg = new this.history({
                contact: contact,
                sessionId: 1,
                author: author,
                message: conversation
            })
            await msg.save();
            console.log("Message saved");
        } catch (err) {
            console.error("Error updating user: ", err.message);
            return false;
        }
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
                this.init()
            }
        });
    }
    
    init() {
        this.client.on('message', async (message) => {
            if (message.from.includes('@g.us')) {
                return
            }

            var sender = message.from,
                exists = await db.search({
                    contact: sender
                }, 'userRef', 'findOne')
            console.log(exists)
            
            if (!exists) {
                new Flow({
                    sender: sender,
                    user: exists,
                    body: message.body.toLowerCase()
                }, this)
            } else {
                const latestSession = await db.search(
                    { contact: sender, status: 'Active' }, 
                    'sessions', 
                    'findOne'
                );
                if (latestSession) {
                    console.log("Active session found:", latestSession);
                    // If an active session is found, do nothing
                    return;
                }
                new Flow({
                    sender: sender,
                    user: exists.name,
                    body: message.body.toLowerCase()
                }, this)
            }
        })
    }

    receiveMessage(s) {
        return new Promise((resolve) => {
            this.client.once('message', async (message) => {
                if (message.from.includes('@g.us') || message.from !== s) {
                    this.receiveMessage(s)
                    return
                }
                
                this.storeMessages(message.from, "Client", message.body.toLowerCase())
                
                resolve({
                    message: message,
                    sender: message.from,
                    body: message.body.toLowerCase(),
                    user: "User",
                    name: "User"
                })
            })
        })
        
    }

    async sendMessage(sender, message) {
        try {
            this.storeMessages(sender, 'Chatbot', message)
            await this.client.sendMessage(sender, message);
            
        } catch (err) {
            console.error('Error sending the message. \nError: ', err)
        }
    }

    storeMessages(contact, author, msg) {
        try {
            db.addConversation(contact, author, msg)
        } catch (err) {
            console.error('Error storing the message. \nError: ', err)
        }
        
    }
}

class Services {
    constructor() {
        this.prompts = require(path.join(__dirname, "Questions", "prompts.json"))
        h.bind(this, ['createPrompt', 'getResponse'])
        this.prompt = false
    }

    async createPrompt(incident, questions) {
        let user = this.prompts["user"],
            template = "",
            varChar = "$",
            placeholders = ["name", "age", "type", "date", "time", "device", "financial_loss", "desc", "actions"],
            keys = Object.keys(incident.related),
            questionsMap = {}
        questions.forEach(question => {
            questionsMap[question.id] = question;
        });

        for (var c = 0; c<placeholders.length; c++) {
            var placeholderValue = incident[placeholders[c]];
            user = user.replaceAll(`${varChar}${placeholders[c]}`, placeholderValue || "undefined");
        }

        for (var c = 0; c<keys.length; c++) {
            var questionTemplate = questionsMap[keys[c]]?.template || "undefined";
            template += `\n${questionTemplate}`;
            template += incident.related[keys[c]] || "undefined";
        }

        this.prompt = user + template
    }

    async getResponse() {
        let start = this.prompts["intro"]["2"],
            rPrompt = this.prompt,
            prompt = start + rPrompt + this.prompts.end["1"],
            res = await this.fetchAI(prompt),
            thres = res.slice(0, 70).toLowerCase()
            if (thres.includes("i can't") || thres.includes("i cannot")) {
                let attempts = 0,
                    re = 2,
                    lRes = ""
                while ((thres.includes("i can't") || thres.includes("i cannot")) && thres.length < 100) {
                    if (re > 3) {
                        return lRes
                    }
                    attempts++
                    console.log(`attempt ${re} for response _---------------------------------------------------------------------`)
                    prompt = this.prompts["intro"]["2"] + rPrompt + this.prompts["end"][(re+"")]
                    console.log(prompt)
                    res = await this.fetchAI(prompt)
                    lRes = (res.length > lRes.length) ? res : lRes
                    thres = res.slice(0, 70).toLowerCase()
                    re++
                }
            }
            return res
    }

    async fetchAI(prompt, re) {
        return (await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
              model: 'llama3.1',
              prompt: prompt || this.prompt,
              stream: false
            }) 
          })
          .then(response => response.json()) 
          .then(data => data.response)
        )
    }

    async getPoliceStation(loc) {
        var api = "https://api.olamaps.io",
            layers = "layers=venue",
            types = "types=police",
            location = `location=${loc.lat},${loc.lon}`,
            rad = "radius=6000",
            opt = "strictbounds=false&withCentroid=false",
            api_key = "api_key=4xd8VFPIZPc3OnFC4oJdlH2chdfC120zIrsRvE36",
            url = api + "/places/v1/nearbysearch?" + [layers, types, location, rad, opt, api_key].join("&"),
            nearbyID = [],
            data = fetch(url) 
                .then(response => response.json())
                .then(data => {
                    if (data.predictions && Array.isArray(data.predictions)) {
                        var pred = data.predictions,
                            fe = pred.length >= 2 ? 2 : pred.length
                        for (var c=0; c<fe; c++)
                            nearbyID.push(pred[c].place_id)
                        return nearbyID
                    } else {
                        console.log('No predictions found.');
                        return []
                    }
                })
                .then(places => {
                    var locPromises = places.map(pi => {
                        var placeId = encodeURIComponent(pi);
                        var detailUrl = api + "/places/v1/details?" + "place_id=" + placeId + "&" + api_key;
                        
                        // Return a promise for each place_id
                        return fetch(detailUrl)
                            .then(res => res.json())
                            .then(cd => ({
                                lat: cd.result.geometry.location.lat,
                                lon: cd.result.geometry.location.lng
                            }))
                            .catch(error => {
                                console.error(`Error fetching details for place_id ${pi}:`, error);
                                return null; // Return null for failed fetches
                            });
                    });
                    return Promise.all(locPromises)
                })
                .then(validLocations => {
                    console.log('Nearby locations:', validLocations);
                    return validLocations; // This returns the array of location objects containing lat and lon
                })
                .catch(error => {
                    console.error('Error fetching location data:', error);
                });
        return data
    }
}

class Flow {
    constructor(s, bot) {
        // this.bot = new cyberBot
        this.bot = bot
        this.services = new Services
        this.flow = ["greet", "categories", "essential", "related", "options"]
        this.greet(s)
    }

    async greet(m) {
        // let res = await this.bot.receiveMessage(),
        //     reply;
        let res = m,
        reply;
        if ("hello" === res.body) {
            if (res.user) {
                reply = `Hello ${res.name}! How can I help you today?`
                await this.bot.sendMessage(res.sender, reply)
                this.essentials(res.sender, !0)
            } else if (!res.user) {
                reply = `Hi, \nBefore we get started, we\'d like to gather a few details to better assist you.\nCould you please provide the following information?`
                await this.bot.sendMessage(res.sender, reply)
                // db.addSession(res.sender, {
                //     incidentType: "Starters"
                // })
                this.starters(res.sender)
            }

        } else {
            reply = "Type 'Hello' to start the conversation."
            await this.bot.sendMessage(res.sender, reply)
            res = await this.bot.receiveMessage(res.sender)
            this.greet({
                sender: res.sender,
                user: res.user,
                body: res
            })
        }
    }

    async starters(contact) {
        let questions = require("./Questions/starters.json"),
            response,
            sender = contact,
            user = {
                id: contact
            }

        for (var c = 0; c<questions.length; c++) {
            let question = questions[c].q,
                opt = questions[c].opt,
                oflag = !1;

            if (opt.length > 0) {
                oflag = !0
                question = h.options(question, opt)
            }

            await this.bot.sendMessage(sender, question)
            response = await h.getOption(opt, this.bot, sender, (oflag ? null : String))
            if (question.includes("E-mail")) {
                var email = response.toLowerCase(),
                    format = h.validate("email", email),
                    attempts = 0;

                while (!format) {
                    if (attempts>3) {
                        await this.bot.sendMessage(sender, 'Failed to validate email.')
                        return
                    }
                    var message = "Please provide valid email"
                    await this.bot.sendMessage(sender, message)
                    response = await this.bot.receiveMessage(sender)
                    email = response.body.toLowerCase()
                    format = h.validate("email", email)
                    attempts++
                }

                let verification = await this.verifyEmail(email, sender)
                if (verification) {
                    user[questions[c].id] = email
                    // db.addUser({
                    //     name: user.name,
                    //     age: user.age,
                    //     email: user.email,
                    //     contact: user.id,
                    //     premium_user: false
                    // })
                    await this.bot.sendMessage(sender, "Now, we will ask questions related to the cyberthreat.")
                    this.essentials(user)
                    return
                } else {
                    // this.greet()
                    return
                }
            } else if (question.includes("age")) {
                var attempts = 0
                response = Number(response)
                while (response > 99 || response < 15 || isNaN(response)) {
                    if (!isNaN(response)) {
                        if (attempts > 3) {
                            return false
                        }
                        if (response<15) {
                            await this.bot.sendMessage(sender, "Only 15+ age users are allowed to use this chatbot.")
                            return
                        } else if (response>99) {
                            await this.bot.sendMessage(sender, "Please provide a valid age.")
                        }
                    } else {
                        await this.bot.sendMessage(sender, "Please provide a numeric age.")
                    }

                    response = await this.bot.receiveMessage(sender)
                    response = Number(response.body)
                    attempts++
                }
            }
            user[questions[c].id] = response
        }
    }

    async essentials(user, prev) {
        var questions = require("./Questions/essentials.json")
        user = prev ? (user = {
            id: user
        }, user) : user
        user.event = {
            name: "abc",
            age: 17
        }
        let response,
            sender = user.id

        for (var c=0; c<questions.length; c++) {
            var question = questions[c].q,
                opt = questions[c].opt,
                oflag = !1
            
            if (0 < opt.length) {
                oflag = !0
                question = h.options(question, opt)
            }

            await this.bot.sendMessage(sender, question)
            response = await h.getOption(opt, this.bot, sender, (oflag ? null : String))

            if (question.includes("date")) {
                response = h.validate("date", response)
                while (!response) {
                    var msg = "Provide date & time in foll. format: DD/MM/YYYY, HH:MM (AM/PM)\n ex: 07/08/2024, 12:23 am or 08/12/2024, 11 am"
                    await this.bot.sendMessage(sender, msg)
                    response = await this.bot.receiveMessage(sender)
                    response = h.validate("date", response.body)
                }
                user.event["date"] = response.date
                user.event["time"] = response.time
                continue
            } else if (question.includes("financial")) {
                response = response.toLowerCase()
                user.event[questions[c].id] = response
                if ("yes" === response) {
                    await this.bot.sendMessage(sender, questions[c].follow_up)
                    response = await this.bot.receiveMessage(sender)
                    response = response.body
                    var format = /^[0-9]+$/g.test(response)
                    while (!format) {
                        await this.bot.sendMessage(sender, "Please provide entire amount ex. 2000, 10000")
                        response = await this.bot.receiveMessage(sender)
                        response = response.body
                        format = /^\d+$/g.test(response)
                    }
                    user.event["loss_amount"] = response
                    continue
                }
            }
            user.event[questions[c].id] = response
        }
        this.techSupport(user)
    }

    async techSupport(user_data) {
        var question = h.options("Would you like to talk to one of our Cyber Crime Specialists or continue with Cyberbot's assistance?", ["Cyber Crime Specialist", "Chatbot's Assistance"])
        await this.bot.sendMessage(user_data.id, question)
        let res = await h.getOption(["Yes", "No"], this.bot, user_data.id)
        if (res.toLowerCase() === "yes") {
            question = h.options("Here is our pricing for personal support. \nWhich option would you like to go with", ["a", "b", "Chatbot's assistance"])
            await this.bot.sendMessage(user_data.id, question)
            res = await h.getOption(["a", "b", "Back"], this.bot, user_data.id)
            if (res.toLowerCase() == "back") {
                this.categories(user_data)
                return
            }
            // this.greet()
            return
        }
        this.categories(user_data)
    }

    async categories(user_data) {
        let qPath = path.join(__dirname, "Questions", "types", `${user_data.event.type.replace(" ", "_")}.json`),
            questions = require(qPath),
            question,
            response,
            opt,
            sender = user_data.id
            user_data.event.related = {}

        await this.bot.sendMessage(sender, `${questions.length} questions will be provided. \nYou can skip any if already answered in description of event,\nbut providing as many answers as possible will help us offer the best\nsupport and assistance.`)
        for (var c = 0; c<questions.length; c++) {
            question = questions[c].q
            
            var qNo = questions.length - (c+1),
                qNoTemp = 1 === qNo ? "1 more question left" : 0 === qNo ? "Last question." : `\n${qNo} more questions left.`
                opt = ["Yes", "No", "Skip"]
            question = h.options(question, opt) + "\n" + qNoTemp

            await this.bot.sendMessage(sender, question)
            response = await h.getOption(opt, this.bot, sender)
            if (response.toLowerCase() === "skip") {
                continue
            } else if (response.toLowerCase() === "yes") {
                question = questions[c]["follow_up"]
                opt = questions[c]?.opt
                if (opt && opt.length > 0) {
                    question = h.options(question, questions[c].opt)
                }
                await this.bot.sendMessage(sender, question)
                response = await h.getOption(opt, this.bot, sender, (opt ? null : String))
            }
            
            user_data.event.related[questions[c].id] = response
        }
        this.services.createPrompt(user_data.event, questions)
        this.options(user_data)
    }

    async options(user_data) {
        let tipsPromise = this.services.getResponse()
        let question = h.options("We're almost done! Would you like: ", ["Mitigations tips", "Find Nearby Police Station"]),
            sender = user_data.id
        await this.bot.sendMessage(sender, question)
        let response = await h.getOption(["tips", "location"], this.bot, sender)
        if (response.toLowerCase() == "location") {
            var msg = "Please provide your location using Whatsapp's location sharing"
            await this.bot.sendMessage(sender, msg)
            response = await this.bot.receiveMessage(sender)
            var attempts = 0

            while (!response.message.location) {
                if (attempts > 3) {
                    await this.bot.sendMessage(sender, "Exiting. Please try again later.")
                    return
                }
                var repeat = "Invalid message. Provide your location using Whatsapp's location sharing option."
                await this.bot.sendMessage(sender, repeat)
                response = await this.bot.receiveMessage(sender)
                attempts++
            }
            var data = await this.services.getPoliceStation({
                    lat: response.message.location.latitude,
                    lon: response.message.location.longitude
                })
            if (0 === data.length) {
                await this.bot.sendMessage(sender, "Sorry. Can't find any nearby Police Stations.")
                return false
            }
            data.forEach(async (loc, i) => {
                var location = new Location(loc.lat, loc.lon)
                await this.bot.sendMessage(sender, `Location ${i+1}:`)
                await this.bot.sendMessage(sender, location)
            });
        } else {
            await this.bot.sendMessage(sender, "Please wait while we generate structured response tailored to this incident.");
            var attempts = 0,
                tips = false

            while (!tips && attempts < 8) {  
                tips = await tipsPromise;
                attempts++;
                if (!tips) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (tips) {
                await this.bot.sendMessage(sender, tips); 
            } else {
                await this.bot.sendMessage(sender, "Sorry, we couldn't generate tips at the moment.");
            }
            await this.bot.sendMessage(sender, "Hope our services were useful.")
        }
        this.feedback(user_data)
    }

    async feedback(data) {
        let feedbackQs = h.options("Would you like to provice a feedback for this chatbot?", ["Yes", "No"]),
            response,
            sender = data.id
        await this.bot.sendMessage(sender, feedbackQs)
        response = await h.getOption(["yes", "no"], this.bot, data.id)
        if (response === "yes") {
            feedbackQs = h.options("Rating: (1-5)", ["★", "★★", "★★★", "★★★★", "★★★★★"])
            await this.bot.sendMessage(sender, feedbackQs)
            response = await h.getOption(["1", "2", "3", "4", "5"], this.bot, sender)
            feedbackQs = h.options("Could you please share a quick written review with any suggestions or thoughts you may have?", ["Yes", "No"])
            await this.bot.sendMessage(sender, feedbackQs)
            response = await h.getOption(["yes", "no"], this.bot, sender)
            if ("yes" === response) {
                await this.bot.sendMessage(sender, "You can provide your feedback now.")
                response = await this.bot.receiveMessage(sender)
                response = response.body
                await this.bot.sendMessage(sender, "Thanks for your feedback.")
            }
            // this.greet()
        }
    }

    async verifyEmail(email, sender) {
        const nodemailer = require('nodemailer'),
            otpGen = require('otp-generator');
        
        let otp = otpGen.generate(6, { upperCaseAlphabets: false, specialChars: false }),
            transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: 'johnwickxh@gmail.com', 
                    pass: 'syky zwhr arud hpnt'
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
            let res = await this.bot.receiveMessage(sender)
            if (res.body == otp) {
                await this.bot.sendMessage(sender, "Email verified successfully.")
                return true
            } else {
                var attempts = 0
                while (res != otp) {
                    if (attempts > 2) {
                        return false
                    }
                    await this.bot.sendMessage(sender, "Invalid OTP. Please Try again.")
                    res = await this.bot.receiveMessage(sender)
                    res = res.body
                }
                return true
            }
        } catch (error) {
            console.error('Error sending email:', error);
        }
    }
}

new class {
    constructor() {
        // new Flow
        new cyberBot
    }
}