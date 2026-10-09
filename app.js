/**
 * ElevenLabs Voice Studio — Main Application Controller
 * Handles ElevenLabs Text-to-Speech API integration, Model & Voice selection,
 * Web Audio visualizer, playback controls, history, and demo simulation mode.
 */

// ==========================================================================
// Application State & Configuration
// ==========================================================================

const DEFAULT_API_KEY = 'sk_93d6e1e1186bbbc1fa70c219aefae45f9c1904dadf196b7c';

const APP_STATE = {
  apiKey: localStorage.getItem('elevenlabs_api_key') || DEFAULT_API_KEY,
  isDemoMode: false,
  isGenerating: false,
  isPlaying: false,
  currentAudioBlob: null,
  currentAudioUrl: null,
  currentVoiceName: 'George',
  currentModelId: 'eleven_multilingual_v2',
  history: [],
  audioContext: null,
  analyserNode: null,
  audioSourceNode: null,
  animationFrameId: null
};

// Model descriptions dictionary
const MODEL_DESCRIPTIONS = {
  'eleven_multilingual_v2': 'The flagship multilingual model with human-grade prosody, emotional nuance, and support for 29 languages.',
  'eleven_flash_v2_5': 'Ultra-low latency model (~75ms) optimized for real-time conversational AI and rapid streaming.',
  'eleven_turbo_v2_5': 'High quality with high speed, balanced latency, and support for 32 languages.',
  'eleven_flash_v2': 'Super-fast multilingual speech generation for cost-effective, high-throughput narration.',
  'eleven_turbo_v2': 'Lightning fast English speech generation optimized for real-time performance.',
  'eleven_monolingual_v1': 'Classic English speech synthesis model with stable narration characteristics.'
};

// Preset Prompt Scripts
const SAMPLE_PROMPTS = {
  audiobook: `The ancient library of Alexandria was said to hold secrets capable of unraveling the fabric of civilization. As Sister Beatrice ran her fingers across the gilded parchment, the faded script began to hum with an ethereal, low resonance. "Knowledge isn't merely remembered," she whispered into the dim candlelight, "it demands to be awakened."`,
  documentary: `Here, along the sun-drenched volcanic ridge of the Galapagos, the marine iguana prepares for its perilous descent into the roaring Pacific. Capable of slowing its heartbeat to half its normal rhythm, this prehistoric marvel grazes upon sea kelp in turbulent waters that would crush ordinary creatures.`,
  product: `Introducing the next frontier in audio intelligence: a seamless symphony of computational acoustics and neural synthesis. Engineered from the silicon up to understand not just what you say, but the subtle emotional inflections that make your voice uniquely yours.`,
  quotes: `Do not go where the path may lead; go instead where there is no path and leave a trail. Every great accomplishment began as an irrational conviction in the minds of those who dared to imagine what did not yet exist.`
};

// ==========================================================================
// DOM Element Cache
// ==========================================================================

const DOM = {
  // Header & Controls
  apiKeyToggleBtn: document.getElementById('apiKeyToggleBtn'),
  apiKeyStatusLabel: document.getElementById('apiKeyStatusLabel'),
  apiKeyStatusDot: document.getElementById('apiKeyStatusDot'),
  demoModeCheckbox: document.getElementById('demoModeCheckbox'),

  // Script & Text Area
  textInput: document.getElementById('textInput'),
  charCount: document.getElementById('charCount'),
  wordCount: document.getElementById('wordCount'),
  readTime: document.getElementById('readTime'),
  clearTextBtn: document.getElementById('clearTextBtn'),
  presetChips: document.querySelectorAll('.chip'),

  // Selectors
  modelSelect: document.getElementById('modelSelect'),
  modelDescription: document.getElementById('modelDescription'),
  voiceSelect: document.getElementById('voiceSelect'),
  voiceDescription: document.getElementById('voiceDescription'),
  refreshVoicesBtn: document.getElementById('refreshVoicesBtn'),

  // Primary Action
  generateBtn: document.getElementById('generateBtn'),
  generateBtnLabel: document.getElementById('generateBtnLabel'),
  generateBtnSub: document.getElementById('generateBtnSub'),
  mainPlayIcon: document.getElementById('mainPlayIcon'),
  btnSpinner: document.getElementById('btnSpinner'),
  stopAudioBtn: document.getElementById('stopAudioBtn'),

  // Audio Deck Player
  audioDeck: document.getElementById('audioDeck'),
  playbackPulse: document.getElementById('playbackPulse'),
  audioStatusText: document.getElementById('audioStatusText'),
  downloadAudioBtn: document.getElementById('downloadAudioBtn'),
  waveformCanvas: document.getElementById('waveformCanvas'),
  canvasPlaceholderText: document.getElementById('canvasPlaceholderText'),
  togglePlayPauseBtn: document.getElementById('togglePlayPauseBtn'),
  playerPlayPauseIcon: document.getElementById('playerPlayPauseIcon'),
  currentTimeLabel: document.getElementById('currentTimeLabel'),
  totalDurationLabel: document.getElementById('totalDurationLabel'),
  audioSeekBar: document.getElementById('audioSeekBar'),
  seekProgressBar: document.getElementById('seekProgressBar'),
  muteBtn: document.getElementById('muteBtn'),
  volumeIcon: document.getElementById('volumeIcon'),
  volumeSlider: document.getElementById('volumeSlider'),
  nativeAudioElement: document.getElementById('nativeAudioElement'),

  // Sidebar Settings
  stabilitySlider: document.getElementById('stabilitySlider'),
  stabilityVal: document.getElementById('stabilityVal'),
  similaritySlider: document.getElementById('similaritySlider'),
  similarityVal: document.getElementById('similarityVal'),
  styleSlider: document.getElementById('styleSlider'),
  styleVal: document.getElementById('styleVal'),
  speakerBoostCheck: document.getElementById('speakerBoostCheck'),
  resetSettingsBtn: document.getElementById('resetSettingsBtn'),

  // History
  historyList: document.getElementById('historyList'),
  historyEmptyState: document.getElementById('historyEmptyState'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),

  // API Key Modal
  apiKeyModal: document.getElementById('apiKeyModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  toggleKeyVisibilityBtn: document.getElementById('toggleKeyVisibilityBtn'),
  eyeIcon: document.getElementById('eyeIcon'),
  apiKeyFeedback: document.getElementById('apiKeyFeedback'),
  testApiKeyBtn: document.getElementById('testApiKeyBtn'),
  removeKeyBtn: document.getElementById('removeKeyBtn'),
  saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),

  // Toast Container
  toastContainer: document.getElementById('toastContainer')
};

// ==========================================================================
// Initialization
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  initIcons();
  initApiStatus();
  initEventListeners();
  initTextStats();
  initCanvasVisualizer();
  loadSavedHistory();

  // Populate initial prompt
  if (!DOM.textInput.value.trim()) {
    DOM.textInput.value = SAMPLE_PROMPTS.audiobook;
    updateTextMetrics();
  }

  // Auto-sync voices & user profile on load if API key is present
  if (APP_STATE.apiKey) {
    syncVoicesFromApi();
    fetchUserSubscription();
  }
});

function initIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

// ==========================================================================
// API Key Status & Management
// ==========================================================================

function initApiStatus() {
  if (APP_STATE.apiKey) {
    localStorage.setItem('elevenlabs_api_key', APP_STATE.apiKey);
    DOM.apiKeyStatusLabel.textContent = 'API Key Active';
    DOM.apiKeyStatusDot.classList.add('connected');
    DOM.apiKeyInput.value = APP_STATE.apiKey;
    DOM.demoModeCheckbox.checked = false;
    APP_STATE.isDemoMode = false;
  } else {
    DOM.apiKeyStatusLabel.textContent = 'Configure Key';
    DOM.apiKeyStatusDot.classList.remove('connected');
    // Enable demo mode by default if no key is configured
    DOM.demoModeCheckbox.checked = true;
    APP_STATE.isDemoMode = true;
    showToast('Demo Simulation Mode enabled. Add your ElevenLabs key anytime for genuine AI narration.', 'info', 5000);
  }
}

async function fetchUserSubscription() {
  if (!APP_STATE.apiKey) return;
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': APP_STATE.apiKey }
    });
    if (res.ok) {
      const data = await res.json();
      const used = data.subscription?.character_count || 0;
      const limit = data.subscription?.character_limit || 10000;
      const remaining = Math.max(0, limit - used);
      const name = data.first_name || 'User';
      DOM.apiKeyStatusLabel.textContent = `${name} (${remaining.toLocaleString()} chars)`;
      DOM.apiKeyToggleBtn.title = `ElevenLabs Account: ${name} • ${remaining.toLocaleString()} chars remaining out of ${limit.toLocaleString()}`;
    }
  } catch (err) {
    console.debug('Quota check deferred:', err);
  }
}

function openApiKeyModal() {
  DOM.apiKeyFeedback.textContent = '';
  DOM.apiKeyFeedback.className = 'modal-feedback';
  DOM.apiKeyInput.value = APP_STATE.apiKey;
  DOM.apiKeyModal.style.display = 'flex';
  DOM.apiKeyInput.focus();
}

function closeApiKeyModal() {
  DOM.apiKeyModal.style.display = 'none';
}

function toggleKeyVisibility() {
  const isPass = DOM.apiKeyInput.type === 'password';
  DOM.apiKeyInput.type = isPass ? 'text' : 'password';
  DOM.eyeIcon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
  initIcons();
}

async function verifyApiKey(keyToTest) {
  const key = keyToTest || DOM.apiKeyInput.value.trim();
  if (!key) {
    DOM.apiKeyFeedback.textContent = 'Please enter an ElevenLabs API key.';
    DOM.apiKeyFeedback.className = 'modal-feedback error';
    return false;
  }

  DOM.apiKeyFeedback.textContent = 'Verifying API key with ElevenLabs...';
  DOM.apiKeyFeedback.className = 'modal-feedback';

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': key }
    });

    if (response.ok) {
      const data = await response.json();
      const characterCount = data.subscription ? data.subscription.character_count : 'N/A';
      const characterLimit = data.subscription ? data.subscription.character_limit : 'N/A';
      const tier = data.subscription ? data.subscription.tier : 'Active';

      DOM.apiKeyFeedback.innerHTML = `Connected! Tier: <strong>${tier}</strong> (${characterCount.toLocaleString()} / ${characterLimit.toLocaleString()} characters used).`;
      DOM.apiKeyFeedback.className = 'modal-feedback success';
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.detail?.message || 'Invalid API Key or unauthorized access.';
      DOM.apiKeyFeedback.textContent = `Verification failed: ${msg}`;
      DOM.apiKeyFeedback.className = 'modal-feedback error';
      return false;
    }
  } catch (err) {
    DOM.apiKeyFeedback.textContent = `Network or CORS error connecting to ElevenLabs.`;
    DOM.apiKeyFeedback.className = 'modal-feedback error';
    return false;
  }
}

function saveApiKey() {
  const key = DOM.apiKeyInput.value.trim();
  if (!key) {
    showToast('Please enter an ElevenLabs API Key or use Demo Mode.', 'error');
    return;
  }

  APP_STATE.apiKey = key;
  localStorage.setItem('elevenlabs_api_key', key);
  DOM.apiKeyStatusLabel.textContent = 'API Key Active';
  DOM.apiKeyStatusDot.classList.add('connected');
  DOM.demoModeCheckbox.checked = false;
  APP_STATE.isDemoMode = false;

  closeApiKeyModal();
  showToast('ElevenLabs API Key saved successfully!', 'success');
  syncVoicesFromApi();
}

function removeApiKey() {
  APP_STATE.apiKey = '';
  localStorage.removeItem('elevenlabs_api_key');
  DOM.apiKeyInput.value = '';
  DOM.apiKeyStatusLabel.textContent = 'Configure Key';
  DOM.apiKeyStatusDot.classList.remove('connected');
  DOM.demoModeCheckbox.checked = true;
  APP_STATE.isDemoMode = true;

  closeApiKeyModal();
  showToast('API Key removed. Switched to Demo Mode.', 'info');
}

// ==========================================================================
// Voices Synchronization
// ==========================================================================

async function syncVoicesFromApi() {
  if (!APP_STATE.apiKey) {
    showToast('Add your ElevenLabs API Key to sync account voices.', 'info');
    openApiKeyModal();
    return;
  }

  DOM.refreshVoicesBtn.disabled = true;
  DOM.refreshVoicesBtn.innerHTML = `<i data-lucide="loader-2" class="spin"></i> Syncing...`;
  initIcons();

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': APP_STATE.apiKey }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.voices) && data.voices.length > 0) {
        const currentSelectedId = DOM.voiceSelect.value;
        DOM.voiceSelect.innerHTML = '';

        data.voices.forEach(voice => {
          const opt = document.createElement('option');
          opt.value = voice.voice_id;
          const category = voice.category ? ` [${voice.category}]` : '';
          const labels = voice.labels ? ` (${Object.values(voice.labels).slice(0, 2).join(', ')})` : '';
          opt.textContent = `${voice.name}${category}${labels}`;
          DOM.voiceSelect.appendChild(opt);
        });

        // Restore selection if still exists
        if ([...DOM.voiceSelect.options].some(o => o.value === currentSelectedId)) {
          DOM.voiceSelect.value = currentSelectedId;
        }

        showToast(`Synced ${data.voices.length} voices from your account!`, 'success');
        updateVoiceDescription();
      }
    } else {
      showToast('Could not fetch voices. Check your API key permissions.', 'error');
    }
  } catch (err) {
    showToast('Failed to connect to voices endpoint.', 'error');
  } finally {
    DOM.refreshVoicesBtn.disabled = false;
    DOM.refreshVoicesBtn.innerHTML = `<i data-lucide="refresh-cw"></i> Sync`;
    initIcons();
  }
}

function updateVoiceDescription() {
  const selectedText = DOM.voiceSelect.options[DOM.voiceSelect.selectedIndex]?.text || '';
  DOM.voiceDescription.textContent = `Selected Voice: ${selectedText}`;
  APP_STATE.currentVoiceName = selectedText.split('(')[0].trim();
}

// ==========================================================================
// Text Metrics & Prompt Presets
// ==========================================================================

function initTextStats() {
  DOM.textInput.addEventListener('input', updateTextMetrics);
}

function updateTextMetrics() {
  const text = DOM.textInput.value || '';
  const charLen = text.length;
  DOM.charCount.textContent = charLen.toLocaleString();

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  DOM.wordCount.textContent = words.toLocaleString();

  // Average reading speed: 150 words per minute
  const minutes = (words / 150).toFixed(1);
  DOM.readTime.textContent = words === 0 ? '0 min read' : `~${minutes} min read`;
}

// ==========================================================================
// ElevenLabs API Narration Engine
// ==========================================================================

async function handleStartNarration() {
  const text = DOM.textInput.value.trim();
  if (!text) {
    showToast('Please type or paste some text before starting narration.', 'error');
    DOM.textInput.focus();
    return;
  }

  // Check if API key is present; if not and not demo mode, prompt user
  if (!APP_STATE.apiKey && !APP_STATE.isDemoMode) {
    showToast('No API key provided. Switching to Demo Mode for local simulation.', 'info');
    DOM.demoModeCheckbox.checked = true;
    APP_STATE.isDemoMode = true;
  }

  setGeneratingState(true);
  DOM.audioStatusText.textContent = APP_STATE.isDemoMode 
    ? 'Synthesizing voice in Demo Mode...' 
    : `Synthesizing with ElevenLabs (${DOM.modelSelect.value})...`;
  DOM.playbackPulse.classList.add('active');

  try {
    let audioBlob = null;

    if (APP_STATE.isDemoMode) {
      audioBlob = await generateDemoSpeech(text);
    } else {
      audioBlob = await callElevenLabsTtsApi(text);
    }

    if (audioBlob) {
      loadAndPlayAudio(audioBlob, text);
    }
  } catch (err) {
    console.error('Narration generation error:', err);
    showToast(err.message || 'Error occurred while generating narration.', 'error');
    DOM.audioStatusText.textContent = 'Generation failed. Check console or API key.';
    DOM.playbackPulse.classList.remove('active');
  } finally {
    setGeneratingState(false);
  }
}

/**
 * Direct call to ElevenLabs Text-to-Speech API
 */
async function callElevenLabsTtsApi(text) {
  const voiceId = DOM.voiceSelect.value;
  const modelId = DOM.modelSelect.value;
  const stability = parseFloat(DOM.stabilitySlider.value);
  const similarityBoost = parseFloat(DOM.similaritySlider.value);
  const style = parseFloat(DOM.styleSlider.value);
  const useSpeakerBoost = DOM.speakerBoostCheck.checked;

  const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const requestBody = {
    text: text,
    model_id: modelId,
    voice_settings: {
      stability: stability,
      similarity_boost: similarityBoost,
      style: style,
      use_speaker_boost: useSpeakerBoost
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'xi-api-key': APP_STATE.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorDetail = 'API call failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail?.message || errJson.message || JSON.stringify(errJson);
    } catch (_) {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }

    if (response.status === 401) {
      throw new Error(`Invalid ElevenLabs API Key. Please verify your credentials.`);
    } else if (response.status === 429) {
      throw new Error(`ElevenLabs rate limit or quota exceeded. Switch to Demo Mode or upgrade plan.`);
    } else {
      throw new Error(`ElevenLabs Error: ${errorDetail}`);
    }
  }

  const blob = await response.blob();
  return blob;
}

/**
 * Procedural demo audio generation using Web Audio API buffer synthesis
 * and browser SpeechSynthesis fallback so users can test immediately.
 */
async function generateDemoSpeech(text) {
  // Try Web Speech API speech synthesis
  if ('speechSynthesis' in window) {
    // Speak using Web Speech API in parallel
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    // Pick appropriate browser voice
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const englishVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      utterance.voice = englishVoice;
    }
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  // Create an engaging synthetic harmonic speech wave audio blob (MP3/WAV)
  // so that native audio playback, canvas visualizer, seeking and download work!
  const words = text.trim().split(/\s+/).length;
  const estimatedSeconds = Math.max(3, Math.min(25, words * 0.45));
  return createProceduralHarmonicBlob(estimatedSeconds);
}

/**
 * Creates a rich multi-tonal audio WAV buffer simulating spoken frequency energy
 */
function createProceduralHarmonicBlob(durationSeconds) {
  const sampleRate = 44100;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new Float32Array(numSamples);

  // Synthesize multi-harmonic voice formants
  const baseFreq = 130; // Average fundamental pitch for narration
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Cadence rhythm envelope (speech modulation)
    const cadence = 0.5 + 0.5 * Math.sin(t * 8) * Math.sin(t * 3.5);
    // Envelope attack & release
    const env = Math.min(1, t * 4) * Math.min(1, (durationSeconds - t) * 2);

    const f1 = Math.sin(2 * Math.PI * baseFreq * t);
    const f2 = 0.5 * Math.sin(2 * Math.PI * (baseFreq * 2.1) * t);
    const f3 = 0.25 * Math.sin(2 * Math.PI * (baseFreq * 3.8) * t);
    const breath = 0.05 * (Math.random() * 2 - 1);

    buffer[i] = (f1 + f2 + f3 + breath) * cadence * env * 0.4;
  }

  return encodeWavFile(buffer, sampleRate);
}

/**
 * Helper to encode Float32Array audio into a standard RIFF/WAV Blob
 */
function encodeWavFile(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true); // 16-bit
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// ==========================================================================
// Audio Playback & Deck Controls
// ==========================================================================

function loadAndPlayAudio(blob, originalText) {
  if (APP_STATE.currentAudioUrl) {
    URL.revokeObjectURL(APP_STATE.currentAudioUrl);
  }

  APP_STATE.currentAudioBlob = blob;
  APP_STATE.currentAudioUrl = URL.createObjectURL(blob);
  DOM.nativeAudioElement.src = APP_STATE.currentAudioUrl;

  // Enable controls
  DOM.togglePlayPauseBtn.disabled = false;
  DOM.stopAudioBtn.disabled = false;
  DOM.downloadAudioBtn.disabled = false;
  DOM.audioSeekBar.disabled = false;
  DOM.canvasPlaceholderText.classList.add('hidden');

  const modelName = DOM.modelSelect.options[DOM.modelSelect.selectedIndex].text.split('(')[0].trim();
  const voiceName = DOM.voiceSelect.options[DOM.voiceSelect.selectedIndex].text.split('(')[0].trim();
  DOM.audioStatusText.textContent = `Playing: ${voiceName} via ${modelName}`;

  ensureAudioContext();

  DOM.nativeAudioElement.play().then(() => {
    setPlayingState(true);
  }).catch(err => {
    console.warn('Autoplay blocked or playback deferred:', err);
    setPlayingState(false);
  });

  // Save to history
  addToHistory({
    text: originalText,
    model: DOM.modelSelect.value,
    voice: voiceName,
    timestamp: new Date(),
    blob: blob
  });
}

function setGeneratingState(isGenerating) {
  APP_STATE.isGenerating = isGenerating;
  DOM.generateBtn.disabled = isGenerating;

  if (isGenerating) {
    DOM.btnSpinner.style.display = 'block';
    DOM.mainPlayIcon.style.display = 'none';
    DOM.generateBtnLabel.textContent = 'Synthesizing Audio...';
    DOM.generateBtnSub.textContent = 'Contacting ElevenLabs neural models';
  } else {
    DOM.btnSpinner.style.display = 'none';
    DOM.mainPlayIcon.style.display = 'block';
    DOM.generateBtnLabel.textContent = 'Start Narration';
    DOM.generateBtnSub.textContent = 'Generate & Play Speech (Ctrl + Enter)';
  }
}

function setPlayingState(isPlaying) {
  APP_STATE.isPlaying = isPlaying;
  DOM.playbackPulse.classList.toggle('active', isPlaying);

  if (isPlaying) {
    DOM.playerPlayPauseIcon.setAttribute('data-lucide', 'pause');
  } else {
    DOM.playerPlayPauseIcon.setAttribute('data-lucide', 'play');
  }
  initIcons();
}

function togglePlayPause() {
  if (!DOM.nativeAudioElement.src) return;

  ensureAudioContext();

  if (DOM.nativeAudioElement.paused) {
    DOM.nativeAudioElement.play();
    setPlayingState(true);
    DOM.audioStatusText.textContent = 'Resumed narration playback';
  } else {
    DOM.nativeAudioElement.pause();
    setPlayingState(false);
    DOM.audioStatusText.textContent = 'Narration paused';
  }
}

function stopAudio() {
  if (DOM.nativeAudioElement) {
    DOM.nativeAudioElement.pause();
    DOM.nativeAudioElement.currentTime = 0;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  setPlayingState(false);
  DOM.audioStatusText.textContent = 'Narration stopped';
  DOM.audioSeekBar.value = 0;
  DOM.seekProgressBar.style.width = '0%';
  DOM.currentTimeLabel.textContent = '0:00';
}

function downloadCurrentAudio() {
  if (!APP_STATE.currentAudioBlob) {
    showToast('No audio available to download.', 'error');
    return;
  }

  const voiceName = (APP_STATE.currentVoiceName || 'narration').toLowerCase().replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `elevenlabs_${voiceName}_${timestamp}.mp3`;

  const link = document.createElement('a');
  link.href = APP_STATE.currentAudioUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Downloading ${filename}`, 'success');
}

// ==========================================================================
// Web Audio API Visualizer
// ==========================================================================

function ensureAudioContext() {
  if (!APP_STATE.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    APP_STATE.audioContext = new AudioCtx();
    APP_STATE.analyserNode = APP_STATE.audioContext.createAnalyser();
    APP_STATE.analyserNode.fftSize = 256;
    APP_STATE.analyserNode.smoothingTimeConstant = 0.8;

    try {
      APP_STATE.audioSourceNode = APP_STATE.audioContext.createMediaElementSource(DOM.nativeAudioElement);
      APP_STATE.audioSourceNode.connect(APP_STATE.analyserNode);
      APP_STATE.analyserNode.connect(APP_STATE.audioContext.destination);
    } catch (e) {
      console.warn('MediaElementSource already connected or cross-origin:', e);
    }
  }

  if (APP_STATE.audioContext.state === 'suspended') {
    APP_STATE.audioContext.resume();
  }
}

function initCanvasVisualizer() {
  const canvas = DOM.waveformCanvas;
  const ctx = canvas.getContext('2d');

  function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth * window.devicePixelRatio || 800;
    canvas.height = canvas.parentElement.clientHeight * window.devicePixelRatio || 110;
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  let phase = 0;

  function renderFrame() {
    APP_STATE.animationFrameId = requestAnimationFrame(renderFrame);

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (APP_STATE.analyserNode && APP_STATE.isPlaying && !DOM.nativeAudioElement.paused) {
      // Real-time audio frequency visualizer
      const bufferLength = APP_STATE.analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      APP_STATE.analyserNode.getByteFrequencyData(dataArray);

      const barCount = 48;
      const step = Math.floor(bufferLength / barCount);
      const barWidth = (width / barCount) * 0.65;
      const gap = (width / barCount) * 0.35;

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] / 255;
        const barHeight = Math.max(4, val * (height * 0.82));
        const x = i * (barWidth + gap) + gap / 2;
        const y = (height - barHeight) / 2;

        // Dynamic neon gradient
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(0.5, '#6366f1');
        gradient.addColorStop(1, '#d946ef');

        ctx.fillStyle = gradient;
        ctx.shadowColor = 'rgba(99, 102, 241, 0.4)';
        ctx.shadowBlur = 8;

        // Rounded bar
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else {
      // Idle ambient breathing sine wave
      phase += 0.035;
      ctx.beginPath();
      ctx.lineWidth = 2.5;

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.45)');
      gradient.addColorStop(1, 'rgba(168, 85, 247, 0.2)');

      ctx.strokeStyle = gradient;
      const centerY = height / 2;

      for (let x = 0; x < width; x += 4) {
        const y = centerY + Math.sin(x * 0.015 + phase) * 8 * Math.sin(x / width * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  renderFrame();
}

// ==========================================================================
// History Management
// ==========================================================================

function addToHistory(item) {
  APP_STATE.history.unshift(item);
  if (APP_STATE.history.length > 15) {
    APP_STATE.history.pop();
  }
  renderHistoryList();
}

function renderHistoryList() {
  if (APP_STATE.history.length === 0) {
    DOM.historyEmptyState.style.display = 'flex';
    DOM.historyList.querySelectorAll('.history-item').forEach(el => el.remove());
    return;
  }

  DOM.historyEmptyState.style.display = 'none';
  DOM.historyList.querySelectorAll('.history-item').forEach(el => el.remove());

  APP_STATE.history.forEach((entry, idx) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'history-item';

    const snippet = entry.text.length > 40 ? entry.text.substring(0, 40) + '...' : entry.text;
    const timeStr = entry.timestamp instanceof Date 
      ? entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'Recent';

    itemEl.innerHTML = `
      <div class="history-info">
        <span class="history-text" title="${entry.text.replace(/"/g, '&quot;')}">${snippet}</span>
        <div class="history-meta">
          <span>${entry.voice}</span>
          <span>•</span>
          <span>${entry.model}</span>
          <span>•</span>
          <span>${timeStr}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="history-action-btn play-hist-btn" title="Replay" data-idx="${idx}">
          <i data-lucide="play"></i>
        </button>
        <button class="history-action-btn dl-hist-btn" title="Download" data-idx="${idx}">
          <i data-lucide="download"></i>
        </button>
        <button class="history-action-btn del-hist-btn" title="Delete" data-idx="${idx}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    DOM.historyList.appendChild(itemEl);
  });

  // Attach history action listeners
  DOM.historyList.querySelectorAll('.play-hist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const entry = APP_STATE.history[idx];
      if (entry && entry.blob) {
        DOM.textInput.value = entry.text;
        updateTextMetrics();
        loadAndPlayAudio(entry.blob, entry.text);
      }
    });
  });

  DOM.historyList.querySelectorAll('.dl-hist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const entry = APP_STATE.history[idx];
      if (entry && entry.blob) {
        const url = URL.createObjectURL(entry.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `elevenlabs_${entry.voice.toLowerCase()}_narration.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    });
  });

  DOM.historyList.querySelectorAll('.del-hist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      APP_STATE.history.splice(idx, 1);
      renderHistoryList();
    });
  });

  initIcons();
}

function loadSavedHistory() {
  renderHistoryList();
}

// ==========================================================================
// Toast Notifications
// ==========================================================================

function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  if (type === 'error') iconName = 'alert-triangle';

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <span>${message}</span>
  `;

  DOM.toastContainer.appendChild(toast);
  initIcons();

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, duration);
}

// ==========================================================================
// Event Listeners & Interactions
// ==========================================================================

function initEventListeners() {
  // Model Select changes
  DOM.modelSelect.addEventListener('change', () => {
    const model = DOM.modelSelect.value;
    APP_STATE.currentModelId = model;
    DOM.modelDescription.textContent = MODEL_DESCRIPTIONS[model] || 'ElevenLabs Neural Speech Model.';
  });

  // Voice Select changes
  DOM.voiceSelect.addEventListener('change', updateVoiceDescription);

  // Sync Voices
  DOM.refreshVoicesBtn.addEventListener('click', syncVoicesFromApi);

  // Quick Prompt Chips
  DOM.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sampleKey = chip.dataset.sample;
      if (SAMPLE_PROMPTS[sampleKey]) {
        DOM.textInput.value = SAMPLE_PROMPTS[sampleKey];
        updateTextMetrics();
        showToast(`Loaded ${chip.textContent} script preset.`, 'info', 2000);
      }
    });
  });

  // Clear Text
  DOM.clearTextBtn.addEventListener('click', () => {
    DOM.textInput.value = '';
    updateTextMetrics();
    DOM.textInput.focus();
  });

  // Keyboard shortcut Ctrl+Enter / Cmd+Enter
  DOM.textInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleStartNarration();
    }
  });

  // Generate button
  DOM.generateBtn.addEventListener('click', handleStartNarration);

  // Stop button
  DOM.stopAudioBtn.addEventListener('click', stopAudio);

  // Demo Mode Switch
  DOM.demoModeCheckbox.addEventListener('change', () => {
    APP_STATE.isDemoMode = DOM.demoModeCheckbox.checked;
    if (APP_STATE.isDemoMode) {
      showToast('Demo Mode enabled (browser simulated narration).', 'info');
    } else {
      if (!APP_STATE.apiKey) {
        showToast('Please configure your ElevenLabs API key for live mode.', 'warning');
        openApiKeyModal();
      } else {
        showToast('Live ElevenLabs API Mode active.', 'success');
      }
    }
  });

  // Audio Playback Events
  DOM.togglePlayPauseBtn.addEventListener('click', togglePlayPause);
  DOM.downloadAudioBtn.addEventListener('click', downloadCurrentAudio);

  DOM.nativeAudioElement.addEventListener('timeupdate', () => {
    const cur = DOM.nativeAudioElement.currentTime || 0;
    const dur = DOM.nativeAudioElement.duration || 0;
    
    DOM.currentTimeLabel.textContent = formatTime(cur);
    if (dur > 0) {
      const pct = (cur / dur) * 100;
      DOM.audioSeekBar.value = pct;
      DOM.seekProgressBar.style.width = `${pct}%`;
    }
  });

  DOM.nativeAudioElement.addEventListener('loadedmetadata', () => {
    DOM.totalDurationLabel.textContent = formatTime(DOM.nativeAudioElement.duration || 0);
  });

  DOM.nativeAudioElement.addEventListener('ended', () => {
    setPlayingState(false);
    DOM.audioStatusText.textContent = 'Narration completed';
    DOM.seekProgressBar.style.width = '100%';
    DOM.audioSeekBar.value = 100;
  });

  DOM.audioSeekBar.addEventListener('input', (e) => {
    const dur = DOM.nativeAudioElement.duration || 0;
    if (dur > 0) {
      const targetTime = (e.target.value / 100) * dur;
      DOM.nativeAudioElement.currentTime = targetTime;
      DOM.seekProgressBar.style.width = `${e.target.value}%`;
    }
  });

  // Volume & Mute
  DOM.volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    DOM.nativeAudioElement.volume = val;
    DOM.nativeAudioElement.muted = (val === 0);
    updateVolumeIcon(val);
  });

  DOM.muteBtn.addEventListener('click', () => {
    DOM.nativeAudioElement.muted = !DOM.nativeAudioElement.muted;
    if (DOM.nativeAudioElement.muted) {
      DOM.volumeIcon.setAttribute('data-lucide', 'volume-x');
    } else {
      updateVolumeIcon(DOM.nativeAudioElement.volume);
    }
    initIcons();
  });

  // Sliders
  DOM.stabilitySlider.addEventListener('input', (e) => {
    DOM.stabilityVal.textContent = parseFloat(e.target.value).toFixed(2);
  });

  DOM.similaritySlider.addEventListener('input', (e) => {
    DOM.similarityVal.textContent = parseFloat(e.target.value).toFixed(2);
  });

  DOM.styleSlider.addEventListener('input', (e) => {
    DOM.styleVal.textContent = parseFloat(e.target.value).toFixed(2);
  });

  DOM.resetSettingsBtn.addEventListener('click', () => {
    DOM.stabilitySlider.value = 0.50;
    DOM.stabilityVal.textContent = '0.50';
    DOM.similaritySlider.value = 0.75;
    DOM.similarityVal.textContent = '0.75';
    DOM.styleSlider.value = 0.00;
    DOM.styleVal.textContent = '0.00';
    DOM.speakerBoostCheck.checked = true;
    showToast('Voice parameters reset to ElevenLabs defaults.', 'info', 2000);
  });

  // Clear History
  DOM.clearHistoryBtn.addEventListener('click', () => {
    APP_STATE.history = [];
    renderHistoryList();
    showToast('Narration history cleared.', 'info', 2000);
  });

  // API Key Modal interactions
  DOM.apiKeyToggleBtn.addEventListener('click', openApiKeyModal);
  DOM.closeModalBtn.addEventListener('click', closeApiKeyModal);
  DOM.toggleKeyVisibilityBtn.addEventListener('click', toggleKeyVisibility);
  DOM.testApiKeyBtn.addEventListener('click', () => verifyApiKey());
  DOM.saveApiKeyBtn.addEventListener('click', saveApiKey);
  DOM.removeKeyBtn.addEventListener('click', removeApiKey);

  // Close modal when clicking backdrop
  DOM.apiKeyModal.addEventListener('click', (e) => {
    if (e.target === DOM.apiKeyModal) closeApiKeyModal();
  });
}

function updateVolumeIcon(vol) {
  if (vol === 0) {
    DOM.volumeIcon.setAttribute('data-lucide', 'volume-x');
  } else if (vol < 0.5) {
    DOM.volumeIcon.setAttribute('data-lucide', 'volume-1');
  } else {
    DOM.volumeIcon.setAttribute('data-lucide', 'volume-2');
  }
  initIcons();
}

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === Infinity) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
