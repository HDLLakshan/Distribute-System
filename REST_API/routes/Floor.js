const router = require('express').Router();
let Floor = require('../model/Floor.model');
const axios = require('axios');
const nodemailer = require("nodemailer");
const dotenv = require('dotenv');
const Twilio = require('twilio');

const config = dotenv.config().parsed;
const client = new Twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);


router.route('/all').get((req, res) => {
    Floor.find()
        .then(Floors => res.json(Floors))
        .catch(err => res.status(400).json('Error: ' + err));
});

router.route('/addFloor').post(async (req, res) => {
    const data = await axios.get(`http://localhost:5000/getFloorCount`).then((response) => {
        console.log(response.data.count);
        const FloorNo = response.data.count + 1;
        const Rooms = [];
        const newFloor = new Floor({FloorNo, Rooms});

        newFloor.save().then(() => res.json('Floor added')).catch(err => res.status(400).json('Error' + err));
    });
});

router.route('/addRoom/:no').post(async (req, res) => {
    const data = await axios.get(`http://localhost:5000/getRoomsCount/${req.params.no}`).then((response) => {
        Floor.update({FloorNo: req.params.no}, {
            $push: {
                Rooms: {
                    "RoomNo": response.data.count + 1,
                    "Active": true,
                    "SmokeLevel": 0,
                    "CO2Level": 0
                }
            }
        }).then(() => res.json('Done'));
    });
});

router.route('/getRoomsCount/:no').get((req, res) => {
    Floor.findOne({FloorNo: req.params.no})
        .then(Floor => {
            res.send({count: Floor.Rooms.length})
        });
});

router.route('/getFloorCount').get((req, res) => {
    Floor.find()
        .then(Floors => res.send({count: Floors.length}))
        .catch(err => res.status(400).json('Error: ' + err));
})

router.route('/update').post((req, res) => {
    Floor.findOneAndUpdate(
        {FloorNo: req.body.FloorNo, "Rooms.RoomNo": req.body.RoomNo},
        {
            $set: {
                "Rooms.$.CO2Level": req.body.co2L,
                "Rooms.$.SmokeLevel": req.body.smL
            }
        },
        {new: true})
        .then(() => {
            res.sendStatus(200);
        })
        .catch(err => {
            console.error(err);
        });
});

router.route('/Off/:FloorNo/:RoomNo').post((req, res) => {

    Floor.findOneAndUpdate(
        {FloorNo:parseInt( req.params.FloorNo), "Rooms.RoomNo": parseInt(req.params.RoomNo)},
        {
            $set: {
                "Rooms.$.Active": false
            }
        },
        {new: true})
        .then(() => {
            res.sendStatus(200);
        })
        .catch(err => {
            console.error(err);
        });
});

router.route('/On/:FloorNo/:RoomNo').post((req, res) => {
    Floor.findOneAndUpdate(
        {FloorNo:parseInt( req.params.FloorNo), "Rooms.RoomNo": parseInt(req.params.RoomNo)},
        {
            $set: {
                "Rooms.$.Active": true
            }
        },
        {new: true})
        .then(() => {
            res.sendStatus(200);
        })
        .catch(err => {
            console.error(err);
        });
});

router.route('/MaxRoomCount').get((req, res) => {
    Floor.find()
        .then(Floors => {
            let maximumRoom = 0;
            Floors.map(floor => {
                if (floor.Rooms.length > maximumRoom) {
                    maximumRoom = floor.Rooms.length
                }
            });
            res.send({maximumRoom: maximumRoom})
        })
        .catch(err => res.status(400).json('Error: ' + err));
});

router.route('/MailSender').get(async (req,res)=>{
    try {
        const res = await axios.get('http://localhost:5000/all');
        let floors = res.data;
        let listOfRooms = ``;

        floors.map((floor, i) => {
            listOfRooms += `Floor No:  ${i + 1}`;
            floor.Rooms.map((room, i) => {
                if (room.Active) {
                    if (room.SmokeLevel > 5 || room.CO2Level > 5)
                        listOfRooms += `\nroom No: ${i + 1} `
                    if (room.SmokeLevel > 5) {
                        listOfRooms += `#Smoke Level- warning\t`
                    }
                    if (room.CO2Level > 5) {
                        listOfRooms += `#CO2 Level- warning `
                    }
                }
            })
            listOfRooms += "\n-------------------------------------\n"
        })
        MailSender(listOfRooms);
    } catch (err) {
        console.error(err);
    }
    res.sendStatus(200);
});

router.route('/SMS-Sender').get(async (req,res)=>{
    try {
        const res1 = await axios.get('http://localhost:5000/all');
        let floors = res1.data;
        let listOfRooms = ``;

        floors.map((floor, i) => {
            listOfRooms += `Floor No:  ${i + 1}`;
            floor.Rooms.map((room, i) => {
                if (room.Active) {
                    if (room.SmokeLevel > 5 || room.CO2Level > 5)
                        listOfRooms += `\nroom No: ${i + 1} `
                    if (room.SmokeLevel > 5) {
                        listOfRooms += `#Smoke Level- warning\t`
                    }
                    if (room.CO2Level > 5) {
                        listOfRooms += `#CO2 Level- warning `
                    }
                }
            })
            listOfRooms += "\n-------------------------------------\n"
        })
        sendSms(listOfRooms,() => {
            console.log("successfully send this message \n " + listOfRooms);
        })
    } catch (err) {
        console.error(err);
    }
    res.sendStatus(200);
});

function MailSender(text) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'hanger24x7@gmail.com',
            pass: '1qaz2wsx@'
        }
    });

    var mailOptions = {
        from: 'hanger24x7@gmail.com',
        //change email address to test it
        to: 'lahirulakshan780@gmail.com',
        subject: 'Details From Sensors',
        text: text
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

 function sendSms(bodyMessage, done){

    let message = {
        to: config.TO_PHONE_NUMBER,
        from: config.FROM_PHONE_NUMBER,
        body: bodyMessage
    };

    client.messages.create(message, (err, message) => {
        if (err) return done(err);

        return done(null, message);
    });

}
module.exports = router;