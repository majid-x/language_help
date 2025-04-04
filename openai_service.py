"""
OpenAI Service Module
Handles integration with OpenAI APIs, specifically for analyzing speech recordings
using GPT-4o-audio-preview models.
"""

import os
import json
import base64
import re
import subprocess
from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# API Configuration
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

class OpenAIService:
    """Service for interacting with OpenAI APIs"""

    def __init__(self, api_key=None):
        """Initialize with API key"""
        self.api_key = api_key or OPENAI_API_KEY
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        
        # Initialize the OpenAI client
        self.client = OpenAI(api_key=self.api_key)
        print(f"OpenAI service initialized with API key: {self.api_key[:4]}...{self.api_key[-4:] if len(self.api_key) > 8 else '****'}")

    def analyze_speech(self, audio_file_path, text_passage, native_language=None, target_language=None, accent_goal=None, prompt=None):
        """
        Analyze speech recording against the text passage
        
        Args:
            audio_file_path (str): Path to the audio file to analyze
            text_passage (str): The original text passage that was read
            native_language (str, optional): User's native language. Defaults to None.
            target_language (str, optional): Language user is practicing. Defaults to None.
            accent_goal (str, optional): User's accent goal. Defaults to None.
            prompt (str, optional): Custom prompt for the analysis. Defaults to None.
            
        Returns:
            dict: Structured feedback on pronunciation, rhythm, clarity, etc.
        """
        try:
            # Ensure the audio file exists
            if not os.path.exists(audio_file_path):
                raise FileNotFoundError(f"Audio file not found: {audio_file_path}")
            
            # Enhanced system prompt based on the provided detailed speech analysis parameters
            system_prompt = """You are a Speech Therapist and will be given an audio recording to analyze and give your feedback. 
To ensure a proper analysis you will analyze the following aspects:

1. Pronunciation: 
   - Accuracy of individual sounds (phonemes)
   - Common mispronunciations
   - Clarity of articulation
   - Word stress and syllable emphasis
   - Effective intonation

2. Fluency and Coherence:
   - Pace (speed of speaking)
   - Pauses (frequency, duration, and placement)
   - Use of filler words
   - Organization of ideas

3. Lexical Resource:
   - Range and accuracy of vocabulary
   - Appropriate use of words and idiomatic expressions

4. Grammatical Range and Accuracy:
   - Accuracy of grammar
   - Use of simple and complex grammatical structures

5. Voice Quality:
   - Pitch and tone consistency
   - Loudness and projection
   - Clarity and resonance

Provide detailed, constructive feedback that is helpful, specific, and encouraging."""
            
            # User prompt with context - enhanced with more specific reading task
            if prompt is None:
                # Format language context information
                language_context = ""
                if native_language and target_language:
                    language_context = f"The speaker's native language is {native_language} and they are practicing {target_language}. "
                elif native_language:
                    language_context = f"The speaker's native language is {native_language}. "
                elif target_language:
                    language_context = f"The speaker is practicing {target_language}. "
                
                # Format accent goal information
                accent_context = ""
                if accent_goal:
                    if accent_goal == "identify":
                        accent_context = "Please identify their current accent. "
                    elif accent_goal == "minimize":
                        accent_context = "They want to minimize their accent. "
                    else:
                        accent_context = f"They are aiming for a {accent_goal} accent. "
                
                user_prompt = f"""
                {language_context}{accent_context}Here's the text the user was reading:
                
                "{text_passage}"
                
                Please analyze their speech and provide detailed feedback on:
                
                1. Pronunciation (accuracy of sounds, articulation, word stress): Score out of 10 and specific details
                2. Fluency and Coherence (pace, pauses, organization): Score out of 10 and specific details
                3. Grammar and Vocabulary (if applicable): Score out of 10 and specific details
                4. Voice Quality (pitch, tone, clarity): Score out of 10 and specific details
                5. Accent Analysis: Identify the accent type and intensity
                6. Compare what user said in comparison to the text passage
                
                For each category:
                - Provide a brief summary of strengths and areas for improvement
                - Include 2-3 specific examples from the recording
                - Suggest practical tips or exercises to improve
                
                Also identify any accent patterns and provide an overall score with a summary of strengths and suggestions.
                Keep your feedback helpful, specific, and encouraging.
                """
            else:
                user_prompt = prompt
            
            print(f"Analyzing speech recording at: {audio_file_path}")
            print(f"Text passage length: {len(text_passage)} characters")
            if native_language or target_language or accent_goal:
                print(f"Language context: Native={native_language}, Target={target_language}, Accent Goal={accent_goal}")

            # Convert to MP3 using ffmpeg
            output_mp3 = "temp_output.mp3"
            subprocess.run([
                "ffmpeg", 
                "-i", audio_file_path, 
                "-codec:a", "libmp3lame", 
                "-qscale:a", "2", 
                output_mp3
            ], check=True)
            
            # Read the converted MP3 file
            with open(output_mp3, "rb") as f:
                mp3_data = f.read()
            
            # Clean up temporary file
            os.remove(output_mp3)
            
            try:
                print("Creating API request to OpenAI using SDK")
                
                # Base64 encode the MP3 file
                audio_base64 = base64.b64encode(mp3_data).decode('utf-8')
                
                # Make the API call using the client library
                response = self.client.chat.completions.create(
                    model="gpt-4o-audio-preview",
                    messages=[
                        {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": user_prompt},
                                {
                                    "type": "input_audio",
                                    "input_audio":  {
                                        "data": audio_base64,
                                        "format": "mp3",
                                    },
                                }
                            ]
                        }
                    ],
                    temperature=0.7
                )
                
                print("Successfully received feedback")
                
                # Extract the text content from the response
                feedback_text = response.choices[0].message.content
                
                # If the feedback is empty or contains null values, try to get more detailed feedback
                if "null/10" in feedback_text or "No details provided" in feedback_text:
                    # Make another request with a more specific prompt
                    detailed_prompt = f"""Please provide a detailed analysis of the speech recording. Include specific scores and examples for each category:

1. Pronunciation (0-10):
   - Specific examples of correct/incorrect pronunciations
   - Word stress and intonation patterns
   - Areas for improvement

2. Fluency (0-10):
   - Speaking pace
   - Pause patterns
   - Flow and coherence
   - Specific examples

3. Grammar (0-10):
   - Sentence structure
   - Tense usage
   - Specific examples

4. Voice Quality (0-10):
   - Clarity
   - Volume
   - Tone
   - Specific observations

5. Accent Analysis:
   - Identify the accent type
   - Describe its intensity
   - Specific characteristics

Please provide concrete examples and specific suggestions for improvement."""

                    response = self.client.chat.completions.create(
                        model="gpt-4o-audio-preview",
                        messages=[
                            {"role": "system", "content": [{"type": "text", "text": system_prompt}]},
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": detailed_prompt},
                                    {
                                        "type": "input_audio",
                                        "input_audio":  {
                                            "data": audio_base64,
                                            "format": "mp3",
                                        },
                                    }
                                ]
                            }
                        ],
                        temperature=0.7
                    )
                    feedback_text = response.choices[0].message.content
                
                # Parse the response into structured feedback
                feedback = self.parse_detailed_feedback(feedback_text)
                
                return {
                    "success": True,
                    "feedback": feedback
                }
            except Exception as e:
                print(f"API call failed: {e}")
                print(f"Error type: {type(e).__name__}")
                import traceback
                print(f"Traceback: {traceback.format_exc()}")
                raise e

        except Exception as e:
            print(f"Unexpected error: {e}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            raise e
    
    def parse_detailed_feedback(self, feedback_text):
        """Parse the detailed feedback text into a structured format"""
        
        # Initialize empty feedback structure
        parsed_feedback = {
            "pronunciation": {"score": None, "details": "", "tips": ""},
            "fluency": {"score": None, "details": "", "tips": ""},
            "grammar": {"score": None, "details": "", "tips": ""},
            "vocabulary": {"score": None, "details": "", "tips": ""},
            "voice_quality": {"score": None, "details": "", "tips": ""},
            "accent": {"identification": "", "intensity": ""},
            "overall": {"score": None, "summary": ""}
        }
        
        try:
            # Extract pronunciation score
            pronunciation_match = feedback_text.find("Pronunciation") 
            if pronunciation_match != -1:
                # Look for score
                pron_section = feedback_text[pronunciation_match:feedback_text.find("\n\n", pronunciation_match) if feedback_text.find("\n\n", pronunciation_match) != -1 else len(feedback_text)]
                
                # First try decimal format
                pron_score_match = re.search(r'(\d+\.\d+)(?:/10)', pron_section)
                
                if not pron_score_match:
                    # Then try integer format
                    pron_score_match = re.search(r'(\d+)(?:/10)', pron_section)
                    
                    if pron_score_match:
                        score_value = int(pron_score_match.group(1))
                        # Handle incorrectly formatted scores
                        if score_value > 10:
                            score_value = score_value / 10
                        parsed_feedback["pronunciation"]["score"] = round(score_value, 1)
                else:
                    # Handle decimal scores directly
                    parsed_feedback["pronunciation"]["score"] = float(pron_score_match.group(1))
                
                # Extract details and tips
                parsed_feedback["pronunciation"]["details"] = self._extract_content(pron_section, ["details", "examples", "issues"])
                parsed_feedback["pronunciation"]["tips"] = self._extract_content(pron_section, ["tips", "exercises", "improve", "practice"])
            
            # Extract fluency score
            fluency_match = feedback_text.find("Fluency")
            if fluency_match != -1:
                fluency_section = feedback_text[fluency_match:feedback_text.find("\n\n", fluency_match) if feedback_text.find("\n\n", fluency_match) != -1 else len(feedback_text)]
                
                # First try decimal format
                fluency_score_match = re.search(r'(\d+\.\d+)(?:/10)', fluency_section)
                
                if not fluency_score_match:
                    # Then try integer format
                    fluency_score_match = re.search(r'(\d+)(?:/10)', fluency_section)
                    
                    if fluency_score_match:
                        score_value = int(fluency_score_match.group(1))
                        # Handle incorrectly formatted scores
                        if score_value > 10:
                            score_value = score_value / 10
                        parsed_feedback["fluency"]["score"] = round(score_value, 1)
                else:
                    # Handle decimal scores directly
                    parsed_feedback["fluency"]["score"] = float(fluency_score_match.group(1))
                
                parsed_feedback["fluency"]["details"] = self._extract_content(fluency_section, ["details", "examples", "issues"])
                parsed_feedback["fluency"]["tips"] = self._extract_content(fluency_section, ["tips", "exercises", "improve", "practice"])
            
            # Extract grammar score
            grammar_match = feedback_text.find("Grammar") 
            if grammar_match != -1:
                grammar_section = feedback_text[grammar_match:feedback_text.find("\n\n", grammar_match) if feedback_text.find("\n\n", grammar_match) != -1 else len(feedback_text)]
                
                # First try decimal format
                grammar_score_match = re.search(r'(\d+\.\d+)(?:/10)', grammar_section)
                
                if not grammar_score_match:
                    # Then try integer format
                    grammar_score_match = re.search(r'(\d+)(?:/10)', grammar_section)
                    
                    if grammar_score_match:
                        score_value = int(grammar_score_match.group(1))
                        # Handle incorrectly formatted scores
                        if score_value > 10:
                            score_value = score_value / 10
                        parsed_feedback["grammar"]["score"] = round(score_value, 1)
                else:
                    # Handle decimal scores directly
                    parsed_feedback["grammar"]["score"] = float(grammar_score_match.group(1))
                
                parsed_feedback["grammar"]["details"] = self._extract_content(grammar_section, ["details", "examples", "issues"])
                parsed_feedback["grammar"]["tips"] = self._extract_content(grammar_section, ["tips", "exercises", "improve", "practice"])
            
            # Extract voice quality score
            voice_match = feedback_text.find("Voice Quality")
            if voice_match != -1:
                voice_section = feedback_text[voice_match:feedback_text.find("\n\n", voice_match) if feedback_text.find("\n\n", voice_match) != -1 else len(feedback_text)]
                
                # First try decimal format
                voice_score_match = re.search(r'(\d+\.\d+)(?:/10)', voice_section)
                
                if not voice_score_match:
                    # Then try integer format
                    voice_score_match = re.search(r'(\d+)(?:/10)', voice_section)
                    
                    if voice_score_match:
                        score_value = int(voice_score_match.group(1))
                        # Handle incorrectly formatted scores
                        if score_value > 10:
                            score_value = score_value / 10
                        parsed_feedback["voice_quality"]["score"] = round(score_value, 1)
                else:
                    # Handle decimal scores directly
                    parsed_feedback["voice_quality"]["score"] = float(voice_score_match.group(1))
                
                parsed_feedback["voice_quality"]["details"] = self._extract_content(voice_section, ["details", "examples", "issues"])
                parsed_feedback["voice_quality"]["tips"] = self._extract_content(voice_section, ["tips", "exercises", "improve", "practice"])
            
            # Extract accent information
            accent_match = feedback_text.find("Accent") 
            if accent_match != -1:
                accent_section = feedback_text[accent_match:feedback_text.find("\n\n", accent_match) if feedback_text.find("\n\n", accent_match) != -1 else len(feedback_text)]
                
                # Try to find accent identification
                identification_patterns = [
                    r'(?:sounds like|appears to be|identified as|similar to|characteristic of)\s+([A-Za-z\s]+)(?:accent|speaker)',
                    r'accent[:\s]+([A-Za-z\s]+)',
                    r'([A-Za-z\s]+)(?:\s+accent)'
                ]
                
                for pattern in identification_patterns:
                    accent_id_match = re.search(pattern, accent_section, re.IGNORECASE)
                    if accent_id_match:
                        parsed_feedback["accent"]["identification"] = accent_id_match.group(1).strip()
                        break
                
                # Try to find accent intensity
                intensity_patterns = [
                    r'(strong|moderate|light|minor|thick|heavy|slight|noticeable)',
                    r'accent is (strong|moderate|light|minor|thick|heavy|slight|noticeable)'
                ]
                
                for pattern in intensity_patterns:
                    intensity_match = re.search(pattern, accent_section, re.IGNORECASE)
                    if intensity_match:
                        parsed_feedback["accent"]["intensity"] = intensity_match.group(1).strip().capitalize()
                        break
            
            # Extract overall score and summary
            overall_match = feedback_text.find("Overall") 
            if overall_match != -1:
                # Get the overall section - go to the end if no more sections are found
                next_section = feedback_text.find("\n\n", overall_match)
                if next_section != -1:
                    # If there's another section after this, use that as the boundary
                    overall_section = feedback_text[overall_match:next_section]
                else:
                    # If this is the last section, take everything until the end
                    overall_section = feedback_text[overall_match:]
                
                # First, try to match proper score format like "7.5/10"
                overall_score_match = re.search(r'(\d+\.\d+)(?:/10)', overall_section)
                
                if not overall_score_match:
                    # Then try the standard integer format "7/10"
                    overall_score_match = re.search(r'(\d+)(?:/10)', overall_section)
                    
                    if overall_score_match:
                        score_value = int(overall_score_match.group(1))
                        # If the score is greater than 10, it's likely incorrectly formatted (e.g., 75/10 should be 7.5/10)
                        if score_value > 10:
                            score_value = score_value / 10
                        parsed_feedback["overall"]["score"] = round(score_value, 1)
                else:
                    # Handle decimal scores directly
                    parsed_feedback["overall"]["score"] = float(overall_score_match.group(1))
                
                # Try to extract summary with multiple approaches
                # 1. Look for explicit "summary:" label
                summary_match = re.search(r'(?:summary|overview)[:\s]+(.+)', overall_section, re.IGNORECASE | re.DOTALL)
                if summary_match:
                    parsed_feedback["overall"]["summary"] = summary_match.group(1).strip()
                else:
                    # 2. Remove the header and use the rest as summary 
                    lines = overall_section.strip().split('\n')
                    if len(lines) > 1:
                        parsed_feedback["overall"]["summary"] = '\n'.join(lines[1:]).strip()
                    elif len(overall_section) > 30:
                        # 3. At minimum, take a larger portion of text
                        # Remove the "Overall" header if present
                        cleaned_text = re.sub(r'^Overall[^:]*:?\s*', '', overall_section, flags=re.IGNORECASE)
                        # Remove any score text
                        cleaned_text = re.sub(r'\d+(?:\.\d+)?/10', '', cleaned_text).strip()
                        parsed_feedback["overall"]["summary"] = cleaned_text
            
            # Calculate overall score if not found
            if parsed_feedback["overall"]["score"] is None:
                component_scores = [
                    score for score in [
                        parsed_feedback["pronunciation"]["score"],
                        parsed_feedback["fluency"]["score"],
                        parsed_feedback["grammar"]["score"],
                        parsed_feedback["voice_quality"]["score"]
                    ] if score is not None
                ]
                if component_scores:
                    # Calculate average and ensure it's out of 10
                    avg_score = sum(component_scores) / len(component_scores)
                    # If any score is above 10, scale everything down
                    if max(component_scores) > 10:
                        scale_factor = 10 / max(component_scores)
                        avg_score = avg_score * scale_factor
                    parsed_feedback["overall"]["score"] = round(avg_score, 1)
                
            return parsed_feedback
            
        except Exception as e:
            print(f"Error parsing detailed feedback: {e}")
            # If parsing fails, return the raw feedback text
            return {
                "raw_feedback": feedback_text,
                "error": str(e)
            }
    
    def _extract_content(self, section_text, keywords):
        """Helper method to extract content from a section based on keywords"""
        # First try to find content based on specific keywords
        for keyword in keywords:
            # Use more comprehensive pattern with DOTALL flag to capture multiline content
            pattern = rf'{keyword}[:\s]+(.+?)(?:\n\n(?:[A-Z]|$)|$)'
            match = re.search(pattern, section_text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        
        # If no specific keyword match found, try to extract content after the first line
        lines = section_text.strip().split('\n')
        if len(lines) > 1:
            # Skip the first line (header) and join the rest
            content = '\n'.join(lines[1:]).strip()
            # If content starts with ":" or "-", clean it up
            content = re.sub(r'^[:\s-]+', '', content).strip()
            return content
        
        # Default to the entire section if we can't extract a better portion
        return section_text.strip()


# Singleton instance
openai_service = OpenAIService()