console.log("main.js is being executed");

// Global variables
let passageText;
let readBtn;
let restartBtn;
let practiceBtn;
let feedbackText;
let feedbackHistory;
let playBtn;
let muteBtn;
let progressBar;
let audioElement = null;
let recordingAudio = null;
let currentMode = "idle"; // 'idle', 'reading', 'practicing'
let audioLevelMonitor = null;

// Function to initialize when the page is ready
function initApp() {
  console.log("Initializing app...");

  // DOM Elements
  passageText = document.getElementById("passage-text");
  readBtn = document.getElementById("read-btn");
  restartBtn = document.getElementById("restart-btn");
  practiceBtn = document.getElementById("practice-btn");
  feedbackText = document.getElementById("feedback-text");
  feedbackHistory = document.getElementById("feedback-history");
  playBtn = document.querySelector(".play-btn");
  muteBtn = document.querySelector(".mute-btn");
  progressBar = document.querySelector(".progress");
  const testHighlighterBtn = document.getElementById("test-highlighter-btn");
  const testMicBtn = document.getElementById("test-mic-btn");

  console.log("DOM elements found:", {
    passageText: !!passageText,
    readBtn: !!readBtn,
    restartBtn: !!restartBtn,
    practiceBtn: !!practiceBtn,
    testHighlighterBtn: !!testHighlighterBtn,
    testMicBtn: !!testMicBtn,
    playBtn: !!playBtn,
    muteBtn: !!muteBtn,
    progressBar: !!progressBar,
  });

  // Try to initialize text highlighter and audio recorder
  try {
    if (window.TextHighlighter) {
      console.log("TextHighlighter found, initializing...");
      window.TextHighlighter.initialize(passageText, [], function () {
        console.log("Highlighting complete");
        currentMode = "idle";
      });
      console.log("TextHighlighter initialized successfully");
    } else {
      console.error("TextHighlighter is not defined");
    }

    if (typeof AudioRecorder !== "undefined" && AudioRecorder.initialize) {
      AudioRecorder.initialize();
      console.log("AudioRecorder initialized");
    } else {
      console.error(
        "AudioRecorder is not defined or missing initialize method"
      );
    }
  } catch (e) {
    console.error("Error initializing modules:", e);
  }

  // Set up event listeners
  if (readBtn) {
    readBtn.addEventListener("click", handleReadClick);
  }
  if (restartBtn) {
    restartBtn.addEventListener("click", handleRestartClick);
  }
  if (practiceBtn) {
    practiceBtn.addEventListener("click", handlePracticeClick);
  }
  if (playBtn) {
    playBtn.addEventListener("click", togglePlayback);
  }
  if (muteBtn) {
    muteBtn.addEventListener("click", toggleMute);
  }
  if (testHighlighterBtn) {
    testHighlighterBtn.addEventListener("click", testTextHighlighter);
  }
  if (testMicBtn) {
    testMicBtn.addEventListener("click", handleTestMicClick);
  }

  console.log("Event listeners attached");

  // Function to test TextHighlighter
  function testTextHighlighter() {
    console.log("Testing TextHighlighter...");

    if (!passageText) {
      console.error("No passage element found");
      alert("Error: No passage element found");
      return;
    }

    // Create test timing data
    const testTimings = [];
    const text = passageText.value || passageText.textContent;
    for (let i = 0; i < text.length; i++) {
      testTimings.push({
        char: text[i],
        char_index: i,
        start_time: i * 0.1,
        end_time: (i + 1) * 0.1,
      });
    }

    console.log("Created test timing data:", testTimings.length);

    // Initialize with test data
    if (window.TextHighlighter) {
      window.TextHighlighter.initialize(passageText, testTimings, () => {
        console.log("Test highlighting complete");
        alert("Test highlighting complete");
      });

      // Start highlighting
      window.TextHighlighter.startHighlighting();

      console.log("Test highlighting started");
      alert("Test highlighting started");
    } else {
      console.error("TextHighlighter is not available");
      alert("TextHighlighter is not available");
    }
  }

  // Handler when highlighting is complete
  function onHighlightingComplete() {
    console.log("Highlighting complete");
    // If in practice mode, stop recording when highlighting is complete
    if (
      currentMode === "practicing" &&
      AudioRecorder &&
      AudioRecorder.isActive
    ) {
      AudioRecorder.stopRecording();
    }
    currentMode = "idle";
  }

  // Handler when recording starts
  function onRecordingStart() {
    console.log("Recording started");
    // Add recording indicator or UI feedback
    if (practiceBtn) practiceBtn.textContent = "Stop Practice";

    // Start audio level monitoring for visualization
    startAudioLevelMonitor();
  }

  // Handler when recording completes
  function onRecordingComplete(audioBlob, audioUrl) {
    console.log("Recording completed");
    // Stop audio level monitoring
    stopAudioLevelMonitor();

    // Reset button text
    if (practiceBtn) practiceBtn.textContent = "Practice";

    // Analyze the recording
    analyzeSpeech(audioBlob);

    // Store audio for playback
    recordingAudio = new Audio(audioUrl);
    setupRecordingPlayback();
  }

  // Start monitoring audio levels for visualization
  function startAudioLevelMonitor() {
    if (!AudioRecorder || !AudioRecorder.getAudioLevel) return;

    audioLevelMonitor = AudioRecorder.getAudioLevel((level) => {
      // Use the level (0-255) to update a visualization
      console.log(`Audio level: ${level}`);

      // Example: Update progress width based on audio level
      const scaledLevel = (level / 255) * 100;
      if (progressBar) progressBar.style.width = `${scaledLevel}%`;
    });
  }

  // Stop monitoring audio levels
  function stopAudioLevelMonitor() {
    if (audioLevelMonitor) {
      audioLevelMonitor();
      audioLevelMonitor = null;
    }
    if (progressBar) progressBar.style.width = "0%";
  }

  // Handle "Read To Me" button click
  async function handleReadClick(e) {
    console.log("Read button clicked");
    if (e) e.preventDefault();

    if (currentMode !== "idle") return;

    currentMode = "reading";

    // Reset the highlighter
    if (TextHighlighter && TextHighlighter.reset) {
      console.log("Resetting TextHighlighter");
      TextHighlighter.reset();
    }

    // Get the passage text from the textarea
    const text = passageText.value.trim();
    console.log("Text to process:", text);

    // Check if text is empty
    if (!text) {
      alert("Please enter some text to read.");
      currentMode = "idle";
      return false;
    }

    try {
      // Show we're processing
      passageText.style.opacity = "0.5";

      // Generate speech from the server
      const response = await fetch("/generate-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passage: text }),
      });

      const data = await response.json();
      console.log("Received response from server:", {
        success: data.success,
        hasAudioUrl: !!data.audio_url,
        hasCharTimings: !!data.char_timings,
        charTimingsLength: data.char_timings ? data.char_timings.length : 0,
        firstTiming: data.char_timings ? data.char_timings[0] : null,
      });

      // Restore opacity
      passageText.style.opacity = "1";

      if (data.success) {
        console.log("Speech generated successfully");

        // Process and validate timing data
        const processedTimings = [];
        if (data.char_timings && Array.isArray(data.char_timings)) {
          console.log(
            `Received ${data.char_timings.length} timing entries from server`
          );

          // Validate and convert timing data
          data.char_timings.forEach((timing, index) => {
            if (timing && typeof timing === "object") {
              const processedTiming = {
                char: timing.char || "",
                char_index:
                  typeof timing.char_index === "number"
                    ? timing.char_index
                    : parseInt(timing.char_index),
                start_time:
                  typeof timing.start_time === "number"
                    ? timing.start_time
                    : parseFloat(timing.start_time),
                end_time:
                  typeof timing.end_time === "number"
                    ? timing.end_time
                    : parseFloat(timing.end_time),
              };

              // Validate processed timing
              if (
                !isNaN(processedTiming.char_index) &&
                !isNaN(processedTiming.start_time)
              ) {
                processedTimings.push(processedTiming);
              } else {
                console.warn(
                  `Skipping invalid timing at index ${index}:`,
                  timing
                );
              }
            }
          });

          console.log(
            `Processed ${processedTimings.length} valid timing entries`
          );

          // Replace original timings with processed ones
          data.char_timings = processedTimings;
        } else {
          console.warn("No timing data received or invalid timing data format");
          data.char_timings = [];
        }

        // Log full timing data for debugging
        console.log(
          "First few processed timings:",
          data.char_timings.slice(0, 5)
        );

        // Create audio element and load the generated speech
        if (audioElement) {
          audioElement.pause();
          audioElement.remove();
        }

        // Create a completely new audio element
        audioElement = new Audio();
        audioElement.src = data.audio_url;
        audioElement.crossOrigin = "anonymous";
        console.log("Created audio element with URL:", data.audio_url);

        // Prepare the passage for highlighting by creating character spans
        if (passageText) {
          // Store the original text for later
          const originalText = passageText.value;

          // Replace textarea with spans for highlighting
          passageText.style.display = "none";

          // Clean up any existing highlight container
          const existingContainer = document.getElementById(
            "highlight-container"
          );
          if (existingContainer) {
            existingContainer.remove();
          }

          const tempContainer = document.createElement("div");
          tempContainer.id = "highlight-container";

          // Make the container visually distinct
          tempContainer.style.fontSize = "18px";
          tempContainer.style.lineHeight = "1.6";
          tempContainer.style.minHeight = "250px";
          tempContainer.style.maxHeight = "100%";
          tempContainer.style.overflow = "auto";
          tempContainer.style.whiteSpace = "pre-wrap";
          tempContainer.style.wordBreak = "break-word";
          tempContainer.style.padding = "12px";
          tempContainer.style.fontFamily = "Arial, sans-serif";
          tempContainer.style.backgroundColor = "#ffffff";
          tempContainer.style.border = "1px dashed #cccccc"; // Add border for visibility
          tempContainer.style.borderRadius = "5px";

          // Log container creation
          console.log(
            "Created highlighting container with ID:",
            tempContainer.id
          );

          passageText.parentNode.insertBefore(
            tempContainer,
            passageText.nextSibling
          );

          const chars = text.split("");
          chars.forEach((char, i) => {
            const span = document.createElement("span");
            span.textContent = char === " " ? "\u00A0" : char;
            span.classList.add("char");
            span.dataset.index = i;
            tempContainer.appendChild(span);
          });

          console.log("Prepared spans for highlighting:", chars.length);
        }

        // Set up audio with timing-based highlighting
        audioElement.addEventListener("loadedmetadata", () => {
          console.log(
            "Audio metadata loaded, duration:",
            audioElement.duration
          );

          // Now that the audio is loaded, set up the event listeners
          audioElement.addEventListener("play", () => {
            console.log("Audio play event fired");

            // Set up the timing-based highlighting
            const highlightContainer = document.getElementById(
              "highlight-container"
            );
            if (!highlightContainer) {
              console.error("Highlight container not found!");
              return;
            }

            const charSpans = highlightContainer.querySelectorAll(".char");
            console.log("Found character spans:", charSpans.length);

            // Clear any previous highlights and timeouts
            if (window.highlightTimeouts) {
              window.highlightTimeouts.forEach((timeout) =>
                clearTimeout(timeout)
              );
            }
            window.highlightTimeouts = [];

            charSpans.forEach((span) => span.classList.remove("highlighted"));

            // Set up timeouts for each character based on timing data
            if (data.char_timings && data.char_timings.length > 0) {
              console.log(
                "Setting up highlighting timeouts for",
                data.char_timings.length,
                "characters"
              );

              // Log the first few timings for debugging
              console.log(
                "First 5 timing entries:",
                data.char_timings.slice(0, 5)
              );

              data.char_timings.forEach((timing, i) => {
                if (
                  !timing ||
                  typeof timing.char_index === "undefined" ||
                  typeof timing.start_time === "undefined"
                ) {
                  console.error("Invalid timing data at index", i, timing);
                  return;
                }

                const index = timing.char_index;
                const startTime = timing.start_time * 1000; // Convert to ms

                if (index < charSpans.length) {
                  const timeout = setTimeout(() => {
                    console.log(`Highlighting char ${index} at ${startTime}ms`);
                    charSpans[index].classList.add("highlighted");
                  }, startTime);

                  window.highlightTimeouts.push(timeout);
                }
              });
            } else {
              console.error("No valid timing data available for highlighting");
            }
          });

          // When audio ends, restore the textarea
          audioElement.addEventListener("ended", () => {
            console.log("Audio playback ended");
            resetUIAfterPlayback();
            currentMode = "idle";
          });

          // Play the audio
          audioElement.play().catch((error) => {
            console.error("Error playing audio:", error);
            resetUIAfterPlayback();
          });
        });

        // Fallback if loadedmetadata doesn't fire
        setTimeout(() => {
          if (audioElement && audioElement.paused) {
            console.log("Fallback: Playing audio after timeout");
            audioElement.play().catch((e) => {
              console.error("Error in fallback play:", e);
              resetUIAfterPlayback();
            });
          }
        }, 1000);
      } else {
        console.error("Error generating speech:", data.error);
        alert("Error generating speech. Please try again.");
        currentMode = "idle";
      }
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
      currentMode = "idle";
      // Restore opacity
      passageText.style.opacity = "1";
      resetUIAfterPlayback();
    }

    return false;
  }

  // Function to reset UI after playback
  function resetUIAfterPlayback() {
    // Remove temporary highlighting container
    const highlightContainer = document.getElementById("highlight-container");
    if (highlightContainer) {
      highlightContainer.remove();
    }

    // Show the textarea again
    if (passageText) {
      passageText.style.display = "";
    }

    // Clear any timeouts
    if (window.highlightTimeouts) {
      window.highlightTimeouts.forEach((timeout) => clearTimeout(timeout));
      window.highlightTimeouts = [];
    }
  }

  // Handle "Restart" button click
  function handleRestartClick(e) {
    console.log("Restart button clicked");
    if (e) e.preventDefault();

    // Stop and clear any audio elements
    if (audioElement) {
      console.log("Stopping and clearing generated audio");
      audioElement.pause();
      audioElement.src = "";
      audioElement = null;
    }

    if (recordingAudio) {
      console.log("Stopping and clearing recorded audio");
      recordingAudio.pause();
      recordingAudio.src = "";
      recordingAudio = null;
    }

    // Reset UI elements
    resetUIAfterPlayback();

    // Hide recording container
    const recordingContainer = document.querySelector(".recording-container");
    if (recordingContainer) {
      recordingContainer.style.display = "none";
    }

    // Reset play/mute buttons
    const playBtn = document.querySelector(".play-btn");
    if (playBtn) playBtn.textContent = "▶";

    const muteBtn = document.querySelector(".mute-btn");
    if (muteBtn) muteBtn.textContent = "🔊";

    // Reset progress bar
    const progressBar = document.querySelector(".progress");
    if (progressBar) progressBar.style.width = "0%";

    // Reset TextHighlighter if available
    if (window.TextHighlighter && TextHighlighter.reset) {
      TextHighlighter.reset();
    }

    // Stop recording if active
    if (AudioRecorder && AudioRecorder.isActive && AudioRecorder.isActive()) {
      AudioRecorder.stopRecording();
    }

    // Reset button appearance
    if (practiceBtn) {
      practiceBtn.textContent = "Practice";
      practiceBtn.classList.remove("recording-active");
    }

    // Reset textarea opacity
    if (passageText) {
      passageText.style.opacity = "1";
      passageText.style.display = "";
    }

    // Hide highlighting container if exists
    const highlightingContainer = document.getElementById(
      "highlighting-container"
    );
    if (highlightingContainer) {
      highlightingContainer.classList.add("hidden");
    }

    // Remove highlighting-active class from passage box
    const passageBox = document.querySelector(".passage-box");
    if (passageBox) {
      passageBox.classList.remove("highlighting-active");
    }

    // Clear any timeouts
    if (window.highlightTimeouts) {
      window.highlightTimeouts.forEach(clearTimeout);
      window.highlightTimeouts = [];
    }

    currentMode = "idle";
    console.log("Application reset to idle state");

    return false;
  }

  // Handle "Practice" button click
  function handlePracticeClick(e) {
    console.log("Practice button clicked");
    if (e) e.preventDefault();

    // If we're already recording, this acts as a "stop" button
    if (currentMode === "practicing") {
      console.log("Already recording, stopping practice");
      if (AudioRecorder && AudioRecorder.isActive && AudioRecorder.isActive()) {
        console.log("Stopping audio recording");
        AudioRecorder.stopRecording();
      }
      return false;
    }

    if (currentMode !== "idle") {
      console.log("Not in idle mode, ignoring practice click");
      return false;
    }

    // Get text from textarea
    const text = passageText.value.trim();
    if (!text) {
      alert("Please enter some text to practice with.");
      return false;
    }

    console.log("Starting practice with text:", text.slice(0, 30) + "...");
    currentMode = "practicing";

    // Check if AudioRecorder is available
    if (!window.AudioRecorder) {
      console.error("AudioRecorder not available");
      alert(
        "Audio recording functionality is not available. Please check your browser permissions."
      );
      currentMode = "idle";
      return false;
    }

    try {
      // Update button text to show it's now a stop button
      if (practiceBtn) {
        practiceBtn.textContent = "Stop Recording";
        practiceBtn.classList.add("recording-active");
      }

      // Provide visual feedback that recording is starting
      passageText.style.opacity = "0.7";

      // Get timing data from server for highlighting
      fetch("/generate-speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passage: text }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success && data.char_timings) {
            // Prepare the passage for highlighting
            if (passageText) {
              // Store the original text for later
              const originalText = passageText.value;

              // Replace textarea with spans for highlighting
              passageText.style.display = "none";

              // Clean up any existing highlight container
              const existingContainer = document.getElementById(
                "highlight-container"
              );
              if (existingContainer) {
                existingContainer.remove();
              }

              const tempContainer = document.createElement("div");
              tempContainer.id = "highlight-container";

              // Make the container visually distinct
              tempContainer.style.fontSize = "18px";
              tempContainer.style.lineHeight = "1.6";
              tempContainer.style.minHeight = "250px";
              tempContainer.style.maxHeight = "100%";
              tempContainer.style.overflow = "auto";
              tempContainer.style.whiteSpace = "pre-wrap";
              tempContainer.style.wordBreak = "break-word";
              tempContainer.style.padding = "12px";
              tempContainer.style.fontFamily = "Arial, sans-serif";
              tempContainer.style.backgroundColor = "#ffffff";
              tempContainer.style.border = "1px dashed #cccccc";
              tempContainer.style.borderRadius = "5px";

              passageText.parentNode.insertBefore(
                tempContainer,
                passageText.nextSibling
              );

              const chars = text.split("");
              chars.forEach((char, i) => {
                const span = document.createElement("span");
                span.textContent = char === " " ? "\u00A0" : char;
                span.classList.add("char");
                span.dataset.index = i;
                tempContainer.appendChild(span);
              });

              // Set up character highlighting using timing data
              const charSpans = tempContainer.querySelectorAll(".char");

              // Clear any previous highlights and timeouts
              if (window.highlightTimeouts) {
                window.highlightTimeouts.forEach((timeout) =>
                  clearTimeout(timeout)
                );
              }
              window.highlightTimeouts = [];

              // Set up timeouts for each character based on timing data
              data.char_timings.forEach((timing) => {
                if (
                  timing &&
                  typeof timing.char_index === "number" &&
                  typeof timing.start_time === "number"
                ) {
                  const index = timing.char_index;
                  const startTime = timing.start_time * 1000; // Convert to ms

                  if (index < charSpans.length) {
                    const timeout = setTimeout(() => {
                      charSpans[index].classList.add("highlighted");
                    }, startTime);

                    window.highlightTimeouts.push(timeout);
                  }
                }
              });
            }

            // Start recording with a callback for when recording completes
            console.log("Starting audio recording...");
            AudioRecorder.startRecording(function (recordingData) {
              console.log("Recording complete, size:", recordingData.length);

              // Reset button text
              if (practiceBtn) {
                practiceBtn.textContent = "Practice";
                practiceBtn.classList.remove("recording-active");
              }

              // Reset opacity
              passageText.style.opacity = "1";

              // Clear highlighting timeouts
              if (window.highlightTimeouts) {
                window.highlightTimeouts.forEach((timeout) =>
                  clearTimeout(timeout)
                );
                window.highlightTimeouts = [];
              }

              // Restore the textarea
              const highlightContainer = document.getElementById(
                "highlight-container"
              );
              if (highlightContainer) {
                highlightContainer.remove();
              }
              if (passageText) {
                passageText.style.display = "";
              }

              // Create audio element from the recording data
              try {
                console.log("Processing recording data...");
                const audioBlob = dataURItoBlob(recordingData);
                console.log("Created audio blob, size:", audioBlob.size);

                if (audioBlob.size === 0) {
                  console.error("Audio blob is empty");
                  alert("Recording failed, please try again");
                  currentMode = "idle";
                  return;
                }

                const audioUrl = URL.createObjectURL(audioBlob);
                console.log("Created audio URL:", audioUrl);

                // Release any previous recording
                if (recordingAudio) {
                  recordingAudio.pause();
                  recordingAudio.src = "";
                  recordingAudio = null;
                }

                recordingAudio = new Audio(audioUrl);
                recordingAudio.onloadedmetadata = function () {
                  console.log(
                    "Recording loaded, duration:",
                    recordingAudio.duration
                  );
                };
                recordingAudio.onerror = function () {
                  console.error(
                    "Error loading recording:",
                    recordingAudio.error
                  );
                };
                console.log("Created recording audio element");

                // Set up playback controls for the recording
                setupRecordingPlayback();

                // Store the recording data for playback
                window.recordedAudioData = recordingData;

                // Send the recording for analysis
                console.log("Sending recording for analysis...");

                // Get language preferences and accent goal
                const nativeLanguage = document.getElementById(
                  "native-language"
                )
                  ? document.getElementById("native-language").value
                  : "english";
                const targetLanguage = document.getElementById(
                  "target-language"
                )
                  ? document.getElementById("target-language").value
                  : "english";
                const accentGoal = document.getElementById("accent-goal")
                  ? document.getElementById("accent-goal").value
                  : "identify";

                console.log(
                  `Language preferences - Native: ${nativeLanguage}, Target: ${targetLanguage}, Accent Goal: ${accentGoal}`
                );

                fetch("/analyze-speech", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    audio: recordingData,
                    passage: text,
                    native_language: nativeLanguage,
                    target_language: targetLanguage,
                    accent_goal: accentGoal,
                  }),
                })
                  .then((response) => response.json())
                  .then((data) => {
                    console.log("Analysis response received:", data.success);

                    if (data.success) {
                      // Display feedback
                      const feedbackText =
                        document.getElementById("feedback-text");
                      if (feedbackText) {
                        feedbackText.textContent = data.feedback.pronunciation
                          ? data.feedback.pronunciation.details
                          : data.feedback;
                      }

                      // Add to feedback history if available
                      try {
                        if (
                          data.feedback &&
                          typeof data.feedback === "object"
                        ) {
                          // Create a feedback item
                          const feedbackItem = document.createElement("div");
                          feedbackItem.className = "feedback-item";

                          let content = "<h3>Practice Results</h3>";

                          // Check if we have detailed structured feedback
                          if (
                            data.feedback.pronunciation &&
                            data.feedback.fluency
                          ) {
                            // Enhanced feedback display
                            content += `
                              <div class="feedback-section">
                                <h4>Pronunciation: ${
                                  data.feedback.pronunciation.score
                                }/10</h4>
                                <p><strong>Details:</strong> ${
                                  data.feedback.pronunciation.details ||
                                  "No details provided."
                                }</p>
                                ${
                                  data.feedback.pronunciation.tips
                                    ? `<p><strong>Tips:</strong> ${data.feedback.pronunciation.tips}</p>`
                                    : ""
                                }
                              </div>

                              <div class="feedback-section">
                                <h4>Fluency: ${
                                  data.feedback.fluency.score
                                }/10</h4>
                                <p><strong>Details:</strong> ${
                                  data.feedback.fluency.details ||
                                  "No details provided."
                                }</p>
                                ${
                                  data.feedback.fluency.tips
                                    ? `<p><strong>Tips:</strong> ${data.feedback.fluency.tips}</p>`
                                    : ""
                                }
                              </div>

                              ${
                                data.feedback.grammar
                                  ? `
                              <div class="feedback-section">
                                <h4>Grammar: ${
                                  data.feedback.grammar.score
                                }/10</h4>
                                <p><strong>Details:</strong> ${
                                  data.feedback.grammar.details ||
                                  "No details provided."
                                }</p>
                                ${
                                  data.feedback.grammar.tips
                                    ? `<p><strong>Tips:</strong> ${data.feedback.grammar.tips}</p>`
                                    : ""
                                }
                              </div>`
                                  : ""
                              }

                              ${
                                data.feedback.vocabulary
                                  ? `
                              <div class="feedback-section">
                                <h4>Vocabulary: ${
                                  data.feedback.vocabulary.score
                                }/10</h4>
                                <p><strong>Details:</strong> ${
                                  data.feedback.vocabulary.details ||
                                  "No details provided."
                                }</p>
                                ${
                                  data.feedback.vocabulary.tips
                                    ? `<p><strong>Tips:</strong> ${data.feedback.vocabulary.tips}</p>`
                                    : ""
                                }
                              </div>`
                                  : ""
                              }

                              ${
                                data.feedback.voice_quality
                                  ? `
                              <div class="feedback-section">
                                <h4>Voice Quality: ${
                                  data.feedback.voice_quality.score
                                }/10</h4>
                                <p><strong>Details:</strong> ${
                                  data.feedback.voice_quality.details ||
                                  "No details provided."
                                }</p>
                                ${
                                  data.feedback.voice_quality.tips
                                    ? `<p><strong>Tips:</strong> ${data.feedback.voice_quality.tips}</p>`
                                    : ""
                                }
                              </div>`
                                  : ""
                              }

                              ${
                                data.feedback.accent
                                  ? `
                              <div class="feedback-section">
                                <h4>Accent</h4>
                                <p><strong>Identification:</strong> ${
                                  data.feedback.accent.identification ||
                                  "Not identified"
                                }</p>
                                <p><strong>Intensity:</strong> ${
                                  data.feedback.accent.intensity ||
                                  "Not specified"
                                }</p>
                              </div>`
                                  : ""
                              }

                              ${
                                data.feedback.overall
                                  ? `
                              <div class="feedback-section overall-feedback">
                                <h4>Overall: ${
                                  data.feedback.overall.score
                                }/10</h4>
                                <p>${
                                  data.feedback.overall.summary ||
                                  "No summary provided."
                                }</p>
                              </div>`
                                  : ""
                              }
                            `;
                          } else if (data.feedback.pronunciation) {
                            // Legacy format for backward compatibility
                            content += `
                              <p><strong>Pronunciation:</strong> ${
                                data.feedback.pronunciation.score || "N/A"
                              }/10 - ${
                              data.feedback.pronunciation.details ||
                              "No details"
                            }</p>
                              <p><strong>Rhythm:</strong> ${
                                data.feedback.rhythm
                                  ? data.feedback.rhythm.score || "N/A"
                                  : "N/A"
                              }/10</p>
                              <p><strong>Clarity:</strong> ${
                                data.feedback.clarity
                                  ? data.feedback.clarity.score || "N/A"
                                  : "N/A"
                              }/10</p>
                            `;
                          } else {
                            // Simple feedback
                            content += `<p>${JSON.stringify(
                              data.feedback
                            )}</p>`;
                          }

                          feedbackItem.innerHTML = content;

                          // Add to history
                          const feedbackHistory =
                            document.getElementById("feedback-history");
                          if (feedbackHistory) {
                            if (feedbackHistory.firstChild) {
                              feedbackHistory.insertBefore(
                                feedbackItem,
                                feedbackHistory.firstChild
                              );
                            } else {
                              feedbackHistory.appendChild(feedbackItem);
                            }
                          }

                          // Also update the main feedback display
                          const feedbackText =
                            document.getElementById("feedback-text");
                          if (feedbackText) {
                            if (
                              data.feedback.overall &&
                              data.feedback.overall.summary
                            ) {
                              feedbackText.innerHTML = `<p><strong>Overall Score: ${data.feedback.overall.score}/10</strong></p>
                                                      <p>${data.feedback.overall.summary}</p>`;
                            } else if (data.feedback.pronunciation) {
                              feedbackText.textContent =
                                data.feedback.pronunciation.details ||
                                "Analysis complete. See detailed results below.";
                            }
                          }
                        }
                      } catch (e) {
                        console.error(
                          "Error creating feedback history item:",
                          e
                        );
                      }
                    } else {
                      console.error("Error analyzing speech:", data.error);
                      alert("Error analyzing your speech: " + data.error);
                    }

                    currentMode = "idle";
                  })
                  .catch((error) => {
                    console.error("Error in analyze-speech request:", error);
                    alert(
                      "An error occurred during analysis. Please try again."
                    );
                    currentMode = "idle";
                    passageText.style.opacity = "1";
                  });
              } catch (error) {
                console.error("Error creating audio from recording:", error);
                alert("Error processing recording: " + error.message);
                currentMode = "idle";
                return;
              }
            });
          } else {
            console.error("Error getting timing data:", data.error);
            alert("Error preparing practice mode. Please try again.");
            currentMode = "idle";
            passageText.style.opacity = "1";
          }
        })
        .catch((error) => {
          console.error("Error getting timing data:", error);
          alert("Error preparing practice mode. Please try again.");
          currentMode = "idle";
          passageText.style.opacity = "1";
        });

      console.log("Recording started successfully");
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not start recording: " + error.message);
      currentMode = "idle";
      passageText.style.opacity = "1";

      // Reset button if error
      if (practiceBtn) {
        practiceBtn.textContent = "Practice";
        practiceBtn.classList.remove("recording-active");
      }
    }

    return false;
  }

  // Helper function to convert data URI to Blob
  function dataURItoBlob(dataURI) {
    console.log(
      "Converting data URI to blob, format:",
      dataURI.substring(0, 30) + "..."
    );

    try {
      // Check if it's already in data URI format
      if (dataURI.indexOf("data:") === 0) {
        const byteString = atob(dataURI.split(",")[1]);
        const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);

        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        // Always convert to MP3 format
        return new Blob([ab], { type: "audio/mp3" });
      } else {
        // Handle base64 without data URI prefix
        const byteString = atob(dataURI);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);

        for (let i = 0; i < byteString.length; i++) {
          ia[i] = byteString.charCodeAt(i);
        }

        // Use audio/mp3 as default MIME type
        return new Blob([ab], { type: "audio/mp3" });
      }
    } catch (error) {
      console.error("Error converting data URI to blob:", error);
      return new Blob([], { type: "audio/mp3" });
    }
  }

  // Analyze user's speech recording
  async function analyzeSpeech(audioBlob) {
    if (!audioBlob) {
      console.error("No audio blob to analyze");
      return;
    }

    try {
      console.log("Analyzing speech...");
      // Convert blob to base64
      const reader = new FileReader();

      reader.onload = async function () {
        const base64Audio = reader.result;

        // Get language preferences
        const nativeLanguage = document.getElementById("native-language")
          ? document.getElementById("native-language").value
          : "english";
        const targetLanguage = document.getElementById("target-language")
          ? document.getElementById("target-language").value
          : "english";
        const accentGoal = document.getElementById("accent-goal")
          ? document.getElementById("accent-goal").value
          : "identify";

        console.log(
          `Analyzing with preferences - Native: ${nativeLanguage}, Target: ${targetLanguage}, Accent Goal: ${accentGoal}`
        );

        // Send audio to server for analysis
        const response = await fetch("/analyze-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio: base64Audio,
            passage: passageText ? passageText.textContent : "",
            native_language: nativeLanguage,
            target_language: targetLanguage,
            accent_goal: accentGoal,
          }),
        });

        const data = await response.json();

        if (data.success) {
          console.log("Speech analysis complete");
          displayFeedback(data.feedback);
        } else {
          console.error("Error analyzing speech:", data.error);
          alert("Error analyzing speech. Please try again.");
        }
      };

      reader.readAsDataURL(audioBlob);
    } catch (error) {
      console.error("Error:", error);
      alert("An error occurred. Please try again.");
    }
  }

  // Display feedback from the server
  function displayFeedback(feedback) {
    console.log("Displaying feedback:", feedback);

    // Set the main feedback text
    if (feedbackText) {
      feedbackText.textContent = feedback.pronunciation.details;
    }

    // Create a feedback item for history
    const feedbackItem = document.createElement("div");
    feedbackItem.className = "feedback-item";

    const content = `
            <p><strong>Pronunciation:</strong> ${feedback.pronunciation.score}/10 - ${feedback.pronunciation.details}</p>
            <p><strong>Rhythm:</strong> ${feedback.rhythm.score}/10 - ${feedback.rhythm.details}</p>
            <p><strong>Clarity:</strong> ${feedback.clarity.score}/10 - ${feedback.clarity.details}</p>
        `;

    feedbackItem.innerHTML = content;

    // Add to history
    if (feedbackHistory) {
      feedbackHistory.prepend(feedbackItem);

      // Scroll to top of history
      feedbackHistory.scrollTop = 0;
    }
  }

  // Set up playback controls for the recording
  function setupRecordingPlayback() {
    if (!recordingAudio) {
      console.error("No recording audio to set up playback for");
      return;
    }

    console.log("Setting up recording playback controls");

    // Make sure recording container is visible
    const recordingContainer = document.querySelector(".recording-container");
    if (recordingContainer) {
      recordingContainer.style.display = "block";
    }

    // Get playback controls
    const playBtn = document.querySelector(".play-btn");
    const progressBar = document.querySelector(".progress");
    const muteBtn = document.querySelector(".mute-btn");

    // Reset play button to initial state
    if (playBtn) {
      playBtn.textContent = "▶";

      // Set up play/pause functionality
      playBtn.onclick = function () {
        console.log("Play button clicked for recording");
        if (recordingAudio.paused) {
          recordingAudio
            .play()
            .then(() => {
              console.log("Recording playback started");
            })
            .catch((err) => {
              console.error("Error playing recording:", err);
            });
          playBtn.textContent = "⏸";
        } else {
          recordingAudio.pause();
          playBtn.textContent = "▶";
        }
      };
    }

    // Update progress bar during playback
    recordingAudio.addEventListener("timeupdate", () => {
      if (progressBar && recordingAudio.duration) {
        const progress =
          (recordingAudio.currentTime / recordingAudio.duration) * 100;
        progressBar.style.width = `${progress}%`;
      }
    });

    // Reset play button when audio ends
    recordingAudio.addEventListener("ended", () => {
      if (playBtn) playBtn.textContent = "▶";
      if (progressBar) progressBar.style.width = "0%";
    });

    // Handle mute button
    if (muteBtn) {
      muteBtn.onclick = function () {
        console.log("Mute button clicked for recording");
        recordingAudio.muted = !recordingAudio.muted;
        muteBtn.textContent = recordingAudio.muted ? "🔇" : "🔊";
      };
    }

    console.log("Recording playback controls set up successfully");
  }

  // Reset audio playback
  function resetPlayback() {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    if (recordingAudio) {
      recordingAudio.pause();
    }
  }

  // Toggle audio playback
  function togglePlayback(e) {
    console.log("Toggle playback clicked");
    if (e) e.preventDefault();

    // Check if we have recorded audio data
    if (window.recordedAudioData) {
      console.log("Playing recorded audio");
      playRecordedAudio(window.recordedAudioData);
      if (playBtn) playBtn.textContent = "⏸";
    } else {
      console.log("No recorded audio exists");
    }

    return false;
  }

  // Function to play recorded audio
  function playRecordedAudio(audioData) {
    try {
      // Create a blob from the base64 audio data
      const audioBlob = dataURItoBlob(audioData);

      // Create an audio element
      const audio = new Audio(URL.createObjectURL(audioBlob));

      // Play the audio
      audio.play().catch((error) => {
        console.error("Error playing audio:", error);
        alert("Error playing audio: " + error.message);
      });

      // Clean up the URL object after the audio is loaded
      audio.onloadeddata = () => {
        URL.revokeObjectURL(audio.src);
      };

      // Update play button text when audio ends
      audio.onended = () => {
        if (playBtn) playBtn.textContent = "▶";
      };
    } catch (error) {
      console.error("Error creating audio blob:", error);
      alert("Error creating audio: " + error.message);
    }
  }

  // Toggle audio mute
  function toggleMute(e) {
    console.log("Toggle mute clicked");
    if (e) e.preventDefault();

    if (recordingAudio) {
      recordingAudio.muted = !recordingAudio.muted;
      if (muteBtn) muteBtn.textContent = recordingAudio.muted ? "🔇" : "🔊";
    } else if (audioElement) {
      audioElement.muted = !audioElement.muted;
      if (muteBtn) muteBtn.textContent = audioElement.muted ? "🔇" : "🔊";
    }

    return false;
  }

  // Handle "Test Microphone" button click
  function handleTestMicClick(e) {
    console.log("Test Microphone button clicked");
    if (e) e.preventDefault();

    if (!window.AudioRecorder) {
      console.error("AudioRecorder not available");
      alert(
        "Audio recording functionality is not available. Please check your browser permissions."
      );
      return false;
    }

    try {
      // Check if mic is already active or being tested
      if (AudioRecorder.isActive && AudioRecorder.isActive()) {
        alert("Microphone is currently active and working!");
        return false;
      }

      // Update status display
      const permissionStatus = document.getElementById("permission-status");
      if (permissionStatus) {
        permissionStatus.textContent = "Testing microphone...";
        permissionStatus.className = "status-pending";
      }

      // Test microphone by requesting access
      AudioRecorder.initialize(function (success) {
        if (success) {
          console.log("Microphone access granted");
          if (permissionStatus) {
            permissionStatus.textContent =
              "Microphone access granted and working!";
            permissionStatus.className = "status-granted";
          }

          // Briefly show audio level to confirm it's working
          let testDuration = 5; // seconds
          let levelMonitor = null;

          // Show a temporary level indicator
          const levelIndicator = document.createElement("div");
          levelIndicator.className = "mic-test-indicator";
          levelIndicator.style.position = "fixed";
          levelIndicator.style.bottom = "20px";
          levelIndicator.style.right = "20px";
          levelIndicator.style.width = "200px";
          levelIndicator.style.height = "30px";
          levelIndicator.style.backgroundColor = "#f0f0f0";
          levelIndicator.style.border = "1px solid #000";
          levelIndicator.style.borderRadius = "5px";
          levelIndicator.style.overflow = "hidden";
          levelIndicator.style.zIndex = "9999";

          const levelBar = document.createElement("div");
          levelBar.style.height = "100%";
          levelBar.style.width = "0%";
          levelBar.style.backgroundColor = "#4CAF50";
          levelBar.style.transition = "width 0.1s ease";

          const levelText = document.createElement("div");
          levelText.style.position = "absolute";
          levelText.style.top = "50%";
          levelText.style.left = "50%";
          levelText.style.transform = "translate(-50%, -50%)";
          levelText.style.color = "#000";
          levelText.style.fontWeight = "bold";
          levelText.textContent = `Testing: ${testDuration}s`;

          levelIndicator.appendChild(levelBar);
          levelIndicator.appendChild(levelText);
          document.body.appendChild(levelIndicator);

          // Start monitoring audio level
          levelMonitor = AudioRecorder.getAudioLevel((level) => {
            // Use the level (0-255) to update the visualization
            const scaledLevel = (level / 255) * 100;
            levelBar.style.width = `${scaledLevel}%`;
          });

          // Update countdown and clean up
          const countdownInterval = setInterval(() => {
            testDuration--;
            levelText.textContent = `Testing: ${testDuration}s`;

            if (testDuration <= 0) {
              clearInterval(countdownInterval);

              // Clean up
              if (levelMonitor) {
                levelMonitor();
              }

              document.body.removeChild(levelIndicator);

              if (permissionStatus) {
                permissionStatus.textContent =
                  "Microphone test complete - Ready to use!";
              }
            }
          }, 1000);
        } else {
          console.error("Microphone access denied");
          if (permissionStatus) {
            permissionStatus.textContent =
              "Microphone access denied! Please check your browser settings.";
            permissionStatus.className = "status-denied";
          }
          alert(
            "Microphone access was denied. Please check your browser settings and permissions."
          );
        }
      });
    } catch (error) {
      console.error("Error testing microphone:", error);
      alert("Error testing microphone: " + error.message);

      if (permissionStatus) {
        permissionStatus.textContent =
          "Error testing microphone: " + error.message;
        permissionStatus.className = "status-error";
      }
    }

    return false;
  }
}

// Try both ways to initialize when the page is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  // If DOMContentLoaded already fired
  setTimeout(initApp, 100);
}
