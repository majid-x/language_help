/**
 * Text Highlighter Module
 * Handles character-by-character text highlighting in sync with audio
 */

console.log("text-highlighter.js loaded");

class TextHighlighter {
  constructor() {
    this.characters = [];
    this.startTimes = [];
    this.endTimes = [];
    this.audioUrl = "";
    this.highlightClassName = "highlighted";

    this.passageElement = null;
    this.audioElement = null;
    this.activeTimeouts = [];
    console.log("TextHighlighter constructor called");
  }

  /**
   * Initialize the highlighter
   * @param {HTMLElement} element - The passage element to highlight
   * @param {Array} timingData - Array of character timing objects
   * @param {Function} onComplete - Callback when highlighting completes
   */
  initialize(element, timingData = [], onComplete = null) {
    console.log("TextHighlighter.initialize called with:", {
      element: element ? "present" : "missing",
      timingDataLength: timingData ? timingData.length : 0,
      onComplete: onComplete ? "present" : "missing",
    });

    if (!element) {
      console.error("No element provided to TextHighlighter.initialize");
      return;
    }

    this.passageElement = element;
    this.onComplete = onComplete;

    // Extract timing data if provided
    if (timingData && timingData.length > 0) {
      // Convert the timing data to the format we need
      this.characters = [];
      this.startTimes = [];
      this.endTimes = [];

      timingData.forEach((timing) => {
        const index = timing.char_index;
        this.characters[index] = timing.char;
        this.startTimes[index] = timing.start_time;
        this.endTimes[index] = timing.end_time;
      });

      console.log("Timing data processed:", {
        chars: this.characters.length,
        startTimes: this.startTimes.length,
        endTimes: this.endTimes.length,
      });
    }

    // Prepare the text for highlighting
    this.prepareText();
  }

  /**
   * Prepare the text for character-by-character highlighting
   */
  prepareText() {
    if (!this.passageElement) {
      console.error("No passage element to prepare");
      return;
    }

    try {
      const text = this.passageElement.textContent;
      console.log("Preparing text with length:", text.length);

      // If we don't have timing data, use the text content
      if (this.characters.length === 0) {
        this.characters = text.split("");
        console.log(
          "Using text content for characters:",
          this.characters.length
        );
      }

      // Clear previous content
      this.passageElement.innerHTML = "";

      // Wrap each character in a span
      this.characters.forEach((char) => {
        const span = document.createElement("span");
        // Use non-breaking space for spaces to ensure they're visible
        span.textContent = char === " " ? "\u00A0" : char;
        span.classList.add("char");
        this.passageElement.appendChild(span);
      });

      console.log(
        `Prepared ${this.characters.length} characters for highlighting`
      );

      // Output sample of the created spans
      const spans = this.passageElement.querySelectorAll(".char");
      console.log("Sample spans:", Array.from(spans).slice(0, 5));
    } catch (e) {
      console.error("Error preparing text:", e);
    }
  }

  setAudio(audioUrl) {
    this.audioUrl = audioUrl;
    console.log("Audio URL set:", audioUrl);
  }

  /**
   * Start highlighting based on timing data or at a fixed rate
   */
  startHighlighting() {
    console.log("Starting text highlighting");

    // Stop any existing highlighting
    this.stopHighlighting();

    // Reset all characters
    const chars = this.passageElement.querySelectorAll(".char");
    chars.forEach((char) => char.classList.remove(this.highlightClassName));

    // If we have an audio element, play it
    if (this.audioElement) {
      this.audioElement.currentTime = 0;
      this.audioElement.play().catch((err) => {
        console.error("Error playing audio:", err);
      });
    }

    // Only highlight if we have timing data
    if (this.startTimes.length > 0) {
      console.log("Using timing-based highlighting");
      this.startTimingBasedHighlighting();
    } else {
      console.log("Using fixed-rate highlighting");
      this.startFixedRateHighlighting(100);
    }
  }

  /**
   * Start highlighting based on timing data
   */
  startTimingBasedHighlighting() {
    // Debug output timing array lengths
    console.log("Start timing-based highlighting with arrays:", {
      characters: this.characters.length,
      startTimes: this.startTimes.length,
      endTimes: this.endTimes.length,
    });

    // Get all characters as spans
    const chars = this.passageElement.querySelectorAll(".char");
    console.log("Found character spans:", chars.length);

    // Create an array of all defined start times
    const definedStartTimes = this.startTimes
      .map((time, index) => ({ time, index }))
      .filter((item) => item.time !== undefined);

    console.log("Defined start times:", definedStartTimes.length);

    // Schedule highlighting for each character
    definedStartTimes.forEach(({ time, index }) => {
      const startTime = time;

      // Create a timeout to highlight this character
      const highlightTimeout = setTimeout(() => {
        if (index < chars.length) {
          // Add highlighting class
          chars[index].classList.add(this.highlightClassName);
          console.log(
            `Highlighting char ${index} at ${startTime}s: "${chars[index].textContent}"`
          );
        }
      }, startTime * 1000);

      this.activeTimeouts.push(highlightTimeout);

      // Find next character to determine when to unhighlight
      const nextIndex = definedStartTimes.findIndex(
        (item) => item.index > index
      );
      if (nextIndex !== -1) {
        const nextStartTime = definedStartTimes[nextIndex].time;

        // Schedule unhighlighting when next character should be highlighted
        const unhighlightTimeout = setTimeout(() => {
          if (index < chars.length) {
            chars[index].classList.remove(this.highlightClassName);
          }
        }, nextStartTime * 1000);

        this.activeTimeouts.push(unhighlightTimeout);
      }
    });

    // Set final timeout for completion
    if (this.onComplete && definedStartTimes.length > 0) {
      // Find the last timing
      const lastTiming = Math.max(
        ...definedStartTimes.map((item) => item.time)
      );
      const completionTimeout = setTimeout(() => {
        console.log("Highlighting complete (timed)");
        this.reset();
        this.onComplete();
      }, lastTiming * 1000 + 500); // Add a buffer

      this.activeTimeouts.push(completionTimeout);
    }

    console.log("DETAILED TIMING DEBUG");
    console.log("Raw start times:", this.startTimes);
    console.log("First few start times:", this.startTimes.slice(0, 10));
    console.log("Type of first start time:", typeof this.startTimes[0]);
  }

  /**
   * Start highlighting based on fixed rate
   * @param {number} rate - Milliseconds per character
   */
  startFixedRateHighlighting(rate) {
    const chars = this.passageElement.querySelectorAll(".char");
    let currentIndex = 0;

    const highlightInterval = setInterval(() => {
      // Remove highlight from previous character
      if (currentIndex > 0) {
        chars[currentIndex - 1].classList.remove(this.highlightClassName);
      }

      // Highlight current character
      if (currentIndex < chars.length) {
        chars[currentIndex].classList.add(this.highlightClassName);
        console.log(`Highlighting char ${currentIndex} with fixed rate`);
        currentIndex++;
      } else {
        // Done highlighting
        clearInterval(highlightInterval);

        // Call onComplete if provided
        if (this.onComplete) {
          console.log("Highlighting complete");
          this.reset();
          this.onComplete();
        }
      }
    }, rate);

    // Store interval to clear later if needed
    this.highlightInterval = highlightInterval;
  }

  /**
   * Pause the highlighting process
   */
  pause() {
    console.log("Pausing text highlighting");
    // Clear all timeouts
    this.stopHighlighting();

    // Pause audio if it exists
    if (this.audioElement) {
      this.audioElement.pause();
    }
  }

  /**
   * Resume the highlighting process
   */
  resume() {
    console.log("Resuming text highlighting");
    // Not implemented yet - would need to recalculate timing
  }

  /**
   * Stop highlighting
   */
  stopHighlighting() {
    console.log("Stopping text highlighting");

    // Clear all timeouts
    if (this.activeTimeouts) {
      this.activeTimeouts.forEach(clearTimeout);
      this.activeTimeouts = [];
    }

    // Clear interval if it exists
    if (this.highlightInterval) {
      clearInterval(this.highlightInterval);
      this.highlightInterval = null;
    }
  }

  /**
   * Reset highlighting, clearing all highlights
   */
  reset() {
    console.log("Resetting text highlighting");

    // Stop highlighting
    this.stopHighlighting();

    // Reset audio if it exists
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
    }

    // Remove highlights from all characters
    const chars = this.passageElement.querySelectorAll(".char");
    chars.forEach((char) => char.classList.remove(this.highlightClassName));
  }
}

// Create and export the TextHighlighter instance
const textHighlighter = new TextHighlighter();
window.TextHighlighter = textHighlighter;

// Log when the module is loaded
console.log(
  "TextHighlighter module loaded and initialized: ",
  window.TextHighlighter
);

// Add direct test function
window.directTestHighlight = function () {
  console.log("Direct test highlight function called");
  const passageElement = document.getElementById("passage-text");
  if (!passageElement) {
    console.error("Passage element not found");
    return;
  }

  // Prepare the passage with spans
  const text = passageElement.textContent;
  let spanContent = "";
  for (let i = 0; i < text.length; i++) {
    spanContent += `<span class="char">${text[i]}</span>`;
  }
  passageElement.innerHTML = spanContent;

  // Highlight each character one by one
  const chars = passageElement.querySelectorAll(".char");
  let index = 0;

  function highlightNext() {
    if (index > 0) {
      chars[index - 1].classList.remove("highlighted");
    }

    if (index < chars.length) {
      chars[index].classList.add("highlighted");
      index++;
      setTimeout(highlightNext, 100);
    }
  }

  highlightNext();
};

// Add a test method to verify it's working
window.testTextHighlighter = function () {
  console.log("Testing TextHighlighter...");

  // Get the passage element
  const passageElement = document.getElementById("passage-text");
  if (!passageElement) {
    console.error("No passage element found");
    alert("Error: No passage element found");
    return;
  }

  // Create test timing data
  const testTimings = [];
  const text = passageElement.textContent;
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
  textHighlighter.initialize(passageElement, testTimings, () => {
    console.log("Test highlighting complete");
    alert("Test highlighting complete");
  });

  // Start highlighting
  textHighlighter.startHighlighting();

  console.log("Test highlighting started");
  alert("Test highlighting started");
};

// After receiving the data from the server
if (data.success && data.char_timings && data.char_timings.length > 0) {
  console.log("Testing first few timings directly from API");
  const chars = passageText.querySelectorAll(".char");

  // Directly highlight the first 5 characters
  for (let i = 0; i < 5 && i < data.char_timings.length; i++) {
    const timing = data.char_timings[i];
    if (timing && timing.char_index < chars.length) {
      setTimeout(() => {
        chars[timing.char_index].classList.add("highlighted");
      }, i * 500); // Just use a fixed delay for testing
    }
  }
}
