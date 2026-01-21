
import React, { useEffect, useState, useRef } from 'react';
import { registerAmplitudeListener, isPlayingAudioContext } from '../utils/audioPlayer';
import { VISEMES } from '../utils/visemePaths';

interface AvatarProps {
  isTalking: boolean;
  visemeId?: number | null; 
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ isTalking, visemeId, className = "w-24 h-24" }) => {
  const [mouthOpen, setMouthOpen] = useState(0); 
  const isTalkingRef = useRef(isTalking);

  useEffect(() => {
      isTalkingRef.current = isTalking;
  }, [isTalking]);

  useEffect(() => {
    const unsubscribe = registerAmplitudeListener((level) => {
      const SILENCE_THRESHOLD = 0.01;
      const speaking = isTalkingRef.current;
      if (speaking) {
        if (isPlayingAudioContext()) {
            const openAmount = Math.min(1, level * 5); 
            setMouthOpen(level > SILENCE_THRESHOLD ? openAmount : 0);
        } else {
            const time = Date.now();
            const wave = (Math.sin(time / 80) + 1) / 2;
            const flutter = Math.random() * 0.2;
            setMouthOpen(Math.max(0.15, wave * 0.7 + flutter));
        }
      } else {
        setMouthOpen(0);
      }
    });
    return unsubscribe;
  }, []);

  let mouthPath = "";
  let showTeeth = false;
  if (visemeId !== undefined && visemeId !== null && VISEMES[visemeId]) {
      mouthPath = VISEMES[visemeId];
  } else {
      const mouthCenterY = 82;
      const maxOpenHeight = 12;
      const currentHeight = mouthOpen * maxOpenHeight;
      mouthPath = mouthOpen < 0.1 
        ? `M 40 ${mouthCenterY} Q 50 ${mouthCenterY + 2} 60 ${mouthCenterY}`
        : `M 40 ${mouthCenterY} Q 50 ${mouthCenterY - currentHeight/2} 60 ${mouthCenterY} Q 50 ${mouthCenterY + currentHeight * 1.5} 40 ${mouthCenterY}`;
      if (mouthOpen > 0.3) showTeeth = true;
  }

  return (
    <div className={`${className} relative`}>
      <svg viewBox="0 0 100 110" className="w-full h-full drop-shadow-xl">
        <defs>
            <linearGradient id="skinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFE0B2" />
                <stop offset="100%" stopColor="#FFCC80" />
            </linearGradient>
        </defs>
        <path d="M 10 45 L 2 50 L 10 65 Z" fill="#FFCC80" stroke="#E65100" strokeWidth="0.5" />
        <path d="M 90 45 L 98 50 L 90 65 Z" fill="#FFCC80" stroke="#E65100" strokeWidth="0.5" />
        <path d="M 15 5 L 85 5 L 88 50 L 85 75 L 70 95 L 30 95 L 15 75 L 12 50 Z" fill="url(#skinGradient)" stroke="#E65100" strokeWidth="1.5" />
        <path d="M 10 35 Q 10 0 50 0 Q 90 0 90 35 Q 92 20 50 10 Q 8 20 10 35" fill="#3E2723" />
        <path d="M 10 35 L 10 55 L 15 45 Z" fill="#3E2723" />
        <path d="M 90 35 L 90 55 L 85 45 Z" fill="#3E2723" />
        <path d="M 25 45 Q 35 42 45 45" stroke="#3E2723" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M 55 45 Q 65 42 75 45" stroke="#3E2723" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <g><circle cx="35" cy="55" r="5" fill="#FFF" /><circle cx="65" cy="55" r="5" fill="#FFF" /><circle cx="35" cy="55" r="2.5" fill="#333" /><circle cx="65" cy="55" r="2.5" fill="#333" /></g>
        <path d="M 50 55 L 48 70 L 52 70 Z" fill="#E65100" opacity="0.3" />
        <path d={mouthPath} fill="#3E2723" stroke="#3E2723" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {showTeeth && !visemeId && (<path d="M 42 82 Q 50 84 58 82" stroke="#FFF" strokeWidth="1.5" fill="none" opacity="0.8" />)}
      </svg>
    </div>
  );
};
