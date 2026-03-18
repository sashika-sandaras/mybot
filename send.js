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
    const voeKey = process.env.VOE_KEY;

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
                await delay(1000);
                await sendMsg("📥 *Download වෙමින් පවතී...*");

                const pyScript = `
import os, requests, sys, subprocess

f_id = "${fileId}"
v_key = "${voeKey}"
ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36"

try:
    # 1. API එකෙන් විස්තර ගන්නවා
    api_url = f"https://voe.sx/api/drive/v2/file/info?key={v_key}&file_code={f_id}"
    res = requests.get(api_url, headers={"User-Agent": ua}, timeout=15).json()
    
    if res.get('success'):
        # 2. direct_url එක ගන්නවා (මෙතනයි රහස තියෙන්නේ)
        d_url = res['result'].get('direct_url')
        name = res['result'].get('name', 'video.mp4')
        
        if not d_url:
            sys.stderr.write("Direct URL not found. Check if Direct Download is enabled in VOE settings.")
            sys.exit(1)
            
        # 3. curl එකෙන් බානවා
        cmd = f'curl -L -k -s -A "{ua}" -o "{name}" "{d_url}"'
        exit_code = subprocess.call(cmd, shell=True)
        
        if exit_code == 0 and os.path.exists(name):
            print(name)
        else:
            sys.exit(1)
    else:
        sys.stderr.write(f"API Error: {res.get('msg', 'Unknown')}")
        sys.exit(1)
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
`;
                fs.writeFileSync('downloader.py', pyScript);

                let fileName;
                try {
                    fileName = execSync('python3 downloader.py').toString().trim();
                } catch (pyErr) {
                    let errorMsg = pyErr.stderr.toString() || "Unknown Error";
                    await sendMsg("❌ *දෝෂය:* " + errorMsg);
                    throw pyErr;
                }

                if (!fileName || !fs.existsSync(fileName)) throw new Error("File missing");

                await sendMsg("📤 *Upload වෙමින් පවතී...*");

                const ext = path.extname(fileName).toLowerCase();
                const isSub = ['.srt', '.vtt', '.ass'].includes(ext);
                const mime = isSub ? 'text/plain' : (ext === '.mp4' ? 'video/mp4' : 'video/x-matroska');
                const header = isSub ? "💚 *Subtitles Upload Successfully...*" : "💚 *Video Upload Successfully...*";

                await sock.sendMessage(userJid, {
                    document: { url: `./${fileName}` },
                    fileName: fileName,
                    mimetype: mime,
                    caption: `${header}\n\n📦 *File :* ${fileName}\n\n🏷️ *Mflix WhDownloader*\n💌 *Made With Sashika Sandras*`
                });

                await sendMsg("☺️ *Mflix භාවිතා කළ ඔබට සුභ දවසක්...*\n*කරුණාකර Report කිරීමෙන් වළකින්...* 💝");
                
                if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
                if (fs.existsSync('downloader.py')) fs.unlinkSync('downloader.py');
                setTimeout(() => process.exit(0), 5000);

            } catch (err) {
                process.exit(1);
            }
        }
    });
}

startBot();
