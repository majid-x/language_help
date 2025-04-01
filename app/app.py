from flask import Flask, render_template, request, jsonify
import os
import json
import base64
import sounddevice as sd
import numpy as np
import wave
import re
from dotenv import load_dotenv

# Import service modules
from elevenlabs_service import elevenlabs_service
from openai_service import openai_service

# Load environment variables
load_dotenv()

# Set OpenAI API key
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    print("WARNING: No OpenAI API key found in environment variables.")
    print("Set OPENAI_API_KEY in your .env file or environment variables.")
else:
    print("OpenAI API key found. Length:", len(api_key))

app = Flask(__name__)

# Sample passage (hardcoded)
SAMPLE_PASSAGE = "The rhythmic rain thundered through the rural area yesterday, creating murals of puddles on the asphalt. Thirty-three thirsty children gathered around the water fountain, their voices carrying through the corridor. The authorities particularly wanted to measure whether accurate pronunciation remained consistent..."

@app.route('/')
def index():
    return render_template('index.html', passage=SAMPLE_PASSAGE)

@app.route('/generate-speech', methods=['POST'])
def generate_speech():
    try:
        # Get user-provided passage from the request
        passage = request.json.get('passage', '')
        
        # Use sample passage as fallback if empty (though frontend should prevent this)
        if not passage.strip():
            passage = SAMPLE_PASSAGE
            
        print(f"Generating speech for text: {passage[:50]}...")
        
        # Create a temporary file path (will only be used temporarily)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as temp_file:
            temp_path = temp_file.name
        
        # Use the ElevenLabs service to generate speech with timestamps
        result = elevenlabs_service.generate_speech_with_timestamps(
            text=passage,
            output_path=temp_path
        )
        
        if result["success"]:
            # Process character timings
            char_timings = result.get("char_timings", [])
            
            # Create a static folder if it doesn't exist
            audio_dir = os.path.join(os.path.dirname(__file__), 'static', 'audio')
            os.makedirs(audio_dir, exist_ok=True)
            
            # Move the temporary file to the static folder with a unique name
            import time
            import shutil
            timestamp = int(time.time())
            static_filename = f"speech_{timestamp}.mp3"
            static_path = os.path.join(audio_dir, static_filename)
            
            # Copy the file to the static folder
            shutil.copy(temp_path, static_path)
            
            # Remove the temporary file immediately
            try:
                os.unlink(temp_path)
                print(f"Temporary file {temp_path} deleted")
            except Exception as e:
                print(f"Error deleting temporary file: {e}")
            
            # Add a cache-busting parameter to the audio URL
            audio_url = f"/static/audio/{static_filename}?t={timestamp}"
            
            # Set up a timer to delete the static file after 5 minutes
            def delete_file_later(file_path, delay=300):
                import threading
                def delete_file():
                    try:
                        if os.path.exists(file_path):
                            os.unlink(file_path)
                            print(f"Deleted temporary audio file: {file_path}")
                    except Exception as e:
                        print(f"Error deleting file {file_path}: {e}")
                
                timer = threading.Timer(delay, delete_file)
                timer.daemon = True
                timer.start()
            
            # Schedule the file for deletion
            delete_file_later(static_path)
            print(f"Audio file {static_path} scheduled for deletion after playback")
            
            return jsonify({
                "success": True,
                "audio_url": audio_url,
                "char_timings": char_timings
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Unknown error generating speech")
            })
    
    except Exception as e:
        print(f"Exception in generate_speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        })

@app.route('/analyze-speech', methods=['POST'])
def analyze_speech():
    try:
        # Get the audio data and user-provided passage
        audio_data = request.json.get('audio')
        passage = request.json.get('passage', '')
        native_language = request.json.get('native_language')
        target_language = request.json.get('target_language')
        accent_goal = request.json.get('accent_goal')
        
        if not audio_data:
            return jsonify({
                "success": False,
                "error": "No audio data provided"
            })
            
        # Use sample passage as fallback if empty
        if not passage.strip():
            passage = SAMPLE_PASSAGE
        
        print(f"Analyzing speech for text: {passage[:50]}...")
        print(f"Language preferences - Native: {native_language}, Target: {target_language}, Accent Goal: {accent_goal}")
        
        try:
            # Decode base64 audio
            audio_binary = base64.b64decode(audio_data.split(',')[1])
            
            # Save audio file temporarily
            temp_audio_path = os.path.join(os.path.dirname(__file__), 'static', 'audio', 'user_recording.wav')
            with open(temp_audio_path, "wb") as f:
                f.write(audio_binary)
                
            print(f"Saved user recording to {temp_audio_path}")
        except Exception as e:
            print(f"Error processing audio data: {e}")
            return jsonify({
                "success": False,
                "error": f"Error processing audio data: {str(e)}"
            })
        
        # Check if we're using mock data (for testing without API keys)
        use_mock = os.getenv("USE_MOCK_DATA") == "true" or not os.getenv("OPENAI_API_KEY")
        if use_mock:
            print("Using mock data for speech analysis")
            
            # Return mock feedback data
            return jsonify({
                "success": True,
                "feedback": {
                    "pronunciation": {
                        "score": 8,
                        "details": "Your pronunciation is generally good. Pay attention to the 'th' sound in 'thirty-three' and 'rhythmic'."
                    },
                    "rhythm": {
                        "score": 7,
                        "details": "Good rhythm overall, but try to maintain a more consistent pace throughout."
                    },
                    "clarity": {
                        "score": 9,
                        "details": "Your speech was very clear. Great job enunciating difficult words."
                    }
                }
            })
        
        # Use the OpenAI service to analyze the speech
        print("Calling OpenAI service for speech analysis")
        result = openai_service.analyze_speech(
            audio_file_path=temp_audio_path,
            text_passage=passage,
            native_language=native_language,
            target_language=target_language,
            accent_goal=accent_goal
        )
        
        if result["success"]:
            print("Successfully analyzed speech")
            return jsonify({
                "success": True,
                "feedback": result["feedback"]
            })
        else:
            print(f"Error from OpenAI service: {result.get('error')}")
            return jsonify({
                "success": False,
                "error": result.get("error", "Unknown error analyzing speech")
            })
    
    except Exception as e:
        print(f"Exception in analyze_speech: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": f"Error analyzing speech: {str(e)}"
        })

@app.route('/check-api-keys', methods=['GET'])
def check_api_keys():
    """Endpoint to check if API keys are properly configured"""
    openai_key = os.getenv("OPENAI_API_KEY")
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY")
    
    return jsonify({
        "openai_key_present": bool(openai_key),
        "elevenlabs_key_present": bool(elevenlabs_key)
    })

@app.route('/browser-info', methods=['POST'])
def browser_info():
    """Endpoint to log browser information for debugging"""
    try:
        info = request.json
        print("Browser Info:")
        print(f"  User Agent: {info.get('userAgent', 'Not provided')}")
        print(f"  Platform: {info.get('platform', 'Not provided')}")
        print(f"  Is Secure Context: {info.get('isSecureContext', 'Not provided')}")
        print(f"  Supports MediaDevices: {info.get('supportsMediaDevices', 'Not provided')}")
        print(f"  Supports MediaRecorder: {info.get('supportsMediaRecorder', 'Not provided')}")
        print(f"  Audio Context State: {info.get('audioContextState', 'Not provided')}")
        print(f"  Microphone Permission: {info.get('microphonePermission', 'Not provided')}")
        
        return jsonify({"success": True, "message": "Browser information logged"})
    except Exception as e:
        print(f"Error logging browser info: {e}")
        return jsonify({"success": False, "error": str(e)})

if __name__ == '__main__':
    # Ensure the audio directory exists
    os.makedirs(os.path.join(os.path.dirname(__file__), 'static', 'audio'), exist_ok=True)
    app.run(debug=True) 