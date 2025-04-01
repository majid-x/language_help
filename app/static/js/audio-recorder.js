/**
 * Audio Recorder Module
 * Handles audio recording for speech practice
 */

console.log("audio-recorder.js loaded");

const AudioRecorder = {
  // State
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  completionCallback: null,

  // Initialize the audio recorder
  initialize: function () {
    console.log("AudioRecorder initialized");
  },

  // Check if recording is active
  isActive: function () {
    return this.isRecording;
  },

  // Start recording
  startRecording: function (callback) {
    if (this.isRecording) {
      console.log("Already recording, stopping first");
      this.stopRecording();
    }

    this.completionCallback = callback;
    this.audioChunks = [];

    console.log("Requesting microphone access");

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        console.log("Microphone access granted");

        this.mediaRecorder = new MediaRecorder(stream);

        this.mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        });

        this.mediaRecorder.addEventListener("stop", () => {
          console.log("Recording stopped");
          this.isRecording = false;

          // Convert audio chunks to base64 data
          const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
          const reader = new FileReader();

          reader.onloadend = () => {
            const base64data = reader.result;

            if (this.completionCallback) {
              this.completionCallback(base64data);
            }
          };

          reader.readAsDataURL(audioBlob);

          // Stop all tracks in the stream
          stream.getTracks().forEach((track) => track.stop());
        });

        // Start recording
        this.mediaRecorder.start();
        this.isRecording = true;
        console.log("Recording started");

        // Automatically stop after 10 seconds
        setTimeout(() => {
          if (this.isRecording) {
            console.log("Auto-stopping recording after 10 seconds");
            this.stopRecording();
          }
        }, 10000);
      })
      .catch((error) => {
        console.error("Error accessing microphone:", error);
        throw new Error("Could not access microphone: " + error.message);
      });
  },

  // Stop recording
  stopRecording: function () {
    if (this.isRecording && this.mediaRecorder) {
      console.log("Stopping recording");
      this.mediaRecorder.stop();
    } else {
      console.log("Not recording, nothing to stop");
    }
  },
};

// Add to window object
window.AudioRecorder = AudioRecorder;

// Add a test function
window.testAudioRecorder = function () {
  console.log("Testing AudioRecorder");

  try {
    AudioRecorder.startRecording(function (recordingData) {
      console.log("Test recording complete");
      alert("Recording test successful! Data length: " + recordingData.length);
    });

    setTimeout(() => {
      if (AudioRecorder.isActive()) {
        console.log("Stopping test recording after 3 seconds");
        AudioRecorder.stopRecording();
      }
    }, 3000);

    alert("Recording started. Will automatically stop in 3 seconds.");
  } catch (error) {
    console.error("Test recording failed:", error);
    alert("Test recording failed: " + error.message);
  }
};
