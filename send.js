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
        connectTimeoutMs: 120000, // ලොකු ෆයිල් නිසා ටයිම් එක වැඩි කළා
        defaultQueryTimeoutMs: 0
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        
        if (connection === 'open') {
            console.log("✅ WhatsApp Connected!");
            const userJid = process.env.USER_JID;

            // Python එකෙන් ලියපු filename එක කියවනවා
            if (fs.existsSync('filename.txt')) {
                const originalFileName = fs.readFileSync('filename.txt', 'utf8').trim();
                const filePath = `./${originalFileName}`;

                if (fs.existsSync(filePath)) {
                    console.log(`📤 Sending Original File: ${originalFileName}`);
                    
                    await sock.sendMessage(userJid, { 
                        document: fs.readFileSync(filePath), 
                        mimetype: originalFileName.endsWith('.mkv') ? 'video/x-matroska' : 'video/mp4',
                        fileName: originalFileName,
                        caption: `🎬 *MFlix Original Delivery*\n\n*Name:* ${originalFileName}\n\nරසවිඳින්න! 🍿`
                    });

                    console.log("🚀 Movie Sent Successfully with Original Name!");
                    await delay(10000);
                    process.exit(0);
                } else {
                    console.log("❌ Video File not found on server!");
                    process.exit(1);
                }
            } else {
                console.log("❌ Filename tracking lost!");
                process.exit(1);
            }
        }
    });
}

sendMovie();
