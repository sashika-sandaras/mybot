const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');

async function sendVideo() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    const userJid = process.env.USER_JID;
    const filePath = './movie_mflix.mp4';

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log("🚀 WhatsApp එකට සම්බන්ධ වුණා. වීඩියෝ එක යවනවා...");
            
            await sock.sendMessage(userJid, { 
                video: fs.readFileSync(filePath), 
                caption: "✅ මෙන්න ඔයා ඉල්ලපු MFlix වීඩියෝ එක!",
                mimetype: 'video/mp4'
            });
            
            console.log("✅ සාර්ථකව යැව්වා!");
            process.exit(0);
        }
    });

    sock.ev.on('creds.update', saveCreds);
}

sendVideo();
