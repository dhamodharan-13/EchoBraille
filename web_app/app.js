/* ==========================================================================
   ECHOBRAILLE — APPLICATION LOGIC & HARDWARE CONTROLLER (app.js)
   ========================================================================== */

// --- Global Application State ---
const state = {
    currentTab: 'assistant',
    isHardwareConnected: false,
    hardwareType: null, // 'bluetooth', 'webserial', or 'simulated'
    serialPort: null,
    serialWriter: null,
    bleDevice: null,
    bleServer: null,
    bleRxCharacteristic: null,
    bleTxCharacteristic: null,
    
    // AI & Speech State
    isListening: false,
    speechRecognition: null,
    geminiApiKey: 'YOUR_GEMINI_API_KEY', // Default placeholder or user provided
    
    // Playback & Stream State
    currentTextStream: "",
    currentCharIndex: 0,
    isPlaying: false,
    playbackTimer: null,
    refreshSpeedMs: 1000, // Speed per letter (matches LETTER_TIME in ino)
    
    // 6-Dot Braille Mapping Table (Standard Grade 1)
    // Matches echobraille_bluetooth.ino servo mapping & bitwise layout
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
        '1': [true,  false, false, false, false, false], // Digits match A-J with # sign
        '2': [true,  true,  false, false, false, false],
        '3': [true,  false, false, true,  false, false],
        '4': [true,  false, false, true,  true,  false],
        '5': [true,  false, false, false, true,  false],
        '6': [true,  true,  false, true,  false, false],
        '7': [true,  true,  false, true,  true,  false],
        '8': [true,  true,  false, false, true,  false],
        '9': [false, true,  false, true,  false, false],
        '0': [false, true,  false, true,  true,  false],
        '#': [false, false, true,  true,  true,  true ], // Number sign
        ' ': [false, false, false, false, false, false]  // Space
    },
    
    // Interactive Studio Test Dots
    studioDots: [false, false, false, false, false, false]
};

// --- Initialization on DOM Loaded ---
document.addEventListener('DOMContentLoaded', () => {
    initSpeechRecognition();
    populateBrailleStudioChart();
    logSerial("[SYS] EchoBraille App Ready. Load echobraille_bluetooth.ino onto ESP32.");
});

// --- Tab Switching ---
function switchTab(tabId) {
    state.currentTab = tabId;
    
    // Update navigation button active state
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${tabId}-btn`);
    if (activeBtn) activeBtn.classList.add('active');
    
    // Update tab panes
    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.add('hidden'));
    const activePane = document.getElementById(`pane-${tabId}`);
    if (activePane) {
        activePane.classList.remove('hidden');
        activePane.classList.add('active');
    }
}

function connectHardwareModal() {
    switchTab('hardware');
}

// --- High Contrast & Settings Modals ---
function toggleHighContrast() {
    document.body.classList.toggle('high-contrast');
    logSerial("[UI] Toggled High Contrast Mode");
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
            logSerial("[AI] Gemini API Key saved to local storage.");
        } else {
            localStorage.removeItem('gemini_api_key');
            state.geminiApiKey = '';
            logSerial("[AI] Using built-in offline rule engine (No API Key).");
        }
    }
    closeSettingsModal();
}

// --- Speech Recognition (Web Speech API) ---
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        state.speechRecognition = new SpeechRecognition();
        state.speechRecognition.continuous = false;
        state.speechRecognition.interimResults = true;
        state.speechRecognition.lang = 'en-US';

        state.speechRecognition.onstart = () => {
            state.isListening = true;
            document.getElementById('mic-active-overlay').classList.remove('hidden');
            document.getElementById('mic-button').classList.add('recording');
            document.getElementById('hero-mic-label').textContent = "Listening...";
        };

        state.speechRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript += event.results[i][0].transcript;
            }
            document.getElementById('chat-input-field').value = transcript;
            document.getElementById('mic-listening-text').textContent = `"${transcript}"`;
        };

        state.speechRecognition.onerror = (event) => {
            console.error("Speech Recognition Error:", event.error);
            stopVoiceInput();
        };

        state.speechRecognition.onend = () => {
            stopVoiceInput();
            const inputVal = document.getElementById('chat-input-field').value.trim();
            if (inputVal.length > 0) {
                handleUserMessage();
            }
        };
    } else {
        console.warn("Web Speech API not supported in this browser.");
    }
}

function startVoiceInput() {
    if (state.speechRecognition) {
        try {
            state.speechRecognition.start();
        } catch (e) {
            console.warn("Speech recognition already active.");
        }
    } else {
        alert("Speech recognition is not supported on your current browser. Please type your query.");
    }
}

function stopVoiceInput() {
    state.isListening = false;
    document.getElementById('mic-active-overlay').classList.add('hidden');
    document.getElementById('mic-button').classList.remove('recording');
    document.getElementById('hero-mic-label').textContent = "Speak to AI";
    if (state.speechRecognition) {
        try { state.speechRecognition.stop(); } catch(e){}
    }
}

function toggleVoiceInput() {
    if (state.isListening) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

// --- Messaging & AI Chat Stream ---
function sendQuickPrompt(text) {
    document.getElementById('chat-input-field').value = text;
    handleUserMessage();
}

async function handleUserMessage() {
    const inputField = document.getElementById('chat-input-field');
    const userQuery = inputField.value.trim();
    if (!userQuery) return;

    // Append User Message to UI
    appendMessageBubble('user', userQuery);
    inputField.value = '';

    // Show AI Thinking State
    const aiBubbleId = appendMessageBubble('ai', 'Thinking... converting to Braille stream...');

    try {
        // Query AI Model (Gemini 1.5 Flash API or Simulated Intelligent Response)
        const aiResponseText = await generateAIResponse(userQuery);
        updateMessageBubble(aiBubbleId, aiResponseText);

        // Load into Braille Tactile Stream Queue
        loadBrailleStream(aiResponseText);
        
        // Auto-play stream
        startBrailleStream();
    } catch (err) {
        updateMessageBubble(aiBubbleId, `Sorry, I encountered an error: ${err.message}`);
    }
}

function appendMessageBubble(sender, text) {
    const container = document.getElementById('chat-messages-container');
    const bubbleId = `msg-${Date.now()}`;
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = `chat-bubble ${sender}-bubble`;
    bubbleDiv.id = bubbleId;

    const avatarText = sender === 'ai' ? 'AI' : 'YOU';
    bubbleDiv.innerHTML = `
        <div class="avatar ${sender}-avatar">${avatarText}</div>
        <div class="bubble-content">
            <p>${escapeHTML(text)}</p>
        </div>
    `;

    container.appendChild(bubbleDiv);
    container.scrollTop = container.scrollHeight;
    return bubbleId;
}

function updateMessageBubble(bubbleId, newText) {
    const bubble = document.getElementById(bubbleId);
    if (bubble) {
        const p = bubble.querySelector('.bubble-content p');
        if (p) p.innerHTML = escapeHTML(newText);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

// --- AI Response Generator (Live Gemini 1.5 Flash API + Offline Fallback) ---
async function generateAIResponse(prompt) {
    const apiKey = localStorage.getItem('gemini_api_key') || state.geminiApiKey;

    // If an API key is provided, query Google Gemini 1.5 Flash API
    if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY' && apiKey.trim().length > 10) {
        try {
            logSerial("[AI] Querying Google Gemini 1.5 Flash API...");
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;
            
            const payload = {
                contents: [
                    {
                        parts: [
                            {
                                text: `You are EchoBraille AI, an assistive voice-to-Braille assistant for deafblind users. Answer the query concisely in under 15 words using simple English words only. No markdown, no emojis, no special symbols. Query: "${prompt}"`
                            }
                        ]
                    }
                ],
                generationConfig: {
                    maxOutputTokens: 35,
                    temperature: 0.2
                }
            };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                if (aiText) {
                    logSerial(`[AI] Gemini Flash responded: "${aiText}"`);
                    return aiText.replace(/[*_#~`]/g, '').trim();
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                console.warn("Gemini API Error:", errData);
                logSerial(`[AI] API returned ${response.status}: Falling back to local engine.`);
            }
        } catch (err) {
            console.error("Gemini fetch error:", err);
            logSerial(`[AI] Fetch error: ${err.message}. Using offline fallback.`);
        }
    }

    // --- Fast Local Offline Knowledge Base (< 10ms response) ---
    const lower = prompt.toLowerCase().trim();

    // 1. Time & Date (Live Dynamic Evaluation)
    if (lower.includes("time")) {
        const now = new Date();
        return `The current time is ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
    }
    if (lower.includes("date") || lower.includes("today")) {
        const now = new Date();
        return `Today is ${now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}.`;
    }

    // 2. Greetings & Identity
    if (lower.startsWith("hi") || lower.startsWith("hello") || lower.includes("hey")) {
        return "Hello! I am EchoBraille. How can I help you today?";
    }
    if (lower.includes("who are you") || lower.includes("what is your name")) {
        return "I am EchoBraille, an AI Voice to 6-dot tactile assistive platform.";
    }
    if (lower.includes("how are you")) {
        return "I am functioning well and ready to translate tactile Braille.";
    }

    // 3. Assistive & Emergency Commands
    if (lower.includes("help") || lower.includes("emergency") || lower.includes("sos")) {
        return "Emergency alert activated. Assistance requested.";
    }
    if (lower.includes("water")) {
        return "Water requested. Please stay seated while someone assists you.";
    }
    if (lower.includes("doctor") || lower.includes("hospital")) {
        return "Contacting medical assistance immediately.";
    }

    // 4. Braille & Accessibility Facts
    if (lower.includes("what is braille")) {
        return "Braille is a tactile writing system used by visually impaired people.";
    }
    if (lower.includes("who invented braille")) {
        return "Louis Braille invented Braille in 1824.";
    }
    if (lower.includes("how many dots")) {
        return "Standard Braille uses 6 dots arranged in two columns of three.";
    }

    // 5. General Knowledge & Facts
    if (lower.includes("capital of india")) {
        return "New Delhi is the capital of India.";
    }
    if (lower.includes("capital of france")) {
        return "Paris is the capital of France.";
    }
    if (lower.includes("capital of usa") || lower.includes("capital of america")) {
        return "Washington D.C. is the capital of the United States.";
    }

    // 6. Spelling Practice
    if (lower.startsWith("spell ")) {
        const word = prompt.substring(6).trim().toUpperCase();
        return word.split("").join(" ");
    }

    // 7. Project & Hardware Specs
    if (lower.includes("echobraille") || lower.includes("sih") || lower.includes("hardware")) {
        return "EchoBraille uses an ESP32, PCA9685 driver, and 6 micro servos.";
    }

    // Default Fallback: Formats any custom phrase into a clean sentence for servo testing
    return `EchoBraille translating: "${prompt}".`;
}

// --- Braille Playback & Servo Stream Engine ---
function loadBrailleStream(text) {
    state.currentTextStream = text.toUpperCase();
    state.currentCharIndex = 0;
    
    document.getElementById('stream-text-display').textContent = state.currentTextStream;
    document.getElementById('braille-progress-fill').style.width = '0%';
    
    // Enable playback controls
    document.getElementById('play-pause-btn').disabled = false;
    document.getElementById('step-prev-btn').disabled = false;
    document.getElementById('step-next-btn').disabled = false;
    document.getElementById('repeat-btn').disabled = false;
    
    logSerial(`[STREAM] Loaded stream: "${state.currentTextStream}" (${state.currentTextStream.length} chars)`);
}

function startBrailleStream() {
    if (!state.currentTextStream) return;
    state.isPlaying = true;
    updatePlayPauseUI();
    
    if (state.playbackTimer) clearInterval(state.playbackTimer);
    
    // Play first letter immediately
    playCurrentCharacter();
    
    state.playbackTimer = setInterval(() => {
        if (!state.isPlaying) return;
        state.currentCharIndex++;
        if (state.currentCharIndex >= state.currentTextStream.length) {
            pauseBrailleStream();
            logSerial("[STREAM] Finished streaming entire text.");
            return;
        }
        playCurrentCharacter();
    }, state.refreshSpeedMs);
}

function pauseBrailleStream() {
    state.isPlaying = false;
    if (state.playbackTimer) clearInterval(state.playbackTimer);
    updatePlayPauseUI();
}

function togglePlayback() {
    if (state.isPlaying) {
        pauseBrailleStream();
    } else {
        startBrailleStream();
    }
}

function updatePlayPauseUI() {
    const playIcon = document.getElementById('play-icon');
    const pauseIcon = document.getElementById('pause-icon');
    if (state.isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
}

function stepBraille(delta) {
    pauseBrailleStream();
    state.currentCharIndex += delta;
    if (state.currentCharIndex < 0) state.currentCharIndex = 0;
    if (state.currentCharIndex >= state.currentTextStream.length) {
        state.currentCharIndex = state.currentTextStream.length - 1;
    }
    playCurrentCharacter();
}

function restartBrailleStream() {
    state.currentCharIndex = 0;
    startBrailleStream();
}

function updateRefreshSpeed(val) {
    state.refreshSpeedMs = parseInt(val, 10);
    document.getElementById('speed-value-text').textContent = `${(state.refreshSpeedMs / 1000).toFixed(1)}s / char`;
    if (state.isPlaying) {
        startBrailleStream(); // Restart timer with new speed interval
    }
}

// --- Servo & OLED Renderer for Current Character ---
function playCurrentCharacter() {
    if (!state.currentTextStream) return;
    
    const char = state.currentTextStream[state.currentCharIndex];
    const progressPct = ((state.currentCharIndex + 1) / state.currentTextStream.length) * 100;
    document.getElementById('braille-progress-fill').style.width = `${progressPct}%`;
    document.getElementById('current-char-badge').textContent = `Char: ${char} (${state.currentCharIndex + 1}/${state.currentTextStream.length})`;
    
    // Get 6-dot boolean pattern from mapping table
    let dots = state.brailleMap[char] || state.brailleMap[' '];
    
    // Update Interactive 6-Pin Physical Actuator Display in UI
    updateActuatorUI(char, dots);

    // Transmit character to ESP32 hardware over WebSerial / Bluetooth
    sendHardwareTextCommand(char);

    // Trigger Phone Haptic Vibration if enabled
    triggerPhoneHaptic(dots);
}

function updateActuatorUI(char, dots) {
    // Update OLED screen simulator
    document.getElementById('oled-char-display').textContent = char;
    document.getElementById('oled-mode-text').textContent = "ACTIVE";
    document.getElementById('oled-stream-preview').textContent = `Streaming: ${state.currentTextStream.substring(0, 18)}...`;
    
    // Unicode Braille Glyph calculation
    const brailleGlyph = getBrailleUnicodeGlyph(dots);
    document.getElementById('oled-braille-symbol').textContent = brailleGlyph;
    document.getElementById('oled-binary-pattern').textContent = `Dots: [ ${dots.map(d => d ? 1 : 0).join(', ')} ]`;

    // Update 6 Servo Pin Elevation states
    for (let i = 1; i <= 6; i++) {
        const pinBox = document.getElementById(`pin-box-${i}`);
        const isRaised = dots[i - 1];
        const angleSpan = document.getElementById(`servo-angle-${i}`);
        
        if (isRaised) {
            pinBox.classList.add('active');
            angleSpan.textContent = "55°"; // Matches MOVE_ANGLE in ino
        } else {
            pinBox.classList.remove('active');
            angleSpan.textContent = "0°";
        }
    }
}

function getBrailleUnicodeGlyph(dots) {
    // Unicode Braille patterns start at 0x2800
    // Dot 1: 0x01, Dot 2: 0x02, Dot 3: 0x04, Dot 4: 0x08, Dot 5: 0x10, Dot 6: 0x20
    let code = 0x2800;
    if (dots[0]) code += 0x01;
    if (dots[1]) code += 0x02;
    if (dots[2]) code += 0x04;
    if (dots[3]) code += 0x08;
    if (dots[4]) code += 0x10;
    if (dots[5]) code += 0x20;
    return String.fromCharCode(code);
}

function triggerPhoneHaptic(dots) {
    if (navigator.vibrate && document.getElementById('haptic-toggle').checked) {
        const activeCount = dots.filter(Boolean).length;
        if (activeCount > 0) {
            navigator.vibrate(50 * activeCount);
        }
    }
}

// --- Hardware Connection Management (WebSerial & Web Bluetooth) ---
async function connectWebSerial() {
    if ('serial' in navigator) {
        try {
            state.serialPort = await navigator.serial.requestPort();
            await state.serialPort.open({ baudRate: 115200 });
            
            const textEncoder = new TextEncoderStream();
            const writableStreamClosed = textEncoder.readable.pipeTo(state.serialPort.writable);
            state.serialWriter = textEncoder.writable.getWriter();
            
            state.isHardwareConnected = true;
            state.hardwareType = 'webserial';
            updateHardwareStatusUI(true, "ESP32 WebSerial Connected");
            logSerial("[HW] Successfully opened WebSerial COM port at 115200 baud.");

            // Start background stream reader for incoming ESP32 serial logs
            readSerialStream();
        } catch (err) {
            console.error("WebSerial connection error:", err);
            logSerial(`[ERR] WebSerial failed: ${err.message}`);
        }
    } else {
        alert("WebSerial is not supported in this browser. Please use Chrome, Edge, or Opera.");
    }
}

async function readSerialStream() {
    while (state.serialPort && state.serialPort.readable && state.isHardwareConnected) {
        try {
            const textDecoder = new TextDecoderStream();
            const readableStreamClosed = state.serialPort.readable.pipeTo(textDecoder.writable);
            const reader = textDecoder.readable.getReader();
            let buffer = "";
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                if (value) {
                    buffer += value;
                    const lines = buffer.split('\n');
                    buffer = lines.pop();
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed) logSerial(`[ESP32] ${trimmed}`);
                    }
                }
            }
        } catch (err) {
            console.warn("Serial read stream ended:", err);
            break;
        }
    }
}

// --- Nordic UART Service (NUS) UUIDs for Web Bluetooth BLE ---
const NORDIC_UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NORDIC_UART_RX_UUID      = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Browser -> ESP32 Write
const NORDIC_UART_TX_UUID      = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // ESP32 -> Browser Notify

// --- Thread-Safe BLE Transmit Queue & MTU Slicing ---
let bleWriteQueue = [];
let isBleWriting = false;

async function writeBlePayload(payloadString) {
    if (!state.bleRxCharacteristic) return;

    return new Promise((resolve, reject) => {
        bleWriteQueue.push({ payload: payloadString, resolve, reject });
        processBleQueue();
    });
}

async function processBleQueue() {
    if (isBleWriting || bleWriteQueue.length === 0) return;
    isBleWriting = true;

    while (bleWriteQueue.length > 0) {
        const item = bleWriteQueue.shift();
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(item.payload);
            const CHUNK_SIZE = 20; // Safe Standard BLE ATT payload per packet (prevents truncation)

            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE);
                if (state.bleRxCharacteristic.writeValueWithoutResponse) {
                    await state.bleRxCharacteristic.writeValueWithoutResponse(chunk);
                } else {
                    await state.bleRxCharacteristic.writeValue(chunk);
                }
                // Yield briefly between consecutive packets to prevent ESP32 FIFO overflow
                if (i + CHUNK_SIZE < data.length) {
                    await new Promise(r => setTimeout(r, 20));
                }
            }
            item.resolve();
        } catch (err) {
            console.error("BLE queued packet transmission error:", err);
            item.reject(err);
        }
    }

    isBleWriting = false;
}

async function connectWebBluetooth() {
    if (!navigator.bluetooth) {
        const isSecure = window.isSecureContext;
        let errMsg = "Web Bluetooth is not supported in your current browser.";
        if (!isSecure) {
            errMsg += "\n\n⚠️ INSECURE CONTEXT: Web Bluetooth requires HTTPS or http://localhost.\nIf accessing via LAN IP (e.g. 192.168.x.x), please open Chrome and configure:\nchrome://flags/#unsafely-treat-insecure-origin-as-secure";
        } else {
            errMsg += "\n\nPlease use Google Chrome, Microsoft Edge, Opera, or Bluefy (iOS).";
        }
        alert(errMsg);
        return;
    }

    // Cleanly close any existing connection before starting a new scan
    if (state.isHardwareConnected && state.hardwareType === 'bluetooth') {
        logSerial("[BLE] Disconnecting existing Bluetooth session...");
        await disconnectHardware();
        await new Promise(r => setTimeout(r, 300));
    }

    try {
        logSerial("[BLE] Scanning for EchoBraille (NUS Service / Name)...");
        let device = null;
        try {
            // Primary attempt: Filter specifically for EchoBraille name or Nordic UART Service
            device = await navigator.bluetooth.requestDevice({
                filters: [
                    { name: 'EchoBraille' },
                    { namePrefix: 'Echo' },
                    { services: [NORDIC_UART_SERVICE_UUID] }
                ],
                optionalServices: [NORDIC_UART_SERVICE_UUID]
            });
        } catch (filterErr) {
            if (filterErr.name === 'NotFoundError') {
                logSerial("[BLE] Device selection cancelled by user.");
                return;
            }
            logSerial(`[BLE] Filtered scan notice: ${filterErr.message}. Trying open scan...`);
            // Fallback attempt: Accept all devices if name filter isn't matching scan response
            device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [NORDIC_UART_SERVICE_UUID]
            });
        }

        if (!device) return;

        logSerial(`[BLE] Device selected: "${device.name || 'EchoBraille'}". Connecting to GATT Server...`);
        
        // Listen for sudden disconnection
        device.addEventListener('gattserverdisconnected', onBLEDisconnected);
        state.bleDevice = device;

        const server = await device.gatt.connect();
        state.bleServer = server;
        logSerial("[BLE] Connected to GATT Server. Discovering Nordic UART Service...");

        const service = await server.getPrimaryService(NORDIC_UART_SERVICE_UUID);
        logSerial("[BLE] Found Nordic UART Service.");

        // Characteristic to send commands to ESP32 (RX on device side)
        state.bleRxCharacteristic = await service.getCharacteristic(NORDIC_UART_RX_UUID);
        logSerial("[BLE] Initialized RX write characteristic.");

        // Characteristic to receive telemetry/replies from ESP32 (TX on device side)
        try {
            state.bleTxCharacteristic = await service.getCharacteristic(NORDIC_UART_TX_UUID);
            await state.bleTxCharacteristic.startNotifications();
            state.bleTxCharacteristic.addEventListener('characteristicvaluechanged', handleBLENotification);
            logSerial("[BLE] Subscribed to ESP32 TX notifications.");
        } catch (txErr) {
            console.warn("BLE TX notification setup skipped:", txErr);
        }

        // Reset write queue
        bleWriteQueue = [];
        isBleWriting = false;

        state.isHardwareConnected = true;
        state.hardwareType = 'bluetooth';
        updateHardwareStatusUI(true, "EchoBraille BLE Connected");
        logSerial("[HW] Successfully connected to EchoBraille via Web Bluetooth BLE!");
    } catch (err) {
        if (err.name === 'NotFoundError') {
            logSerial("[BLE] Device selection cancelled by user.");
        } else {
            console.error("Bluetooth connection error:", err);
            logSerial(`[ERR] BLE connection failed: ${err.message}`);
            alert(`Bluetooth Connection Error: ${err.message}\n\nTips:\n1. Ensure ESP32 is powered ON.\n2. Ensure echobraille_bluetooth.ino is flashed with #define USE_BLE 1.\n3. Make sure no other phone/tab is currently connected to the ESP32.`);
        }
        updateHardwareStatusUI(false, "ESP32 Offline");
    }
}

function handleBLENotification(event) {
    const value = new TextDecoder().decode(event.target.value);
    if (value && value.trim()) {
        logSerial(`[ESP32-BLE] ${value.trim()}`);
    }
}

function onBLEDisconnected() {
    logSerial("[BLE] EchoBraille Bluetooth device disconnected.");
    state.isHardwareConnected = false;
    state.hardwareType = null;
    state.bleDevice = null;
    state.bleServer = null;
    state.bleRxCharacteristic = null;
    state.bleTxCharacteristic = null;
    bleWriteQueue = [];
    isBleWriting = false;
    updateHardwareStatusUI(false, "ESP32 Offline");
}

async function disconnectHardware() {
    if (state.hardwareType === 'bluetooth' && state.bleDevice) {
        try {
            if (state.bleDevice.gatt && state.bleDevice.gatt.connected) {
                state.bleDevice.gatt.disconnect();
            }
        } catch (e) {
            console.warn("BLE disconnect warning:", e);
        }
    } else if (state.hardwareType === 'webserial' && state.serialPort) {
        try {
            if (state.serialWriter) {
                await state.serialWriter.close();
                state.serialWriter = null;
            }
            await state.serialPort.close();
            state.serialPort = null;
        } catch (e) {
            console.warn("Serial port close warning:", e);
        }
    }
    state.isHardwareConnected = false;
    state.hardwareType = null;
    bleWriteQueue = [];
    isBleWriting = false;
    updateHardwareStatusUI(false, "ESP32 Offline");
    logSerial("[HW] Hardware disconnected.");
}

function toggleSimulatedHardware() {
    state.isHardwareConnected = !state.isHardwareConnected;
    state.hardwareType = state.isHardwareConnected ? 'simulated' : null;
    
    const btnText = document.getElementById('sim-hw-btn-text');
    if (state.isHardwareConnected) {
        updateHardwareStatusUI(true, "Virtual ESP32 Ready");
        btnText.textContent = "Disable Virtual ESP32 Hardware";
        logSerial("[HW] Enabled Virtual ESP32 Hardware Simulator.");
    } else {
        updateHardwareStatusUI(false, "ESP32 Offline");
        btnText.textContent = "Enable Virtual ESP32 Hardware";
        logSerial("[HW] Disabled Virtual Hardware.");
    }
}

function updateHardwareStatusUI(isConnected, labelText) {
    const pulseDot = document.getElementById('status-pulse-dot');
    const labelTextEl = document.getElementById('hw-status-text');
    const statusCircle = document.getElementById('hw-status-circle');
    const metaTitle = document.getElementById('hw-meta-title');
    const metaDesc = document.getElementById('hw-meta-desc');
    const disconnectBtn = document.getElementById('disconnect-hw-btn');

    if (disconnectBtn) {
        if (isConnected) {
            disconnectBtn.classList.remove('hidden');
        } else {
            disconnectBtn.classList.add('hidden');
        }
    }

    if (isConnected) {
        pulseDot.className = "status-pulse online";
        labelTextEl.textContent = labelText;
        statusCircle.className = "status-indicator-big connected";
        metaTitle.textContent = "ESP32 Connected & Active";
        metaDesc.textContent = `Hardware receiving 6-dot Braille packets via ${state.hardwareType.toUpperCase()}.`;
    } else {
        pulseDot.className = "status-pulse offline";
        labelTextEl.textContent = "ESP32 Offline";
        statusCircle.className = "status-indicator-big disconnected";
        metaTitle.textContent = "Device Disconnected";
        metaDesc.textContent = "Click connect below to pair with EchoBraille ESP32 Bluetooth BLE or USB WebSerial COM port.";
    }
}

async function sendHardwareTextCommand(text) {
    const formattedPayload = `${text}\n`; // echobraille_bluetooth.ino reads lines ending in \n
    
    if (state.hardwareType === 'webserial' && state.serialWriter) {
        try {
            await state.serialWriter.write(formattedPayload);
            logSerial(`[TX->Serial] Sent: "${text}"`);
        } catch (err) {
            console.error("Serial write failed:", err);
            logSerial(`[ERR] Serial write failed: ${err.message}`);
        }
    } else if (state.hardwareType === 'bluetooth' && state.bleRxCharacteristic) {
        try {
            await writeBlePayload(formattedPayload);
            logSerial(`[TX->BLE] Sent: "${text}"`);
        } catch (err) {
            console.error("BLE write failed:", err);
            logSerial(`[ERR] BLE transmission failed: ${err.message}`);
        }
    } else if (state.hardwareType === 'simulated') {
        logSerial(`[TX->Virtual ESP32] Moved servos for: "${text}"`);
    }
}

function logSerial(msg) {
    const terminal = document.getElementById('serial-terminal-output');
    if (terminal) {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.textContent = `${new Date().toLocaleTimeString()} ${msg}`;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }
}

function clearSerialLog() {
    const terminal = document.getElementById('serial-terminal-output');
    if (terminal) terminal.innerHTML = '';
}

// --- Servo Calibration Test Buttons ---
let servoThrottleTimer = null;
function testSingleServo(pinIndex, angleValue) {
    document.getElementById(`cal-val-${pinIndex}`).textContent = `${angleValue}°`;
    if (servoThrottleTimer) clearTimeout(servoThrottleTimer);
    servoThrottleTimer = setTimeout(() => {
        logSerial(`[CAL] Dot ${pinIndex} -> ${angleValue}°`);
        if (state.isHardwareConnected) {
            sendHardwareTextCommand(`SERVO ${pinIndex} ${angleValue}`);
        }
    }, 60);
}

function resetAllServos(angleValue) {
    for (let i = 1; i <= 6; i++) {
        const slider = document.querySelectorAll('.cal-slider')[i - 1];
        if (slider) slider.value = angleValue;
        document.getElementById(`cal-val-${i}`).textContent = `${angleValue}°`;
    }
    logSerial(`[CAL] Reset all 6 servos to ${angleValue}°`);
    if (state.isHardwareConnected) {
        if (angleValue >= 50) {
            sendHardwareTextCommand("UP");
        } else {
            sendHardwareTextCommand("DOWN");
        }
    }
}

function runHardwareSelfTest() {
    logSerial("[CMD] Running Hardware 6-Dot Self-Test...");
    if (state.isHardwareConnected) {
        sendHardwareTextCommand("TEST");
    }
}

// --- Studio Braille Reference Chart & Interactive Cell ---
function toggleTestDot(dotNum) {
    state.studioDots[dotNum - 1] = !state.studioDots[dotNum - 1];
    const btn = document.getElementById(`tdot-${dotNum}`);
    if (state.studioDots[dotNum - 1]) {
        btn.classList.add('active');
    } else {
        btn.classList.remove('active');
    }

    // Identify character from pattern
    let matchedChar = '?';
    for (const [char, pattern] of Object.entries(state.brailleMap)) {
        if (pattern.every((val, idx) => val === state.studioDots[idx])) {
            matchedChar = char;
            break;
        }
    }

    document.getElementById('studio-test-char').textContent = matchedChar;
    document.getElementById('studio-test-name').textContent = matchedChar !== '?' ? `Matched Character: "${matchedChar}"` : "Custom Dot Pattern";
    document.getElementById('studio-test-pattern').textContent = `Dot Pattern: [ ${state.studioDots.map(d => d ? 1 : 0).join(', ')} ]`;

    if (state.isHardwareConnected) {
        const dotPatternStr = state.studioDots.map(d => d ? 1 : 0).join(',');
        sendHardwareTextCommand(`DOTS:${dotPatternStr}`);
    }
}

function clearTestCell() {
    state.studioDots = [false, false, false, false, false, false];
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`tdot-${i}`).classList.remove('active');
    }
    document.getElementById('studio-test-char').textContent = '?';
    document.getElementById('studio-test-name').textContent = "Select dots to test";
    document.getElementById('studio-test-pattern').textContent = "Dot Pattern: [ 0, 0, 0, 0, 0, 0 ]";

    if (state.isHardwareConnected) {
        sendHardwareTextCommand("DOWN");
    }
}

function populateBrailleStudioChart() {
    const grid = document.getElementById('braille-alphabet-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    for (const [char, dots] of Object.entries(state.brailleMap)) {
        if (char === '#' || char === ' ') continue;
        const glyph = getBrailleUnicodeGlyph(dots);
        const card = document.createElement('div');
        card.className = 'alpha-card';
        card.innerHTML = `
            <span class="alpha-char">${char}</span>
            <span class="alpha-braille">${glyph}</span>
        `;
        card.onclick = () => {
            loadBrailleStream(char);
            startBrailleStream();
        };
        grid.appendChild(card);
    }
}
