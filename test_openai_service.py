"""
Test script for OpenAI service
"""

import os
from openai_service import openai_service

def test_openai_service():
    # Check if the service initialized correctly
    print("Testing OpenAI service initialization...")
    print(f"API key configured: {'Yes' if openai_service.api_key else 'No'}")
    
    # Test with a simple mock audio file
    mock_audio_path = os.path.join(os.path.dirname(__file__), 'static', 'audio', 'test_audio.wav')
    
    # Create a simple test audio file if it doesn't exist
    if not os.path.exists(mock_audio_path):
        import wave
        import numpy as np
        
        print(f"Creating test audio file at {mock_audio_path}...")
        # Ensure the directory exists
        os.makedirs(os.path.dirname(mock_audio_path), exist_ok=True)
        
        # Create a 1-second sine wave test audio
        sample_rate = 16000
        duration = 1  # seconds
        frequency = 440  # Hz (A4 note)
        
        # Generate sine wave
        t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
        audio_data = (np.sin(2 * np.pi * frequency * t) * 32767).astype(np.int16)
        
        # Save as WAV file
        with wave.open(mock_audio_path, 'wb') as wf:
            wf.setnchannels(1)  # Mono
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(sample_rate)
            wf.writeframes(audio_data.tobytes())
        
        print(f"Test audio file created successfully.")
    else:
        print(f"Using existing test audio file at {mock_audio_path}")
    
    # Simple test passage
    test_passage = "This is a test passage to analyze pronunciation."
    
    print("\nTesting speech analysis with mock audio...")
    try:
        # Return mock feedback instead of calling the API
        result = openai_service.analyze_speech(
            audio_file_path=mock_audio_path,
            text_passage=test_passage
        )
        
        print(f"Analysis result success: {result['success']}")
        if result['success']:
            feedback = result['feedback']
            print("\nFeedback:")
            print(f"Pronunciation score: {feedback['pronunciation']['score']}")
            print(f"Pronunciation details: {feedback['pronunciation']['details']}")
            print(f"Rhythm score: {feedback['rhythm']['score']}")
            print(f"Rhythm details: {feedback['rhythm']['details']}")
            print(f"Clarity score: {feedback['clarity']['score']}")
            print(f"Clarity details: {feedback['clarity']['details']}")
        else:
            print(f"Error: {result.get('error', 'Unknown error')}")
        
        return result['success']
    except Exception as e:
        print(f"Error testing OpenAI service: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Enable mock feedback for testing
    # Uncomment the following line in openai_service.py:
    # return mock_feedback instead of real API call
    test_result = test_openai_service()
    print(f"\nTest {'passed' if test_result else 'failed'}.") 