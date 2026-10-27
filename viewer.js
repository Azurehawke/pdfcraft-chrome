// Hosts PdfCraft's web build in an iframe and drives its postMessage bridge
// (apps/pdfcraft-web/src/main.rs, `mod host`): pdfcraft:ready / open / save / dirty / failed.

const pdfUrl = location.hash.slice(1);
const frame = document.getElementById('app');
const status = document.getElementById('status');

let fileName = nameFromUrl(pdfUrl);
let saveHandle = null; // file chosen on the first Save, reused until Save As
let dirty = false;

function show(text) {
  status.textContent = text;
  status.hidden = !text;
}

function nameFromUrl(url) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
    return last || 'document.pdf';
  } catch {
    return 'document.pdf';
  }
}

function nameFromDisposition(header) {
  if (!header) return null;
  const star = /filename\*\s*=\s*[^']*''([^;]+)/i.exec(header);
  if (star) try { return decodeURIComponent(star[1].trim()); } catch {}
  const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(header);
  return plain ? plain[1].trim() : null;
}

// XHR rather than fetch: it can read file:// URLs (with file access allowed)
// and sends the site's cookies, so logged-in PDFs open.
function download(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.responseType = 'arraybuffer';
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status && (xhr.status < 200 || xhr.status >= 300)) return reject(new Error('HTTP ' + xhr.status));
      const named = nameFromDisposition(xhr.getResponseHeader('Content-Disposition'));
      if (named) fileName = named;
      resolve(xhr.response);
    };
    xhr.onerror = () => reject(new Error('network error'));
    xhr.send();
  });
}

async function save(bytes, name, saveAs) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  if (window.showSaveFilePicker) {
    try {
      if (!saveHandle || saveAs) {
        saveHandle = await showSaveFilePicker({
          suggestedName: name || fileName,
          types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
        });
      }
      const out = await saveHandle.createWritable();
      await out.write(blob);
      await out.close();
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled the picker
      console.warn('PdfCraft: save picker failed, downloading instead', e);
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name || fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

const pdf = pdfUrl ? download(pdfUrl) : Promise.resolve(null);
pdf.catch(e => show(`Couldn't load ${pdfUrl}\n(${e.message})`));

window.addEventListener('message', async event => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  const msg = event.data || {};
  switch (msg.type) {
    case 'pdfcraft:ready': {
      const bytes = await pdf.catch(() => null);
      if (!pdfUrl) show('');
      if (!bytes) return;
      show('');
      document.title = fileName + ' – PdfCraft';
      frame.contentWindow.postMessage({ type: 'pdfcraft:open', name: fileName, bytes }, location.origin, [bytes]);
      break;
    }
    case 'pdfcraft:save':
      save(msg.bytes, msg.name, msg.saveAs);
      break;
    case 'pdfcraft:dirty':
      dirty = !!msg.dirty;
      break;
    case 'pdfcraft:failed':
      show('PdfCraft could not start: ' + msg.error);
      break;
  }
});

window.addEventListener('beforeunload', e => {
  if (dirty) e.preventDefault();
});

frame.src = 'app/index.html?host=parent';
