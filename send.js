const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const zlib = require('zlib'); // No npm install needed
const { execSync } = require('child_process');
const path = require('path');

async function startBot() {
    const sessionData = process.env.SESSION_ID;
    const userJid = process.env.USER_JID;
    const fileId = process.env.FILE_ID;
    const voeKey = process.env.VOE_KEY;

    // Session Decryption
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

    // මැසේජ් යවන පොදු function එක
    async function sendUpdate(text) {
        await sock.sendMessage(userJid, { text: `🍿 *MFLIX ENGINE* \n\n${text}` });
    }

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;
        if (connection === 'open') {
            console.log('✅ Bot Connected to WhatsApp');

            try {
                // 1. මුලින්ම Request එක ලැබුණු බව කියනවා
                await sendUpdate("🎬 *Request Received!*\nඔබේ ඉල්ලීම සාර්ථකව ලැබුණා. පද්ධතිය දැන් ක්‍රියාත්මකයි... ⏳");
                
                // 2. ඩවුන්ලෝඩ් එක පටන් ගන්නවා
                await sendUpdate("📥 *Downloading Started...*\nදැන් ෆයිල් එක සර්වර් එකට බාමින් පවතියි. කරුණාකර රැඳී සිටින්න. 🚀");

                const pyCode = `
import os, requests, gdown, re, sys
f_id = "${fileId}"
v_key = "${voeKey}"
is_gdrive = len(f_id) > 25 or (len(f_id) > 20 and any(c.isupper() for c in f_id))
try:
    if is_gdrive:
        url = f"https://drive.google.com/uc?id={f_id}"
        output = gdown.download(url, quiet=True, fuzzy=True)
    else:
        api_url = f"https://voe.sx/api/drive/v2/file/info?key={v_key}&file_code={f_id}"
        r = requests.get(api_url).json()
        direct_url = r['result']['direct_url']
        res = requests.get(direct_url, stream=True)
        cd = res.headers.get('content-disposition')
        output = re.findall('filename="?([^"]+)"?', cd)[0] if cd else 'video.mkv'
        with open(output, 'wb') as f:
            for chunk in res.iter_content(1024*1024): f.write(chunk)
    print(output)
except Exception as e:
    sys.exit(1)
`;
                // Python එක රන් කරලා ෆයිල් එකේ නම ගන්නවා
                const fileName = execSync(`python3 -c '${pyCode}'`).toString().trim();

                if (!fileName || !fs.existsSync(fileName)) throw new Error("File not found");

                // 3. අප්ලෝඩ් එක පටන් ගන්නවා
                await sendUpdate(`📤 *Uploading to WhatsApp...*\n\n*File:* ${fileName}\nදැන් ඔබේ දුරකථනයට එවමින් පවතියි... 🚀`);

                const extension = path.extname(fileName).toLowerCase();
                let mime = 'video/x-matroska';
                if (extension === '.mp4') mime = 'video/mp4';
                if (extension === '.srt') mime = 'text/plain';

                // Document එකක් විදිහට යැවීම
                await sock.sendMessage(userJid, {
                    document: { url: `./${fileName}` },
                    fileName: fileName,
                    mimetype: mime,
                    caption: `✅ *MFlix File Delivered!*\n\n📂 Name: ${fileName}\n🍿 *MFlix Engine*`
                });

                // 4. අවසාන පණිවිඩය
                await sendUpdate("✨ *Task Completed!* \nඔබට අවශ්‍ය වීඩියෝව සාර්ථකව එවා ඇත. සුබ දවසක්! 🎬🍿");
                
                // Cleanup
                fs.unlinkSync(fileName);
                setTimeout(() => process.exit(0), 5000);

            } catch (err) {
                await sendUpdate("❌ *Error:* වැඩේ සිද්ධ වෙද්දී දෝෂයක් ආවා. කරුණාකර File ID එක පරීක්ෂා කර නැවත උත්සාහ කරන්න.");
                console.error(err);
                process.exit(1);
            }
        }
    });
}

startBot();
