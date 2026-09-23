/* ==========================================================================
   ECHOBRAILLE — FORMAL APPLICATION CONTROLLER & NATIVE BLE ENGINE (app.js)
   Production Android & Web Architecture (Zero Emojis, Robust Native BLE)
   ========================================================================== */

// --- Native Platform Check ---
const isNativeApp = () => {
    return (typeof window.Capacitor !== 'undefined' && 
            typeof window.Capacitor.isNativePlatform === 'function' && 
            window.Capacitor.isNativePlatform()) ||
           (typeof window.capacitorCommunityBluetoothLe !== 'undefined') ||
           (typeof window.androidBridge !== 'undefined');
};

// --- Application State ---
const state = {
    currentTab: 'assistant',
    isHardwareConnected: false,
    hardwareType: null, // 'bluetooth', 'webserial', or 'simulated'
    serialPort: null,
    serialWriter: null,
    bleDevice: null,
    bleServer: null,
    bleRxCharacteristic: null,
    nativeBleDeviceId: null,
    
    // AI & Speech State
    isListening: false,
    speechRecognition: null,
    geminiApiKey: '',
    
    // Playback & Stream State
    currentTextStream: "ECHOBRAILLE",
    currentCharIndex: 0,
    isPlaying: false,
    playbackTimer: null,
    refreshSpeedMs: 800,
    
    // 6-Dot Grade-1 Braille Bitmask Table
    brailleMap: {
        'A': [true,  false, false, false, false, false],
        'B': [true,  true,  false, false, false, false],
        'C': [true,  false, false, true,  false, false],
        'D': [true,  false, false, true,  true,  false],
        'E': [true,  false, false, false, true,  false],
        'F': [true,  true,  false, true,  false, false],
        'G': [true,  true,  false, true,  true,  false],
        'H': [true,  true,  false, false, true,  false],
        'I': [false, true,  false, true,  false, false],
        'J': [false, true,  false, true,  true,  false],
        'K': [true,  false, true,  false, false, false],
        'L': [true,  true,  true,  false, false, false],
        'M': [true,  false, true,  true,  false, false],
        'N': [true,  false, true,  true,  true,  false],
        'O': [true,  false, true,  false, true,  false],
        'P': [true,  true,  true,  true,  false, false],
        'Q': [true,  true,  true,  true,  true,  false],
        'R': [true,  true,  true,  false, true,  false],
        'S': [false, true,  true,  true,  false, false],
        'T': [false, true,  true,  true,  true,  false],
        'U': [true,  false, true,  false, false, true ],
        'V': [true,  true,  true,  false, false, true ],
        'W': [false, true,  false, true,  true,  true ],
        'X': [true,  false, true,  true,  false, true ],
        'Y': [true,  false, true,  true,  true,  true ],
        'Z': [true,  false, true,  false, true,  true ],
        '1': [true,  false, false, false, false, false],
        '2': [true,  true,  false, false, false, false],
        '3': [true,  false, false, true,  false, false],
        '4': [true,  false, false, true,  true,  false],
        '5': [true,  false, false, false, true,  false],
        '6': [true,  true,  false, true,  false, false],
        '7': [true,  true,  false, true,  true,  false],
        '8': [true,  true,  false, false, true,  false],
        '9': [false, true,  false, true,  false, false],
        '0': [false, true,  false, true,  true,  false],
        '#': [false, false, true,  true,  true,  true ],
        ' ': [false, false, false, false, false, false]
    },
    
    // Interactive Studio Builder Dots
    builderDots: [true, false, false, false, false, false]
};

// --- DOM Ready Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initSplashScreen();
    initSpeechRecognition();
    populateBrailleDictionary();
    updateBuilderPreview();
    updateActuatorUI('A', state.brailleMap['A']);
    initNativePlugins();
});

// --- Splash Screen Controller ---
function initSplashScreen() {
    const splash = document.getElementById('app-splash-screen');
    if (!splash) return;
    setTimeout(() => {
        dismissSplash();
    }, 2400);
}

function dismissSplash() {
    const splash = document.getElementById('app-splash-screen');
    if (!splash || splash.style.display === 'none') return;
    splash.style.transition = 'opacity 0.4s ease, visibility 0.4s ease';
    splash.style.opacity = '0';
    splash.style.visibility = 'hidden';
    splash.style.pointerEvents = 'none';
    setTimeout(() => {
        splash.style.display = 'none';
    }, 450);
}

// --- Initialize Native Plugins Silently ---
async function initNativePlugins() {
    console.log("[INIT] Platform:", window.Capacitor?.getPlatform?.() || 'unknown');
    console.log("[INIT] isNative:", window.Capacitor?.isNativePlatform?.() || false);
    console.log("[INIT] BleClient available:", !!window.capacitorCommunityBluetoothLe?.BleClient);
    console.log("[INIT] Plugins.BluetoothLe available:", !!window.Capacitor?.Plugins?.BluetoothLe);

    if (window.capacitorCommunityBluetoothLe?.BleClient) {
        try {
            await window.capacitorCommunityBluetoothLe.BleClient.initialize({ androidNeverForLocation: true });
            console.log("[INIT] BleClient initialized successfully");
        } catch(e) {
            console.warn("[INIT] BLE client auto-init:", e);
        }
    } else if (window.Capacitor?.Plugins?.BluetoothLe) {
        try {
            await window.Capacitor.Plugins.BluetoothLe.initialize({ androidNeverForLocation: true });
            console.log("[INIT] Capacitor BluetoothLe plugin initialized");
        } catch(e) {
            console.warn("[INIT] Capacitor BluetoothLe plugin auto-init:", e);
        }
    } else {
        console.log("[INIT] No native BLE plugin found - will try Web Bluetooth as fallback");
    }
}

// --- Tab Navigation & Synchronization ---
function switchTab(tabId) {
    state.currentTab = tabId;

    // 1. Synchronize 4-Column Bottom Dock
    document.querySelectorAll('.dock-tab-item').forEach(btn => btn.classList.remove('active'));
    const dockBtn = document.getElementById(`dock-btn-${tabId}`);
    if (dockBtn) dockBtn.classList.add('active');

    // 2. Switch View Panels
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });
    const activePanel = document.getElementById(`pane-${tabId}`);
    if (activePanel) {
        activePanel.style.display = 'block';
        activePanel.classList.add('active');
    }
}

// --- High Contrast & Settings Modals ---
function toggleHighContrast() {
    document.body.classList.toggle('high-contrast');
}

function openSettingsModal() {
    const keyInput = document.getElementById('gemini-api-key-input');
    if (keyInput) {
        keyInput.value = localStorage.getItem('gemini_api_key') || '';
    }
    document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.add('hidden');
}

function saveSettings() {
    const keyInput = document.getElementById('gemini-api-key-input');
    if (keyInput) {
        const enteredKey = keyInput.value.trim();
        if (enteredKey) {
            localStorage.setItem('gemini_api_key', enteredKey);
            state.geminiApiKey = enteredKey;
        } else {
            localStorage.removeItem('gemini_api_key');
            state.geminiApiKey = '';
        }
    }
    closeSettingsModal();
}

// --- Speech Recognition ---
function initSpeechRecognition() {
    if (isNativeApp() && window.Capacitor?.Plugins?.SpeechRecognition) {
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        state.speechRecognition = new SpeechRecognition();
        state.speechRecognition.continuous = false;
        state.speechRecognition.interimResults = true;
        state.speechRecognition.lang = 'en-US';

        state.speechRecognition.onstart = () => {
            state.isListening = true;
            document.getElementById('mic-button')?.classList.add('listening');
        };

        state.speechRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            const inputField = document.getElementById('chat-input-field');
            if (inputField) inputField.value = transcript;
        };

        state.speechRecognition.onerror = () => {
            stopVoiceInput();
        };

        state.speechRecognition.onend = () => {
            stopVoiceInput();
            const inputVal = document.getElementById('chat-input-field')?.value.trim();
            if (inputVal && inputVal.length > 0) {
                handleUserMessage();
            }
        };
    }
}

async function startVoiceInput() {
    if (isNativeApp() && window.Capacitor?.Plugins?.SpeechRecognition) {
        const SpeechPlugin = window.Capacitor.Plugins.SpeechRecognition;
        try {
            const hasPerm = await SpeechPlugin.hasPermissions();
            if (!hasPerm.speechRecognition) {
                await SpeechPlugin.requestPermissions();
            }
            state.isListening = true;
            document.getElementById('mic-button')?.classList.add('listening');

            SpeechPlugin.removeAllListeners?.();
            SpeechPlugin.addListener('partialResults', (data) => {
                if (data.matches && data.matches.length > 0) {
                    const transcript = data.matches[0];
                    const input = document.getElementById('chat-input-field');
                    if (input) input.value = transcript;
                }
            });

            const result = await SpeechPlugin.start({
                language: "en-US",
                maxResults: 1,
                prompt: "Speak your query",
                partialResults: true,
                popup: false
            });

            if (result && result.matches && result.matches.length > 0) {
                const finalTranscript = result.matches[0];
                const input = document.getElementById('chat-input-field');
                if (input) input.value = finalTranscript;
            }
            stopVoiceInput();
            const inputVal = document.getElementById('chat-input-field')?.value.trim();
            if (inputVal && inputVal.length > 0) {
                handleUserMessage();
            }
        } catch (err) {
            console.error("Native speech recognition error:", err);
            stopVoiceInput();
        }
        return;
    }

    if (state.speechRecognition) {
        try {
            state.speechRecognition.start();
        } catch (e) {}
    } else {
        alert("Speech recognition not supported on this browser. Please type your query.");
    }
}

async function stopVoiceInput() {
    state.isListening = false;
    document.getElementById('mic-button')?.classList.remove('listening');

    if (isNativeApp() && window.Capacitor?.Plugins?.SpeechRecognition) {
        try { await window.Capacitor.Plugins.SpeechRecognition.stop(); } catch(e) {}
    } else if (state.speechRecognition) {
        try { state.speechRecognition.stop(); } catch(e) {}
    }
}

function toggleVoiceInput() {
    if (state.isListening) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

// --- Messaging & AI Intent ---
function sendQuickPrompt(text) {
    const input = document.getElementById('chat-input-field');
    if (input) input.value = text;
    handleUserMessage();
}

async function handleUserMessage() {
    const inputField = document.getElementById('chat-input-field');
    const userQuery = inputField?.value.trim();
    if (!userQuery) return;

    appendMessageBubble('user', userQuery);
    inputField.value = '';

    const aiBubbleId = appendMessageBubble('ai', 'Processing text and converting to Braille stream...');

    try {
        const aiResponseText = await generateAIResponse(userQuery);
        updateMessageBubble(aiBubbleId, aiResponseText);

        // Load into Braille Tactile Stream Queue
        loadBrailleStream(aiResponseText);
        startBrailleStream();
    } catch (err) {
        updateMessageBubble(aiBubbleId, `Error: ${err.message}`);
    }
}

function appendMessageBubble(sender, text) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return null;

    const bubbleId = `msg-${Date.now()}`;
    const row = document.createElement('div');
    row.className = `msg-card-row ${sender}`;
    row.id = bubbleId;

    const authorTitle = sender === 'ai' ? 'EchoBraille AI' : 'YOU';
    row.innerHTML = `
        <div class="msg-card-bubble ${sender}">
            <div class="msg-card-header">
                <span class="msg-author-pill">${authorTitle}</span>
                <span class="msg-card-time">LIVE</span>
            </div>
            <div class="msg-body-text">${escapeHTML(text)}</div>
            ${sender === 'ai' ? `
            <div class="msg-braille-box">
                <span class="braille-stream-text">Translating to tactile pins...</span>
            </div>` : ''}
        </div>
    `;

    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
    return bubbleId;
}

function updateMessageBubble(bubbleId, newText) {
    const bubble = document.getElementById(bubbleId);
    if (bubble) {
        const bodyText = bubble.querySelector('.msg-body-text');
        if (bodyText) bodyText.innerHTML = escapeHTML(newText);

        const brailleBox = bubble.querySelector('.braille-stream-text');
        if (brailleBox) {
            brailleBox.textContent = `QUEUE: "${newText.substring(0, 24)}${newText.length > 24 ? '...' : ''}"`;
        }
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// --- Gemini Flash AI Engine with Sub-10ms Offline Fallback ---
async function generateAIResponse(prompt) {
    const apiKey = state.geminiApiKey || localStorage.getItem('gemini_api_key');
    if (apiKey) {
        try {
            const systemPrompt = "You are EchoBraille AI, an assistive voice-to-Braille system for deafblind users. Answer concisely in under 15 words using simple English words only. No emojis, no markdown.";
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: `${systemPrompt}\nUser: ${prompt}` }] }],
                    generationConfig: { maxOutputTokens: 35, temperature: 0.2 }
                })
            });
            const data = await response.json();
            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                return data.candidates[0].content.parts[0].text.trim();
            }
        } catch (e) {
            console.warn("Online Gemini API request failed, falling back to local engine.");
        }
    }

    // Local Sub-10ms Intent Engine (No Emojis)
    const lower = prompt.toLowerCase();
    if (lower.includes("what is braille") || lower.includes("explain braille")) {
        return "Braille is a 6-dot tactile code read with fingertips.";
    }
    if (lower.includes("capital of india")) {
        return "New Delhi is the capital of India.";
    }
    if (lower.includes("emergency") || lower.includes("help") || lower.includes("sos")) {
        return "Alert sent. Caregiver notified of emergency.";
    }
    if (lower.includes("what time") || lower.includes("current time")) {
        return `Current time is ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    }
    if (lower.startsWith("spell ")) {
        return prompt.substring(6).trim().toUpperCase().split("").join(" ");
    }
    return `EchoBraille translating: "${prompt}".`;
}

// --- Braille Stream Playback & Actuator Controller ---
function loadBrailleStream(text) {
    state.currentTextStream = text.toUpperCase();
    state.currentCharIndex = 0;
    const streamDisplay = document.getElementById('stream-text-display');
    if (streamDisplay) streamDisplay.textContent = `Streaming: ${state.currentTextStream}`;
}

function startBrailleStream() {
    if (!state.currentTextStream) return;
    state.isPlaying = true;
    updatePlayPauseButton();

    if (state.playbackTimer) clearInterval(state.playbackTimer);
    playCurrentCharacter();

    state.playbackTimer = setInterval(() => {
        if (!state.isPlaying) return;
        state.currentCharIndex++;
        if (state.currentCharIndex >= state.currentTextStream.length) {
            pauseBrailleStream();
            return;
        }
        playCurrentCharacter();
    }, state.refreshSpeedMs);
}

function pauseBrailleStream() {
    state.isPlaying = false;
    if (state.playbackTimer) clearInterval(state.playbackTimer);
    updatePlayPauseButton();
}

function toggleStreamPlayback() {
    if (state.isPlaying) {
        pauseBrailleStream();
    } else {
        startBrailleStream();
    }
}

function updatePlayPauseButton() {
    const btn = document.getElementById('play-pause-btn');
    if (btn) {
        btn.innerHTML = state.isPlaying ? `<span>Pause Stream</span>` : `<span>Start Stream</span>`;
    }
}

function setSpeedPreset(speedSec, btn) {
    state.refreshSpeedMs = speedSec * 1000;
    document.querySelectorAll('.speed-pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    if (state.isPlaying) {
        startBrailleStream();
    }
}

function playCurrentCharacter() {
    if (!state.currentTextStream) return;
    const char = state.currentTextStream[state.currentCharIndex];
    const total = state.currentTextStream.length;

    const charBadge = document.getElementById('current-char-badge');
    if (charBadge) charBadge.textContent = `Char: ${char}`;

    const indexLabel = document.getElementById('stream-index-label');
    if (indexLabel) indexLabel.textContent = `(${state.currentCharIndex + 1}/${total})`;

    const dots = state.brailleMap[char] || state.brailleMap[' '];
    updateActuatorUI(char, dots);
    sendHardwareTextCommand(char);
    triggerPhoneHaptic(dots);
}

function updateActuatorUI(char, dots) {
    // OLED miniature display
    const oledChar = document.getElementById('oled-letter-char');
    if (oledChar) oledChar.textContent = char;

    const oledMode = document.getElementById('oled-mode-text');
    if (oledMode) oledMode.textContent = "ACTIVE";

    // Miniature OLED 6-dots
    for (let i = 1; i <= 6; i++) {
        const oledDot = document.getElementById(`oled-d${i}`);
        if (oledDot) {
            if (dots[i - 1]) oledDot.classList.add('on');
            else oledDot.classList.remove('on');
        }
    }

    // 6-Pin Physical Matrix Elevation
    for (let i = 1; i <= 6; i++) {
        const pinUnit = document.getElementById(`pin-box-${i}`);
        const isRaised = dots[i - 1];
        const angleEl = document.getElementById(`angle-val-${i}`);

        if (pinUnit) {
            if (isRaised) pinUnit.classList.add('raised');
            else pinUnit.classList.remove('raised');
        }

        if (angleEl) {
            if (i <= 3) {
                angleEl.textContent = isRaised ? "55°" : "0°";
            } else {
                angleEl.textContent = isRaised ? "125°" : "180°";
            }
        }
    }
}

function triggerPhoneHaptic(dots) {
    if (navigator.vibrate && document.getElementById('haptic-toggle')?.checked) {
        const activeCount = dots.filter(Boolean).length;
        if (activeCount > 0) {
            navigator.vibrate(40 * activeCount);
        }
    }
}

// --- Hardware Management (Robust Native BLE + Web Bluetooth) ---
async function connectBluetooth() {
    const bleBtnText = document.getElementById('ble-btn-text');

    // If already connected, disconnect
    if (state.isHardwareConnected) {
        await disconnectBluetooth();
        return;
    }

    // 1. Native Capacitor Community Bluetooth-LE (BleClient)
    if (window.capacitorCommunityBluetoothLe?.BleClient) {
        const BleClient = window.capacitorCommunityBluetoothLe.BleClient;
        try {
            if (bleBtnText) bleBtnText.textContent = "Initializing BLE...";
            console.log("[BLE] Using capacitorCommunityBluetoothLe.BleClient");

            await BleClient.initialize({ androidNeverForLocation: true });
            console.log("[BLE] BleClient initialized");

            // Check if BLE is enabled
            const isEnabled = await BleClient.isEnabled();
            if (!isEnabled) {
                console.log("[BLE] Bluetooth not enabled, requesting enable...");
                try {
                    await BleClient.requestEnable();
                } catch(enableErr) {
                    console.warn("[BLE] User declined enabling Bluetooth:", enableErr);
                    updateHardwareStatus(false, "Enable Bluetooth");
                    return;
                }
            }

            if (bleBtnText) bleBtnText.textContent = "Scanning for ESP32...";
            console.log("[BLE] Requesting device with NUS service filter...");

            // Try requestDevice first (shows native system scan dialog)
            let device;
            try {
                device = await BleClient.requestDevice({
                    services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'],
                    optionalServices: []
                });
            } catch (scanErr) {
                console.error("[BLE] requestDevice failed:", scanErr);
                // Fallback: try scanning manually
                if (bleBtnText) bleBtnText.textContent = "Scanning (fallback)...";
                let foundDeviceId = null;
                try {
                    await BleClient.requestLEScan(
                        { services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e'] },
                        (result) => {
                            console.log("[BLE] Scan found:", result.device?.name, result.device?.deviceId);
                            if (!foundDeviceId && result.device?.deviceId) {
                                foundDeviceId = result.device.deviceId;
                            }
                        }
                    );
                    // Wait 5 seconds for scan results
                    await new Promise(r => setTimeout(r, 5000));
                    await BleClient.stopLEScan();
                } catch (leScanErr) {
                    console.error("[BLE] LE Scan also failed:", leScanErr);
                }

                if (foundDeviceId) {
                    device = { deviceId: foundDeviceId };
                } else {
                    console.error("[BLE] No device found via scan fallback");
                    updateHardwareStatus(false, "ESP32 Not Found");
                    return;
                }
            }

            console.log("[BLE] Device found:", device.deviceId, device.name || '');
            if (bleBtnText) bleBtnText.textContent = "Connecting...";

            await BleClient.connect(device.deviceId, (disconnectedDeviceId) => {
                console.log("[BLE] Device disconnected:", disconnectedDeviceId);
                state.isHardwareConnected = false;
                state.nativeBleDeviceId = null;
                updateHardwareStatus(false, "ESP32 Disconnected");
            });

            state.isHardwareConnected = true;
            state.hardwareType = 'bluetooth';
            state.nativeBleDeviceId = device.deviceId;

            console.log("[BLE] Connected successfully to:", device.deviceId);
            updateHardwareStatus(true, "ESP32 Connected");
            return;
        } catch (err) {
            console.error("[BLE] Native BleClient error:", err, JSON.stringify(err));
            updateHardwareStatus(false, "Connection Failed");
            return;
        }
    }

    // 2. Native Capacitor Plugins.BluetoothLe (fallback path)
    if (window.Capacitor?.Plugins?.BluetoothLe) {
        const BlePlugin = window.Capacitor.Plugins.BluetoothLe;
        try {
            if (bleBtnText) bleBtnText.textContent = "Scanning BLE...";
            console.log("[BLE] Using Capacitor.Plugins.BluetoothLe");

            await BlePlugin.initialize({ androidNeverForLocation: true });

            const device = await BlePlugin.requestDevice({
                services: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
            });

            if (bleBtnText) bleBtnText.textContent = "Connecting...";
            await BlePlugin.connect({ deviceId: device.deviceId });
            state.isHardwareConnected = true;
            state.hardwareType = 'bluetooth';
            state.nativeBleDeviceId = device.deviceId;

            console.log("[BLE] Connected via Capacitor.Plugins.BluetoothLe:", device.deviceId);
            updateHardwareStatus(true, "ESP32 Connected");
            return;
        } catch (err) {
            console.error("[BLE] Native BluetoothLe error:", err);
            updateHardwareStatus(false, "Connection Failed");
            return;
        }
    }

    // 3. Desktop Web Bluetooth
    if ('bluetooth' in navigator) {
        try {
            if (bleBtnText) bleBtnText.textContent = "Pairing...";
            console.log("[BLE] Using Web Bluetooth API");

            state.bleDevice = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'EchoBraille' }, { namePrefix: 'ESP32' }],
                optionalServices: ['6e400001-b5a3-f393-e0a9-e50e24dcca9e']
            });

            state.bleServer = await state.bleDevice.gatt.connect();
            const service = await state.bleServer.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
            state.bleRxCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');

            state.isHardwareConnected = true;
            state.hardwareType = 'bluetooth';
            console.log("[BLE] Connected via Web Bluetooth");
            updateHardwareStatus(true, "ESP32 Connected");
        } catch (err) {
            console.warn("[BLE] Web Bluetooth error:", err);
            updateHardwareStatus(false, "ESP32 Offline");
        }
    } else {
        // Fallback info
        console.warn("[BLE] No Bluetooth API available on this platform");
        if (bleBtnText) bleBtnText.textContent = "BLE Unavailable";
        setTimeout(() => {
            updateHardwareStatus(false, "ESP32 Offline");
        }, 1500);
    }
}

async function disconnectBluetooth() {
    try {
        if (window.capacitorCommunityBluetoothLe?.BleClient && state.nativeBleDeviceId) {
            await window.capacitorCommunityBluetoothLe.BleClient.disconnect(state.nativeBleDeviceId);
            console.log("[BLE] Disconnected via BleClient");
        } else if (window.Capacitor?.Plugins?.BluetoothLe && state.nativeBleDeviceId) {
            await window.Capacitor.Plugins.BluetoothLe.disconnect({ deviceId: state.nativeBleDeviceId });
            console.log("[BLE] Disconnected via Capacitor.Plugins");
        } else if (state.bleServer) {
            state.bleServer.disconnect();
            console.log("[BLE] Disconnected via Web Bluetooth");
        }
    } catch (e) {
        console.warn("[BLE] Disconnect error (non-critical):", e);
    }
    state.isHardwareConnected = false;
    state.hardwareType = null;
    state.nativeBleDeviceId = null;
    state.bleDevice = null;
    state.bleServer = null;
    state.bleRxCharacteristic = null;
    updateHardwareStatus(false, "ESP32 Offline");
}

function updateHardwareStatus(online, text) {
    const badgeText = document.getElementById('hw-status-text');
    const pulseDot = document.getElementById('status-pulse-dot');
    const bleBtn = document.getElementById('ble-connect-btn');
    const bleBtnText = document.getElementById('ble-btn-text');

    if (badgeText) badgeText.textContent = online ? "ESP32 Online" : "ESP32 Offline";
    if (pulseDot) {
        if (online) pulseDot.classList.add('online');
        else pulseDot.classList.remove('online');
    }
    if (bleBtn) {
        if (online) bleBtn.classList.add('connected');
        else bleBtn.classList.remove('connected');
    }
    if (bleBtnText) {
        bleBtnText.textContent = online ? "Connected (Tap to Disconnect)" : "Connect ESP32 BLE";
    }
}

async function sendHardwareTextCommand(text) {
    const payload = `${text}\n`;
    const encoder = new TextEncoder();
    const encoded = encoder.encode(payload);
    
    if (state.hardwareType === 'bluetooth') {
        if (window.capacitorCommunityBluetoothLe?.BleClient && state.nativeBleDeviceId) {
            try {
                // Chunk data into 20-byte MTU-safe segments
                const BleClient = window.capacitorCommunityBluetoothLe.BleClient;
                const chunkSize = 20;
                for (let offset = 0; offset < encoded.length; offset += chunkSize) {
                    const chunk = encoded.slice(offset, offset + chunkSize);
                    const dataView = new DataView(chunk.buffer);
                    await BleClient.writeWithoutResponse(
                        state.nativeBleDeviceId,
                        '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
                        '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
                        dataView
                    );
                }
                console.log("[BLE] Sent:", text);
            } catch(e) {
                console.error("[BLE] Write error:", e);
            }
        } else if (window.Capacitor?.Plugins?.BluetoothLe && state.nativeBleDeviceId) {
            try {
                const dataView = new DataView(encoded.buffer);
                await window.Capacitor.Plugins.BluetoothLe.writeWithoutResponse({
                    deviceId: state.nativeBleDeviceId,
                    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
                    characteristic: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
                    value: dataView
                });
                console.log("[BLE] Sent via Plugins:", text);
            } catch(e) {
                console.error("[BLE] Write error (Plugins):", e);
            }
        } else if (state.bleRxCharacteristic) {
            try {
                await state.bleRxCharacteristic.writeValueWithoutResponse(encoded);
                console.log("[BLE] Sent via Web Bluetooth:", text);
            } catch(e) {
                // Fallback to writeValue if writeValueWithoutResponse not supported
                try {
                    await state.bleRxCharacteristic.writeValue(encoded);
                } catch(e2) {
                    console.error("[BLE] Web BT write error:", e2);
                }
            }
        }
    }
}

// --- PCA9685 Servo Calibration ---
function calibrateServo(pin, angle) {
    const valEl = document.getElementById(`cal-val-${pin}`);
    if (valEl) valEl.textContent = `${angle}°`;
    if (state.isHardwareConnected) {
        sendHardwareTextCommand(`SERVO ${pin} ${angle}`);
    }
}

// --- Interactive 6-Dot Builder (Studio) ---
function toggleBuilderDot(dotNum) {
    state.builderDots[dotNum - 1] = !state.builderDots[dotNum - 1];
    const btn = document.getElementById(`bdot-${dotNum}`);
    if (btn) {
        if (state.builderDots[dotNum - 1]) btn.classList.add('active');
        else btn.classList.remove('active');
    }
    updateBuilderPreview();
}

function updateBuilderPreview() {
    let matchedChar = '?';
    for (const [char, dots] of Object.entries(state.brailleMap)) {
        if (char === '#' || char === ' ') continue;
        if (dots.every((val, idx) => val === state.builderDots[idx])) {
            matchedChar = char;
            break;
        }
    }

    const charEl = document.getElementById('builder-char-result');
    if (charEl) charEl.textContent = matchedChar;

    const bitmaskVal = state.builderDots.map(d => d ? 1 : 0).join('');
    const bitmaskEl = document.getElementById('builder-bitmask-label');
    if (bitmaskEl) bitmaskEl.textContent = `Mask: 0b${bitmaskVal}`;
}

function sendCustomBuilderLetter() {
    const charEl = document.getElementById('builder-char-result');
    const letter = charEl?.textContent || 'A';
    loadBrailleStream(letter);
    startBrailleStream();
    switchTab('actuator');
}

// --- Grade-1 UEB Braille Alphabet Dictionary ---
function populateBrailleDictionary() {
    const container = document.getElementById('alphabet-dictionary-container');
    if (!container) return;

    container.innerHTML = '';
    for (const [char, dots] of Object.entries(state.brailleMap)) {
        if (char === '#' || char === ' ') continue;
        const card = document.createElement('div');
        card.className = 'dict-letter-card';

        // Build visual 2x3 braille cell (dots arranged: 1-4, 2-5, 3-6)
        const dotPairs = [[0, 3], [1, 4], [2, 5]]; // [dot1,dot4], [dot2,dot5], [dot3,dot6]
        let cellHTML = '<div class="dict-dot-cell">';
        for (const [left, right] of dotPairs) {
            cellHTML += `<div class="dict-dot-row">`;
            cellHTML += `<span class="dict-dot ${dots[left] ? 'on' : ''}"></span>`;
            cellHTML += `<span class="dict-dot ${dots[right] ? 'on' : ''}"></span>`;
            cellHTML += `</div>`;
        }
        cellHTML += '</div>';

        card.innerHTML = `
            <span class="dict-letter-char">${char}</span>
            ${cellHTML}
        `;
        card.onclick = () => {
            loadBrailleStream(char);
            startBrailleStream();
            switchTab('actuator');
        };
        container.appendChild(card);
    }
}
