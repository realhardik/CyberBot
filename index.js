const { Client, MessageMedia, Buttons, Location } = require('whatsapp-web.js');
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
    options: (q, o) => {
        var options = Array.from({ length: o.length }, (v, i) => {
            return `${i+1}. ${o[i]}`
        }).join('\n')
        q = q + "\n" + options + "\n" + `Provide Option no. [1-${o.length}]`
        return q
    },
    getOption: async (options, bot, sender, expected) => {
        let res = await bot.receiveMessage()
        console.log(Boolean(expected))
        if (!expected) {
            res = await h.verify(options, res.body)

            while (!res) {
                await bot.sendMessage(sender, "Please enter a valid numeric option.")
                res = await bot.receiveMessage()
                res = await h.verify(options, res.body)
            }
        } else if (expected) {
            res = expected(res.body)?.trim()?.toLowerCase()
            while (res.length<2 || !res) {
                await bot.sendMessage(sender, "Please enter a valid answer.")
                res = await bot.receiveMessage()
                res = expected(res.body).toLowerCase()
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
    checkOptions: (i, o) => {
        var max = o,
            input = i.split(',').map(option => (parseInt(option.trim()) - 1)),
            uOptions = [...new Set(input.map(Number))].filter(option => option >= 0 && option < max)
        return uOptions
    },
    multipleOptions: (q) => {
        var starter = "From what we\'ve seen, here are some common questions that might be helpful. \nFeel free to pick the ones you\'d like to answer.",
            options = Array.from({ length: q.length }, (v, i) => {
                return `${i+1}. ${q[i].q}`
            }).join('\n'),
            end = `Provide Option no(s). separated by comma [1-${q.length}]\neg: 1, 2, 3`,
            question = starter + "\n" + options + "\n" + end
        return question
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
                this.essentials(res.sender)
            } else if (null == res.user) {
                reply = `Hi, \nBefore we get started, we\'d like to gather a few details to better assist you.\nCould you please provide the following information?`
                await this.bot.sendMessage(res.sender, reply)
                this.starters(res.sender)
            }

        } else {
            reply = "Type 'Hello' to start the conversation."
            await this.bot.sendMessage(res.sender, reply)
            this.greet()
        }
    }

    async starters(contact) {
        let questions = require("./Questions/starters.json"),
            response,
            user = {
                contact: contact
            }
            

        for (var c = 0; c<questions.length; c++) {
            let question = questions[c].q,
                opt = questions[c].opt,
                oflag = !1;

            if (opt.length > 0) {
                oflag = !0
                question = h.options(question, opt)
            }

            this.bot.sendMessage(user.contact, question)
            response = await h.getOption(opt, this.bot, user.contact, (oflag ? null : String))
            
            if (question.includes("E-mail")) {
                var email = response.toLowerCase(),
                    regex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/g,
                    format = email.match(regex),
                    attempts = 0;

                while (!format) {
                    if (attempts>3) {
                        await this.bot.sendMessage(user.contact, 'Failed to validate email.')
                        this.greet()
                        return
                    }
                    var message = "Please provide valid email"
                    await this.bot.sendMessage(user.contact, message)
                    response = await this.bot.receiveMessage()
                    email = response.body.toLowerCase()
                    format = email.match(regex)
                    attempts++
                }

                let verification = await this.verifyEmail(email, user.contact)
                if (verification) {
                    user[questions[c].id] = email
                    // db.createUser(user)
                    console.log(user)
                    this.essentials(user.contact)
                    return
                } else {
                    this.greet()
                    return
                }
            } else if (question.includes("age")) {
                console.log(response)
                response = Number(response)
                console.log(response)
                var attempts = 0
                if (response) {
                    while (response > 99 && response < 15) {
                        if (attempts > 3) {
                            this.greet()
                            return false
                        }
                        if (response<15) {
                            await this.bot.sendMessage(user.contact, "Only 15+ age users are allowed to use this chatbot.")
                        } else if (response>99) {
                            await this.bot.sendMessage(user.contact, "Please provide a valid age.")
                        }
                        var i = await this.bot.receiveMessage()
                        response = Number(i.body)
                        attempts++
                    }
                } else {
                    await this.bot.sendMessage(user.contact, "Please provide a valid age.")
                    this.greet()
                }
            }
            user[questions[c].id] = response
        }
    }

    async essentials(sender) {
        var eQuestions = require("./Questions/essentials.json"),
            res = {}
        
        for (var c=0; c<eQuestions.length; c++) {
            var q = eQuestions[c].q,
                opt = eQuestions[c].opt,
                oflag = !1
            
            if (0 < opt.length) {
                oflag = !0
                q = h.options(q, opt)
            }
            await this.bot.sendMessage(sender, q)
            var response = await h.getOption(opt, this.bot, sender, (oflag ? null : String))
            res[eQuestions[c].id] = response
        }
        console.log(res)
        this.categories(sender, res.category)
    }

    async categories(sender, category) {
        let qPath = path.join(__dirname, "Questions", `${category}.json`),
            questions = require(qPath),
            question = h.multipleOptions(questions)
        console.log(questions)
        await this.bot.sendMessage(sender, question)
        let response = await this.bot.receiveMessage()
        var options = h.checkOptions(response.body, questions.length)
        console.log(options)
        for (var c = 0; c<options.length; c++) {
            question = questions[options[c]].q
            var opt = questions[options[c]].opt,
                oflag = !1

            if (opt.length>0) {
                oflag = !0
                question = h.options(question, opt)
            }

            await this.bot.sendMessage(sender, question)
            response = await h.getOption(opt, this.bot, sender, (oflag ? null : String))
        }
        this.options(sender)
    }

    async options(sender) {
        let question = h.options("We're almost done! Would you like: ", ["Mitigations tips", "Find Nearby Police Station"])
        await this.bot.sendMessage(sender, question)
        let response = await this.bot.receiveMessage()
        response = h.checkOptions(response.body, 2)
        console.log(response)
        if (response[0] == 1) {
            var msg = "Please provide your location using Whatsapp's location sharing"
            await this.bot.sendMessage(sender, msg)
            response = await this.bot.receiveMessage("l")
            var attempts = 0

            while (!response.message.location) {
                if (attempts > 3) {
                    await this.bot.sendMessage(sender, "Please try again later.")
                    this.greet()
                    return
                }
                var repeat = "Invalid message. Provide your location using Whatsapp's location sharing option."
                await this.bot.sendMessage(sender, repeat)
                response = await this.bot.receiveMessage()
                attempts++
            }
            var data = await this.getPoliceStation({
                    lat: response.message.location.latitude,
                    lon: response.message.location.longitude
                })
            console.log(data)
            data.forEach(async (loc) => {
                var location = new Location(loc.lat, loc.lon)
                console.log(location)
                await this.bot.sendMessage(sender, location)
            });
        }
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
                    // Process the location data
                    if (data.predictions && Array.isArray(data.predictions)) {
                        // Iterate through predictions and log place_id
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