# Edge AI "Teach the board": implementation plan

Status: plan, not started. Based on the draft "Edge AI Teach Mode" plan, checked against the code on `main` (commit 7ab6a5e4 plus uncommitted MPU6050 work in `condition.js` and `sensorReads.js`).

## Goal
Students record examples from the motion sensor, the microphone or their wired kit sensors. The browser trains a tiny kNN model, and Upload writes it into the sketch as plain C, so the ESP32 recognises things offline. Nothing changes on the compile server.

## What changed from the draft (and why)

| # | Draft said | Plan now | Why |
|---|---|---|---|
| 1 | "Version bump with migration" in autosave | `loadProject` must accept **v1 and v2** | Today `data.v !== VERSION` returns `null`, so a plain bump silently wipes every student's saved project |
| 2 | Hold **Record** while doing the gesture | **Event capture**: click Record once; every detected wave/clap becomes one example; it stops by itself at 10 examples or after 20 s | A student needs both hands to wave the board, so they can't also hold a mouse button. It's also easier for motor-impaired students |
| 3 | Motion window "starts on a threshold, so `still` is recordable" | These contradict each other: a threshold trigger never fires for `still`. Event kinds (Motion, Sound) get a **built-in "Nothing" answer** when no event happens. Sensors stays continuous | Students don't need to record a "nothing" class, and the window lines up with the gesture |
| 4 | Accuracy by leave-one-out per example | **Leave-one-take-out** (group by recording take) | Examples from one take are near-copies, so plain leave-one-out reports 100% for models that fail in real use |
| 5 | Sound sampled at ~4 kHz | **~8 kHz** if ADC2 can keep up (hardware check), else 4 kHz with bands under 2 kHz | At 4 kHz anything above 2 kHz folds back (whistles are 1–3 kHz) |
| 6 | Model arrays always in the generated sketch | The live C++ panel shows `// AI model: 3 things, 72 examples (added at Upload)`. Upload and Copy get the full arrays | ~30 KB of numbers would bury the student's code and recompute on every edit. Same pattern as the hidden Cloud secrets |
| 7 | Separate recorder sketch | Recorder = `generateArduino(connections, [], {aiRecorder: kind})` | It reuses the exact same setup (pinModes, **pumps/solenoids driven off at boot**, DHT/ultrasonic helpers) and the same feature C code as the real sketch, so there is no second code path to drift |
| 8 | "Train" stores a model | The model is **always computed from the samples** (kNN training is just standardising). Train is the step that shows the accuracy | Saved state can never hold a stale model |
| 9 | Cloud: "a reading named after the thing" | One 0/1 reading per thing, `ai_<slug>` (regex `^[a-zA-Z][a-zA-Z0-9_]{0,31}$`). It counts toward the server's 24-key limit | Existing alert rules work unchanged (`ai_wave > 0`) |

## Decisions to confirm before coding
1. **Event capture with a built-in "Nothing" answer** for Motion and Sound (row 2/3). This means held poses such as "tilted left" aren't AI things in v1; the Tilt block covers those. *Recommended.*
2. **"Ask the AI" blocks the loop** for up to 2 s (it waits for an event, then classifies). A background task would let LEDs keep blinking, but it would share the I2C bus with OLED/HW-605 across tasks and need a mutex. *Recommended: blocking in v1.*
3. **One AI per project, 2–4 things, 10–40 examples per thing.**

## Phases
Each phase ends green (`npx jest --testPathIgnorePatterns node_modules -- beginner-studio`) and can be committed separately.

### Phase 0: Hardware checks (before Phase 3)
- [ ] The kit mic outputs raw audio, not only an envelope: scope it, or print 2,000 raw `analogRead` values for a clap and a whistle. If it's only an envelope, Sound uses loudness + time-slice features only, and Clap or Whistle becomes "Clap or Knock".
- [ ] How fast ADC2 `analogRead` runs on GPIO 4 (target ≥8 kHz sustained with `micros()` pacing).
- [ ] MPU6050 boards in the kit: the `WHO_AM_I` value (genuine 0x68; clones return 0x70/0x72/0x98) and the AD0 address (0x68 or 0x69).
- [ ] The MPU6050 at 100 kHz I2C alongside OLED (0x3C) and HW-605 (0x57): no address clash expected; confirm reads at 100 Hz.

### Phase 1: MPU6050 part (prerequisite, already started)
- Add `mpu6050` to `domain/modules.js`: I2C, `extraValues: [{name:'tiltAngle'}, {name:'shakeLevel'}]`, action `read_motion`. The uncommitted `condition.js`/`sensorReads.js` changes already expect this shape.
- Raw `Wire` driver in codegen (no library):
  - wake it with `PWR_MGMT_1 = 0`
  - ±2 g / ±250 °/s ranges
  - burst-read 14 bytes from `0x3B`
  - try 0x68, then 0x69
  - accept any `WHO_AM_I` value but print it.
- Read failure: `tiltAngle = 0`, `shakeLevel = -1`, print `MPU6050: not found - check the I2C cable` once.
- Port rules: I2C or I2C1, shares the bus with OLED/HW-605, works with Cloud (no ADC2).
- Tests: module present, port picking, codegen includes `Wire.h` once even with OLED + HW-605.

### Phase 2: Core domain (`src/beginner-studio/domain/ai/`)
**`aiKinds.js`**
- Kinds: `motion` (needs mpu6050, event), `sound` (needs mic, event), `sensors` (continuous).
- Sensors kind uses parts with a numeric reading: pot, soil, mq2, dht (temperature + humidity), ultra, ir, pir, reed, ldr, flame, water, mic loudness.
  - Excluded: pulse (needs continuous sampling), rfid and hc05 (not numbers), btn (an If block already covers it).
- `availableKinds(connections)` returns the kinds the current wiring allows.
- `featureNames(kind, connections)` and `signature(kind, connections)`:
  - The signature covers the kind, `FEATURE_VERSION`, and the sorted module ids of the parts used.
  - The jack is not part of it: moving the mic from A1 to A2 keeps the examples.
- Limits: 2–4 things; names 1–16 characters, unique ignoring case, not "Nothing" / "Not sure"; 10 examples per thing before Train, 40 max.

**`knn.js`** (pure, deterministic)
- Standardise with the mean and standard deviation from the training data.
  - A feature whose standard deviation is under 1e-6 gets weight 0 (a constant sensor would otherwise divide by zero).
- k = 3 in Euclidean distance. A 1-1-1 vote goes to the single nearest example.
  - With 2 things and k = 3 there are no ties.
- "Not sure" distance limit: for each thing, take the 95th percentile of each example's nearest same-thing distance (leave-one-take-out), times 1.5. Also "Not sure" when the vote is split and the nearest example is beyond the limit.
- `accuracy(samples)`: leave-one-take-out. With a single take per thing, fall back to leave-one-out and set the label "rough guess, record another take".
- `tooAlike(samples)`: the pair of things the leave-one-take-out run confuses most, or whose centres are closer than 1.5 × their average spread.
- `outliers(samples)`: examples nearer to another thing's centre than their own; flagged in the list.
- Imbalance: warn when the largest thing has more than 2× the examples of the smallest.

**`aiLine.js`** (serial protocol parser)
- The board sends `TBAI1,H,<kind>,<sig>,<n>` once at start and after every 50 lines, then `TBAI1,F,<take>,<f1..fn>` per example and `TBAI1,E,<code>` for errors.
- Each line is checked in order:
  1. The prefix and version must match.
  2. The field count must equal `n` from the header.
  3. Every value must be finite.
  4. The line must be at most 400 characters.
- Lines arriving before a header with the current signature are ignored. The browser can't trust a recorder that was uploaded before the wiring changed.
- Junk is dropped without a message: half-lines, ESP32 boot noise at 115200 shown at 9600, and normal sketch output.
- Error codes:
  - `no_mpu`: "Check the I2C cable"
  - `mic_flat`: "The mic reads the same value; check the A-port cable"
  - `too_fast`: the board is overloaded.

**`aiFirmware.js`** (C emitters, shared by the recorder and the real sketch)
- `aiCapture(float *f)` per kind. It returns `true` with features, or `false` when no event happened before the timeout.
  - **Motion:** a 100 Hz ring buffer, triggered when |accel| − 1 g or |gyro| goes over a threshold calibrated at boot. The window is 1 s, including 200 ms before the trigger. For each of the 6 axes: mean, standard deviation, min and max, giving 24 features.
  - **Sound:** the DC offset is removed (running mean). The trigger is loudness above the ambient level × 3, with ambient tracked by a slow EMA when quiet. The window is 0.5 s, including 50 ms before the trigger. Features (13): RMS, peak, zero-crossing rate, Goertzel energy at 4 bands (the bands depend on the sample rate from Phase 0), and RMS in 4 time slices. The buffer is `int16_t[4000]`, 8 KB, held in a static.
  - **Sensors:** a 1 s average of each part's existing reader.
    - DHT reuses its 2 s cached value.
    - Ultrasonic uses the median of 5 readings, and −1 is stored as the last good value.
    - This kind is always `true` (no events).
- `aiClassify()`:
  - The model data is `const float` arrays in flash: mean, scale, examples, labels and limits.
  - The maths is in `float`.
  - It returns the thing index, `-1` for "Not sure", or `-2` for "Nothing".
- The recorder loop calls `aiCapture`, prints a `TBAI1,F` line, and repeats. It prints `H` lines periodically and blinks the onboard LED on each capture so the student sees it worked.
- The real sketch: `aiAsk()` runs `aiCapture` (a 2 s event timeout), then `aiClassify`, and stores the result in `aiAnswer`. It prints `AI: wave` / `AI: not sure` / `AI: nothing`, rate-limited.

### Phase 3: State, autosave, undo
- `state.ai = null | {kind, things:[{id, name}], samples:[{thing, take, f:[...]}], sig}`. Samples are rounded to 4 significant digits.
- `autosave.js`:
  - `VERSION = 2`; `loadProject` accepts v1 (with `ai: null`) and v2.
  - `cleanAi()` drops anything malformed: unknown thing ids, wrong feature length, non-finite values, more than 4 things.
  - `useAutosave` effect deps add `state.ai`.
  - Size: ~160 examples × 24 values is ~25 KB, well under quota. A save failure (`false`) shows a status-bar warning; today it's silent.
- `useUndoHistory`:
  - The snapshot adds `ai`.
  - A take arrives about every second, but `MERGE_MS` is only 700 ms. While recording, merging is forced so one take is one undo step.
  - Undo/redo are disabled while recording (otherwise undo would delete samples mid-take).
- `useStudioActions`: `setAiKind` (it clears samples, so the UI asks first), `addThing`, `renameThing`, `removeThing` (it deletes that thing's samples), `addSamples`, `deleteSample`, `deleteTake`, `clearThing`.
- Loading a template or a project replaces `ai`, the same way it replaces wiring.

### Phase 4: Teach page
- The **AI** button sits in `TopBar.jsx` next to IoT and opens `view: 'ai'` (the same pattern as the Cloud page in `App.jsx`).
- `components/ai/TeachView.jsx` has three steps.
  1. **Pick what it pays attention to**
     - It shows only the kinds the wiring allows.
     - With none available it says what to wire, e.g. "Add the motion sensor or the microphone", with an Add button.
  2. **Get board ready**
     - It uploads the recorder through `uploadCode` (`UploadContext`) and starts listening through `addSerialDataListener` + `createLineSplitter` (as `listenToBoard` in `useCloudLive.js`).
     - The page shows "Board ready" once a header with the current signature arrives.
  3. **Teach**
     - There is one card per thing: name, example count and a Record button.
     - Record shows "Do it now: 10 more" with a live level bar; each captured example appears as a mini sparkline with ✕.
     - Train shows "The AI got 18 of 20 right", plus warnings for things that are too alike, outliers and imbalance.
     - **Try it** shows live guesses, including "Not sure" and "Nothing", computed in the browser from the recorder stream.
- `hooks/useAiRecorder.js` holds the recording logic.
  - The first example after Record is discarded if it started before the click.
  - An example in flight when recording stops is dropped.
  - On disconnect it keeps what's recorded and shows "Board unplugged — plug it back and click Get board ready".
  - When an upload starts, it pauses and stops listening (the pipeline closes the port).
  - It keeps a `boardHas: 'recorder' | 'program' | null` flag for the session.
- Leaving the Teach page while the recorder is on the board shows a banner: "The board is running the AI recorder. Upload your program to use it." The Upload button turns highlighted.
- When Web Serial isn't available (Firefox, Safari, phone), things can still be edited, but recording shows the existing "Use Chrome or Edge on a computer" message.
- The serial monitor panel still shows TBAI lines. The Teach page has a "hide AI lines" filter.
- Keyboard: Space starts Record on the focused card, Esc stops it; the cards are buttons with `aria-pressed`.

### Phase 5: Blocks and codegen
- **Ask the AI** (`ai_ask`):
  - It's a silent read in `sensorReads.js` (added to `SILENT_READS` / `READ_BLOCKS`, var `aiAnswer`).
  - Codegen inserts it automatically before any `AI thinks it is` condition, exactly like the other sensors.
- **AI thinks it is [thing]** (`ai_is` sensor option in `condition.js`):
  - It stores the **thing id**, not the name, so renaming keeps it working.
  - The options are the things plus "Not sure" and "Nothing" (event kinds only).
- `blockMeta.js` and `ProgramBlock.jsx` get the labels and the dropdown.
  - A block pointing at a deleted thing shows "pick a thing" in red.
- Codegen:
  - The model, helpers, `Wire`/buffer setup and `aiAsk` are emitted **only when the program uses AI blocks**.
  - AI state alone adds nothing.
- Upload is blocked (via the same path as `cloudUploadProblem`, as a new `aiUploadProblem`) when the program uses AI blocks and any of these holds:
  - the AI is missing, or has fewer than 2 things with 10+ examples each ("Teach the AI first");
  - the signature doesn't match the wiring ("You changed the parts the AI listens to. Record again on the AI page.");
  - a block points at a deleted thing;
  - `kind === 'sound'` while Cloud is wired. In practice the shelf already stops this, but the check stays as a guard for old saves.
- Cloud: when Cloud is on and the program uses AI, each thing becomes a reading `ai_<slug>` (0/1, slugs de-duplicated, e.g. `ai_wave`, `ai_wave2`). It's sent only on change, plus the usual heartbeat. If wired readings plus AI keys would exceed 24, Upload is blocked with a clear message.
- Thing names go through `cText` escaping in C strings, so quotes, backslashes and emoji are safe.

### Phase 6: Templates
They ship with things but no examples, and open on the Teach page:
- **Magic Wand** (MPU6050 + LED + buzzer): `wave`, `circle`, `flick`.
- **Clap or Whistle** (mic + LED): `clap`, `whistle`. If Phase 0 finds only an envelope, it becomes `clap`, `knock`.
- **Room Mood** (LDR + DHT + ultrasonic + LED): `empty`, `someone here`, `lights off`.
- **Phone AI Alert** (Cloud + MPU6050): `knock on door`, `door opens`. A1–A4 aren't used, so the template is legal with Cloud.
- `scripts/check-templates.js` and `check-kit-projects.js` must pass. The templates must be legal under the Cloud and ADC2 rules.

### Phase 7: Verification and docs
- Unit tests:
  - `knn`: two clean clusters give 100%; overlapping clusters give "tooAlike"; a point far from everything gives "Not sure"; constant features; 1-1-1 votes; the leave-one-take-out leakage case.
  - `aiLine`: partial lines, a stale signature, the wrong field count, NaN, boot noise.
  - `autosave`: v1 to v2 migration, malformed AI data dropped.
  - Undo: one take is one step; undo is disabled while recording.
  - Codegen: the AI is absent when unused; arrays and lengths are consistent; Upload is blocked in each of the four cases above; the Cloud reading keys; the recorder keeps the pumps off.
  - A **JS mirror of `aiClassify`** on 50 fixed vectors must match `knn.predict`. Ties within 1e-5 are allowed, because the board uses `float` and JS uses `double`.
- Size guard: the full sketch for Cloud + Motion with 4×40 examples stays under the 128 KB compile payload. Compile it once through the compile server and record the flash/RAM figures.
- Browser check: Teach page with a fake serial stream (inject lines through `addSerialDataListener`).
- Board runs: one per kind, plus a noisy-room test for Sound, and unplugging mid-take.
- Add an "Edge AI" section to `ARCHITECTURE.md`: the jack rules, the protocol and the limits.

## Edge cases at a glance
| Area | Case | Handling |
|---|---|---|
| Saved data | Old v1 saves | Migrated, `ai: null` |
| Saved data | Corrupt AI data | Dropped field by field; the rest of the project loads |
| Saved data | Storage full / private mode | Status-bar warning (today it's silent) |
| Wiring | Part removed or added after training | Signature mismatch: Upload blocked, "Record again" |
| Wiring | Part moved to another jack | Examples kept |
| Wiring | Mic + Cloud | Already impossible (A ports are locked); also guarded at Upload |
| Wiring | Two of the same sensor | Features named by connection; both used |
| Wiring | The only AI part deleted | Kind unavailable; blocks red; Upload blocked |
| Recording | Both hands busy | Event capture; no holding needed |
| Recording | Neighbour claps while recording "whistle" | Outlier flag + ✕ on each example |
| Recording | Recorder from before a wiring change | Header signature mismatch; lines ignored; "Get board ready" again |
| Recording | Board unplugged mid-take, or an upload starts | Samples kept, recording paused |
| Recording | First or last example cut by Record/Stop | Discarded |
| Recording | MPU clone / not found | Accept any WHO_AM_I value; `no_mpu` message |
| Training | Constant feature | Weight 0 |
| Training | One take per thing | Leave-one-out fallback, "rough guess" label |
| Training | Uneven counts | Warning above 2× |
| Training | Two things too alike | Named pair + tip ("make them more different") |
| Board | Board still runs the recorder | Banner + highlighted Upload |
| Board | Student uses `wait 5` with AI | Fine, Ask blocks when called; doc tip about loop speed |
| Board | float vs double differences | Mirror test with tolerance |
| Board | I2C shared with OLED/HW-605 | Same task, same bus speed (100 kHz) |
| Board | Sketch size with Cloud | Size guard test + one real compile |
| Names | Rename after blocks use it | Blocks keep the id |
| Names | Quotes / emoji / duplicates / reserved | Escaped in C; unique; "Nothing" and "Not sure" reserved |
| Names | Cloud key limits | Slug + de-duplication; block Upload above 24 keys |
| Browser | No Web Serial | Editing allowed; recording shows the Chrome/Edge message |

## Files
- New:
  - `domain/ai/aiKinds.js`, `knn.js`, `aiLine.js`, `aiFirmware.js`
  - `components/ai/TeachView.jsx` (+ `ThingCard.jsx`, `TryIt.jsx`)
  - `hooks/useAiRecorder.js`
  - tests under `test/unit/beginner-studio/ai/`
- Changed:
  - Domain: `modules.js`, `codegen.js`, `condition.js`, `sensorReads.js`, `blockMeta.js`, `autosave.js`, `templates.js`, `cloud.js`
  - Hooks: `useStudioActions.js`, `useUndoHistory.js`, `useAutosave.js`
  - Components and context: `ProgramBlock.jsx`, `TopBar.jsx`, `App.jsx`, `StudioContext.jsx`, `UploadContext.jsx`
  - Docs: `ARCHITECTURE.md`
