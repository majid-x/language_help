"""
ElevenLabs Service Module
Handles integration with ElevenLabs Text-to-Speech API, specifically for
character-level timing and speech generation.
"""

import os
import base64
from elevenlabs import ElevenLabs
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API Configuration
ELEVENLABS_API_KEY = "sk_11d1702cf0249669e8291b5608c4a25ce25095bf2c9b40cc"
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"  # Default voice ID

class ElevenLabsService:
    """Service for interacting with ElevenLabs Text-to-Speech API"""

    def __init__(self, api_key=None):
        """Initialize with API key"""
        self.api_key = api_key or ELEVENLABS_API_KEY
        if not self.api_key:
            raise ValueError("ElevenLabs API key is required")
        
        # Initialize ElevenLabs client
        self.client = ElevenLabs(api_key=self.api_key)

    def generate_speech_with_timestamps(self, text, voice_id=None, output_path=None):
        """
        Generate speech with character-level timestamps
        
        Args:
            text (str): The text to convert to speech
            voice_id (str, optional): The voice ID to use. Defaults to DEFAULT_VOICE_ID.
            output_path (str, optional): Path to save audio file. Defaults to None.
            
        Returns:
            dict: Response containing audio URL and character timing data
        """
        try:
            voice_id = voice_id or DEFAULT_VOICE_ID
            #print(f"Generating speech for text: {text[:50]}...")
            
            # Generate speech with timestamps using the SDK
            result = self.client.text_to_speech.convert_with_timestamps(
                voice_id=voice_id,
                text=text
            )
            #print(f"Received response from ElevenLabs API: {result}")
            
            # Convert result to dictionary if it's not already
            if hasattr(result, 'dict'):
                result = result.dict()
            
            # Extract audio data from base64
            if 'audio_base64' not in result:
                raise ValueError("No audio_base64 in response")
            
            audio_data = base64.b64decode(result['audio_base64'])
            char_timings = []
            
            # Convert timestamp data to our format using the alignment data
            if 'alignment' not in result:
                raise ValueError("No alignment data in response")
            
            alignment = result['alignment']
            if 'characters' not in alignment or 'character_start_times_seconds' not in alignment or 'character_end_times_seconds' not in alignment:
                raise ValueError("Invalid alignment data structure")
            
            # Process each character and its timing
            for i, char in enumerate(alignment['characters']):
                # Include all characters, including spaces
                char_timings.append({
                    "char": char,
                    "char_index": i,
                    "start_time": float(alignment['character_start_times_seconds'][i]),
                    "end_time": float(alignment['character_end_times_seconds'][i])
                })
            
            #print(f"Generated {len(char_timings)} character timings")
            #print("Sample timing data:", char_timings[:5])
            
            # Save the audio if output path is provided
            if output_path:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(audio_data)
                print(f"Saved audio to {output_path}")
            
            return {
                "success": True,
                "audio_path": output_path,
                "char_timings": char_timings
            }
        
        except Exception as e:
            print(f"Error generating speech: {e}")
            print(f"Error type: {type(e)}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return {
                "success": False,
                "error": str(e)
            }

    def generate_speech(self, text, voice_id=None, output_path=None):
        """
        Generate speech without timestamps (simpler version)
        
        Args:
            text (str): The text to convert to speech
            voice_id (str, optional): The voice ID to use. Defaults to DEFAULT_VOICE_ID.
            output_path (str, optional): Path to save audio file. Defaults to None.
            
        Returns:
            bool: Success status
        """
        try:
            voice_id = voice_id or DEFAULT_VOICE_ID
            
            # Generate speech using the SDK
            result = self.client.text_to_speech.convert(
                voice_id=voice_id,
                text=text
            )
            
            # Convert result to dictionary if it's not already
            if hasattr(result, 'dict'):
                result = result.dict()
            
            # Extract audio data from base64
            if 'audio_base64' not in result:
                raise ValueError("No audio_base64 in response")
            
            audio_data = base64.b64decode(result['audio_base64'])
            
            # Save the audio if output path is provided
            if output_path:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                with open(output_path, "wb") as f:
                    f.write(audio_data)
            
            return True
        
        except Exception as e:
            print(f"Error generating speech: {e}")
            return False


# Singleton instance
elevenlabs_service = ElevenLabsService() 