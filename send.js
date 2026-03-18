const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');

async function sendMovie() {
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    
    const sessionData = process.env.SESSION_ID;
    try {
        const base64Data = sessionData.split('Gifted~')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const decodedSession = zlib.gunzipSync(buffer).toString();
        fs.writeFileSync('./auth_info/creds.json', decodedSession);
        console.log("📂 Session File Ready.");
    } catch (e) {
        console.log("❌ Session Error: " + e.message);
        process.exit(1);
    }

    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        
        if (connection === 'open') {
            console.log("✅ WhatsApp Connected!");
            const userJid = process.env.USER_JID;
            const filePath = './movie_mflix.mp4';

            if (fs.existsSync(filePath)) {
                console.log("📤 Sending video... this may take a few minutes for large files.");
                
                await sock.sendMessage(userJid, { 
                    video: { url: filePath }, 
                    caption: "🎬 *MFlix Movie Delivery*\n\nරසවිඳින්න! 🍿\n\nWebsite: edulk.xyz",
                    mimetype: 'video/mp4',
                    fileName: 'MFlix_Movie.mp4'
                });

                console.log("🚀 Video Sent Successfully!");
                await delay(15000); // විනාඩි කිහිපයක් රැඳී සිටීම
                process.exit(0);
            } else {
                console.log("❌ File not found!");
                process.exit(1);
            }
        }
    });
}

sendMovie();
