const os = require("os");
const { execFile } = require("child_process");
const dns = require("dns").promises;

/* =========================
   NETWORK HELPERS
========================= */

function getActiveIPv4() {
  const nets = os.networkInterfaces();
  for (const addrs of Object.values(nets)) {
    for (const addr of addrs || []) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr;
      }
    }
  }
  return null;
}

function ipToInt(ip) {
  return ip.split(".").reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}

function intToIp(int) {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join(".");
}

function netmaskToCidr(mask) {
  return mask
    .split(".")
    .map(o => Number(o).toString(2))
    .join("")
    .replace(/0/g, "").length;
}

function getNetworkCidr(ip, mask) {
  const network = ipToInt(ip) & ipToInt(mask);
  return `${intToIp(network)}/${netmaskToCidr(mask)}`;
}

/* =========================
   NMAP SCAN
========================= */

function scanNetwork(cidr) {
  return new Promise((resolve, reject) => {
    execFile("nmap", ["-sn", cidr, "-oG", "-"], (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

function parseOutput(out) {
  const devices = [];
  for (const line of out.split("\n")) {
    if (!line.includes("Status: Up")) continue;
    const match = line.match(/^Host:\s+(\d+\.\d+\.\d+\.\d+)\s+\((.*?)\)/);
    if (!match) continue;

    devices.push({
      ip: match[1],
      name: match[2] || "unknown",
    });
  }

  return devices;
}

async function enrichDNS(devices) {
  for (const d of devices) {
    if (d.name !== "unknown") continue;
    try {
      const rev = await dns.reverse(d.ip);
      if (rev?.[0]) d.name = rev[0];
    } catch {}
  }
  return devices;
}

/* =========================
   MAIN
========================= */

(async () => {
  const iface = getActiveIPv4();
  if (!iface) {
    console.error("❌ Nenašiel som aktívnu sieť");
    process.exit(1);
  }

  const cidr = getNetworkCidr(iface.address, iface.netmask);

  console.log("📡 Sieť:", cidr);
  console.log("🔍 Skenujem...\n");

  const raw = await scanNetwork(cidr);
  let devices = parseOutput(raw);
  devices = await enrichDNS(devices);

  devices.sort((a, b) => ipToInt(a.ip) - ipToInt(b.ip));

  console.log("ZARIADENIA NA SIETI:");
  console.log("--------------------");

  for (const d of devices) {
    console.log(`${d.ip.padEnd(16)} ${d.name}`);
  }

  console.log(`\n✅ Nájdených zariadení: ${devices.length}`);
})();