const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { DIRS } = require('../db');
const log = require('../utils/logger').child('upload');

const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '2048', 10);

function storageFor(dir) {
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      // Never trust the client filename on disk — generate our own,
      // keeping only a sanitised extension.
      const ext = (path.extname(file.originalname) || '')
        .toLowerCase()
        .replace(/[^a-z0-9.]/g, '')
        .slice(0, 10);
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });
}

function makeUploader(dir, accept) {
  return multer({
    storage: storageFor(dir),
    limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (!accept) return cb(null, true);
      // Recorded blobs can arrive with parameters ("video/webm;codecs=vp9")
      // or, on some browsers, as a bare application/octet-stream — so accept
      // on either a normalised mime prefix OR a known extension. A legitimate
      // recording must never bounce off its own vault.
      const baseMime = String(file.mimetype || '').split(';')[0].trim().toLowerCase();
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mimeOk = accept.prefixes.some((p) => baseMime.startsWith(p));
      const extOk = accept.exts.includes(ext);
      if (mimeOk || extOk) return cb(null, true);
      log.warn('rejected upload — type not accepted', {
        mimetype: file.mimetype, ext, field: file.fieldname, name: file.originalname,
      });
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
    },
  });
}

const uploadVideo = makeUploader(DIRS.videos, {
  prefixes: ['video/'],
  exts: ['.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.3gp'],
});
const uploadAudio = makeUploader(DIRS.audio, {
  prefixes: ['audio/', 'video/webm'], // MediaRecorder voice notes can be video/webm
  exts: ['.m4a', '.mp3', '.wav', '.ogg', '.oga', '.webm', '.aac', '.flac'],
});
const uploadFile = makeUploader(DIRS.files, null);

/**
 * Multer throws (file too large, wrong field, wrong type). Without this
 * wrapper Express would render an HTML error page; the frontend expects JSON.
 */
function handleUpload(uploader, field) {
  const single = uploader.single(field);
  return (req, res, next) => {
    single(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        log.warn('upload failed', { code: err.code, field });
        const messages = {
          LIMIT_FILE_SIZE: `That file is too large. The limit is ${MAX_UPLOAD_MB} MB.`,
          LIMIT_UNEXPECTED_FILE: 'That file type is not accepted here.',
        };
        return res
          .status(400)
          .json({ error: messages[err.code] || `Upload failed: ${err.code}` });
      }
      return res.status(500).json({ error: 'Upload failed. Try again.' });
    });
  };
}

module.exports = { uploadVideo, uploadAudio, uploadFile, handleUpload };
