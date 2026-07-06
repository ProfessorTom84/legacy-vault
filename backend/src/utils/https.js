/**
 * Built-in HTTPS via a self-signed certificate.
 *
 * Browsers only allow camera/microphone access on secure origins, so the
 * vault serves HTTPS on a second port using a certificate it generates
 * itself (open-source `selfsigned`, MIT). The certificate is persisted in
 * $DATA_DIR/certs so each device's one-time "proceed anyway" acceptance
 * keeps working across container restarts. It is regenerated automatically
 * if the BASE_URL host changes, so the cert always names the right address.
 */
const fs = require('fs');
const path = require('path');
const log = require('./logger').child('https');

const DATA_DIR = process.env.DATA_DIR || '/data';
const CERT_DIR = path.join(DATA_DIR, 'certs');
const KEY_FILE = path.join(CERT_DIR, 'vault.key.pem');
const CERT_FILE = path.join(CERT_DIR, 'vault.cert.pem');
const HOSTS_FILE = path.join(CERT_DIR, 'hosts.txt');

const IP_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Hosts the certificate should be valid for. */
function wantedHosts() {
  const hosts = new Set(['localhost', '127.0.0.1']);
  try {
    const h = new URL(process.env.BASE_URL || 'http://localhost:8080').hostname;
    if (h) hosts.add(h);
  } catch {
    /* unparseable BASE_URL — cert still covers localhost */
  }
  return [...hosts].sort();
}

function loadExisting(hostsKey) {
  try {
    if (fs.readFileSync(HOSTS_FILE, 'utf8').trim() !== hostsKey) return null; // host changed → regenerate
    return { key: fs.readFileSync(KEY_FILE), cert: fs.readFileSync(CERT_FILE) };
  } catch {
    return null;
  }
}

/**
 * Returns { key, cert } or null if HTTPS can't be set up (never throws —
 * the HTTP listener must not be taken down by a certificate problem).
 */
function ensureCert() {
  const hosts = wantedHosts();
  const hostsKey = hosts.join(',');

  const existing = loadExisting(hostsKey);
  if (existing) {
    log.info('using existing self-signed certificate', { hosts: hostsKey });
    return existing;
  }

  let selfsigned;
  try {
    selfsigned = require('selfsigned');
  } catch (err) {
    log.error('selfsigned package missing — HTTPS disabled', { err });
    return null;
  }

  try {
    const altNames = hosts.map((h) =>
      IP_RE.test(h) ? { type: 7, ip: h } : { type: 2, value: h }
    );
    const pems = selfsigned.generate(
      [{ name: 'commonName', value: hosts.find((h) => h !== 'localhost' && h !== '127.0.0.1') || 'localhost' }],
      {
        days: 3650,
        keySize: 2048,
        algorithm: 'sha256',
        extensions: [
          { name: 'basicConstraints', cA: false },
          { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
          { name: 'extKeyUsage', serverAuth: true },
          { name: 'subjectAltName', altNames },
        ],
      }
    );
    fs.mkdirSync(CERT_DIR, { recursive: true });
    fs.writeFileSync(KEY_FILE, pems.private, { mode: 0o600 });
    fs.writeFileSync(CERT_FILE, pems.cert);
    fs.writeFileSync(HOSTS_FILE, hostsKey);
    log.info('generated new self-signed certificate', { hosts: hostsKey, valid_days: 3650 });
    return { key: pems.private, cert: pems.cert };
  } catch (err) {
    log.error('certificate generation failed — HTTPS disabled', { err });
    return null;
  }
}

module.exports = { ensureCert };
