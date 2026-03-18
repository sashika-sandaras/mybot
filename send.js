const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib');
const { execSync } = require('child_process');
const path = require('path');

async function startBot() {
    const sessionData = process.env.SESSION_ID;
    const userJid = process.env.USER_JID;
    const fileId = process.env.FILE_ID;

    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    if (sessionData && sessionData.startsWith('Gifted~')) {
        try {
            const base64Data = sessionData.split('Gifted~')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const decodedSession = zlib.gunzipSync(buffer).toString();
            fs.writeFileSync('./auth_info/creds.json', decodedSession);
        } catch (e) { console.log("Session Error"); }
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        browser: ["MFlix-Engine", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    async function sendMsg(text) {
        await sock.sendMessage(userJid, { text: text });
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            try {
                await sendMsg("✅ *Request Received...*");
                await delay(500);
                await sendMsg("📥 *Downloading 700MB+ File...*");

                // Python script using gdown to handle large files and virus scan warnings
                const pyScript = `
import gdown
import os
import sys

file_id = "${fileId}"
url = f'https://drive.google.com/uc?id={file_id}'
output = 'video_content.mp4'

try:
    # gdown automatically handles the 'virus scan warning' for large files
    path = gdown.download(url, output, quiet=False, fuzzy=True)
    if path and os.path.exists(path):
        print(path)
    else:
        sys.exit(1)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;
                fs.writeFileSync('downloader.py', pyScript);

                // Ensure gdown is installed
                try { execSync('pip install gdown'); } catch(e) {}

                let fileName;
                try {
                    fileName = execSync('python3 downloader.py').toString().trim();
                } catch (e) {
                    throw new Error("DOWNLOAD_FAILED");
                }

                if (!fileName || !fs.existsSync(fileName)) throw new Error("FILE_NOT_FOUND");

                await sendMsg("📤 *Upload වෙමින් පවතී... (700MB නිසා මඳක් ප්‍රමාද විය හැක)*");

                const ext = path.extname(fileName).toLowerCase();
                const mime = (ext === '.mkv') ? 'video/x-matroska' : 'video/mp4';

                // Send to WhatsApp
                await sock.sendMessage(userJid, {
                    document: { url: `./${fileName}` },
                    fileName: fileName,
                    mimetype: mime,
                    caption: `💚 *Video Upload Successfully...*\n\n📦 *File :* ${fileName}\n\n🏷️ *Mflix WhDownloader*\n💌 *Made With Sashika Sandras*`
                });

                await sendMsg("☺️ *Mflix භාවිතා කළ ඔබට සුභ දවසක්...*\n*කරුණාකර Report කිරීමෙන් වළකින්න...* 💝");
                
                if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
                if (fs.existsSync('downloader.py')) fs.unlinkSync('downloader.py');
                setTimeout(() => process.exit(0), 5000);

            } catch (err) {
                await sendMsg("❌ *දෝෂය:* 700MB ගොනුව බාගත කිරීමට නොහැකි විය. කරුණාකර Google Drive Link එක 'Public' (Anyone with link) දැයි බලන්න.");
                process.exit(1);
            }
        }
    });
}

startBot();
