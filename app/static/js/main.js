console.log("main.js is being executed");

// Function to initialize when the page is ready
function initApp() {
  console.log("Initializing app...");

  // DOM Elements
  const passageText = document.getElementById("passage-text");
  const readBtn = document.getElementById("read-btn");
  const restartBtn = document.getElementById("restart-btn");
  const practiceBtn = document.getElementById("practice-btn");
  const feedbackText = document.getElementById("feedback-text");
  const feedbackHistory = document.getElementById("feedback-history");
  const playBtn = document.querySelector(".play-btn");
  const muteBtn = document.querySelector(".mute-btn");
  const progressBar = document.querySelector(".progress");
  const testHighlighterBtn = document.getElementById("test-highlighter-btn");

  console.log("DOM elements found:", {
    passageText: !!passageText,
    readBtn: !!readBtn,
    restartBtn: !!restartBtn,
    practiceBtn: !!practiceBtn,
    testHighlighterBtn: !!testHighlighterBtn,
  });

  // Global variables
  let audioElement = null;
  let recordingAudio = null;
  let currentMode = "idle"; // 'idle', 'reading', 'practicing'
  let audioLevelMonitor = null;

  // Try to initialize text highlighter and audio recorder
  try {
    if (window.TextHighlighter) {
      console.log("TextHighlighter found, initializing...");
      window.TextHighlighter.initialize(
        passageText,
        [],
        onHighlightingComplete
      );
      console.log("TextHighlighter initialized successfully");
    } else {
      console.error("TextHighlighter is not defined");
    }

    if (typeof AudioRecorder !== "undefined") {
      AudioRecorder.initialize(onRecordingStart, onRecordingComplete);
      console.log("AudioRecorder initialized");
    } else {
      console.error("AudioRecorder is not defined");
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
    const text = passageText.textContent;
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

    // Get the passage text
    const text = passageText ? passageText.textContent : "";
    console.log("Text to process:", text);

    try {
      // Show we're processing
      if (passageText) {
        passageText.style.opacity = "0.5";
      }

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
      if (passageText) {
        passageText.style.opacity = "1";
      }

      if (data.success) {
        console.log("Speech generated successfully");

        // Log full timing data for debugging
        console.log("Complete timing data:", data.char_timings);
        console.log("First few timings:", data.char_timings.slice(0, 5));

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
          passageText.innerHTML = "";
          const chars = text.split("");
          chars.forEach((char, i) => {
            const span = document.createElement("span");
            span.textContent = char === " " ? "\u00A0" : char;
            span.classList.add("char");
            span.dataset.index = i;
            passageText.appendChild(span);
          });
          console.log("Prepared spans for highlighting");
        }

        // DIRECT HIGHLIGHTING TEST - highlight the first 5 characters directly
        // This will verify if the spans can be highlighted properly
        //if (data.char_timings && data.char_timings.length > 0) {
        //  console.log("Testing direct highlighting of first few characters");
        //  const charSpans = passageText.querySelectorAll(".char");

        // Clear any previous highlights
        //charSpans.forEach((span) => span.classList.remove("highlighted"));

        // Try highlighting the first few characters
        //for (let i = 0; i < 5 && i < data.char_timings.length; i++) {
        //const timing = data.char_timings[i];
        // const index = timing.char_index;

        //if (index < charSpans.length) {
        //setTimeout(() => {
        //  console.log(
        //    `Directly highlighting char ${index}: ${charSpans[index].textContent}`
        //  );
        //  charSpans[index].classList.add("highlighted");
        //}, (i + 1) * 500); // Highlight every 500ms
        //}
        //}
        //}

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
            const charSpans = passageText.querySelectorAll(".char");

            // Clear any previous highlights and timeouts
            if (window.highlightTimeouts) {
              window.highlightTimeouts.forEach((timeout) =>
                clearTimeout(timeout)
              );
            }
            window.highlightTimeouts = [];

            charSpans.forEach((span) => span.classList.remove("highlighted"));

            // Set up timeouts for each character based on timing data
            data.char_timings.forEach((timing) => {
              const index = timing.char_index;
              const startTime = timing.start_time * 1000; // Convert to ms

              if (index < charSpans.length) {
                const timeout = setTimeout(() => {
                  charSpans[index].classList.add("highlighted");
                }, startTime);

                window.highlightTimeouts.push(timeout);
              }
            });
          });

          // Play the audio
          audioElement.play().catch((error) => {
            console.error("Error playing audio:", error);
          });
        });

        // Fallback if loadedmetadata doesn't fire
        setTimeout(() => {
          if (audioElement && audioElement.paused) {
            console.log("Fallback: Playing audio after timeout");
            audioElement
              .play()
              .catch((e) => console.error("Error in fallback play:", e));
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
      if (passageText) {
        passageText.style.opacity = "1";
      }
    }

    return false;
  }

  // Handle "Restart" button click
  function handleRestartClick(e) {
    console.log("Restart button clicked");
    if (e) e.preventDefault();

    // Reset playback
    resetPlayback();

    // Clear any highlight timeouts
    if (window.highlightTimeouts) {
      window.highlightTimeouts.forEach((timeout) => clearTimeout(timeout));
      window.highlightTimeouts = [];
    }

    // Remove all highlighting from characters
    const charSpans = document.querySelectorAll(".char");
    charSpans.forEach((span) => span.classList.remove("highlighted"));

    // Reset TextHighlighter if available (for backward compatibility)
    if (TextHighlighter && TextHighlighter.reset) {
      TextHighlighter.reset();
    }

    // Stop recording if active
    if (AudioRecorder && AudioRecorder.isActive && AudioRecorder.isActive()) {
      AudioRecorder.stopRecording();
    }

    currentMode = "idle";

    return false;
  }

  // Handle "Practice" button click
  function handlePracticeClick(e) {
    console.log("Practice button clicked");
    if (e) e.preventDefault();

    if (currentMode !== "idle") return;

    // If already recording, stop recording
    if (AudioRecorder && AudioRecorder.isActive && AudioRecorder.isActive()) {
      AudioRecorder.stopRecording();
      return false;
    }

    currentMode = "practicing";
    if (TextHighlighter && TextHighlighter.reset) TextHighlighter.reset();

    // Start recording
    let success = false;

    if (AudioRecorder && AudioRecorder.startRecording) {
      success = AudioRecorder.startRecording();
    }

    if (success) {
      // Start highlighting at the same pace as the model
      if (TextHighlighter && TextHighlighter.startHighlighting) {
        TextHighlighter.startHighlighting();
      }
    } else {
      alert(
        "Failed to start recording. Please ensure microphone permissions are granted."
      );
      currentMode = "idle";
    }

    return false;
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

        // Send audio to server for analysis
        const response = await fetch("/analyze-speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            audio: base64Audio,
            passage: passageText ? passageText.textContent : "",
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
    if (!recordingAudio) return;

    console.log("Setting up recording playback");

    // Set up playback controls
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (recordingAudio.paused) {
          recordingAudio.play();
          playBtn.textContent = "⏸";
        } else {
          recordingAudio.pause();
          playBtn.textContent = "▶";
        }
      });
    }

    // Update progress bar during playback
    recordingAudio.addEventListener("timeupdate", () => {
      const progress =
        (recordingAudio.currentTime / recordingAudio.duration) * 100;
      if (progressBar) progressBar.style.width = `${progress}%`;
    });

    // Reset play button when audio ends
    recordingAudio.addEventListener("ended", () => {
      if (playBtn) playBtn.textContent = "▶";
      if (progressBar) progressBar.style.width = "0%";
    });

    // Handle mute button
    if (muteBtn) {
      muteBtn.addEventListener("click", () => {
        recordingAudio.muted = !recordingAudio.muted;
        muteBtn.textContent = recordingAudio.muted ? "🔇" : "🔊";
      });
    }
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

    if (recordingAudio) {
      if (recordingAudio.paused) {
        recordingAudio.play();
        if (playBtn) playBtn.textContent = "⏸";
      } else {
        recordingAudio.pause();
        if (playBtn) playBtn.textContent = "▶";
      }
    } else if (audioElement) {
      if (audioElement.paused) {
        audioElement.play();
        if (playBtn) playBtn.textContent = "⏸";
      } else {
        audioElement.pause();
        if (playBtn) playBtn.textContent = "▶";
      }
    }

    return false;
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
}

// Try both ways to initialize when the page is loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  // If DOMContentLoaded already fired
  setTimeout(initApp, 100);
}
