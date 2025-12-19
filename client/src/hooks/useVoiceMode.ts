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
  useKBWhisper: boolean; // Use KB-Whisper instead of Web Speech API
  kbWhisperAvailable: boolean;
}

export function useVoiceMode() {
  console.log('[useVoiceMode] Hook initialized');
  
  const [state, setState] = useState<VoiceModeState>({
    isListening: false,
    isSpeaking: false,
    transcript: '',
    error: null,
    isSupported: false,
    isInCall: false,
    finalTranscript: '',
    selectedVoice: null,
    useKBWhisper: true, // Prefer KB-Whisper for better Swedish support
    kbWhisperAvailable: false,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const onFinalTranscriptRef = useRef<((text: string) => void) | null>(null);
  const accumulatedTextRef = useRef<string>('');
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  // Check KB-Whisper availability and browser support
  useEffect(() => {
    let isMounted = true;
    
    const checkKBWhisper = async () => {
      try {
        if (!isMounted) return;
        
        console.log('[useVoiceMode] Checking KB-Whisper availability...');
        
        // Safely access localStorage
        let sessionToken: string | null = null;
        try {
          sessionToken = localStorage.getItem('sessionToken');
        } catch (e) {
          console.warn('[useVoiceMode] Cannot access localStorage:', e);
          if (isMounted) {
            setState(prev => ({ ...prev, kbWhisperAvailable: false }));
          }
          return;
        }
        
        // Only check if user is logged in
        if (!sessionToken) {
          console.log('[useVoiceMode] No sessionToken found, skipping KB-Whisper check');
          if (isMounted) {
            setState(prev => ({ ...prev, kbWhisperAvailable: false }));
          }
          return;
        }

        console.log('[useVoiceMode] SessionToken found, checking KB-Whisper status...');
        const API_BASE = import.meta.env.VITE_API_URL || '';
        const url = `${API_BASE}/api/whisper/status`;
        console.log('[useVoiceMode] Fetching:', url);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
          },
        });
        
        if (!isMounted) return;
        
        console.log('[useVoiceMode] Response status:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[useVoiceMode] KB-Whisper status:', data);
          if (isMounted) {
            setState(prev => ({ ...prev, kbWhisperAvailable: data.available || false }));
          }
        } else {
          // If auth fails (401, 403), don't try KB-Whisper
          if (response.status === 401 || response.status === 403) {
            console.warn('[useVoiceMode] Auth failed for KB-Whisper check:', response.status);
            if (isMounted) {
              setState(prev => ({ ...prev, kbWhisperAvailable: false }));
            }
          } else {
            console.warn('[useVoiceMode] KB-Whisper check failed with status:', response.status);
            if (isMounted) {
              setState(prev => ({ ...prev, kbWhisperAvailable: false }));
            }
          }
        }
      } catch (error) {
        // Log error for debugging
        console.error('[useVoiceMode] Error checking KB-Whisper:', error);
        if (isMounted) {
          setState(prev => ({ ...prev, kbWhisperAvailable: false }));
        }
      }
    };

    // Listen for storage changes (when user logs in/out)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'sessionToken') {
        console.log('[useVoiceMode] Storage event: sessionToken changed');
        // Re-check when sessionToken changes
        setTimeout(() => {
          console.log('[useVoiceMode] Re-checking KB-Whisper after storage change');
          checkKBWhisper();
        }, 100);
      }
    };

    // Add a small delay to ensure auth is ready on initial mount
    console.log('[useVoiceMode] Setting up KB-Whisper check (500ms delay)');
    const timeoutId = setTimeout(() => {
      console.log('[useVoiceMode] Initial KB-Whisper check triggered');
      checkKBWhisper();
    }, 500);

    // Listen for storage events (cross-tab)
    window.addEventListener('storage', handleStorageChange);
    console.log('[useVoiceMode] Storage event listener added');

    // Also check periodically if sessionToken exists (for same-tab login)
    const intervalId = setInterval(() => {
      const token = localStorage.getItem('sessionToken');
      if (token && !state.kbWhisperAvailable) {
        // Token exists but we haven't checked yet, check now
        console.log('[useVoiceMode] Interval check: token exists, checking KB-Whisper');
        checkKBWhisper();
      }
    }, 2000);

    return () => {
      isMounted = false;
      console.log('[useVoiceMode] Cleaning up KB-Whisper check');
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [state.kbWhisperAvailable]);

  // Initialize Web Speech API
  useEffect(() => {
    try {
      console.log('[useVoiceMode] Initializing Web Speech API...');
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      const speechSynthesis = window.speechSynthesis;

      const isSupported = !!SpeechRecognition && !!speechSynthesis;
      console.log('[useVoiceMode] Web Speech API supported:', isSupported);

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
      console.log('[useVoiceMode] SpeechRecognition initialized');
    }

    synthesisRef.current = speechSynthesis;
    console.log('[useVoiceMode] SpeechSynthesis initialized');

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
    } catch (error) {
      console.error('[useVoiceMode] Error initializing Web Speech API:', error);
      setState(prev => ({ ...prev, isSupported: false, error: 'Failed to initialize voice features' }));
    }

    return () => {
      console.log('[useVoiceMode] Cleaning up Web Speech API');
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        if (currentUtteranceRef.current) {
          synthesisRef.current?.cancel();
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (pauseTimerRef.current) {
          clearTimeout(pauseTimerRef.current);
        }
      } catch (error) {
        console.error('[useVoiceMode] Error during cleanup:', error);
      }
    };
  }, []);

  /**
   * Start recording audio for KB-Whisper transcription
   */
  const startKBWhisperRecording = useCallback(async (language: string = 'sv', continuous: boolean = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          // If in call mode, restart recording immediately
          if (continuous && state.isInCall && !state.isSpeaking) {
            setTimeout(() => {
              if (streamRef.current && mediaRecorderRef.current) {
                audioChunksRef.current = [];
                mediaRecorderRef.current.start();
                setState(prev => ({ ...prev, transcript: 'Spelar in...' }));
              }
            }, 100);
          }
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];

          try {
            setState(prev => ({ ...prev, transcript: 'Transkriberar...' }));

            const API_BASE = import.meta.env.VITE_API_URL || '';
            const sessionToken = localStorage.getItem('sessionToken');
            const response = await fetch(`${API_BASE}/api/whisper/transcribe`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                audioData: base64Audio,
                language,
                task: 'transcribe',
                returnTimestamps: false,
              }),
            });

            if (!response.ok) {
              throw new Error('Transcription failed');
            }

            const data = await response.json();
            if (data.success && data.text && data.text.trim()) {
              const newText = data.text.trim();
              setState(prev => ({
                ...prev,
                transcript: '',
                finalTranscript: prev.finalTranscript + (prev.finalTranscript ? ' ' : '') + newText,
              }));
              accumulatedTextRef.current = state.finalTranscript + (state.finalTranscript ? ' ' : '') + newText;

              // If in call mode, auto-send after pause
              if (continuous && state.isInCall && onFinalTranscriptRef.current) {
                // Clear existing timer
                if (pauseTimerRef.current) {
                  clearTimeout(pauseTimerRef.current);
                }
                // Wait 2 seconds of silence before auto-sending
                pauseTimerRef.current = setTimeout(() => {
                  const textToSend = accumulatedTextRef.current.trim();
                  if (textToSend && onFinalTranscriptRef.current) {
                    onFinalTranscriptRef.current(textToSend);
                    accumulatedTextRef.current = '';
                    setState(prev => ({ ...prev, finalTranscript: '' }));
                  }
                }, 2000);
              }
            }

            // If in call mode, restart recording immediately
            if (continuous && state.isInCall && !state.isSpeaking && streamRef.current) {
              setTimeout(() => {
                if (streamRef.current && mediaRecorderRef.current) {
                  audioChunksRef.current = [];
                  mediaRecorderRef.current.start();
                  setState(prev => ({ ...prev, transcript: 'Spelar in...' }));
                }
              }, 100);
            } else if (!continuous) {
              setState(prev => ({ ...prev, isListening: false }));
            }
          } catch (error) {
            console.error('KB-Whisper transcription error:', error);
            setState(prev => ({
              ...prev,
              error: 'Kunde inte transkribera audio. Försök igen.',
              isListening: false,
            }));
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      setState(prev => ({
        ...prev,
        isListening: true,
        transcript: 'Spelar in...',
        error: null,
        isInCall: continuous,
      }));

      // Start recording
      mediaRecorder.start();

      // For call mode, record in chunks (5 seconds each)
      // For single mode, stop after 5 seconds
      if (continuous) {
        // In call mode, record in 5-second chunks
        const recordChunk = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        };
        // Stop and restart every 5 seconds for continuous transcription
        const chunkInterval = setInterval(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
          }
        }, 5000);
        // Store interval for cleanup
        (mediaRecorderRef.current as any).chunkInterval = chunkInterval;
      } else {
        // Single mode: stop after 5 seconds
        setTimeout(() => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            setState(prev => ({ ...prev, isListening: false }));
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState(prev => ({
        ...prev,
        error: 'Kunde inte komma åt mikrofonen. Kontrollera dina inställningar.',
        isListening: false,
      }));
    }
  }, [state.isInCall, state.finalTranscript]);

  /**
   * Start listening for voice input
   */
  const startListening = useCallback((language: string = 'sv-SE', continuous: boolean = false) => {
    // Use KB-Whisper if available and preferred
    if (state.useKBWhisper && state.kbWhisperAvailable) {
      startKBWhisperRecording(language === 'sv-SE' ? 'sv' : language, continuous);
      return;
    }

    // Fallback to Web Speech API
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
  }, [state.useKBWhisper, state.kbWhisperAvailable, startKBWhisperRecording]);

  /**
   * Stop listening for voice input
   */
  const stopListening = useCallback(() => {
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }

    // Stop KB-Whisper recording if active
    if (mediaRecorderRef.current) {
      // Clear chunk interval if exists
      const chunkInterval = (mediaRecorderRef.current as any).chunkInterval;
      if (chunkInterval) {
        clearInterval(chunkInterval);
      }
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Stop Web Speech API if active
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
    }

    setState(prev => ({ ...prev, isInCall: false, isListening: false }));
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
    // Toggle between KB-Whisper and Web Speech API
    setUseKBWhisper: (use: boolean) => {
      setState(prev => ({ ...prev, useKBWhisper: use }));
    },
  };
}

