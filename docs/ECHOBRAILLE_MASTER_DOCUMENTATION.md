# 🌟 EchoBraille — Master Technical Specification & Complete System Architecture

> **Smart India Hackathon 2026 (SIH) — Team EchoBraille**  
> **Problem Statement ID:** SIH26215 | **Category:** Hardware / MedTech / HealthTech  
> **Mission:** *"Democratizing conversational AI for the deafblind community through real-time, low-cost, 6-dot physical tactile communication."*

---

## 📑 Table of Comprehensive Contents

1. [Executive Summary & Problem Description](#1-executive-summary--problem-description)
2. [The EchoBraille Solution](#2-the-echobraille-solution)
3. [End-to-End System Architecture](#3-end-to-end-system-architecture)
4. [Mobile-First UI & Software Architecture (`web_app/`)](#4-mobile-first-ui--software-architecture-web_app)
5. [Native Android Application & Capacitor Bridge (`android/`)](#5-native-android-application--capacitor-bridge-android)
6. [Hardware Engineering & Component Breakdown](#6-hardware-engineering--component-breakdown)
7. [Pinout, Circuit & Wiring Schematics](#7-pinout-circuit--wiring-schematics)
8. [Firmware Architecture (`echobraille_bluetooth.ino`)](#8-firmware-architecture-echobraille_bluetoothino)
9. [AI Latency Optimization & Streaming Strategy](#9-ai-latency-optimization--streaming-strategy)
10. [Grade-1 Braille Bitmask Translation Matrix](#10-grade-1-braille-bitmask-translation-matrix)
11. [Bill of Materials (BOM) & Economic Feasibility](#11-bill-of-materials-bom--economic-feasibility)
12. [Step-by-Step Installation & Operations Guide](#12-step-by-step-installation--operations-guide)
13. [Future Roadmap & Advanced Technology Expansion](#13-future-roadmap--advanced-technology-expansion)

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
    A[Spoken Voice / Type Query] --> B[Web Speech API / Native Android Mic]
    B --> C[Gemini 1.5 Flash API / Local Offline Intent Engine]
    C --> D[Grade-1 Braille Bitmask Matrix]
    D -->|Bluetooth BLE Nordic UART Service| E[ESP32 Microcontroller]
    E -->|I2C 0x40 50Hz PWM| F[PCA9685 16-Ch Driver]
    E -->|I2C 0x3C Display| G[0.96"/1.3" SSD1306/SH1106 OLED]
    F -->|Pulse Width 0-180°| H[6x Micro Servos: Dots 1-6]
    H --> I[User Senses Physical Braille Cell]
```

### Core Innovations:
1. **Cross-Platform Access (Native Android APK + Web):** Runs as a standalone Android APK (`EchoBraille.apk`) and directly in Google Chrome / Edge without installation.
2. **Dynamic AI Guardrails:** System prompts restrict response length to under 15 words, optimizing output for human tactile reading speeds.
3. **Selective Servo Diffing:** Firmware compares target dot states against active cell state, actuating only modified pins to minimize power draw and mechanical wear.
4. **Dual Visual Confirmation:** On-device OLED screen accompanied by a 3D tactile pin simulator allows educators and companions to verify letter patterns in real time.

---

## 3. End-to-End System Architecture

```mermaid
graph TB
    subgraph "Client Layer (Mobile App / Browser)"
        UI[Mobile-First Glassmorphic Interface & Bottom Dock]
        STT[Web Speech API / Native SpeechRecognizer]
        AI[Google Gemini 1.5 Flash / Sub-10ms Local Intent Engine]
        ENC[Grade-1 Braille Encoder & Bitmask Converter]
        BLE_NATIVE[Native Capacitor Bluetooth LE Client]
        BLE_WEB[W3C Web Bluetooth GATT NUS Client]
        SERIAL_CLIENT[WebSerial API Stream Controller]
        SIM[3D Tactile Pin & OLED Simulator]
    end

    subgraph "Hardware Actuator Layer (ESP32 Module)"
        ESP[ESP32 Dual-Core Microcontroller]
        BLE_SERVER[Nordic UART Service 6e400001]
        PARSER[Command & Text Stream Parser]
        DIFF[Selective Servo Movement Engine]
        PCA[PCA9685 12-Bit PWM Driver @ 0x40]
        OLED[SH1106 OLED Display @ 0x3C]
        SERVOS[6x Micro Servos (Dots 1 to 6)]
    end

    STT --> UI
    UI --> AI
    AI --> ENC
    ENC --> SIM
    ENC --> BLE_NATIVE
    ENC --> BLE_WEB
    ENC --> SERIAL_CLIENT
    BLE_NATIVE -->|Wireless BLE Packets| BLE_SERVER
    BLE_WEB -->|Wireless BLE Packets| BLE_SERVER
    SERIAL_CLIENT -->|USB Serial @ 115200 Baud| PARSER
    BLE_SERVER --> PARSER
    PARSER --> DIFF
    DIFF --> PCA
    PARSER --> OLED
    PCA --> SERVOS
```

---

## 4. Mobile-First UI & Software Architecture (`web_app/`)

The software application in [`web_app/`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/web_app) has been engineered with a mobile-first, thumb-accessible layout:

* **Fixed App Header:** Top status bar featuring the EchoBraille 6-dot animated logo, dynamic connection status pill (`ESP32 Online / Offline`), high-contrast toggle, and settings sheet launcher.
* **Fixed Bottom Navigation Dock:** Intuitive bottom tab bar for phone ergonomics with 4 core views:
  1. **Assistant (`pane-assistant`):** Voice input trigger, real-time message thread, quick action prompt chips (*"What is Braille?"*, *"Emergency SOS"*, *"Spell HELLO"*), and voice waveform overlay.
  2. **Actuator (`pane-actuator`):** Full-screen 3D tactile 6-pin actuator display with live elevation animations, SH1106 OLED simulation, progress bar, play/pause controls, and refresh speed adjustment (`0.3s` to `2.5s` per character).
  3. **Hardware (`pane-hardware`):** One-tap Bluetooth BLE scanner, USB WebSerial connector, PCA9685 servo angle calibration sliders, telemetry metrics (temp, voltage, RSSI, latency), and serial monitor terminal.
  4. **Studio (`pane-studio`):** Interactive 6-dot cell builder for testing custom dot patterns, searchable Grade-1 UEB Braille dictionary (A–Z, 0–9), and SIH 2026 technical specifications.

---

## 5. Native Android Application & Capacitor Bridge (`android/`)

EchoBraille is packaged into a native Android application using Capacitor:

* **Package ID:** `org.echobraille.app`
* **Output APK:** [`EchoBraille.apk`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/EchoBraille.apk) *(3.84 MB)*
* **Target SDK:** API Level 34 (Android 14) / Min SDK 22 (Android 5.1+)
* **Native Plugin Integration:**
  - `@capacitor-community/bluetooth-le`: Provides native Android BLE scanning, GATT server connection, and 20-byte MTU chunked transmission to the Nordic UART Service (`6e400001-b5a3-f393-e0a9-e50e24dcca9e`).
  - `@capacitor-community/speech-recognition`: Provides native microphone voice recognition with partial result streaming.
* **Android Manifest Permissions ([`android/app/src/main/AndroidManifest.xml`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/android/app/src/main/AndroidManifest.xml)):**
  - `BLUETOOTH_SCAN` & `BLUETOOTH_CONNECT` (Android 12+)
  - `BLUETOOTH` & `BLUETOOTH_ADMIN` (Legacy Android)
  - `ACCESS_FINE_LOCATION` & `ACCESS_COARSE_LOCATION`
  - `RECORD_AUDIO` & `VIBRATE` & `INTERNET`

---

## 6. Hardware Engineering & Component Breakdown

| Component | Part / Spec | Description | Quantity |
| :--- | :--- | :--- | :---: |
| **Microcontroller** | ESP32-WROOM-32 / ESP32-S3 | Dual-Core 240MHz, 520KB SRAM, built-in Wi-Fi & BLE | 1 |
| **PWM Servo Driver** | PCA9685 | 16-Channel 12-Bit PWM Driver over I2C (`0x40`) | 1 |
| **Micro Servos** | SG90 / Micro Linear | 9g Micro Servos driving tactile pins (Dots 1 to 6) | 6 |
| **OLED Display** | SH1106 / SSD1306 | 128x64 Monochrome I2C OLED Display (`0x3C`) | 1 |
| **Tactile Housing** | 3D Printed ABS/PLA | Custom 6-hole Braille cap and mechanical linkage | 1 |
| **Power Supply** | 3.7V LiPo + TP4056 | 2000mAh Battery with 5V step-up booster | 1 |

---

## 7. Pinout, Circuit & Wiring Schematics

### 7.1 Shared I2C Bus Wiring
```text
               +-------------------------------------------+
               |          ESP32 DEV MODULE / XIAO          |
               |                                           |
               |   [GPIO 21 / SDA] -----> I2C Data Line    |
               |   [GPIO 22 / SCL] -----> I2C Clock Line   |
               |   [GND]           -----> Common Ground    |
               |   [5V / VBUS]     -----> Logic Power VCC  |
               +-------------------------------------------+
                                      |
               +---------------------+---------------------+
               |                                           |
               v                                           v
   +-----------------------+                   +-----------------------+
   |  PCA9685 PWM DRIVER   |                   |  SH1106 / SSD1306 OLED|
   |  I2C Address: 0x40    |                   |  I2C Address: 0x3C    |
   +-----------------------+                   +-----------------------+
     |   |   |   |   |   |                       | Visual confirmation |
    CH2 CH1 CH0 CH3 CH4 CH5                      | of letter + dots    |
     |   |   |   |   |   |                       +---------------------+
     v   v   v   v   v   v
    [Servo 1] [Servo 2] [Servo 3] [Servo 4] [Servo 5] [Servo 6]
    (Dot 1)   (Dot 2)   (Dot 3)   (Dot 4)   (Dot 5)   (Dot 6)
```

### 7.2 Braille Dot Servo Mapping Matrix

| Braille Dot | Spatial Position | PCA9685 Channel | Retracted Angle | Elevated Angle |
| :---: | :---: | :---: | :---: | :---: |
| **Dot 1** | Top-Left | Channel `2` | `0°` | `55°` |
| **Dot 2** | Mid-Left | Channel `1` | `0°` | `55°` |
| **Dot 3** | Bot-Left | Channel `0` | `0°` | `55°` |
| **Dot 4** | Top-Right | Channel `3` | `180°` | `125°` |
| **Dot 5** | Mid-Right | Channel `4` | `180°` | `125°` |
| **Dot 6** | Bot-Right | Channel `5` | `180°` | `125°` |

---

## 8. Firmware Architecture (`echobraille_bluetooth.ino`)

Located in [`firmware/echobraille_bluetooth/echobraille_bluetooth.ino`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/firmware/echobraille_bluetooth/echobraille_bluetooth.ino):

* **Nordic UART Service (NUS):**
  - Service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
  - RX Write UUID: `6e400002-b5a3-f393-e0a9-e50e24dcca9e`
  - TX Notify UUID: `6e400003-b5a3-f393-e0a9-e50e24dcca9e`
* **Raw Byte Buffer Inspection:** `EchoBrailleRxCallbacks::onWrite()` uses `getData()` and `getLength()` to guarantee cross-compatibility across ESP32 Arduino Core v2.x and v3.x.
* **Instant Advertising Auto-Restart:** Upon disconnection, `BLEDevice::startAdvertising()` is invoked immediately in `onDisconnect()`.
* **Number Sign Prepending:** Automatically detects numeric digits (`0-9`) and prepends `#` (Dots 3-4-5-6).

---

## 9. AI Latency Optimization & Streaming Strategy

1. **Strict 15-Word System Prompt Guardrail:**
   ```text
   "You are EchoBraille AI, an assistive voice-to-Braille assistant for deafblind users. 
   Answer the query concisely in under 15 words using simple English words only. 
   No markdown, no emojis, no special symbols."
   ```
2. **Streaming Pipeline:** Text chunks stream directly into the hardware FIFO queue so servos begin actuating on the first letter while subsequent tokens buffer.
3. **Sub-10ms Offline Intent Engine:** Pre-indexed local keywords (`"help"`, `"water"`, `"sos"`, `"time"`, `"spell"`) bypass network access and respond under 10ms.

---

## 10. Bill of Materials (BOM) & Economic Feasibility

| Item | Component | Qty | Cost (INR) | Cost (USD) |
| :---: | :--- | :---: | :---: | :---: |
| 1 | ESP32 Development Board | 1 | ₹380 | $4.50 |
| 2 | PCA9685 16-Channel PWM Driver | 1 | ₹180 | $2.15 |
| 3 | Micro SG90 9g Servos | 6 | ₹720 | $8.60 |
| 4 | SH1106 / SSD1306 OLED Display | 1 | ₹160 | $1.90 |
| 5 | 3D Printed Tactile Housing & Cap | 1 | ₹60 | $0.70 |
| -- | **Total Prototype Cost** | -- | **≈ ₹1,500 INR** | **≈ $17.85 USD** |
| -- | **Commercial Piezo Display (Reference)** | -- | **₹1,50,000+ INR** | **$1,800+ USD** |

> **Cost Savings:** EchoBraille delivers a **99% cost reduction** compared to traditional piezoelectric displays.

---

## 11. Step-by-Step Installation & Operations Guide

### 11.1 Flashing ESP32 Firmware
1. Open **Arduino IDE** and load [`firmware/echobraille_bluetooth/echobraille_bluetooth.ino`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/firmware/echobraille_bluetooth/echobraille_bluetooth.ino).
2. Install `Adafruit PWMServoDriver`, `Adafruit SSD1306`, and `Adafruit GFX`.
3. Select board (`ESP32 Dev Module`, `ESP32-S3`, or `XIAO ESP32`) and upload.

### 11.2 Installing Native Android Application
Run ADB command:
```powershell
& "C:\Users\HP\AppData\Local\Android\Sdk\platform-tools\adb.exe" install -r "EchoBraille.apk"
```
Or transfer [`EchoBraille.apk`](file:///c:/Users/HP/OneDrive/Desktop/Echobraille/EchoBraille.apk) to your Android device and tap to install.

---

## 12. Future Roadmap & Advanced Technology Expansion

1. **Multi-Cell Tactile Strip:** Expanding from 1 cell to an 8-cell or 16-cell refreshable strip.
2. **Micro-Solenoid Actuation:** Replacing micro servos with miniature linear solenoids to achieve sub-50ms refresh rates.
3. **Bharati Braille Regional Support:** Expanding translation matrix to support Indian regional languages (Hindi, Tamil, Marathi, Bengali, Telugu).

---

<p align="center">
  <b>EchoBraille — Making AI Accessible, One Touch at a Time.</b><br>
  Designed & Built with ❤️ for SIH 2026
</p>
