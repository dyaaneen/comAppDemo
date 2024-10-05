const express = require('express');
const path = require('path');
const bodyparser = require('body-parser');
const session = require("express-session");
const nodemailer = require('nodemailer');
const cors = require('cors');
const Imap = require('imap');
require('dotenv').config();

const router = require('./router');

//chat
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');

//call
const twilio = require('twilio');

// Twilio credentials
const accountSid = 'AC48434b6c6ce96ba17cb0bfa19e67a3ee';
const authToken = '374a1076e60f427891a680a2dec38184';
const client = new twilio(accountSid, authToken);


const app = express();
//chat
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT||3000;

app.use(cors());
app.use(bodyparser.json())
app.use(bodyparser.urlencoded({extended:true}))

app.set('view engine', 'ejs');

//static assets
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
}));

app.use('/route', router);

// Set up storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // Save to 'uploads' directory
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Append timestamp to file name
    },
});

const upload = multer({ 
    storage,
    fileFilter: (req, file, cb) => {
        // Check the file type
        const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx/; // Add more types as needed
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Error: File type not supported!'));
    }
});

// Serve static files from the "public" directory
app.use(express.static('public'));

app.use('/uploads', express.static('uploads')); // Serve uploaded files

// Create an uploads directory
app.use(express.static('uploads'));

// Handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        const filePath = `/uploads/${req.file.filename}`;
        res.json({ filePath }); // Send back the file path to the client
    } else {
        res.status(400).json({ error: 'No file uploaded' });
    }
});

// On a new connection
io.on('connection', (socket) => {
    console.log('A user connected');

    // Listen for chat messages
    socket.on('chat message', (msg) => {
        io.emit('chat message', msg);
    });

    // Listen for file messages
    socket.on('file message', (filePath, fileType) => {
        io.emit('file message', { filePath, fileType }); // Broadcast the file path and type
        console.log(fileType);
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

// Endpoint to make a call
app.post('/make-call', (req, res) => {
    const { to } = req.body;
    client.calls.create({
        url: 'http://demo.twilio.com/docs/voice.xml', // This URL will return TwiML instructions
        to,
        from: +12094351482,
    })
    .then(call => res.json(call))
    .catch(error => res.status(500).json({ error: error.message }));
});

// Handle incoming calls
app.post('/incoming-call', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Hello! You have an incoming call.');

    // Emit an event to the frontend
    io.emit('incomingCall', { message: 'Incoming call!' });

    res.type('text/xml');
    res.send(twiml.toString());
});

// Endpoint to send SMS
app.post('/send-sms', (req, res) => {
    const { to, body } = req.body;

    client.messages.create({
        body: body,
        to: to,
        from: '+12094351482' // Replace with your Twilio number
    })
    .then(message => res.json({ success: true, sid: message.sid }))
    .catch(err => res.status(500).json({ success: false, error: err.message }));
});

let messages = [];

// Twilio webhook endpoint for receiving SMS
app.post('/incoming-sms', (req, res) => {
    const { From, Body } = req.body;
    messages.push({ from: From, body: Body, received: true });
    console.log(`Received message from ${From}: ${Body}`);

    // Respond to Twilio
    res.send('<Response></Response>');
});

// Endpoint to get messages
app.get('/messages', (req, res) => {
    res.send(messages);
});

// Email sending endpoint

    // Create a transporter object
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'testmail03291218@gmail.com', // Your email
            pass: 'kysz mfyl ndkn xnlh' // Your app password
        }
    });

    // Function to send email
const sendEmail = async (to, subject, text, attachmentPath) => {
    const mailOptions = {
        from: 'testmail03291218@gmail.com',
        to: to,
        subject: subject,
        text: text,
        attachments: [
            {
                path: attachmentPath, // Path to the attachment
            },
        ],
    };

    return transporter.sendMail(mailOptions);
};

// Handle form submission
app.post('/send', upload.single('attachment'), async (req, res) => {
    const { to, subject, text } = req.body;
    const attachmentPath = req.file ? req.file.path : null; // Get the uploaded file path

    try {
        await sendEmail(to, subject, text, attachmentPath);
        res.send('Email sent successfully!');
    } catch (error) {
        res.send('Error sending email: ' + error.message);
    }
});

// Fetch emails endpoint
app.post('/fetch-emails', (req, res) => {
    const imap = new Imap({
        user: 'testmail03291218@gmail.com',
        password: 'kysz mfyl ndkn xnlh',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: {
            rejectUnauthorized: false // Allow self-signed certificates
        },
        authTimeout: 3000
    });

    imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to open inbox: ' + err.message });
            }
            imap.search(['UNSEEN'], (err, results) => {
                if (err) {
                    return res.status(500).json({ error: 'Search error: ' + err.message });
                }

                if (results.length === 0) {
                    return res.status(200).json({ emails: [] }); // No new emails
                }

                const f = imap.fetch(results, { bodies: '' });
                const emails = [];

                f.on('message', (msg, seqno) => {
                    msg.on('body', (stream) => {
                        let emailData = '';

                        stream.on('data', (chunk) => {
                            emailData += chunk.toString('utf8');
                        });

                        stream.on('end', () => {
                            emails.push(emailData);
                        });
                    });
                });

                f.on('end', () => {
                    imap.end();
                    res.status(200).json({ emails });
                });


            });
        });
    });

    imap.once('error', (err) => {
        res.status(500).json({ error: 'IMAP error: ' + err.message });
    });

    imap.connect();
});

app.post('/read-email', (req, res) => {
    const { seqno } = req.body; // Get the sequence number from the request

    const imap = new Imap({
        user: 'testmail03291218@gmail.com',
        password: 'kysz mfyl ndkn xnlh',
        host: 'imap.gmail.com',
        port: 993,
        tls: true,
        tlsOptions: {
            rejectUnauthorized: false
        },
        authTimeout: 3000
    });

    imap.once('ready', () => {
        imap.openBox('INBOX', true, (err, box) => {
            if (err) return res.status(500).json({ error: 'Failed to open inbox' });

            // Search for all emails
            imap.search(['ALL'], (err, results) => {
                if (err) return res.status(500).json({ error: 'Search error: ' + err.message });

                // Fetch the emails
                const f = imap.fetch(results, { bodies: '' });

                const emails = [];
                f.on('message', (msg) => {
                    let emailData = '';
                    msg.on('body', (stream) => {
                        stream.on('data', (chunk) => {
                            emailData += chunk.toString('utf8');
                        });
                    });

                    msg.on('attributes', (attrs) => {
                        const date = attrs.date; // Get the email date
                        emails.push({ data: emailData, date });
                    });

                    msg.on('end', () => {
                        // Sort emails by date (latest first)
                        emails.sort((a, b) => new Date(b.date) - new Date(a.date));
                    });
                });

                f.on('end', () => {
                    res.status(200).json({ emails });
                });

                f.on('error', (err) => res.status(500).json({ error: 'Fetch error: ' + err.message }));
            });
        });
    });


    imap.once('error', (err) => {
        res.status(500).json({ error: 'IMAP error: ' + err.message });
    });

    imap.connect();
});

//home
app.get('/',(req,res)=>{
    res.render('loginPage',{title:"Communication App Login"});
})

server.listen(port, ()=>{
    console.log("Listening to the server on http://localhost:3000")
})