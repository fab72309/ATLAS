/**
 * voice-dictation.js — Composant de dictée vocale hybride (Voxtral + Web Speech API)
 *
 * DEUX PARAMÈTRES À CONFIGURER :
 * 1. Clé API Mistral : variable VITE_MISTRAL_API_KEY dans votre fichier .env
 *    → Obtenir une clé sur https://console.mistral.ai/
 *    → Sans clé valide, bascule automatique sur Web Speech API (gratuit, local)
 * 2. Vocabulaire métier : constante VOICE_CONTEXT_BIAS ci-dessous (ligne ~20)
 *    → Modifier la liste pour adapter la reconnaissance au domaine
 *
 * INTÉGRATION :
 *   - Appeler init() après le montage du DOM (ex. useEffect, DOMContentLoaded)
 *   - Ajouter l'attribut data-voice-target sur chaque <textarea> ou <input> cible
 *   - Si plusieurs champs portent l'attribut, le bouton suit le focus
 */

// ─── Vocabulaire métier ────────────────────────────────────────────────────────
const VOICE_CONTEXT_BIAS =
  'FPT,SDIS,GIFF,GRIMP,VSAV,FPTL,officier_de_permanence,' +
  'commandant_d_operations_de_secours,sapeur_pompier_professionnel,' +
  'manœuvre_feux,désincarcération,feux_de_forêt,équipier,' +
  'chef_d_agrès,binôme,niveau_de_garde,plateau_technique,' +
  'formation_sapeur,CRM,NOTECHS,FOH';

// ─── Configuration API ─────────────────────────────────────────────────────────
const MISTRAL_ENDPOINT = 'https://api.mistral.ai/v1/audio/transcriptions';
const MISTRAL_MODEL = 'voxtral-mini-latest';

function getMistralKey() {
  return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MISTRAL_API_KEY) || '';
}

// ─── État interne ──────────────────────────────────────────────────────────────
let activeTarget = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];
let micButton = null;
let errorBanner = null;
let methodBadge = null;
let audioStream = null;
let recognition = null;
let initialized = false;
let observer = null;

// ─── Point d'entrée public ─────────────────────────────────────────────────────

/**
 * Initialise le composant. À appeler une seule fois après le montage du DOM.
 * Utilise un MutationObserver pour détecter les champs ajoutés dynamiquement.
 */
export function init() {
  if (initialized) return;
  initialized = true;

  createUI();
  attachToTargets();

  // Observer les ajouts/suppressions de nœuds pour les champs rendus dynamiquement
  observer = new MutationObserver(() => attachToTargets());
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('scroll', repositionButton, { passive: true });
  window.addEventListener('resize', repositionButton, { passive: true });

  // Cacher le bouton quand le focus quitte tous les champs cibles
  document.addEventListener('focusin', (e) => {
    const isTarget = e.target?.hasAttribute?.('data-voice-target');
    if (!isTarget && micButton) {
      if (!isRecording) micButton.style.display = 'none';
    }
  });
}

// ─── Attachement aux cibles ────────────────────────────────────────────────────

function attachToTargets() {
  const targets = document.querySelectorAll('[data-voice-target]');
  targets.forEach((el) => {
    if (el.dataset.voiceDictationAttached) return;
    el.dataset.voiceDictationAttached = '1';
    el.addEventListener('focus', () => onTargetFocus(el));
  });
}

function onTargetFocus(target) {
  activeTarget = target;
  repositionButton();
  if (micButton) micButton.style.display = 'flex';
}

// ─── Interface utilisateur ─────────────────────────────────────────────────────

function createUI() {
  // Bouton micro
  micButton = document.createElement('button');
  micButton.type = 'button';
  micButton.setAttribute('aria-label', 'Démarrer la dictée');
  Object.assign(micButton.style, {
    position: 'fixed',
    zIndex: '9999',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, box-shadow 0.2s, color 0.2s',
    background: 'rgba(100,116,139,0.15)',
    color: '#94a3b8',
    padding: '0',
    lineHeight: '1',
  });
  micButton.innerHTML = iconMic();
  micButton.addEventListener('click', handleButtonClick);

  // Bandeau d'erreur inline
  errorBanner = document.createElement('div');
  errorBanner.setAttribute('role', 'alert');
  Object.assign(errorBanner.style, {
    position: 'fixed',
    zIndex: '9999',
    background: 'rgba(239,68,68,0.92)',
    color: 'white',
    fontSize: '13px',
    padding: '5px 12px',
    borderRadius: '8px',
    display: 'none',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    backdropFilter: 'blur(4px)',
  });

  // Badge méthode (affiché brièvement sous le champ après transcription)
  methodBadge = document.createElement('div');
  Object.assign(methodBadge.style, {
    position: 'fixed',
    zIndex: '9999',
    fontSize: '11px',
    padding: '3px 10px',
    borderRadius: '6px',
    display: 'none',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    opacity: '0',
    transition: 'opacity 0.25s ease',
  });

  document.body.appendChild(micButton);
  document.body.appendChild(errorBanner);
  document.body.appendChild(methodBadge);
}

function repositionButton() {
  if (!activeTarget || !micButton) return;
  const r = activeTarget.getBoundingClientRect();
  // Positionné en bas à droite de l'élément cible
  micButton.style.top = `${r.bottom - 42}px`;
  micButton.style.left = `${r.right - 42}px`;

  if (errorBanner.style.display !== 'none') {
    errorBanner.style.top = `${r.bottom + 4}px`;
    errorBanner.style.left = `${r.left}px`;
  }
}

function showError(msg) {
  if (!activeTarget || !errorBanner) return;
  const r = activeTarget.getBoundingClientRect();
  errorBanner.textContent = msg;
  errorBanner.style.display = 'block';
  errorBanner.style.top = `${r.bottom + 4}px`;
  errorBanner.style.left = `${r.left}px`;
  clearTimeout(errorBanner._hideTimer);
  errorBanner._hideTimer = setTimeout(hideError, 4500);
}

function hideError() {
  if (errorBanner) errorBanner.style.display = 'none';
}

function showMethodBadge(method) {
  if (!activeTarget || !methodBadge) return;

  const isVoxtral = method === 'voxtral';
  methodBadge.textContent = isVoxtral ? '⚡ Voxtral' : '🎙 Web Speech';
  Object.assign(methodBadge.style, {
    background: isVoxtral ? 'rgba(99,102,241,0.15)' : 'rgba(100,116,139,0.13)',
    color: isVoxtral ? '#818cf8' : '#94a3b8',
    border: isVoxtral ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(100,116,139,0.2)',
  });

  const r = activeTarget.getBoundingClientRect();
  methodBadge.style.top = `${r.bottom + 5}px`;
  methodBadge.style.left = `${r.left}px`;
  methodBadge.style.display = 'block';

  // Fade in
  requestAnimationFrame(() => {
    methodBadge.style.opacity = '1';
  });

  clearTimeout(methodBadge._hideTimer);
  methodBadge._hideTimer = setTimeout(() => {
    methodBadge.style.opacity = '0';
    methodBadge._hideTimer = setTimeout(() => {
      methodBadge.style.display = 'none';
    }, 250);
  }, 3000);
}

function setRecordingUI(recording) {
  isRecording = recording;
  if (!micButton) return;
  if (recording) {
    micButton.style.background = 'rgba(239,68,68,0.15)';
    micButton.style.color = '#ef4444';
    micButton.style.boxShadow = '0 0 0 3px rgba(239,68,68,0.25)';
    micButton.innerHTML = iconMicOff();
    micButton.setAttribute('aria-label', 'Arrêter la dictée');
  } else {
    micButton.style.background = 'rgba(100,116,139,0.15)';
    micButton.style.color = '#94a3b8';
    micButton.style.boxShadow = 'none';
    micButton.innerHTML = iconMic();
    micButton.setAttribute('aria-label', 'Démarrer la dictée');
  }
}

// ─── Contrôle d'enregistrement ─────────────────────────────────────────────────

async function handleButtonClick() {
  if (isRecording) {
    stopAll();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  hideError();

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showError('Accès au micro refusé');
    return;
  }

  const hasMistralKey = Boolean(getMistralKey());
  const hasWebSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

  if (hasMistralKey) {
    audioStream = stream;
    startMediaRecorder(stream);
  } else if (hasWebSpeech) {
    stream.getTracks().forEach((t) => t.stop());
    startWebSpeech();
  } else {
    stream.getTracks().forEach((t) => t.stop());
    showError('Dictée vocale non disponible');
  }
}

function stopAll() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop(); // déclenche onstop → transcription
  }
  if (recognition) {
    recognition.stop();
  }
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
  setRecordingUI(false);
}

// ─── MediaRecorder (Voxtral) ───────────────────────────────────────────────────

function startMediaRecorder(stream) {
  audioChunks = [];
  const mimeType = getSupportedMimeType();
  const options = mimeType ? { mimeType } : {};

  try {
    mediaRecorder = new MediaRecorder(stream, options);
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    fallbackToWebSpeech();
    return;
  }

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    const effectiveMime = mediaRecorder.mimeType || mimeType || 'audio/webm';
    const blob = new Blob(audioChunks, { type: effectiveMime });
    await transcribeWithMistral(blob, effectiveMime);
  };

  mediaRecorder.start();
  setRecordingUI(true);
}

async function transcribeWithMistral(blob, mimeType) {
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
  const file = new File([blob], `audio.${ext}`, { type: mimeType });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', MISTRAL_MODEL);
  formData.append('language', 'fr');
  if (VOICE_CONTEXT_BIAS) {
    // Passer le biais comme prompt de contexte (certaines APIs audio l'acceptent)
    formData.append('prompt', VOICE_CONTEXT_BIAS.replace(/,/g, ' '));
  }

  let resp;
  try {
    resp = await fetch(MISTRAL_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getMistralKey()}` },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    // Réseau indisponible → bascule silencieuse
    fallbackToWebSpeech();
    return;
  }

  if (resp.status === 401 || resp.status === 403) {
    // Clé invalide → bascule silencieuse
    fallbackToWebSpeech();
    return;
  }

  if (!resp.ok) {
    showError(`Erreur Voxtral (${resp.status}) — bascule sur dictée locale`);
    fallbackToWebSpeech();
    return;
  }

  let data;
  try {
    data = await resp.json();
  } catch {
    fallbackToWebSpeech();
    return;
  }

  const text = (data.text ?? '').trim();
  if (text) insertText(text, 'voxtral');
}

// ─── Web Speech API (fallback) ─────────────────────────────────────────────────

function fallbackToWebSpeech() {
  const hasWebSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  if (!hasWebSpeech) {
    showError('Dictée vocale non disponible');
    return;
  }
  startWebSpeech();
}

function startWebSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'fr-FR';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (e) => {
    const text = (e.results[0]?.[0]?.transcript ?? '').trim();
    if (text) insertText(text, 'webspeech');
  };

  recognition.onerror = (e) => {
    if (e.error === 'not-allowed') showError('Accès au micro refusé');
    setRecordingUI(false);
  };

  recognition.onend = () => setRecordingUI(false);

  recognition.start();
  setRecordingUI(true);
}

// ─── Injection du texte (compatible React) ────────────────────────────────────

function insertText(text, method = 'webspeech') {
  if (!activeTarget) return;

  const proto =
    activeTarget.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  const current = activeTarget.value;
  const newValue = current ? `${current} ${text}` : text;

  if (nativeSetter) {
    nativeSetter.call(activeTarget, newValue);
  } else {
    activeTarget.value = newValue;
  }

  // Déclenche les listeners React (onChange) et natifs
  activeTarget.dispatchEvent(new Event('input', { bubbles: true }));
  activeTarget.dispatchEvent(new Event('change', { bubbles: true }));

  showMethodBadge(method);
}

// ─── Utilitaires ───────────────────────────────────────────────────────────────

function getSupportedMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

function iconMic() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
  </svg>`;
}

function iconMicOff() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="22"/>
  </svg>`;
}
