var express = require("express");
var router = express.Router();

const credential = [
    {   username: "admin",
        name: "Administrator",
        password: "admin123",
        phoneNum: '+12094351482',
        accountSid: 'AC48434b6c6ce96ba17cb0bfa19e67a3ee',
        authToken: '374a1076e60f427891a680a2dec38184',
    },
    {   username: "dyaa",
        name: "Janine",
        password: "dyaa1218",
        phoneNum: '+639560221903'
    }
]

router.post('/login',(req, res)=>{
    const { username, password } = req.body;

    const user = credential.find(u => u.username === username && u.password === password);
    const email = user.name;

    if(user){
        req.session.user = req.body.username;
        req.session.userName = email;
        res.redirect('/route/dashboard');
    }else{
        res.end("Invalid login");
    }
});

router.get('/dashboard', (req,res) =>{
    if(req.session.user){
        res.render('dashboard', {username: req.session.userName})
    }else{
        res.send("Unauthorized User")
    }
})

router.get('/sendChat', (req,res) =>{
    res.render('sendChat', {username: req.session.userName})
})

router.get('/sendSMS', (req,res) =>{
    res.render('sendSMS', {username: req.session.userName})
})

router.get('/voiceCall', (req,res) =>{
    res.render('voiceCall', {username: req.session.userName})
})

router.get('/sendMail', (req,res) =>{
    res.render('sendMail', {username: req.session.userName})
})

module.exports = router;