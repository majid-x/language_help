/**
 * Audio Recorder Module
 * Handles recording of user speech for practice sessions
 */

console.log("audio-recorder.js loaded");

class AudioRecorder {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.stream = null;
    this.onRecordingComplete = null;
    this.onRecordingStart = null;
    this.maxRecordingTime = 20000; // 20 seconds default
    this.recordingTimer = null;

    console.log("AudioRecorder instance created");
  }

  /**
   * Initialize the recorder
   * @param {Function} onStart - Callback when recording starts
   * @param {Function} onComplete - Callback when recording completes
   * @param {number} maxTime - Maximum recording time in ms
   */
  initialize(onStart, onComplete, maxTime = 20000) {
    console.log("AudioRecorder initializing");
    this.onRecordingStart = onStart || (() => {});
    this.onRecordingComplete = onComplete || (() => {});
    this.maxRecordingTime = maxTime;

    // Check if browser supports recording
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      console.log("Browser supports audio recording");
    } else {
      console.error("Browser does not support audio recording");
      alert(
        "Your browser does not support audio recording. Please try a different browser like Chrome or Firefox."
      );
    }
  }

  /**
   * Start recording audio
   * @returns {Promise} - Resolves when recording starts
   */
  async startRecording() {
    console.log("Starting audio recording...");

    if (this.isRecording) {
      console.warn("Recording already in progress");
      return false;
    }

    try {
      console.log("Requesting microphone access...");
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Microphone access granted");

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.addEventListener("dataavailable", (event) => {
        this.audioChunks.push(event.data);
      });

      this.mediaRecorder.addEventListener("stop", () => {
        console.log("Recording stopped, processing audio...");
        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Stop all tracks to release microphone
        this.stream.getTracks().forEach((track) => track.stop());

        console.log("Audio processed, calling completion callback");
        if (this.onRecordingComplete) {
          this.onRecordingComplete(audioBlob, audioUrl);
        }
      });

      // Start recording
      this.mediaRecorder.start();
      this.isRecording = true;
      console.log("Recording started successfully");

      // Call the start callback
      if (this.onRecordingStart) {
        this.onRecordingStart();
      }

      // Set a timeout to automatically stop recording after max time
      this.recordingTimer = setTimeout(() => {
        if (this.isRecording) {
          console.log("Maximum recording time reached, stopping automatically");
          this.stopRecording();
        }
      }, this.maxRecordingTime);

      return true;
    } catch (error) {
      console.error("Error starting audio recording:", error);

      if (error.name === "NotAllowedError") {
        alert(
          "Microphone access denied. Please allow microphone access and try again."
        );
      } else {
        alert(
          "Error accessing microphone. Please make sure your microphone is connected and works properly."
        );
      }

      return false;
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording() {
    console.log("Stopping audio recording...");

    if (!this.isRecording || !this.mediaRecorder) {
      console.warn("No active recording to stop");
      return;
    }

    clearTimeout(this.recordingTimer);

    try {
      this.mediaRecorder.stop();
      this.isRecording = false;
      console.log("Recording stopped successfully");
    } catch (e) {
      console.error("Error stopping recording:", e);
    }
  }

  /**
   * Check if recording is in progress
   * @returns {boolean} - True if recording is active
   */
  isActive() {
    return this.isRecording;
  }

  /**
   * Get the audio level for visualization
   * @param {Function} callback - Called with current audio level
   * @returns {Function} - Function to stop monitoring
   */
  getAudioLevel(callback) {
    if (!this.stream) {
      console.warn("No active stream for audio level monitoring");
      return () => {};
    }

    try {
      console.log("Starting audio level monitoring");
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(this.stream);
      const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);
      analyser.connect(javascriptNode);
      javascriptNode.connect(audioContext.destination);

      javascriptNode.onaudioprocess = () => {
        const array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        let values = 0;

        const length = array.length;
        for (let i = 0; i < length; i++) {
          values += array[i];
        }

        const average = values / length;
        callback(average);
      };

      return () => {
        console.log("Stopping audio level monitoring");
        javascriptNode.disconnect();
        analyser.disconnect();
        microphone.disconnect();
      };
    } catch (e) {
      console.error("Error setting up audio level monitoring:", e);
      return () => {};
    }
  }
}

// Export as global
window.AudioRecorder = new AudioRecorder();
console.log("AudioRecorder object created and exported to window");

// Add a test method to verify it's working
window.testAudioRecorder = function () {
  alert("AudioRecorder is available!");
};
