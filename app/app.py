from flask import Flask, render_template, request, jsonify
import os
import json
import base64
from dotenv import load_dotenv

# Import service modules
from elevenlabs_service import elevenlabs_service
from openai_service import openai_service

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Read the sample passage from file
def get_passage():
    try:
        with open(os.path.join(os.path.dirname(__file__), 'practice_passage.txt'), 'r') as f:
            return f.read().strip()
    except Exception as e:
        print(f"Error reading passage file: {e}")
        return "The rhythmic rain thundered through the rural area yesterday, creating murals of puddles on the asphalt. Thirty-three thirsty children gathered around the water fountain, their voices carrying through the corridor. The authorities particularly wanted to measure whether accurate pronunciation remained consistent..."

# Sample passage from file
SAMPLE_PASSAGE = get_passage()

@app.route('/')
def index():
    return render_template('index.html', passage=SAMPLE_PASSAGE)

@app.route('/generate-speech', methods=['POST'])
def generate_speech():
    try:
        passage = request.json.get('passage', SAMPLE_PASSAGE)
        #print(f"Received request to generate speech for passage: {passage[:50]}...")
        
        # Use the ElevenLabs service to generate speech with timestamps
        output_path = os.path.join(os.path.dirname(__file__), 'static', 'audio', 'speech.mp3')
        #print(f"Output path: {output_path}")
        
        result = elevenlabs_service.generate_speech_with_timestamps(
            text=passage,
            output_path=output_path
        )
        
        #print(f"ElevenLabs service result: {result}")
        
        if result["success"]:
            # Ensure timing data is in the correct format
            char_timings = result.get("char_timings", [])
            #print(f"Number of character timings: {len(char_timings)}")
            #print("Sample timing data:", char_timings[:5] if char_timings else None)
            
            return jsonify({
                "success": True,
                "audio_url": "/static/audio/speech.mp3",
                "char_timings": char_timings
            })
        else:
            print(f"Error from ElevenLabs service: {result.get('error')}")
            return jsonify({
                "success": False,
                "error": result.get("error", "Unknown error generating speech")
            })
    
    except Exception as e:
        print(f"Exception in generate_speech route: {e}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return jsonify({
            "success": False,
            "error": str(e)
        })

@app.route('/analyze-speech', methods=['POST'])
def analyze_speech():
    try:
        # Get the audio data and passage
        audio_data = request.json.get('audio')
        passage = request.json.get('passage', SAMPLE_PASSAGE)
        
        # Decode base64 audio
        audio_binary = base64.b64decode(audio_data.split(',')[1])
        
        # Save audio file temporarily
        temp_audio_path = os.path.join(os.path.dirname(__file__), 'static', 'audio', 'user_recording.wav')
        with open(temp_audio_path, "wb") as f:
            f.write(audio_binary)
        
        # Use the OpenAI service to analyze the speech
        result = openai_service.analyze_speech(
            audio_file_path=temp_audio_path,
            text_passage=passage
        )
        
        if result["success"]:
            return jsonify({
                "success": True,
                "feedback": result["feedback"]
            })
        else:
            return jsonify({
                "success": False,
                "error": result.get("error", "Unknown error analyzing speech")
            })
    
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        })

if __name__ == '__main__':
    # Ensure the audio directory exists
    os.makedirs(os.path.join(os.path.dirname(__file__), 'static', 'audio'), exist_ok=True)
    app.run(debug=True) 