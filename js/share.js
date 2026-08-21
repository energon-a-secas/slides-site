/* ═══════════════════════════════════════════════════════════════════════════
   Share links: the deck travels in the URL, or by reference to one.

   Outbound:  #d=<base64url utf-8 yaml>     built by copyShareLink()
   Inbound:   #d=<payload>                  self-contained deck
              ?src=<https url>              fetch a deck someone hosts
              ?yaml=<raw yaml>              legacy; pathfinder still emits it

   Mirrors proctor-site's #t= / ?src= contract so an agent that learned one
   tool can drive both. A ?via= marker on arrival is read by the header kit
   for counting, never here. The hash is cleaned after a successful load:
   an edited deck and a stale URL payload must not diverge silently.
═══════════════════════════════════════════════════════════════════════════ */
import { showToast } from './utils.js';
import { update } from './render.js';

/** Base64url helpers (UTF-8 safe), same shape as proctor-site js/utils.js. */
export function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function loadYaml(yaml) {
  document.getElementById('yaml-input').value = yaml;
  update();
}

/**
 * Load a deck the URL carries, if any. Returns true when a URL source
 * claimed the load (including a pending ?src= fetch), so app.js knows
 * not to restore from localStorage.
 */
export function loadFromUrl() {
  const hash = location.hash.match(/^#d=(.+)$/);
  if (hash) {
    try {
      loadYaml(b64urlDecode(hash[1]));
      history.replaceState(null, '', location.pathname);
      showToast('Deck loaded from the link');
    } catch {
      showToast('The shared link did not contain a valid deck');
    }
    return true;
  }

  const params = new URLSearchParams(location.search);
  const src = params.get('src');
  // https only, plus plain http for localhost so the contract is testable in dev.
  if (src && (/^https:\/\//.test(src) || /^http:\/\/localhost[:/]/.test(src))) {
    // Fill the editor synchronously so the welcome dialog stays away
    // while the fetch is in flight (onboarding keys on editor content).
    loadYaml('# Loading deck from\n# ' + src.replace(/[\n\r]/g, '') + ' …\n');
    fetch(src)
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then((text) => {
        loadYaml(text);
        history.replaceState(null, '', location.pathname);
        showToast('Deck loaded from URL');
      })
      .catch(() => {
        loadYaml('');
        showToast('Could not fetch ?src= (CORS, network, or not https)');
      });
    return true;
  }

  const urlYaml = params.get('yaml');
  if (urlYaml) {
    // URLSearchParams.get() has already decoded this. Decoding again threw
    // URIError on any lone '%', which is why five of the twelve library decks
    // opened an empty editor: they contain percentages.
    loadYaml(urlYaml);
    return true;
  }

  return false;
}

/** Build the #d= link for the current deck and copy it to the clipboard. */
export function copyShareLink() {
  const yaml = document.getElementById('yaml-input').value;
  if (!yaml.trim()) { showToast('Nothing to share yet: write a deck first'); return; }
  const payload = b64urlEncode(yaml);
  if (payload.length > 32000) {
    showToast('Deck too large for a link (' + kb(payload.length) + '). Host the YAML and share ?src=<url>, or use the Pages bundle');
    return;
  }
  const url = location.origin + location.pathname + '#d=' + payload;
  const note = payload.length > 8000
    ? 'Share link copied (' + kb(payload.length) + ', big; ?src= hosting travels better)'
    : 'Share link copied (' + kb(payload.length) + '); the deck itself is in it';
  copyText(url).then(
    () => showToast(note),
    () => showToast('Could not copy: clipboard blocked')
  );
}

function kb(n) { return (n / 1024).toFixed(1) + ' KB'; }

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    // Fall through to execCommand when the API refuses (no user activation,
    // permission denied); the legacy path still works in those cases.
    return navigator.clipboard.writeText(text).catch(() => copyTextLegacy(text));
  }
  return copyTextLegacy(text);
}

function copyTextLegacy(text) {
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy') ? resolve() : reject(); }
    catch (e) { reject(e); }
    finally { ta.remove(); }
  });
}
