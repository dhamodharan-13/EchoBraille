# 🌟 EchoBraille — Master Technical Specification & Complete System Architecture

> **Smart India Hackathon 2026 (SIH) — Team EchoBraille**  
> **Problem Statement ID:** SIH26215 | **Category:** Hardware / MedTech / HealthTech  
> **Mission:** *"Democratizing conversational AI for the deafblind community through real-time, low-cost, 6-dot physical tactile communication."*

---

## 📑 Table of Comprehensive Contents

1. [Executive Summary & Problem Description](#1-executive-summary--problem-description)
2. [The EchoBraille Solution](#2-the-echobraille-solution)
3. [End-to-End System Architecture](#3-end-to-end-system-architecture)
4. [Hardware Engineering & Component Breakdown](#4-hardware-engineering--component-breakdown)
5. [Pinout, Circuit & Wiring Schematics](#5-pinout-circuit--wiring-schematics)
6. [Firmware Deep Breakdown (`echobraille_bluetooth.ino`)](#6-firmware-deep-breakdown-echobraille_bluetoothino)
7. [Software & Web Application Architecture (`web_app/`)](#7-software--web-application-architecture-web_app)
8. [AI Latency Optimization & Streaming Strategy](#8-ai-latency-optimization--streaming-strategy)
9. [Grade-1 Braille Bitmask Translation Matrix](#9-grade-1-braille-bitmask-translation-matrix)
10. [Bill of Materials (BOM) & Economic Feasibility](#10-bill-of-materials-bom--economic-feasibility)
11. [Step-by-Step Installation & Operations Guide](#11-step-by-step-installation--operations-guide)
12. [Future Roadmap & Advanced Technology Expansion](#12-future-roadmap--advanced-technology-expansion)

---

## 1. Executive Summary & Problem Description

### 1.1 Global Accessibility Challenge
According to the **World Health Organization (WHO)**:
* Over **1.5 Billion people** globally experience hearing loss.
* Over **2.2 Billion people** have vision impairment.
* A critical subset suffers from **dual sensory impairment (Deafblindness)**, severely limiting independent communication, education, and social integration.

### 1.2 The Multimodal AI Divide
Recent breakthroughs in Large Language Models (LLMs) like **Google Gemini**, **ChatGPT**, and **Claude** have revolutionized digital interactions through natural language and auditory speech synthesizers. However, for a deafblind user:
* **Audio output is completely unheard.**
* **Visual text displays are completely invisible.**

### 1.3 The Economic Barrier
Existing commercial electronic refreshable Braille displays rely on expensive piezoelectric bender reeds. Consequently:
* Commercial Braille readers cost between **₹1,50,000 to ₹4,00,000 INR ($1,800 to $5,000 USD)**.
* Less than **5% of deafblind individuals** in developing nations can afford access to tactile digital technology.

> [!IMPORTANT]
> **EchoBraille Solution:** An open-standard, smartphone-connected electromechanical tactile system costing under **₹1,500 INR ($17.85 USD)** that translates live spoken queries and AI answers into physical 6-dot Braille.

---

## 2. The EchoBraille Solution

```mermaid
flowchart LR
    A[Spoken Voice Input] --> B[Browser Web Speech API]
    B --> C[Gemini 1.5 Flash API / Local Knowledge Base]
    C --> D[Grade-1 Braille Translation Matrix]
    D -->|Bluetooth BLE NUS / WebSerial 'TEXT\n'| E[ESP32 Microcontroller]
    E -->|I2C 0x40 50Hz PWM| F[PCA9685 16-Ch Driver]
    E -->|I2C 0x3C Display| G[0.96"/1.3" SSD1306/SH1106 OLED]
    F -->|Pulse Width 0-180°| H[6x Micro Servos: Dots 1-6]
    H --> I[User Senses Physical Braille Cell]
```

### Core Innovations:
1. **Zero-Install Web Platform:** Runs directly in Google Chrome / Edge using **Web Bluetooth BLE** and **WebSerial** without app store downloads.
2. **Dynamic AI Guardrails:** System prompts restrict response length to under 15 words, optimizing output for human tactile reading speeds.
3. **Selective Servo Diffing:** The firmware compares target dot states against the active cell state, actuating only modified pins to minimize power draw and mechanical wear.
4. **Dual Monitoring:** An on-device OLED display accompanied by an interactive 3D web actuator preview allows educators and companions to verify letter patterns in real time.

---

## 3. End-to-End System Architecture

```mermaid
graph TB
    subgraph "Software Intelligence Layer (Browser App)"
        UI[HTML5 / Glassmorphism Interface]
        STT[Web Speech API Recognizer]
        AI[Google Gemini 1.5 Flash / Offline Rule Engine]
        ENC[Grade-1 Encoder & Bitmask Converter]
        BLE_CLIENT[Web Bluetooth GATT NUS Client]
        SERIAL_CLIENT[WebSerial API Stream Controller]
        SIM[Interactive 3D Actuator & OLED Simulator]
    end

    subgraph "Hardware Actuator Layer (ESP32 Module)"
        ESP[ESP32 Dual-Core Microcontroller]
        BLE_SERVER[BLE Nordic UART Service 6e400001]
        PARSER[Command & Text Stream Parser]
        DIFF[Selective Servo Movement Engine]
        PCA[PCA9685 12-Bit PWM Driver @ 0x40]
        OLED[SSD1306 OLED Display @ 0x3C]
        SERVOS[6x Micro Servos (Dots 1 to 6)]
    end

    STT --> UI
    UI --> AI
    AI --> ENC
    ENC --> SIM
    ENC --> BLE_CLIENT
    ENC --> SERIAL_CLIENT
    BLE_CLIENT -->|Wireless BLE Packets| BLE_SERVER
    SERIAL_CLIENT -->|USB / SPP Serial @ 115200 Baud| ESP
    BLE_SERVER --> PARSER
    ESP --> PARSER
    PARSER --> DIFF
    DIFF --> PCA
    DIFF --> OLED
    PCA --> SERVOS
```

---

## 4. Hardware Engineering & Component Breakdown

```text
               +-------------------------------------------+
               |        ESP32 DEV MODULE / XIAO ESP32      |
               |  Dual-Core Tensilica LX6 @ 240MHz         |
               |                                           |
               |   [GPIO 21 / SDA] -----> Shared I2C Data  |
               |   [GPIO 22 / SCL] -----> Shared I2C Clock |
               |   [GND]           -----> System Common GND|
               |   [5V / VBUS]     -----> Logic VCC (5V)   |
               +-------------------------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
   +-----------------------+                   +-----------------------+
   |  PCA9685 PWM DRIVER   |                   |  SSD1306 OLED (128x64)|
   |  I2C Address: 0x40    |                   |  I2C Address: 0x3C    |
   +-----------------------+                   +-----------------------+
     |   |   |   |   |   |                       | Visual feedback       |
    CH2 CH1 CH0 CH3 CH4 CH5                      | for companions        |
     |   |   |   |   |   |                       +---------------------+
     v   v   v   v   v   v
    [S1] [S2] [S3] [S4] [S5] [S6]  <-- 6 Micro SG90 Servos
    (D1) (D2) (D3) (D4) (D5) (D6)  <-- Tactile Braille Pins
```

### Hardware Subsystems:
1. **ESP32 Microcontroller Board:**
   - **Processor:** Dual-core 32-bit LX6 microprocessor operating at 240 MHz.
   - **Wireless Connectivity:** Bluetooth 4.2 BLE (Nordic UART Service) and Wi-Fi.
   - **Role:** Handles incoming string packets, parses commands, executes I2C bus communications, and updates OLED display.
2. **PCA9685 16-Channel 12-Bit PWM Driver:**
   - **I2C Address:** `0x40`.
   - **PWM Frequency:** Configured to 50 Hz for analog micro servos.
   - **Resolution:** 12-bit (4096 steps per PWM period), allowing precise angular control without burdening ESP32 CPU timers.
3. **6 SG90 Micro Servos (Tactile Cell Actuators):**
   - **Matrix:** 2 columns × 3 rows representing standard 6-dot Braille cells.
   - **Left Column (Dots 1, 2, 3):** Home angle `0°` (flat/retracted), Raised angle `55°` (elevated).
   - **Right Column (Dots 4, 5, 6):** Home angle `180°` (flat/retracted), Raised angle `125°` (elevated).
4. **0.96" / 1.3" SSD1306 / SH1106 Monochrome OLED Display:**
   - **I2C Address:** `0x3C` (with auto-probing fallback to `0x3D`).
   - **Resolution:** 128 × 64 pixels.
   - **Display Layout:** Left side displays Roman letter (4x font size); right side displays 6-dot Braille grid diagram.

---

## 5. Pinout, Circuit & Wiring Schematics

### 5.1 Shared I2C Bus Wiring

| Component Pin | ESP32 Pin | Logic Voltage | Function |
| :--- | :--- | :--- | :--- |
| **PCA9685 SDA** | `GPIO 21` (D4 on XIAO) | 3.3V / 5V | I2C Serial Data |
| **PCA9685 SCL** | `GPIO 22` (D5 on XIAO) | 3.3V / 5V | I2C Serial Clock |
| **PCA9685 VCC** | `5V` or `3.3V` | Logic Power | Logic power for PCA9685 chip |
| **PCA9685 V+** | `5V (External 2A PSU)` | 5V Power | High-current power rail for 6 servos |
| **OLED SDA** | `GPIO 21` | 3.3V | OLED Data line |
| **OLED SCL** | `GPIO 22` | 3.3V | OLED Clock line |
| **OLED VCC** | `3.3V` or `5V` | Power | OLED power supply |
| **Common GND** | `GND` | Ground | Must tie ESP32, PCA9685, OLED, and external 5V GND together |

### 5.2 Braille Cell Dot-to-Servo Mapping

Standard Braille dot numbering:
```text
  [ Dot 1 ] (o)  ( ) [ Dot 4 ]
  [ Dot 2 ] (o)  (o) [ Dot 5 ]
  [ Dot 3 ] ( )  ( ) [ Dot 6 ]
           Letter "H"
```

| Braille Dot | Position | Internal Servo Index | PCA9685 Channel | Home Position Angle | Elevated Position Angle |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **Dot 1** | Top-Left | Servo 0 | Channel `2` | `0°` | `55°` |
| **Dot 2** | Mid-Left | Servo 1 | Channel `1` | `0°` | `55°` |
| **Dot 3** | Bot-Left | Servo 2 | Channel `0` | `0°` | `55°` |
| **Dot 4** | Top-Right | Servo 3 | Channel `3` | `180°` | `125°` |
| **Dot 5** | Mid-Right | Servo 4 | Channel `4` | `180°` | `125°` |
| **Dot 6** | Bot-Right | Servo 5 | Channel `5` | `180°` | `125°` |

---

## 6. Firmware Deep Breakdown (`echobraille_bluetooth.ino`)

The firmware is implemented in [`firmware/echobraille_bluetooth/echobraille_bluetooth.ino`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/firmware/echobraille_bluetooth/echobraille_bluetooth.ino) (1,304 lines of C++).

### 6.1 Subsystem Analysis

#### A. Preprocessor Directives & Wireless Configuration (Lines 1–89)
- `#define USE_BLE 1`: Selects Bluetooth Low Energy (BLE) Nordic UART Service (`6e400001-b5a3-f393-e0a9-e50e24dcca9e`).
- `EchoBrailleServerCallbacks`: Manages client connection states and automatically restarts BLE advertising upon disconnect (`BLEDevice::startAdvertising()`).
- `EchoBrailleRxCallbacks`: Processes incoming byte packets, buffering characters until `\n` or `\r` triggers `processCommand()`.

#### B. Servo Calibration & Bitmask Definitions (Lines 144–240)
- `homeAngle[6]`: `{0, 0, 0, 180, 180, 180}` home baseline positions.
- `direction[6]`: `{1, 1, 1, -1, -1, -1}` angular movement polarity.
- `servoChannel[6]`: `{2, 1, 0, 3, 4, 5}` PCA9685 channel mapping.
- `currentDots[6]`: State vector maintaining active dot states to enable selective diffing.

#### C. Servo Motor Motion Control Engine (Lines 249–281, 439–466)
```cpp
int angleToPulse(int angle) {
    return map(angle, 0, 180, 102, 512); // Maps 0°-180° to 12-bit PCA9685 pulse counts
}

void moveServo(int servoIndex, int angle) {
    int channel = servoChannel[servoIndex];
    angle = constrain(angle, 0, 180);
    int pulse = angleToPulse(angle);
    pca.setPWM(channel, 0, pulse);
}

void changeBraille(bool newDots[6]) {
    for (int dot = 0; dot < 6; dot++) {
        if (currentDots[dot] != newDots[dot]) { // Selective movement: diffing
            int servo = brailleServo[dot];
            if (newDots[dot]) {
                moveServo(servo, raisedAngle(servo));
            } else {
                moveServo(servo, homeAngle[servo]);
            }
            currentDots[dot] = newDots[dot];
        }
    }
}
```

#### D. OLED Visual Renderer (Lines 297–406)
- `drawBrailleOLED(char symbol, bool dots[6])`: Clears screen, draws single uppercase Roman symbol at font scale 4 (x=10, y=15), draws vertical dividing line at x=55, and draws 6 circular dot indicators (filled for active `fillCircle`, outlined for inactive `drawCircle`).

#### E. Grade-1 Braille Bitmask Encoder & Number-Sign Logic (Lines 472–796, 825–914)
- `getLetterBraille(char letter, bool dots[6])`: Bitmask lookup for letters `A-Z`.
- `getNumberBraille(char number, bool dots[6])`: Bitmask lookup for digits `0-9` (mapped to `A-J`).
- `getNumberSign(bool dots[6])`: Generates the standard English Braille number sign `#` (Dots 3-4-5-6).
- `displayWord(String text)`: Iterates through characters, converts lowercase to uppercase, automatically inserts `displayNumberSign()` before numerical series, and handles space characters.

#### F. Unified Command Parser & Diagnostics (Lines 920–1146)
Handles incoming strings over Serial Monitor and Bluetooth:
- `"TEST"` or `"SELFTEST"`: Executes `runSelfTest()`, cycling each servo individually and testing simultaneous 6-pin elevation.
- `"UP"` or `"ELEVATE"`: Raises all 6 pins (`elevateAllPins()`).
- `"DOWN"` or `"RETRACT"`: Retracts all 6 pins (`retractAllPins()`).
- `"SCAN"` or `"I2C"`: Scans addresses 1–127 on the I2C bus (`scanI2CBus()`).
- `"SERVO <1-6> <angle>"`: Calibrates an individual servo (`setSingleServoCommand()`).
- `"DOTS:1,0,1,0,0,1"`: Directly sets raw 6-dot bitmasks.

---

## 7. Software & Web Application Architecture (`web_app/`)

Located in [`web_app/`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/web_app):

### 7.1 Architecture & File Overview
* [`web_app/index.html`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/web_app/index.html): HTML5 single-page application structured into 4 main navigation tabs:
  1. **AI Assistant:** Voice input, chat log stream, and interactive 3D servo actuator simulator.
  2. **ESP32 Hardware:** Bluetooth BLE & WebSerial connection manager, PCA9685 calibration sliders, and serial monitor terminal.
  3. **Braille Studio:** Interactive dot-to-letter tester and standard A-Z / 0-9 Braille dictionary.
  4. **SIH Specs:** Project background and system specifications.
* [`web_app/styles.css`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/web_app/styles.css): Dark slate glassmorphism styling using CSS variables (`--primary-cyan: #00f2fe`, `--accent-amber: #ffb800`), responsive CSS grid layouts, animated micro-interactions, and high-contrast theme overrides.
* [`web_app/app.js`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/web_app/app.js): Application logic containing:
  - **Speech-to-Text Engine:** `initSpeechRecognition()` using browser Web Speech API (`SpeechRecognition`).
  - **AI Engine:** Live Google Gemini 1.5 Flash API client with sub-10ms offline local fallback rules.
  - **Web Bluetooth BLE Client:** Connects to Nordic UART Service (`6e400001`), subscribing to notifications and queueing outbound packets into 20-byte MTU slices.
  - **WebSerial API Manager:** Fallback USB COM port serial writer at 115200 baud.
  - **Braille Playback Stream Engine:** Streams characters sequentially, updating DOM actuator pins and phone haptic vibration motor (`navigator.vibrate`).

---

## 8. AI Latency Optimization & Streaming Strategy

### 8.1 The Tactile Latency Challenge
Human tactile reading speed for Braille is significantly slower than auditory listening. Actuating 6 physical servos for a 50-word AI response would require over 3 minutes of mechanical motion.

### 8.2 3-Tier Speed & Latency Reduction
1. **System Prompt Guardrails:**
   ```text
   "You are EchoBraille AI, an assistive voice-to-Braille assistant for deafblind users. 
   Answer the query concisely in under 15 words using simple English words only. 
   No markdown, no emojis, no special symbols."
   ```
2. **Gemini 1.5 Flash Parameter Tuning:**
   - `temperature: 0.2` (minimizes token variance).
   - `maxOutputTokens: 35` (caps response generation to ~15 words).
3. **Sub-10ms Offline Engine Fallback:**
   - Pre-indexes emergency keywords (`"help"`, `"water"`, `"doctor"`, `"sos"`), live time/date dynamic calculations, greetings, and spelling routines for instant local execution without network latency.

---

## 9. Grade-1 Braille Bitmask Translation Matrix

Standard 6-dot Grade-1 Braille mapping used in both firmware and software:

| Character | Bitmask `[D1, D2, D3, D4, D5, D6]` | Raised Dots | Unicode Glyph |
| :---: | :---: | :---: | :---: |
| **A / 1** | `[1, 0, 0, 0, 0, 0]` | Dot 1 | ⠁ |
| **B / 2** | `[1, 1, 0, 0, 0, 0]` | Dots 1, 2 | ⠃ |
| **C / 3** | `[1, 0, 0, 1, 0, 0]` | Dots 1, 4 | ⠉ |
| **D / 4** | `[1, 0, 0, 1, 1, 0]` | Dots 1, 4, 5 | ⠙ |
| **E / 5** | `[1, 0, 0, 0, 1, 0]` | Dots 1, 5 | ⠑ |
| **F / 6** | `[1, 1, 0, 1, 0, 0]` | Dots 1, 2, 4 | ⠋ |
| **G / 7** | `[1, 1, 0, 1, 1, 0]` | Dots 1, 2, 4, 5 | ⠛ |
| **H / 8** | `[1, 1, 0, 0, 1, 0]` | Dots 1, 2, 5 | ⠓ |
| **I / 9** | `[0, 1, 0, 1, 0, 0]` | Dots 2, 4 | ⠊ |
| **J / 0** | `[0, 1, 0, 1, 1, 0]` | Dots 2, 4, 5 | ⠚ |
| **K** | `[1, 0, 1, 0, 0, 0]` | Dots 1, 3 | ⠅ |
| **L** | `[1, 1, 1, 0, 0, 0]` | Dots 1, 2, 3 | ⠇ |
| **M** | `[1, 0, 1, 1, 0, 0]` | Dots 1, 3, 4 | ⠍ |
| **N** | `[1, 0, 1, 1, 1, 0]` | Dots 1, 3, 4, 5 | ⠁ |
| **O** | `[1, 0, 1, 0, 1, 0]` | Dots 1, 3, 5 | ⠕ |
| **P** | `[1, 1, 1, 1, 0, 0]` | Dots 1, 2, 3, 4 | ⠏ |
| **Q** | `[1, 1, 1, 1, 1, 0]` | Dots 1, 2, 3, 4, 5 | ⠟ |
| **R** | `[1, 1, 1, 0, 1, 0]` | Dots 1, 2, 3, 5 | 1 |
| **S** | `[0, 1, 1, 1, 0, 0]` | Dots 2, 3, 4 | ⠎ |
| **T** | `[0, 1, 1, 1, 1, 0]` | Dots 2, 3, 4, 5 | ⠞ |
| **U** | `[1, 0, 1, 0, 0, 1]` | Dots 1, 3, 6 | ⠥ |
| **V** | `[1, 1, 1, 0, 0, 1]` | Dots 1, 2, 3, 6 | ⠧ |
| **W** | `[0, 1, 0, 1, 1, 1]` | Dots 2, 4, 5, 6 | ⠺ |
| **X** | `[1, 0, 1, 1, 0, 1]` | Dots 1, 3, 4, 6 | ⠭ |
| **Y** | `[1, 0, 1, 1, 1, 1]` | Dots 1, 3, 4, 5, 6 | ⠽ |
| **Z** | `[1, 0, 1, 0, 1, 1]` | Dots 1, 3, 5, 6 | ⠵ |
| **# (Number Sign)** | `[0, 0, 1, 1, 1, 1]` | Dots 3, 4, 5, 6 | ⠼ |
| **Space** | `[0, 0, 0, 0, 0, 0]` | All Flat (0°) | ` ` |

---

## 10. Bill of Materials (BOM) & Economic Feasibility

EchoBraille achieves a **99% cost reduction** compared to commercial electronic Braille readers:

| Item | Component Description | Qty | Unit Cost (INR) | Total Cost (INR) | Total Cost (USD) |
| :---: | :--- | :---: | :---: | :---: | :---: |
| 1 | ESP32-S3 or ESP32 Dev Module | 1 | ₹380 | ₹380 | $4.50 |
| 2 | PCA9685 16-Channel 12-Bit PWM Driver | 1 | ₹180 | ₹180 | $2.15 |
| 3 | Micro SG90 9g Servos | 6 | ₹120 | ₹720 | $8.60 |
| 4 | 0.96" SSD1306 I2C OLED Display | 1 | ₹160 | ₹160 | $1.90 |
| 5 | Custom 3D Printed Housing & Tactile Pins | 1 | ₹60 | ₹60 | $0.70 |
| -- | **Total EchoBraille Module Cost** | -- | -- | **≈ ₹1,500 INR** | **≈ $17.85 USD** |
| -- | **Commercial Refreshable Braille Reader** | -- | -- | **₹1,50,000+ INR** | **$1,800+ USD** |

---

## 11. Step-by-Step Installation & Operations Guide

### 11.1 Flashing the ESP32 Board
1. Open **Arduino IDE**.
2. Open [`firmware/echobraille_bluetooth/echobraille_bluetooth.ino`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/firmware/echobraille_bluetooth/echobraille_bluetooth.ino).
3. Install required libraries (**Tools → Manage Libraries**):
   - `Adafruit PWMServoDriver`
   - `Adafruit SSD1306` & `Adafruit GFX`
4. Select board (`ESP32 Dev Module` or `XIAO ESP32C3/S3`), select COM Port, and click **Upload**.

### 11.2 Launching the Web Application
1. Run a local web server from the project directory:
   ```bash
   python -m http.server 8000 --directory web_app
   ```
2. Open browser to `http://localhost:8000`.

### 11.3 Wireless Connection
* **Web Bluetooth (BLE):** Navigate to the **ESP32 Hardware** tab $\rightarrow$ click **Pair Web Bluetooth BLE** $\rightarrow$ select `"EchoBraille"`.
* **USB / BT WebSerial:** Click **Connect USB / BT WebSerial** $\rightarrow$ select the assigned COM port.

---

## 12. Future Roadmap & Advanced Technology Expansion

1. **Multi-Cell Refreshable Braille Strip:** Expanding from 1 refreshable cell to an 8-cell or 16-cell tactile strip.
2. **Electromagnetic Actuation:** Replacing micro servos with miniature linear solenoid actuators for sub-50ms refresh rates.
3. **Bharati Braille & Regional Languages:** Extending matrix support for Indian regional languages (Hindi, Tamil, Marathi, Telugu, Bengali).
4. **Wearable Haptic Glove:** Embedding micro vibration motors into a flexible glove for tactile sensory feedback on the move.

---

<p align="center">
  <b>EchoBraille — Making AI Accessible, One Touch at a Time.</b><br>
  Built with ❤️ for SIH 2026
</p>
