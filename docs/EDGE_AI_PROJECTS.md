# Edge AI projects with the TinkerBit kit

Edge AI means the decision is made **on the board itself**: the ESP32 reads its sensors, runs a
small model, and acts, with no internet or cloud in the loop. This guide is a set of
project-based learning units built on the TinkerBit kit (Maker ESP32 on the RJ11 Hub plus its
plug-in modules). Each project starts from a real-world driving question and ends with a working
build that students present.

Every project is tagged with one of two tracks:

- **Track A, Studio now:** built today in Beginner Studio with blocks (read a sensor, if/then,
  wait, repeat, print, drive an output). The "intelligence" is a rule that the student writes and
  tunes by hand. These projects are the baseline that later ML projects improve on.
- **Track B, Arduino + ML:** written in the Arduino IDE. The board either learns on its own
  (running statistics, nearest-neighbour) or runs a model trained on a computer with Edge Impulse,
  TensorFlow Lite Micro or scikit-learn.

Beginner Studio and the main block editor have no machine-learning blocks today, so every
Track B project needs Arduino code.

---

## 1. What's in the kit

| Module | Jack on the hub | Signal | Useful data for AI |
| --- | --- | --- | --- |
| Push Button | D13 or A1-A4 | Digital in | Record a sample, confirm a label |
| Potentiometer | A1-A4 | Analog 0-4095 | Pick a label, set a target value |
| LED | D13 or A1-A4 | Digital / PWM out | Show the predicted class |
| Relay Module | D13 or A1-A4 | Digital out | Act on a decision (lamp, pump) |
| 4-Ch Relay | MD | 4 digital outs | One channel per class |
| Servo Motor | D13 or A1-A4 | PWM out | Point at the answer, open a lid |
| L293D Motor Driver | MD | 2 DC motors | Fan or wheels driven by a model |
| Stepper Motor | ST | 4-wire stepper | Precise movement on a decision |
| OLED Screen | I2C or I2C1 | I2C display | Show the class and its confidence |
| MQ-2 Gas Sensor | A1-A4 | Analog 0-4095 | Smoke and gas level over time |
| Microphone | A1-A4 | Analog | Sound level and audio samples |
| Heartbeat HW-605 (MAX30102) | I2C or I2C1 | I2C | Pulse waveform (red/IR) and BPM |
| Capacitive Soil Moisture | A1-A4 | Analog, 0-100 % | Soil drying curve |
| DHT11 Temp & Humid | A1 | One-wire digital | Temperature and humidity, 1 reading/s |
| HC-SR04 Ultrasonic | D5 only | Trig IO26 / Echo IO25 | Distance in cm, about 15-20 readings/s |
| RFID RC522 | 3D | SPI | Card ID, time of use |
| Bluetooth (BLE) | Built into the ESP32 | Radio | Send results to a phone, scan signal strength |
| HC-05 Bluetooth | UART | Serial | Send results to a phone (classic Bluetooth) |

The ESP32 itself (typical ESP32-WROOM-32): 240 MHz dual-core processor, about 520 KB of RAM
(roughly 300 KB free for a sketch), 4 MB of flash, and a single-precision floating-point unit.
That is enough for small neural networks (tens of KB), decision trees and nearest-neighbour
models. It is not enough for camera vision or speech recognition beyond a few words.

---

## 2. How each track works

### Track A, Studio now
1. Plug the modules into the hub in Beginner Studio and build the program from blocks.
2. Use **Print variable** and **Wait** blocks to watch the sensor in the serial monitor.
3. Pick a threshold by looking at the numbers, write the if/then rule, upload with **Upload**
   (Chrome or Edge).
4. Discuss with students where the rule fails (noise, a different room, a different person).
   That failure is the reason the Track B version exists.

### Track B, Arduino + ML
1. **Collect.** Write a short Arduino sketch that prints one line of comma-separated readings at a
   steady rate over USB serial (for example `distance,loudness` every 50 ms at 115200 baud).
2. **Label and train.** Pick one route:
   - **Edge Impulse** (free, browser based): stream the serial data in with
     `edge-impulse-data-forwarder`, label the recordings, then add a processing block
     (Spectral analysis for movement or pulse, MFE/MFCC for audio, Raw for slow sensors) and a
     learning block (Classification, Anomaly detection K-means, or Regression).
   - **scikit-learn + micromlgen:** save the serial log as CSV, train a decision tree, random
     forest or SVM in Python, and export it to a plain C header with `micromlgen`.
   - **TensorFlow Lite Micro:** train a small Keras model, convert it to a `.tflite` file and
     run it with the EloquentTinyML or TensorFlowLite_ESP32 library.
3. **Check it fits.** Edge Impulse shows the estimated RAM, flash and time per prediction;
   aim for under about 100 KB of RAM and under 100 ms.
4. **Deploy.** Export as an Arduino library (Edge Impulse) or include the header, open the
   example sketch in the Arduino IDE, choose the ESP32 board, add the outputs (OLED, LED, relay,
   servo) and upload.
5. **On-device learning** (no computer): some projects below learn while running, by storing
   labelled samples or running averages in RAM. These are the best first ML projects because
   students see the board learn in front of them.

---

## 3. Hardware rules for ML projects

- **The analog jacks A1-A4 are on ESP32 ADC2 pins** (IO4, IO15, IO2, IO0). ADC2 readings fail
  while WiFi is running, and Beginner Studio advises keeping WiFi and BLE off while reading them.
  For projects that also use the radio, use the DHT11, HC-SR04, HW-605 or RFID, which are not
  analog, or read the analog sensors first and switch the radio on afterwards.
- **A4 is IO0, the BOOT pin.** Do not plug a button into A4: holding it at reset stops the board
  from starting. A2 (IO15) and A3 (IO2) are also boot-strapping pins: fine for sensors, LEDs and
  relays, but if the board will not start or upload, unplug what is on them and retry. The DHT11
  must use A1.
- **The HC-05 on UART shares the USB serial port.** Unplug it while collecting training data over
  USB, or the data stream and the Bluetooth module will interfere.
- **D13 and 3D share IO33.** With the RFID reader on 3D, use A1-A4 for buttons, LEDs and servos.
- **D5 is reserved for the HC-SR04** (Trig IO26, Echo IO25).
- **The OLED and HW-605 share one I2C bus** (SDA 21, SCL 22). Plug them into I2C and I2C1; both
  work at the same time.
- **The MQ-2 heater needs about a minute to warm up.** Throw away readings from the first
  minute, and record training data only after warm-up. Its values are raw, not calibrated ppm.
- **Microphone sampling.** `analogRead` in a tight timed loop gives a few kHz to around 10 kHz;
  audio models usually expect 8-16 kHz. First check what the module outputs: print it fast while
  quiet. A value that wobbles around a middle value (about 2000) is raw audio and supports
  sound classification. A value that sits near zero and rises with noise is a loudness envelope,
  which only supports loudness-pattern projects (claps, knocks, noise level).
- **DHT11 is slow** (one reading per second, about +/-2 degrees C). Use it for slowly changing
  situations, not fast events.

---

## 4. How to run a project

Every project below follows the same six-stage cycle. A "session" is about 45 minutes.

1. **Ask.** Read the driving question, discuss where this problem appears in real life, and agree
   on what "working" means (the success check).
2. **Build.** Plug the modules into the listed jacks and test each one on its own.
3. **Collect.** Watch or record sensor data. In Track B, label every recording and keep some
   data, ideally from people or days not used for training, aside for testing.
4. **Model.** Track A: write and tune the rule. Track B: train or teach the model, then deploy it.
5. **Test and improve.** Measure against the success check with new data, find the failures, and
   fix them with better data or features.
6. **Present.** Show the live demo and a poster or slide covering the problem, the data, the
   model, the results, and its limits and ethics.

**Assessment (same for every project):** a working build; data quality (enough, labelled,
balanced); honest testing on new data; a clear explanation of how the model decides; and
reflection on limits, fairness and privacy.

---

## 5. Projects

Difficulty: **Starter** (first lessons), **Intermediate** (needs Arduino IDE), **Advanced**
(careful data collection or signal processing).

| # | Project | Track | Level | Time | Main modules |
| --- | --- | --- | --- | --- | --- |
| 1 | Clap lamp | A | Starter | 2 sessions | Microphone, LED |
| 2 | Sound classifier | B | Intermediate | 4-5 sessions | Microphone, OLED |
| 3 | Voice switch | B | Advanced | 6-8 sessions | Microphone, Relay |
| 4 | Motor health monitor | B | Intermediate | 4 sessions | L293D, Microphone |
| 5 | Heart-rate display with alert | A | Starter | 2 sessions | HW-605, OLED |
| 6 | Resting vs active | B | Intermediate | 4 sessions | HW-605, OLED |
| 7 | Calm or alert indicator | B | Advanced | 6 sessions | HW-605, OLED |
| 8 | Presence alert | A | Starter | 2 sessions | HC-SR04, Servo |
| 9 | Hand-gesture controller | B | Intermediate | 5 sessions | HC-SR04, Servo, Relay |
| 10 | Smart dustbin | B | Intermediate | 4 sessions | HC-SR04, Servo |
| 11 | Room comfort classifier | B | Intermediate | 5 sessions over a week | DHT11, L293D fan |
| 12 | Gas and smoke anomaly detector | A to B | Starter to Intermediate | 4 sessions | MQ-2, DHT11 |
| 13 | Predictive garden watering | B | Intermediate | 4 sessions over 1-2 weeks | Soil, DHT11, Relay |
| 14 | Teach the board (kNN trainer) | B | Starter | 3 sessions | HC-SR04, Microphone, Potentiometer |
| 15 | Personal fan | B | Intermediate | 4 sessions plus a few days | DHT11, Potentiometer, L293D |
| 16 | Results over BLE | A | Starter | 1-2 sessions | DHT11, BLE |
| 17 | Which room am I in? | B | Advanced | 6 sessions | BLE, several kits |
| 18 | Smart door with unusual-access alert | A to B | Intermediate to Advanced | 5-6 sessions | RFID, HC-SR04, Servo |

### Sound (microphone)

#### Project 1: Clap lamp
**Driving question:** Can a lamp tell a clap from everyday classroom noise?

**Track:** A. **Level:** Starter. **Time:** 2 sessions.

**Kit:** Microphone (A1), LED (D13), or Relay (D13) switching a low-voltage lamp.

**Milestones:**
1. In Beginner Studio, read the microphone and print `soundLevel` every 0.1 s.
2. Fill a table of values for silence, talking, music and clapping.
3. Choose a threshold and build the rule: if `soundLevel` is above it, turn the LED on, wait
   10 s, turn it off.
4. Test 10 claps and 5 minutes of normal talking; count caught claps and false triggers.
5. Retune the threshold and test again.

**What the AI learns:** Nothing yet. The student is the model, choosing the threshold by hand.

**Showcase:** Live demo plus the results table (claps caught vs false triggers).

**Success check:** At least 8 of 10 claps caught, at most 2 false triggers in 5 minutes of talk.

**Extend it:** Try a double-clap rule, then compare with the trained model in project 2.

#### Project 2: Sound classifier (clap, whistle, voice, silence)
**Driving question:** Can the board recognise what it hears without sending audio to the cloud?

**Track:** B. **Level:** Intermediate (needs a raw-audio microphone output). **Time:** 4-5
sessions.

**Kit:** Microphone (A1), OLED (I2C), LED (D13).

**Milestones:**
1. Run the microphone check from section 3 to confirm the module gives raw audio.
2. Write a sketch that records 1-second clips at a steady rate (about 8 kHz) into RAM and prints
   each clip over serial; save the clips and upload them to Edge Impulse.
3. Record about 2 minutes per class (clap, whistle, voice, silence) in the real classroom.
4. In Edge Impulse, use an MFE processing block and a classification block; study the confusion
   matrix.
5. Deploy as an Arduino library: the OLED shows the class and confidence, and the LED lights on
   "clap".
6. Test with classmates whose voices were not in the training data.

**What the AI learns:** The frequency pattern of each sound class.

**Showcase:** Live demo plus a poster of the confusion matrix and the hardest mistakes.

**Success check:** At least 80 % accuracy on test data, and it works for someone not in the
training data.

**Extend it:** Add a "door knock" class and compare against the hand-made rule from project 1.

#### Project 3: Two-word voice switch ("on" / "off")
**Driving question:** Can we control a light by voice with no internet connection?

**Track:** B. **Level:** Advanced (stretch goal; accuracy depends on the microphone module).
**Time:** 6-8 sessions.

**Kit:** Microphone (A1), Relay (D13), OLED (I2C).

**Milestones:**
1. Reuse the audio capture pipeline from project 2.
2. Collect "on", "off", "noise" and "unknown" (other words), with 10+ speakers and 50+ clips per
   word.
3. Train a keyword-spotting model in Edge Impulse (MFCC features plus classification).
4. Deploy and only act above a confidence threshold (for example 0.8), with a 2-second cooldown.
5. Count false triggers during 10 minutes of normal conversation.

**What the AI learns:** The sound shape of two words, separated from everything else.

**Showcase:** Live voice demo plus a chart of accuracy per speaker.

**Success check:** At least 7 of 10 commands obeyed, at most 1 false trigger in 10 minutes.

**Extend it:** Discuss why datasets need many voices, accents and ages.

#### Project 4: Motor health monitor
**Driving question:** Can a machine warn us before it breaks?

**Track:** B. **Level:** Intermediate. **Time:** 4 sessions.

**Kit:** L293D with a DC motor or fan (MD), Microphone (A1) mounted next to the motor, OLED (I2C).

**Milestones:**
1. Run the motor at two or three fixed speeds.
2. Record several minutes of normal running sound at each speed.
3. In Edge Impulse, train anomaly detection (K-means) on normal data only.
4. Deploy: the OLED shows the anomaly score, and the motor stops if the score stays high for
   2 seconds.
5. Test with faults: tape a small weight to the blade, touch the shaft lightly, loosen the mount.

**What the AI learns:** What normal sounds like, so anything else stands out.

**Showcase:** Demo of a fault being caught, plus a graph of anomaly score over time.

**Success check:** All three faults flagged; 5 minutes of normal running with no alarm.

**Extend it:** Collect fault examples and train a classifier that names the fault.

### Body (Heartbeat HW-605)

These projects are for learning only. They are not medical devices. Get consent before
recording anyone's pulse, and do not share the data outside the class.

#### Project 5: Heart-rate display with alert
**Driving question:** What does my heart rate say about what I am doing?

**Track:** A. **Level:** Starter. **Time:** 2 sessions.

**Kit:** HW-605 (I2C), OLED (I2C1), LED (D13).

**Milestones:**
1. In Beginner Studio, read the heartbeat and show the number on the OLED.
2. Check it against a manual pulse count (count for 30 seconds and double it).
3. Record each student's BPM seated and after 20 jumping jacks.
4. Set an alert threshold: if `heartRate` is above it, turn the LED on.
5. Discuss why one threshold does not suit everyone.

**What the AI learns:** Nothing yet; the threshold is chosen by hand.

**Showcase:** A class chart of resting vs active BPM.

**Success check:** The display stays within 5 BPM of the manual count.

**Extend it:** Move on to project 6.

#### Project 6: Resting vs active classifier
**Driving question:** Can the board tell from a pulse alone whether someone has just exercised?

**Track:** B. **Level:** Intermediate. **Time:** 4 sessions.

**Kit:** HW-605 (I2C), OLED (I2C1).

**Milestones:**
1. Write a sketch that prints the raw IR value at about 50 Hz (MAX30105 library).
2. Record 10-second windows from at least 8 students, seated and after exercise.
3. Keep two students' data out for testing.
4. Train in Edge Impulse with spectral analysis plus classification.
5. Deploy: the OLED shows "resting" or "active". Test on the held-out students.

**What the AI learns:** The pulse-waveform pattern of each state.

**Showcase:** Results per student and a discussion of who it worked worst for.

**Success check:** At least 80 % accuracy on the held-out students.

**Extend it:** Add a "recovering" class.

#### Project 7: Calm or alert indicator
**Driving question:** Can heart-rate variability show when someone is calm?

**Track:** B. **Level:** Advanced. **Time:** 6 sessions.

**Kit:** HW-605 (I2C), OLED (I2C1), LED (D13).

**Milestones:**
1. Detect beats with `checkForBeat` and measure the time between beats.
2. Compute RMSSD (variation between beats) over 30 seconds.
3. Each student records a 2-minute calm baseline with slow breathing.
4. The board learns each student's baseline and shows "alert" when RMSSD falls well below it.
5. Test during a timed quiz and during relaxation.

**What the AI learns:** Each person's own normal, then deviations from it.

**Showcase:** Before/after graphs and a class-written set of consent and privacy rules.

**Success check:** The indicator moves in the expected direction for most students.

**Extend it:** Combine BPM and RMSSD in a logistic regression model.

### Distance (HC-SR04)

#### Project 8: Presence alert
**Driving question:** How does an automatic door know you are coming?

**Track:** A. **Level:** Starter. **Time:** 2 sessions.

**Kit:** HC-SR04 (D5), Servo (A1), LED (D13).

**Milestones:**
1. In Beginner Studio, read the distance and print it.
2. Walk towards the sensor and past it; note the readings.
3. Rule: if the distance is under 50 cm, turn the servo to 90 degrees and the LED on; otherwise
   back to 0.
4. Test 10 approaches and 10 walk-pasts at 30 cm; count wrong openings.

**What the AI learns:** Nothing yet; a fixed distance rule.

**Showcase:** Demo plus the count of false openings (the number project 10 must beat).

**Success check:** Opens for every approach; false openings recorded honestly.

**Extend it:** Move on to project 10.

#### Project 9: Hand-gesture controller (approach, swipe, hold)
**Driving question:** Can one distance sensor understand several hand gestures?

**Track:** B. **Level:** Intermediate. **Time:** 5 sessions.

**Kit:** HC-SR04 (D5), Servo (A1), Relay (D13), OLED (I2C).

**Milestones:**
1. Write a sketch that prints the distance 20 times per second.
2. Record 40+ one-second examples each of approach, swipe, hold and "nothing" with the data
   forwarder.
3. Train in Edge Impulse (spectral or raw features plus a small neural network).
4. Deploy: swipe moves the servo, hold toggles the relay, and the OLED names the gesture.
5. Test with classmates who did not record training data.

**What the AI learns:** The shape of the distance signal over one second for each gesture.

**Showcase:** Live gesture demo plus accuracy per gesture.

**Success check:** At least 85 % accuracy with new users.

**Extend it:** Add a "double tap" gesture.

#### Project 10: Smart dustbin that ignores passers-by
**Driving question:** Can the bin tell someone who wants to use it from someone walking past?

**Track:** B. **Level:** Intermediate. **Time:** 4 sessions.

**Kit:** HC-SR04 (D5), Servo (A1).

**Milestones:**
1. Reuse the project 8 build and log distance at 20 Hz in 2-second windows.
2. Record "approach to use" and "walk past" from different angles and several people.
3. Compute features (closest distance, speed, how long the person stayed close) and train a
   decision tree (micromlgen) or use Edge Impulse.
4. Deploy and repeat project 8's test.

**What the AI learns:** Movement patterns that show intent.

**Showcase:** Side-by-side comparison of false openings: rule (project 8) vs model.

**Success check:** Fewer false openings than project 8, with no missed uses in 20 trials.

**Extend it:** Count uses per day and send the count over BLE (the HC-SR04 is not analog, so BLE
does not disturb it).

### Environment

#### Project 11: Room comfort classifier
**Driving question:** What does "comfortable" mean for our class, and can the board learn it?

**Track:** B. **Level:** Intermediate. **Time:** 5 sessions spread over a week.

**Kit:** DHT11 (A1), OLED (I2C), L293D fan (MD).

**Milestones:**
1. Log temperature and humidity every minute (Beginner Studio print blocks work for this).
2. Several times a day, the class votes: comfortable, too hot, too humid or cold. Record the
   time of each vote.
3. Match votes to readings in a spreadsheet and export a CSV.
4. Train a small decision tree (depth 3) in scikit-learn, draw it, and export it with micromlgen.
5. Deploy: the OLED shows the comfort class and the fan runs on "too hot".

**What the AI learns:** The class's own comfort zones, as a readable set of rules.

**Showcase:** The printed decision tree next to the rule the class would have written by hand.

**Success check:** Agrees with the class vote at least 75 % of the time on a held-out day, and
students can read the tree aloud.

**Extend it:** Add time of day as a feature.

#### Project 12: Gas and smoke anomaly detector
**Driving question:** How can a sensor know what "normal air" is in this room?

**Track:** A, then B. **Level:** Starter, then Intermediate. **Time:** 4 sessions.

**Kit:** MQ-2 (A2), DHT11 (A1), LED (D13), Relay (A3) for an extractor fan.

**Milestones:**
1. Track A: in Beginner Studio, print the gas level after a 1-minute warm-up and build a fixed
   threshold alarm.
2. Track B: in Arduino, learn the room's normal level and spread over 10 minutes (running mean
   and standard deviation).
3. Alarm when the reading stays more than 3 standard deviations above normal for 5 seconds;
   update the baseline slowly so it follows normal drift.
4. Log a whole school day and count false alarms for both versions.
5. Supervised test only: the teacher releases a short puff of gas from an unlit lighter near
   the sensor.

**What the AI learns:** The room's normal level and how much it usually varies.

**Showcase:** A graph of a day's readings with both alarm methods marked.

**Success check:** Detects the test within 10 seconds, with no false alarms over a school day.

**Extend it:** Train Edge Impulse anomaly detection that also uses temperature and humidity.

#### Project 13: Predictive garden watering
**Driving question:** Can we water a plant before it gets thirsty instead of after?

**Track:** B. **Level:** Intermediate. **Time:** 4 sessions spread over 1-2 weeks.

**Kit:** Soil Moisture (A2), DHT11 (A1), Relay with a small pump (D13), OLED (I2C).

**Milestones:**
1. Log soil %, temperature and humidity every 10 minutes for several days.
2. Plot the drying curve and measure the drying rate (% per hour).
3. Fit a linear regression of drying rate against temperature and humidity (spreadsheet or
   Python).
4. Deploy: the OLED shows "dry in about N hours", and the pump runs when the prediction drops
   below 1 hour.
5. Run one pot with the old threshold rule and one with the prediction; compare.

**What the AI learns:** How fast the soil dries in the current weather.

**Showcase:** The drying-curve plot with predictions overlaid.

**Success check:** Predictions within 2 hours of the real time the soil reached the threshold.

**Extend it:** Send the prediction over BLE (read the soil sensor first, then advertise, because
the analog jacks share ADC2).

### Teach by example (on-device learning)

#### Project 14: Teach the board (kNN trainer)
**Driving question:** How does a machine learn from examples?

**Track:** B. **Level:** Starter (the teacher provides the sketch; no computer training).
**Time:** 3 sessions.

**Kit:** HC-SR04 (D5), Microphone (A2), Potentiometer (A1) to pick the label, Button (D13) to
record, OLED (I2C).

**Milestones:**
1. Upload the teacher's sketch, which measures average distance and loudness every second.
2. Turn the potentiometer to choose a label ("nobody", "person quiet", "person talking"); the
   OLED shows it.
3. Press the button to save an example; record 5-10 per label.
4. Switch to run mode: the board finds the 3 nearest saved examples and shows the winning label.
5. Experiment: too few examples, wrong examples, and different values of k.

**What the AI learns:** k-nearest-neighbour: new situations are labelled like the closest
examples it has seen.

**Showcase:** Live "teach and test" demo for another class.

**Success check:** Students can explain why a wrong prediction happened and fix it by adding
examples.

**Extend it:** Add a third feature, such as how fast the distance is changing.

#### Project 15: Personal fan that learns your preference
**Driving question:** Can a device learn what you like just by watching your choices?

**Track:** B. **Level:** Intermediate. **Time:** 4 sessions plus a few days of use.

**Kit:** DHT11 (A1), Potentiometer (A2) to set the speed you like, Button (D13) to save, L293D
fan (MD), OLED (I2C).

**Milestones:**
1. Manual mode: the potentiometer sets the fan speed.
2. Each button press saves (temperature, humidity, speed) to flash with the Preferences library,
   so the data survives power-off.
3. Auto mode: predict the speed from the 3 nearest saved examples, or from a fitted line.
4. Use it for a few days; every manual correction becomes new training data.
5. Plot the learned speed against temperature.

**What the AI learns:** Your preferred fan speed for each temperature and humidity.

**Showcase:** The learned speed curve and a demo of switching between manual and auto.

**Success check:** In auto mode, the speed is within about 15 % of what the user would choose.

**Extend it:** Add per-user profiles with RFID (move the button to A3, since 3D shares IO33 with
D13).

### Connected and multi-sensor

#### Project 16: Send results to a phone over BLE
**Driving question:** What is the difference between sending data and sending a decision?

**Track:** A. **Level:** Starter. **Time:** 1-2 sessions.

**Kit:** DHT11 (A1), OLED (I2C), Bluetooth (built into the ESP32).

**Milestones:**
1. In Beginner Studio, start BLE advertising with a team name.
2. Rule: if the temperature is above 30, send "HOT", otherwise "OK"; show it on the OLED too.
3. Read it on a phone with a BLE scanner app (for example nRF Connect).
4. Discuss what leaves the board and what stays private.

**What the AI learns:** Nothing yet; the point is edge vs cloud.

**Showcase:** Phone and board side by side as the status changes.

**Success check:** The phone shows the new status within a few seconds.

**Extend it:** Send the comfort class from project 11 instead.

#### Project 17: Which room am I in? (BLE signal fingerprint)
**Driving question:** Can a device find its location indoors, where GPS does not work?

**Track:** B. **Level:** Advanced. **Time:** 6 sessions.

**Kit:** Bluetooth (built in), OLED (I2C), plus three or more other kits running the
**BLE Beacon** template with unique names, one per room.

**Milestones:**
1. Place the beacon kits in different rooms or corners.
2. Write a sketch that scans BLE and prints the signal strength (RSSI) of each beacon every
   second.
3. Walk each room and record labelled readings (2 minutes per room, from several spots).
4. Classify with kNN on the board, smoothing over the last 5 predictions.
5. Do a test walk and record how often the room is right.

**What the AI learns:** The signal-strength "fingerprint" of each room.

**Showcase:** A floor plan marked with where it was right and wrong.

**Success check:** At least 80 % correct on a test walk.

**Extend it:** Discuss the privacy of tracking people indoors.

#### Project 18: Smart door with unusual-access alert
**Driving question:** Can a lock notice when something is out of the ordinary?

**Track:** A, then B. **Level:** Intermediate, then Advanced. **Time:** 5-6 sessions.

**Kit:** RFID RC522 (3D), HC-SR04 (D5), Servo lock (A1), LED (A2). D13 stays free because it
shares IO33 with 3D.

**Milestones:**
1. Track A: in Beginner Studio, read the card ID and unlock the servo only for a known card while
   someone stands within 40 cm.
2. Track B: connect to WiFi and get the time from the internet (NTP); log each card and the hour
   it was used. None of these sensors is analog, so WiFi is fine.
3. Build each card's usual-hours pattern over a week.
4. Flag a tap at an hour that card has rarely used: blink the LED and log it.
5. Agree on privacy rules: what is stored, who can see it, and when it is deleted.

**What the AI learns:** Each card holder's normal routine, so unusual times stand out.

**Showcase:** A week's access chart with the flagged taps highlighted.

**Success check:** Test taps at unusual hours are flagged; normal taps are not.

**Extend it:** Also flag a card used when nobody is standing at the door.

---

## 6. Not possible with this kit

- **Vision** (face, object or colour recognition): there is no camera. An ESP32-CAM board is
  the usual add-on.
- **Motion gestures, step counting, fall detection**: there is no accelerometer. An MPU-6050
  breakout on the I2C bus (wired to an RJ11 plug for the I2C1 jack) would add this.
- **Full speech recognition or chatbots**: too large for the ESP32. Only a few keywords are
  realistic (project 3).
- **Calibrated gas or medical readings**: the MQ-2 and HW-605 give relative values for
  learning, not certified measurements.

---

## 7. Suggested learning path

| Step | Project | Track | Idea introduced |
| --- | --- | --- | --- |
| 1 | 1. Clap lamp | A | A rule is a hand-made model |
| 2 | 8. Presence alert | A | Rules fail in real situations |
| 3 | 5. Heart-rate display | A | Sensor noise and personal differences |
| 4 | 16. Results over BLE | A | Edge vs cloud |
| 5 | 14. Teach the board | B | Training vs inference, on the board |
| 6 | 15. Personal fan | B | Regression and personalisation |
| 7 | 11. Room comfort | B | Decision trees learned from data |
| 8 | 12. Gas anomaly | B | Baselines and anomaly detection |
| 9 | 9. Hand gestures | B | Time-series windows and neural networks |
| 10 | 2. Sound classifier | B | Audio features and confusion matrices |
| 11 | 4. Motor health | B | Predictive maintenance |
| 12 | 13. Predictive watering | B | Prediction instead of reaction |
| 13 | 6, 7, 10, 17, 18 | B | Open projects for advanced students |
| 14 | 3. Voice switch | B | Stretch goal: keyword spotting |
