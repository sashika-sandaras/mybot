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

    // --- Session Setup ---
    if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
    if (sessionData && sessionData.startsWith('Gifted~')) {
        try {
            const base64Data = sessionData.split('Gifted~')[1];
            const buffer = Buffer.from(base64Data, 'base64');
            const decodedSession = zlib.gunzipSync(buffer).toString();
            fs.writeFileSync('./auth_info/creds.json', decodedSession);
        } catch (e) { console.log("Session Sync Error"); }
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
                await sendMsg("📥 *yt-dlp මගින් Download වෙමින් පවතී...*");

                // --- yt-dlp පාවිච්චි කර වීඩියෝව බාගැනීම ---
                // මෙහිදී අපි VOE Page එකේ URL එක ලබා දෙනවා.
                const voeUrl = `https://voe.sx/${fileId}`;
                
                // 1. මුලින්ම yt-dlp update කරගන්නවා
                try {
                    execSync('python3 -m pip install --upgrade yt-dlp');
                } catch (e) {}

                // 2. වීඩියෝ එකේ නම හොයාගන්නවා
                const rawFileName = execSync(`yt-dlp --get-filename -o "%(title)s.%(ext)s" "${voeUrl}"`).toString().trim();
                const fileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, "_"); // වැරදි අකුරු අයින් කරනවා

                // 3. වීඩියෝව බාගන්නවා
                console.log(`Downloading: ${fileName}`);
                execSync(`yt-dlp -o "${fileName}" "${voeUrl}"`);

                if (!fs.existsSync(fileName)) throw new Error("Download failed");

                await sendMsg("📤 *WhatsApp වෙත Upload වෙමින් පවතී...*");

                const ext = path.extname(fileName).toLowerCase();
                const mime = (ext === '.mp4') ? 'video/mp4' : 'video/x-matroska';

                await sock.sendMessage(userJid, {
                    document: { url: `./${fileName}` },
                    fileName: fileName,
                    mimetype: mime,
                    caption: `💚 *Upload Success!*\n\n📦 *File:* ${fileName}\n🏷️ *Mflix WhDownloader*\n💌 *Made With Sashika Sandras*`
                });

                await sendMsg("☺️ *වැඩේ අවසන්! සුභ දවසක්...*");
                
                // Cleanup
                if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
                setTimeout(() => process.exit(0), 5000);

            } catch (err) {
                await sendMsg("❌ *දෝෂය:* yt-dlp මගින් වීඩියෝව බාගත කිරීමට නොහැකි විය. ලින්ක් එක පරීක්ෂා කරන්න.");
                process.exit(1);
            }
        }
    });
}

startBot();
