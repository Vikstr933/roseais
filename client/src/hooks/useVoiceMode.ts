/**
 * useVoiceMode Hook
 * Handles speech-to-text (voice input) and text-to-speech (voice output)
 * for Elon chat interface
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceModeState {
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  isInCall: boolean;
  finalTranscript: string;
  selectedVoice: string | null;
}

export function useVoiceMode() {
  const [state, setState] = useState<VoiceModeState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    error: null,
    isSupported: false,
    isInCall: false,
    finalTranscript: '',
    selectedVoice: null,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onFinalTranscriptRef = useRef<((text: string) => void) | null>(null);
  const accumulatedTextRef = useRef<string>('');
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    const speechSynthesis = window.speechSynthesis;

    const isSupported = !!SpeechRecognition && !!speechSynthesis;

    setState(prev => ({ ...prev, isSupported }));

    if (isSupported && SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Enable continuous listening for call mode
      recognition.interimResults = true;
      recognition.lang = 'sv-SE'; // Swedish as default, can be changed

      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, error: null }));
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // Clear pause timer when we get new results
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current);
          pauseTimerRef.current = null;
        }

        // Update transcript
        const newFinal = finalTranscript.trim();
        if (newFinal) {
          setState(prev => ({
            ...prev,
            transcript: interimTranscript,
            finalTranscript: prev.finalTranscript + (prev.finalTranscript ? ' ' : '') + newFinal,
          }));
          accumulatedTextRef.current = state.finalTranscript + (state.finalTranscript ? ' ' : '') + newFinal;

          // If in call mode and we got a final transcript, wait for pause then auto-send
          if (state.isInCall && newFinal && onFinalTranscriptRef.current) {
            // Wait 1.5 seconds of silence before auto-sending
            pauseTimerRef.current = setTimeout(() => {
              const textToSend = accumulatedTextRef.current.trim();
              if (textToSend && onFinalTranscriptRef.current) {
                onFinalTranscriptRef.current(textToSend);
                accumulatedTextRef.current = '';
                setState(prev => ({ ...prev, finalTranscript: '' }));
              }
            }, 1500);
          }
        } else {
          setState(prev => ({
            ...prev,
            transcript: interimTranscript,
          }));
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        let errorMessage = 'Speech recognition error';
        
        switch (event.error) {
          case 'no-speech':
            errorMessage = 'Ingen tal detekterades. Försök igen.';
            break;
          case 'audio-capture':
            errorMessage = 'Ingen mikrofon hittades. Kontrollera dina inställningar.';
            break;
          case 'not-allowed':
            errorMessage = 'Mikrofonåtkomst nekad. Tillåt mikrofonåtkomst i webbläsarens inställningar.';
            break;
          case 'network':
            errorMessage = 'Nätverksfel. Kontrollera din internetanslutning.';
            break;
          default:
            errorMessage = `Fel: ${event.error}`;
        }

        setState(prev => ({
          ...prev,
          isListening: false,
          error: errorMessage,
        }));
      };

      recognition.onend = () => {
        // If in call mode, automatically restart listening
        if (state.isInCall && !state.isSpeaking) {
          try {
            recognition.start();
          } catch (error) {
            // Recognition might already be starting, ignore error
            console.log('Recognition restart:', error);
          }
        } else {
          setState(prev => ({ ...prev, isListening: false }));
        }
      };

      recognitionRef.current = recognition;
    }

    synthesisRef.current = speechSynthesis;

    // Find and select a female Swedish voice
    const findFemaleVoice = () => {
      const voices = speechSynthesis.getVoices();
      
      // Priority order: Swedish female voices
      const preferredVoices = [
        // Swedish female voices (common names)
        voices.find(v => v.lang.startsWith('sv') && (
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('hazel') ||
          v.name.toLowerCase().includes('eva') ||
          v.name.toLowerCase().includes('anna') ||
          v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('woman')
        )),
        // Any Swedish voice that sounds female
        voices.find(v => v.lang.startsWith('sv') && !v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('david')),
        // English female voices as fallback
        voices.find(v => v.lang.startsWith('en') && (
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('hazel') ||
          v.name.toLowerCase().includes('eva') ||
          v.name.toLowerCase().includes('susan') ||
          v.name.toLowerCase().includes('female')
        )),
        // Any non-male voice
        voices.find(v => !v.name.toLowerCase().includes('male') && !v.name.toLowerCase().includes('david'))
      ];

      const selectedVoice = preferredVoices.find(v => v !== undefined) || voices[0] || null;
      
      if (selectedVoice) {
        selectedVoiceRef.current = selectedVoice;
        setState(prev => ({ ...prev, selectedVoice: selectedVoice.name }));
        console.log(`🎤 Selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
      } else {
        console.warn('⚠️ No suitable voice found, using default');
        setState(prev => ({ ...prev, selectedVoice: 'Default' }));
      }
    };

    // Load voices (may need to wait for voiceschanged event)
    if (speechSynthesis.getVoices().length > 0) {
      findFemaleVoice();
    } else {
      speechSynthesis.onvoiceschanged = findFemaleVoice;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (currentUtteranceRef.current) {
        synthesisRef.current?.cancel();
      }
    };
  }, []);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback((language: string = 'sv-SE', continuous: boolean = false) => {
    if (!recognitionRef.current) {
      setState(prev => ({
        ...prev,
        error: 'Taligenkänning stöds inte i din webbläsare.',
      }));
      return;
    }

    try {
      recognitionRef.current.lang = language;
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.start();
      setState(prev => ({ 
        ...prev, 
        transcript: '', 
        finalTranscript: '',
        error: null,
        isInCall: continuous 
      }));
      accumulatedTextRef.current = '';
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Kunde inte starta taligenkänning. Försök igen.',
      }));
    }
  }, []);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
      setState(prev => ({ ...prev, isInCall: false }));
    }
  }, [state.isListening]);

  /**
   * Start call mode - continuous listening with auto-send
   */
  const startCall = useCallback((onFinalTranscript: (text: string) => void, language: string = 'sv-SE') => {
    onFinalTranscriptRef.current = onFinalTranscript;
    startListening(language, true);
  }, [startListening]);

  /**
   * End call mode
   */
  const endCall = useCallback(() => {
    onFinalTranscriptRef.current = null;
    stopListening();
    setState(prev => ({ ...prev, isInCall: false, finalTranscript: '', transcript: '' }));
    accumulatedTextRef.current = '';
  }, [stopListening]);

  /**
   * Get the final transcript and clear it
   */
  const getTranscript = useCallback(() => {
    const transcript = state.transcript.trim();
    setState(prev => ({ ...prev, transcript: '' }));
    return transcript;
  }, [state.transcript]);

  /**
   * Speak text using text-to-speech
   */
  const speak = useCallback(
    (text: string, options?: { lang?: string; rate?: number; pitch?: number; volume?: number }) => {
      if (!synthesisRef.current) {
        console.warn('Text-to-speech not supported');
        return;
      }

      // Cancel any ongoing speech
      synthesisRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options?.lang || 'sv-SE';
      utterance.rate = options?.rate || 1.0;
      utterance.pitch = options?.pitch || 1.1; // Slightly higher pitch for more feminine sound
      utterance.volume = options?.volume || 1.0;
      
      // Use selected female voice if available
      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current;
      }

      utterance.onstart = () => {
        setState(prev => ({ ...prev, isSpeaking: true }));
        // Pause listening while speaking in call mode
        if (state.isInCall && recognitionRef.current && state.isListening) {
          recognitionRef.current.stop();
        }
      };

      utterance.onend = () => {
        setState(prev => ({ ...prev, isSpeaking: false }));
        currentUtteranceRef.current = null;
        // Resume listening after speaking in call mode
        if (state.isInCall && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (error) {
            // Might already be starting
            console.log('Resume listening:', error);
          }
        }
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setState(prev => ({ ...prev, isSpeaking: false, error: 'Kunde inte läsa upp texten.' }));
        currentUtteranceRef.current = null;
        // Resume listening on error
        if (state.isInCall && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (error) {
            console.log('Resume listening after error:', error);
          }
        }
      };

      currentUtteranceRef.current = utterance;
      synthesisRef.current.speak(utterance);
    },
    [state.isInCall, state.isListening]
  );

  /**
   * Stream text to speech - speaks as text arrives (for streaming responses)
   */
  const speakStreaming = useCallback(
    (text: string, options?: { lang?: string; rate?: number; pitch?: number; volume?: number }) => {
      if (!synthesisRef.current) {
        return;
      }

      // For streaming, we want to speak chunks as they arrive
      // But we need to be smart about it - don't interrupt if already speaking
      if (state.isSpeaking) {
        // Queue the text or append to current utterance
        return;
      }

      // Clean text for speech
      const cleanText = text
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`([^`]+)`/g, '$1') // Remove inline code
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .trim();

      if (cleanText.length > 20) { // Only speak if we have substantial text
        speak(cleanText, options);
      }
    },
    [speak, state.isSpeaking]
  );

  /**
   * Stop speaking
   */
  const stopSpeaking = useCallback(() => {
    if (synthesisRef.current) {
      synthesisRef.current.cancel();
      setState(prev => ({ ...prev, isSpeaking: false }));
      currentUtteranceRef.current = null;
    }
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    getTranscript,
    speak,
    speakStreaming,
    stopSpeaking,
    clearError,
    startCall,
    endCall,
  };
}

