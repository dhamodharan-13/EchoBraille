#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include "BluetoothSerial.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// =====================================================
// ECHOBRAILLE
// ESP32 + PCA9685 + 6 Servos + 0.96" SSD1306 OLED
//
// Supports:
// A-Z
// 0-9
// Spaces
// Number Sign
// Bluetooth
// USB Serial
// =====================================================


// =====================================================
// OLED
// =====================================================

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

#define OLED_RESET -1
#define OLED_ADDRESS 0x3C

Adafruit_SSD1306 display(
  SCREEN_WIDTH,
  SCREEN_HEIGHT,
  &Wire,
  OLED_RESET
);

// Hardware status flags
bool oledFound = false;
bool pcaFound = false;


// =====================================================
// PCA9685
// =====================================================

Adafruit_PWMServoDriver pca = Adafruit_PWMServoDriver(0x40);


// =====================================================
// BLUETOOTH
// =====================================================

BluetoothSerial SerialBT;


// =====================================================
// ESP32 I2C
// =====================================================

#define SDA_PIN 21
#define SCL_PIN 22


// =====================================================
// PCA9685 SETTINGS
// =====================================================

#define SERVO_FREQ 50

#define MOVE_ANGLE 55

#define LETTER_TIME 1000

#define SPACE_TIME 300


// =====================================================
// SERVO HOME POSITIONS
//
// Servo 1 -> CH2
// Servo 2 -> CH1
// Servo 3 -> CH0
// Servo 4 -> CH3
// Servo 5 -> CH4
// Servo 6 -> CH5
// =====================================================

int homeAngle[6] = {
  0,
  0,
  0,
  180,
  180,
  180
};


// =====================================================
// SERVO DIRECTIONS
// =====================================================

int direction[6] = {
  1,
  1,
  1,
  -1,
  -1,
  -1
};


// =====================================================
// SERVO -> PCA9685 CHANNEL
// =====================================================

int servoChannel[6] = {
  2,    // Servo 1
  1,    // Servo 2
  0,    // Servo 3
  3,    // Servo 4
  4,    // Servo 5
  5     // Servo 6
};


// =====================================================
// BRAILLE DOT -> SERVO
//
// Dot 1 -> Servo 3 -> CH0
// Dot 2 -> Servo 2 -> CH1
// Dot 3 -> Servo 1 -> CH2
// Dot 4 -> Servo 4 -> CH3
// Dot 5 -> Servo 5 -> CH4
// Dot 6 -> Servo 6 -> CH5
// =====================================================

int brailleServo[6] = {
  2,    // Dot 1
  1,    // Dot 2
  0,    // Dot 3
  3,    // Dot 4
  4,    // Dot 5
  5     // Dot 6
};


// =====================================================
// CURRENT BRAILLE STATE
// =====================================================

bool currentDots[6] = {
  false,
  false,
  false,
  false,
  false,
  false
};


// =====================================================
// NUMBER MODE
// =====================================================

bool numberMode = false;


// =====================================================
// ANGLE -> PWM
// =====================================================

int angleToPulse(int angle)
{
  return map(angle, 0, 180, 102, 512);
}


// =====================================================
// MOVE SERVO
// =====================================================

void moveServo(int servoIndex, int angle)
{
  int channel = servoChannel[servoIndex];

  angle = constrain(angle, 0, 180);

  int pulse = angleToPulse(angle);

  pca.setPWM(channel, 0, pulse);
}


// =====================================================
// GET RAISED ANGLE
// =====================================================

int raisedAngle(int servoIndex)
{
  return homeAngle[servoIndex] +
         (direction[servoIndex] * MOVE_ANGLE);
}


// =====================================================
// OLED DRAW BRAILLE
//
// Layout:
//
// LEFT SIDE:
// Character
//
// RIGHT SIDE:
//
// Dot 1    Dot 4
// Dot 2    Dot 5
// Dot 3    Dot 6
// =====================================================

void drawBrailleOLED(char symbol, bool dots[6])
{
  if (!oledFound) return;

  display.clearDisplay();

  // ===================================================
  // CHARACTER ON LEFT
  // ===================================================

  display.setTextColor(SSD1306_WHITE);

  display.setTextSize(4);

  display.setCursor(10, 15);

  display.print(symbol);


  // ===================================================
  // VERTICAL DIVIDER
  // ===================================================

  display.drawLine(
    55, 8,
    55, 56,
    SSD1306_WHITE
  );


  // ===================================================
  // BRAILLE DOT POSITIONS
  // ===================================================

  int leftX  = 78;
  int rightX = 108;

  int topY    = 18;
  int middleY = 32;
  int bottomY = 46;

  int radius = 5;


  // ===================================================
  // DOT 1
  // ===================================================

  if (dots[0])
    display.fillCircle(leftX, topY, radius, SSD1306_WHITE);
  else
    display.drawCircle(leftX, topY, radius, SSD1306_WHITE);


  // ===================================================
  // DOT 2
  // ===================================================

  if (dots[1])
    display.fillCircle(leftX, middleY, radius, SSD1306_WHITE);
  else
    display.drawCircle(leftX, middleY, radius, SSD1306_WHITE);


  // ===================================================
  // DOT 3
  // ===================================================

  if (dots[2])
    display.fillCircle(leftX, bottomY, radius, SSD1306_WHITE);
  else
    display.drawCircle(leftX, bottomY, radius, SSD1306_WHITE);


  // ===================================================
  // DOT 4
  // ===================================================

  if (dots[3])
    display.fillCircle(rightX, topY, radius, SSD1306_WHITE);
  else
    display.drawCircle(rightX, topY, radius, SSD1306_WHITE);


  // ===================================================
  // DOT 5
  // ===================================================

  if (dots[4])
    display.fillCircle(rightX, middleY, radius, SSD1306_WHITE);
  else
    display.drawCircle(rightX, middleY, radius, SSD1306_WHITE);


  // ===================================================
  // DOT 6
  // ===================================================

  if (dots[5])
    display.fillCircle(rightX, bottomY, radius, SSD1306_WHITE);
  else
    display.drawCircle(rightX, bottomY, radius, SSD1306_WHITE);


  // ===================================================
  // UPDATE OLED
  // ===================================================

  display.display();
}


// =====================================================
// CLEAR BRAILLE
// =====================================================

void clearBraille(bool staggered = false)
{
  for (int dot = 0; dot < 6; dot++)
  {
    int servo = brailleServo[dot];

    moveServo(
      servo,
      homeAngle[servo]
    );

    currentDots[dot] = false;

    if (staggered) {
      delay(60); // Prevents sudden 6-servo current inrush on boot
    }
  }
}


// =====================================================
// CHANGE BRAILLE
//
// Only changed dots move.
// =====================================================

void changeBraille(bool newDots[6])
{
  for (int dot = 0; dot < 6; dot++)
  {
    if (currentDots[dot] != newDots[dot])
    {
      int servo = brailleServo[dot];

      if (newDots[dot])
      {
        moveServo(
          servo,
          raisedAngle(servo)
        );
      }
      else
      {
        moveServo(
          servo,
          homeAngle[servo]
        );
      }

      currentDots[dot] = newDots[dot];
    }
  }
}


// =====================================================
// LETTER BRAILLE
// =====================================================

void getLetterBraille(char letter, bool dots[6])
{
  for (int i = 0; i < 6; i++)
    dots[i] = false;


  switch (letter)
  {
    case 'A':
      dots[0] = true;
      break;

    case 'B':
      dots[0] = true;
      dots[1] = true;
      break;

    case 'C':
      dots[0] = true;
      dots[3] = true;
      break;

    case 'D':
      dots[0] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case 'E':
      dots[0] = true;
      dots[4] = true;
      break;

    case 'F':
      dots[0] = true;
      dots[1] = true;
      dots[3] = true;
      break;

    case 'G':
      dots[0] = true;
      dots[1] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case 'H':
      dots[0] = true;
      dots[1] = true;
      dots[4] = true;
      break;

    case 'I':
      dots[1] = true;
      dots[3] = true;
      break;

    case 'J':
      dots[1] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case 'K':
      dots[0] = true;
      dots[2] = true;
      break;

    case 'L':
      dots[0] = true;
      dots[1] = true;
      dots[2] = true;
      break;

    case 'M':
      dots[0] = true;
      dots[2] = true;
      dots[3] = true;
      break;

    case 'N':
      dots[0] = true;
      dots[2] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case 'O':
      dots[0] = true;
      dots[2] = true;
      dots[4] = true;
      break;

    case 'P':
      dots[0] = true;
      dots[1] = true;
      dots[2] = true;
      dots[3] = true;
      break;

    case 'Q':
      dots[0] = true;
      dots[1] = true;
      dots[2] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case 'R':
      dots[0] = true;
      dots[1] = true;
      dots[2] = true;
      dots[4] = true;
      break;

    case 'S':
      dots[1] = true;
      dots[2] = true;
      dots[3] = true;
      break;

    case 'T':
      dots[1] = true;
      dots[2] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case 'U':
      dots[0] = true;
      dots[2] = true;
      dots[5] = true;
      break;

    case 'V':
      dots[0] = true;
      dots[1] = true;
      dots[2] = true;
      dots[5] = true;
      break;

    case 'W':
      dots[1] = true;
      dots[3] = true;
      dots[4] = true;
      dots[5] = true;
      break;

    case 'X':
      dots[0] = true;
      dots[2] = true;
      dots[3] = true;
      dots[5] = true;
      break;

    case 'Y':
      dots[0] = true;
      dots[2] = true;
      dots[3] = true;
      dots[4] = true;
      dots[5] = true;
      break;

    case 'Z':
      dots[0] = true;
      dots[2] = true;
      dots[4] = true;
      dots[5] = true;
      break;
  }
}


// =====================================================
// NUMBER BRAILLE
//
// 1 = A
// 2 = B
// 3 = C
// 4 = D
// 5 = E
// 6 = F
// 7 = G
// 8 = H
// 9 = I
// 0 = J
// =====================================================

void getNumberBraille(char number, bool dots[6])
{
  for (int i = 0; i < 6; i++)
    dots[i] = false;


  switch (number)
  {
    case '1':
      dots[0] = true;
      break;

    case '2':
      dots[0] = true;
      dots[1] = true;
      break;

    case '3':
      dots[0] = true;
      dots[3] = true;
      break;

    case '4':
      dots[0] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case '5':
      dots[0] = true;
      dots[4] = true;
      break;

    case '6':
      dots[0] = true;
      dots[1] = true;
      dots[3] = true;
      break;

    case '7':
      dots[0] = true;
      dots[1] = true;
      dots[3] = true;
      dots[4] = true;
      break;

    case '8':
      dots[0] = true;
      dots[1] = true;
      dots[4] = true;
      break;

    case '9':
      dots[1] = true;
      dots[3] = true;
      break;

    case '0':
      dots[1] = true;
      dots[3] = true;
      dots[4] = true;
      break;
  }
}


// =====================================================
// NUMBER SIGN
//
// Dots 3-4-5-6
// =====================================================

void getNumberSign(bool dots[6])
{
  for (int i = 0; i < 6; i++)
    dots[i] = false;

  dots[2] = true;   // Dot 3
  dots[3] = true;   // Dot 4
  dots[4] = true;   // Dot 5
  dots[5] = true;   // Dot 6
}


// =====================================================
// DISPLAY NUMBER SIGN
// =====================================================

void displayNumberSign()
{
  bool dots[6];

  getNumberSign(dots);

  changeBraille(dots);

  // OLED shows # for number sign
  drawBrailleOLED('#', dots);

  delay(LETTER_TIME);
}


// =====================================================
// DISPLAY LETTER
// =====================================================

void displayLetter(char letter)
{
  bool dots[6];

  getLetterBraille(letter, dots);

  changeBraille(dots);

  drawBrailleOLED(letter, dots);

  delay(LETTER_TIME);
}


// =====================================================
// DISPLAY NUMBER
// =====================================================

void displayNumber(char number)
{
  bool dots[6];

  getNumberBraille(number, dots);

  changeBraille(dots);

  drawBrailleOLED(number, dots);

  delay(LETTER_TIME);
}


// =====================================================
// DISPLAY SPACE
// =====================================================

void displaySpace()
{
  clearBraille();

  if (oledFound)
  {
    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(2);
    display.setCursor(32, 25);
    display.print("SPACE");
    display.display();
  }

  delay(1000);
}


// =====================================================
// DISPLAY COMPLETE MESSAGE
// =====================================================

void displayWord(String text)
{
  numberMode = false;


  for (int i = 0; i < text.length(); i++)
  {
    char c = text.charAt(i);


    // =================================================
    // LOWERCASE -> UPPERCASE
    // =================================================

    if (c >= 'a' && c <= 'z')
    {
      c = c - 32;
    }


    // =================================================
    // SPACE
    // =================================================

    if (c == ' ')
    {
      numberMode = false;

      displaySpace();

      continue;
    }


    // =================================================
    // NUMBER
    // =================================================

    if (c >= '0' && c <= '9')
    {
      // Number sign only before first digit
      if (!numberMode)
      {
        displayNumberSign();

        numberMode = true;
      }

      displayNumber(c);

      continue;
    }


    // =================================================
    // LETTER
    // =================================================

    if (c >= 'A' && c <= 'Z')
    {
      numberMode = false;

      displayLetter(c);

      continue;
    }


    // =================================================
    // OTHER CHARACTERS
    // Currently ignored
    // =================================================
  }


  // ===================================================
  // FINISHED
  // ===================================================

  clearBraille();

  numberMode = false;

  if (oledFound)
  {
    display.clearDisplay();
    display.display();
  }
}


// =====================================================
// I2C DIAGNOSTICS & PROBING
// =====================================================

bool probeI2C(uint8_t address)
{
  Wire.beginTransmission(address);
  return (Wire.endTransmission() == 0);
}

void scanI2CBus()
{
  Serial.println();
  Serial.println("--- I2C Bus Scan (SDA=21, SCL=22) ---");
  byte count = 0;
  for (byte i = 1; i < 127; i++)
  {
    Wire.beginTransmission(i);
    if (Wire.endTransmission() == 0)
    {
      Serial.print(" [OK] Device found at 0x");
      if (i < 16) Serial.print("0");
      Serial.print(i, HEX);
      if (i == 0x3C || i == 0x3D) Serial.print(" (SSD1306 OLED Display)");
      if (i == 0x40) Serial.print(" (PCA9685 16-Ch PWM Driver)");
      Serial.println();
      count++;
    }
  }

  if (count == 0)
  {
    Serial.println(" [!] No I2C devices found! Check 3.3V/5V, GND, SDA (GPIO 21), and SCL (GPIO 22).");
  }
  else
  {
    Serial.print(" Total I2C devices found: ");
    Serial.println(count);
  }
  Serial.println("-------------------------------------\n");
}


// =====================================================
// DIRECT HARDWARE ACTIONS (STANDALONE)
// =====================================================

void elevateAllPins()
{
  Serial.println("[ACTION] Elevating all 6 pins (UP)...");
  bool allDots[6] = {true, true, true, true, true, true};
  changeBraille(allDots);

  if (oledFound)
  {
    drawBrailleOLED('*', allDots);
  }
  Serial.println("[ACTION] Done: Dots 1-3 at 55 deg, Dots 4-6 at 125 deg.");
}

void retractAllPins()
{
  Serial.println("[ACTION] Retracting all 6 pins to 0 deg flat (DOWN)...");
  clearBraille(false);

  if (oledFound)
  {
    display.clearDisplay();
    display.display();
  }
  Serial.println("[ACTION] Done: All pins retracted.");
}

void setSingleServoCommand(int dotNum, int angle)
{
  if (dotNum < 1 || dotNum > 6)
  {
    Serial.println("[ERR] Dot number must be 1 to 6 (e.g. SERVO 1 55)");
    return;
  }

  angle = constrain(angle, 0, 180);
  int servo = brailleServo[dotNum - 1];
  moveServo(servo, angle);

  Serial.print("[SERVO] Dot ");
  Serial.print(dotNum);
  Serial.print(" (Servo ");
  Serial.print(servo);
  Serial.print(", PCA CH ");
  Serial.print(servoChannel[servo]);
  Serial.print(") set to ");
  Serial.print(angle);
  Serial.println(" degrees.");
}

void runSelfTest()
{
  Serial.println();
  Serial.println("=========================================");
  Serial.println("       RUNNING HARDWARE SELF-TEST        ");
  Serial.println("=========================================");
  Serial.println("Testing Dot 1 through Dot 6 individually...");

  clearBraille(true);
  delay(300);

  const char* dotNames[6] = {
    "Dot 1 (Top-Left  | PCA CH 2)",
    "Dot 2 (Mid-Left  | PCA CH 1)",
    "Dot 3 (Bot-Left  | PCA CH 0)",
    "Dot 4 (Top-Right | PCA CH 3)",
    "Dot 5 (Mid-Right | PCA CH 4)",
    "Dot 6 (Bot-Right | PCA CH 5)"
  };

  for (int dot = 0; dot < 6; dot++)
  {
    Serial.print(" -> Actuating: ");
    Serial.print(dotNames[dot]);
    Serial.println(" [UP]");

    bool testDots[6] = {false, false, false, false, false, false};
    testDots[dot] = true;
    changeBraille(testDots);

    if (oledFound)
    {
      drawBrailleOLED('1' + dot, testDots);
    }

    delay(700);

    Serial.print(" -> Retracting: ");
    Serial.print(dotNames[dot]);
    Serial.println(" [DOWN]");

    clearBraille(false);
    delay(250);
  }

  Serial.println("\n[SELF-TEST] Testing ALL 6 PINS SIMULTANEOUS ELEVATION...");
  elevateAllPins();
  delay(1200);

  Serial.println("[SELF-TEST] Retracting all pins...");
  retractAllPins();

  Serial.println();
  Serial.println("=========================================");
  Serial.println("        SELF-TEST COMPLETE! READY        ");
  Serial.println("=========================================\n");
}


// =====================================================
// UNIFIED COMMAND PARSER (SERIAL & BLUETOOTH)
// =====================================================

void processCommand(String input)
{
  input.trim();
  if (input.length() == 0) return;

  String upper = input;
  upper.toUpperCase();

  if (upper == "TEST" || upper == "SELFTEST")
  {
    runSelfTest();
  }
  else if (upper == "UP" || upper == "ELEVATE" || upper == "ELEVATE_ALL")
  {
    elevateAllPins();
  }
  else if (upper == "DOWN" || upper == "RETRACT" || upper == "RETRACT_ALL" || upper == "CLEAR")
  {
    retractAllPins();
  }
  else if (upper == "SCAN" || upper == "I2C")
  {
    scanI2CBus();
  }
  else if (upper.startsWith("SERVO"))
  {
    // Formats supported: "SERVO 1 55" or "SERVO:1:55"
    char sep = (upper.indexOf(':') != -1) ? ':' : ' ';
    int firstSep = upper.indexOf(sep);
    int secondSep = upper.indexOf(sep, firstSep + 1);

    if (firstSep != -1 && secondSep != -1)
    {
      int dotNum = upper.substring(firstSep + 1, secondSep).toInt();
      int angle = upper.substring(secondSep + 1).toInt();
      setSingleServoCommand(dotNum, angle);
    }
    else
    {
      Serial.println("[USAGE] Format: SERVO <1-6> <angle> (e.g. SERVO 1 55)");
    }
  }
  else if (upper.startsWith("DOTS:") || upper.startsWith("DOTS "))
  {
    // Direct dot control: DOTS:1,0,1,0,0,1
    bool customDots[6] = {false, false, false, false, false, false};
    int dIdx = 0;
    for (int i = 4; i < upper.length() && dIdx < 6; i++)
    {
      if (upper.charAt(i) == '1') customDots[dIdx++] = true;
      else if (upper.charAt(i) == '0') customDots[dIdx++] = false;
    }
    changeBraille(customDots);
    if (oledFound) drawBrailleOLED('?', customDots);
    Serial.println("[DOTS] Set custom 6-dot Braille pattern.");
  }
  else
  {
    // Regular English text/numbers -> Translate to Braille
    Serial.print("[BRAILLE] Translating: \"");
    Serial.print(input);
    Serial.println("\"");

    displayWord(input);

    Serial.println("[BRAILLE] Finished.");
  }
}


// =====================================================
// SETUP
// =====================================================

void setup()
{
  Serial.begin(115200);
  delay(500); // Allow USB Serial to stabilize

  Serial.println();
  Serial.println("=========================================");
  Serial.println("     ECHOBRAILLE STANDALONE FIRMWARE     ");
  Serial.println("=========================================");
  Serial.println("[BOOT] Initializing I2C bus (SDA=21, SCL=22)...");

  Wire.begin(SDA_PIN, SCL_PIN);
  delay(100);

  // Scan I2C
  scanI2CBus();

  // Check PCA9685
  if (probeI2C(0x40))
  {
    Serial.println("[OK] PCA9685 PWM Driver detected at 0x40.");
    pca.begin();
    pca.setOscillatorFrequency(27000000);
    pca.setPWMFreq(SERVO_FREQ);
    pcaFound = true;
  }
  else
  {
    Serial.println("[WARN] PCA9685 NOT detected at 0x40!");
    Serial.println("       Check wiring: ESP32 GPIO 21->SDA, GPIO 22->SCL, 5V/VCC, GND.");
  }

  // Check OLED Display (Auto-probes 0x3C and 0x3D)
  uint8_t oledAddr = 0;
  if (probeI2C(0x3C)) oledAddr = 0x3C;
  else if (probeI2C(0x3D)) oledAddr = 0x3D;

  if (oledAddr != 0 && display.begin(SSD1306_SWITCHCAPVCC, oledAddr))
  {
    oledFound = true;
    Serial.print("[OK] SSD1306 OLED initialized at 0x");
    Serial.println(oledAddr, HEX);

    display.clearDisplay();
    display.setTextColor(SSD1306_WHITE);
    display.setTextSize(2);
    display.setCursor(0, 20);
    display.println("EchoBraille");
    display.setTextSize(1);
    display.setCursor(0, 48);
    display.println("Serial / BT Ready");
    display.display();
  }
  else
  {
    Serial.println("[INFO] OLED not detected or failed. Running headless (servos active).");
  }

  // Staggered homing to avoid current spikes
  Serial.println("[BOOT] Homing 6 servos safely (staggered)...");
  clearBraille(true);
  delay(200);

  // Bluetooth Classic
  Serial.println("[BOOT] Starting Bluetooth Classic: \"EchoBraille\"...");
  SerialBT.begin("EchoBraille");

  Serial.println();
  Serial.println("=========================================");
  Serial.println("   ECHOBRAILLE READY FOR COMMANDS!       ");
  Serial.println("=========================================");
  Serial.println("Type any of these commands in Serial Monitor:");
  Serial.println("  TEST              -> Run full hardware 6-dot self-test");
  Serial.println("  UP or ELEVATE     -> Raise all 6 pins");
  Serial.println("  DOWN or RETRACT   -> Retract all 6 pins");
  Serial.println("  SCAN              -> Scan I2C bus for addresses");
  Serial.println("  SERVO <1-6> <deg> -> Move specific servo (e.g. SERVO 1 55)");
  Serial.println("  <word / letter>   -> Display in Braille (e.g. A, B, HELLO 123)");
  Serial.println("=========================================\n");
}


// =====================================================
// LOOP
// =====================================================

void loop()
{
  // USB Serial
  if (Serial.available())
  {
    String input = Serial.readStringUntil('\n');
    processCommand(input);
  }

  // Bluetooth Serial
  if (SerialBT.available())
  {
    String input = SerialBT.readStringUntil('\n');
    processCommand(input);
    SerialBT.println("OK");
  }
}