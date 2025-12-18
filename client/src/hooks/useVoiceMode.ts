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
}

export function useVoiceMode() {
  const [state, setState] = useState<VoiceModeState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    error: null,
    isSupported: false,
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    const speechSynthesis = window.speechSynthesis;

    const isSupported = !!SpeechRecognition && !!speechSynthesis;

    setState(prev => ({ ...prev, isSupported }));

    if (isSupported && SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
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

        setState(prev => ({
          ...prev,
          transcript: finalTranscript || interimTranscript,
        }));
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
        setState(prev => ({ ...prev, isListening: false }));
      };

      recognitionRef.current = recognition;
    }

    synthesisRef.current = speechSynthesis;

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
  const startListening = useCallback((language: string = 'sv-SE') => {
    if (!recognitionRef.current) {
      setState(prev => ({
        ...prev,
        error: 'Taligenkänning stöds inte i din webbläsare.',
      }));
      return;
    }

    try {
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
      setState(prev => ({ ...prev, transcript: '', error: null }));
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
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
    }
  }, [state.isListening]);

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
      utterance.pitch = options?.pitch || 1.0;
      utterance.volume = options?.volume || 1.0;

      utterance.onstart = () => {
        setState(prev => ({ ...prev, isSpeaking: true }));
      };

      utterance.onend = () => {
        setState(prev => ({ ...prev, isSpeaking: false }));
        currentUtteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setState(prev => ({ ...prev, isSpeaking: false, error: 'Kunde inte läsa upp texten.' }));
        currentUtteranceRef.current = null;
      };

      currentUtteranceRef.current = utterance;
      synthesisRef.current.speak(utterance);
    },
    []
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
    stopSpeaking,
    clearError,
  };
}

