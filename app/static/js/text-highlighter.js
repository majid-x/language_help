/**
 * Text Highlighter Module
 * Handles character-by-character text highlighting in sync with audio
 */

console.log("text-highlighter.js loaded");

class TextHighlighter {
  constructor() {
    this.passageElement = null;
    this.charElements = [];
    this.highlightInterval = null;
    this.currentIndex = 0;
    this.charTimings = [];
    this.pauseHighlighting = false;
    this.highlightClassName = "highlighted";
    this.onComplete = null;
    console.log("TextHighlighter constructor called");
  }

  /**
   * Initialize the highlighter
   * @param {HTMLElement} element - The passage element to highlight
   * @param {Array} timings - Array of character timing objects
   * @param {Function} onComplete - Callback when highlighting completes
   */
  initialize(element, timings = [], onComplete = null) {
    console.log("TextHighlighter.initialize called with:", {
      element: element ? "present" : "missing",
      timingsLength: timings ? timings.length : 0,
      timings: timings,
      onComplete: onComplete ? "present" : "missing",
    });

    if (!element) {
      console.error("No element provided to TextHighlighter.initialize");
      return;
    }

    this.passageElement = element;
    this.charTimings = timings || [];
    this.onComplete = onComplete;
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
      let spanContent = "";

      // Create spans for each character, including spaces
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        // Use a non-breaking space for spaces to ensure they're visible
        const displayChar = char === " " ? "\u00A0" : char;
        spanContent += `<span class="char" data-index="${i}">${displayChar}</span>`;
      }

      this.passageElement.innerHTML = spanContent;
      this.charElements = this.passageElement.querySelectorAll(".char");
      console.log(
        `Prepared ${this.charElements.length} characters for highlighting`
      );

      // Verify the spans were created correctly
      console.log(
        "First few characters:",
        Array.from(this.charElements)
          .slice(0, 5)
          .map((el) => ({
            text: el.textContent,
            hasClass: el.classList.contains(this.highlightClassName),
            computedStyle: window.getComputedStyle(el),
          }))
      );
    } catch (e) {
      console.error("Error preparing text:", e);
    }
  }

  /**
   * Start highlighting based on timing data or at a fixed rate
   * @param {number} fixedRate - Rate for highlighting if no timing data (ms)
   */
  startHighlighting(fixedRate = 100) {
    console.log("Starting text highlighting");
    this.reset();
    this.currentIndex = 0;

    if (this.charTimings.length > 0) {
      // Use actual timing data if available
      this.startTimingBasedHighlighting();
    } else {
      // Use fixed rate highlighting
      this.startFixedRateHighlighting(fixedRate);
    }
  }

  /**
   * Start highlighting based on fixed rate
   * @param {number} rate - Milliseconds per character
   */
  startFixedRateHighlighting(rate) {
    if (!this.charElements || this.charElements.length === 0) {
      console.error("No characters to highlight");
      return;
    }

    console.log(`Starting fixed-rate highlighting (${rate}ms per char)`);

    this.highlightInterval = setInterval(() => {
      if (this.pauseHighlighting) return;

      if (this.currentIndex < this.charElements.length) {
        this.charElements[this.currentIndex].classList.add(
          this.highlightClassName
        );
        this.currentIndex++;
      } else {
        this.stopHighlighting();
        if (this.onComplete) this.onComplete();
      }
    }, rate);
  }

  /**
   * Start highlighting based on timing data
   */
  startTimingBasedHighlighting() {
    if (!this.charElements || this.charElements.length === 0) {
      console.error("No characters to highlight");
      return;
    }

    if (!this.charTimings || this.charTimings.length === 0) {
      console.error("No timing data for highlighting");
      this.startFixedRateHighlighting(100); // Fall back to fixed rate
      return;
    }

    console.log("Starting timing-based highlighting with:", {
      numChars: this.charElements.length,
      numTimings: this.charTimings.length,
    });

    // Log the timing data
    this.charTimings.forEach((timing, index) => {
      console.log(`Timing ${index}:`, timing);
    });

    // Create a map of character indices to timing data for faster lookup
    const timingMap = new Map();
    this.charTimings.forEach((timing) => {
      timingMap.set(timing.char_index, timing);
    });

    const startTime = Date.now();
    let lastUpdateTime = startTime;

    const scheduleHighlights = () => {
      const currentTime = Date.now();
      const elapsed = (currentTime - startTime) / 1000; // Convert to seconds
      const deltaTime = (currentTime - lastUpdateTime) / 1000; // Convert to seconds
      lastUpdateTime = currentTime;

      // Find all characters that should be highlighted by now
      for (let i = 0; i < this.charElements.length; i++) {
        const timing = timingMap.get(i);
        if (timing) {
          if (
            elapsed >= timing.start_time &&
            !this.charElements[i].classList.contains(this.highlightClassName)
          ) {
            console.log(
              `Highlighting char ${i}: "${
                this.charElements[i].textContent
              }" at time ${elapsed.toFixed(2)}s`
            );
            this.charElements[i].classList.add(this.highlightClassName);
            this.currentIndex = i + 1;
          }
        }
      }

      // Check if we're done
      if (this.currentIndex >= this.charElements.length) {
        console.log("Highlighting complete");
        this.stopHighlighting();
        if (this.onComplete) this.onComplete();
      } else if (!this.pauseHighlighting) {
        // Schedule next update with a small delay to prevent excessive CPU usage
        setTimeout(scheduleHighlights, 10);
      }
    };

    // Start the highlighting process
    scheduleHighlights();
  }

  /**
   * Pause the highlighting process
   */
  pause() {
    console.log("Pausing text highlighting");
    this.pauseHighlighting = true;
  }

  /**
   * Resume the highlighting process
   */
  resume() {
    console.log("Resuming text highlighting");
    this.pauseHighlighting = false;

    // If using timing-based, we need to restart with adjusted time
    if (this.charTimings.length > 0) {
      this.startTimingBasedHighlighting();
    }
  }

  /**
   * Stop highlighting
   */
  stopHighlighting() {
    console.log("Stopping text highlighting");
    clearInterval(this.highlightInterval);
    this.highlightInterval = null;
  }

  /**
   * Reset highlighting, clearing all highlights
   */
  reset() {
    console.log("Resetting text highlighting");
    this.stopHighlighting();
    this.currentIndex = 0;

    // Remove highlight class from all characters
    if (this.charElements && this.charElements.length > 0) {
      try {
        this.charElements.forEach((char) => {
          if (char && char.classList) {
            char.classList.remove(this.highlightClassName);
          }
        });
      } catch (e) {
        console.error("Error resetting highlights:", e);
      }
    }
  }

  /**
   * Get the current highlight progress (0-1)
   */
  getProgress() {
    if (!this.charElements || this.charElements.length === 0) return 0;
    return this.currentIndex / this.charElements.length;
  }
}

// Create and export the TextHighlighter instance
const textHighlighter = new TextHighlighter();
window.TextHighlighter = textHighlighter;

// Add a test method to verify it's working
window.testTextHighlighter = function () {
  console.log("Testing TextHighlighter...");
  console.log("TextHighlighter instance:", textHighlighter);
  console.log("TextHighlighter methods:", Object.keys(textHighlighter));
  alert("TextHighlighter is available! Check console for details.");
};

// Log when the module is loaded
console.log("TextHighlighter module loaded and initialized");

function testHighlighting(passageElement) {
  console.log("testHighlighting called with passageElement:", passageElement);

  const testTimings = [
    { char_index: 0, start_time: 0, end_time: 0.5 },
    { char_index: 1, start_time: 0.5, end_time: 1 },
    { char_index: 2, start_time: 1, end_time: 1.5 },
    { char_index: 3, start_time: 1.5, end_time: 2 },
    { char_index: 4, start_time: 2, end_time: 2.5 },
    { char_index: 5, start_time: 2.5, end_time: 3 },
    { char_index: 6, start_time: 3, end_time: 3.5 },
    { char_index: 7, start_time: 3.5, end_time: 4 },
    { char_index: 8, start_time: 4, end_time: 4.5 },
    { char_index: 9, start_time: 4.5, end_time: 5 },
    // Add more test timings as needed
  ];

  console.log("Test timings:", testTimings);

  if (window.TextHighlighter) {
    window.TextHighlighter.initialize(passageElement, testTimings, () => {
      console.log("Test highlighting complete");
    });
    window.TextHighlighter.startHighlighting();
  } else {
    console.error("TextHighlighter is not initialized");
  }
}

console.log("Character timings:", data.char_timings);
