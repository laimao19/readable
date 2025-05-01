import { useState, useEffect, useCallback, useRef } from 'react';
const useTextToSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false); //is speaking state
  const [isPaused, setIsPaused] = useState(false); //is paused state
  const utteranceRef = useRef(null); //utterance ref used to store the utterance object

  useEffect(() => {
    //initializing the utterance
    const initUtterance = () => {
      const synth = window.speechSynthesis; //speech synthesis object
      if (!synth) {
        console.error('Web Speech API is not supported by this browser.');
        return null;
      }
      const u = new SpeechSynthesisUtterance(); //new utterance object
      u.onstart = () => { //when the utterance starts
        setIsSpeaking(true);
        setIsPaused(false);
      };
      u.onpause = () => { //when the utterance is paused
        setIsSpeaking(true); 
        setIsPaused(true);
      };
      u.onresume = () => { //when the utterance is resumed
        setIsSpeaking(true);
        setIsPaused(false);
      };
      u.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };
      u.onerror = (event) => {
        console.error('SpeechSynthesisUtterance.onerror', event);
        setIsSpeaking(false);
        setIsPaused(false);
      };
      return u;
    };

    //initialzing utterance on mount
    utteranceRef.current = initUtterance();
    //cleanup function to cancel speech if component unmounts while speaking
    return () => {
      const synth = window.speechSynthesis;
      if (synth && synth.speaking) {
        synth.cancel();
      }
    };
  }, []);

  //function to speak the text
  const speak = useCallback((text) => {
    const synth = window.speechSynthesis;
    if (!utteranceRef.current) {
      utteranceRef.current = new SpeechSynthesisUtterance();
      utteranceRef.current.onstart = () => { //when the utterance starts
        setIsSpeaking(true);
        setIsPaused(false);
      };
      utteranceRef.current.onpause = () => { //when the utterance is paused  
        setIsSpeaking(true);
        setIsPaused(true);
      };
      utteranceRef.current.onresume = () => { //when utterance is resumed
        setIsSpeaking(true);
        setIsPaused(false);
      };
      utteranceRef.current.onend = () => { //when utterance ends
        setIsSpeaking(false);
        setIsPaused(false);
      };
      utteranceRef.current.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };
    }

    //if the synth is not supported or the utterance is not supported or teh text is not supported, return
    if (!synth || !utteranceRef.current || !text) return;
    //if currently speaking, cancel the previous speech
    if (synth.speaking) {
      synth.cancel();
      setTimeout(() => { //delay to ensure previous utterance is cancelled
        utteranceRef.current.text = text;
        synth.speak(utteranceRef.current);
      }, 50);
    } else {
      utteranceRef.current.text = text;
      synth.speak(utteranceRef.current);
    }
  }, []);

  //function to pause the speech
  const pause = useCallback(() => {
    const synth = window.speechSynthesis;
    if (synth && synth.speaking && !synth.paused) {
      synth.pause();
    }
  }, []);

  //function to resume the speech
  const resume = useCallback(() => {
    const synth = window.speechSynthesis;
    if (synth && synth.paused) {
      synth.resume();
    }
  }, []);

  //function to cancel the speech
  const cancel = useCallback(() => {
    const synth = window.speechSynthesis;
    if (synth && (synth.speaking || synth.pending)) {
      synth.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  //return the functions and states
  return {
    speak,
    pause,
    resume,
    cancel,
    isSpeaking,
    isPaused,
    isSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };
};

export default useTextToSpeech; 