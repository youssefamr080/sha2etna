// ============================================================
// Confetti Animation Component
// Shows celebratory confetti animation for achievements
// ============================================================

import React, { useEffect, useState, useCallback } from 'react';

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  velocity: { x: number; y: number; rotation: number };
  shape: 'square' | 'circle' | 'triangle';
}

interface ConfettiProps {
  isActive: boolean;
  duration?: number;
  pieceCount?: number;
  onComplete?: () => void;
}

const COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#95E1D3', // Mint
  '#F38181', // Coral
  '#AA96DA', // Purple
  '#FCB69F', // Peach
  '#00B4D8', // Blue
  '#90F9C4', // Light Green
  '#FEC89A', // Orange
];

const createConfettiPiece = (id: number, width: number, height: number): ConfettiPiece => {
  const shapes: Array<'square' | 'circle' | 'triangle'> = ['square', 'circle', 'triangle'];
  
  return {
    id,
    x: width / 2 + (Math.random() - 0.5) * 200,
    y: height + 20,
    rotation: Math.random() * 360,
    scale: 0.5 + Math.random() * 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    velocity: {
      x: (Math.random() - 0.5) * 15,
      y: -(12 + Math.random() * 8),
      rotation: (Math.random() - 0.5) * 20,
    },
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  };
};

const Confetti: React.FC<ConfettiProps> = ({
  isActive,
  duration = 3000,
  pieceCount = 50,
  onComplete,
}) => {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);

  const startConfetti = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const newPieces: ConfettiPiece[] = [];
    for (let i = 0; i < pieceCount; i++) {
      newPieces.push(createConfettiPiece(i, width, height));
    }
    
    setPieces(newPieces);
    setIsAnimating(true);

    // Animation loop
    let animationId: number;
    let startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed > duration) {
        setIsAnimating(false);
        setPieces([]);
        onComplete?.();
        return;
      }

      setPieces(prev => 
        prev.map(piece => ({
          ...piece,
          x: piece.x + piece.velocity.x,
          y: piece.y + piece.velocity.y,
          rotation: piece.rotation + piece.velocity.rotation,
          velocity: {
            ...piece.velocity,
            y: piece.velocity.y + 0.3, // gravity
            x: piece.velocity.x * 0.99, // air resistance
          },
        })).filter(piece => piece.y < window.innerHeight + 50)
      );

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [duration, pieceCount, onComplete]);

  useEffect(() => {
    if (isActive && !isAnimating) {
      const cleanup = startConfetti();
      return cleanup;
    }
  }, [isActive, isAnimating, startConfetti]);

  if (!isAnimating || pieces.length === 0) return null;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ overflow: 'hidden' }}
    >
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute"
          style={{
            left: piece.x,
            top: piece.y,
            transform: `rotate(${piece.rotation}deg) scale(${piece.scale})`,
            width: piece.shape === 'circle' ? 10 : 12,
            height: piece.shape === 'triangle' ? 0 : 10,
            backgroundColor: piece.shape !== 'triangle' ? piece.color : 'transparent',
            borderRadius: piece.shape === 'circle' ? '50%' : '2px',
            borderLeft: piece.shape === 'triangle' ? '6px solid transparent' : undefined,
            borderRight: piece.shape === 'triangle' ? '6px solid transparent' : undefined,
            borderBottom: piece.shape === 'triangle' ? `12px solid ${piece.color}` : undefined,
          }}
        />
      ))}
    </div>
  );
};

export default Confetti;

// ============================================================
// useConfetti Hook
// ============================================================
export const useConfetti = () => {
  const [showConfetti, setShowConfetti] = useState(false);

  const triggerConfetti = useCallback(() => {
    setShowConfetti(true);
  }, []);

  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  return {
    showConfetti,
    triggerConfetti,
    handleConfettiComplete,
    ConfettiComponent: () => (
      <Confetti 
        isActive={showConfetti} 
        onComplete={handleConfettiComplete}
      />
    ),
  };
};
