import React from 'react';
import './SideBySideDiff.css';

function highlightDiff(originalWords, simplifiedWords) {
  return originalWords.map((word, i) => {
    if (simplifiedWords[i] && word !== simplifiedWords[i]) {
      return <span key={i} className="diff-word">{simplifiedWords[i]}</span>;
    }
    return <span key={i}>{simplifiedWords[i] || ''}</span>;
  });
}

function SideBySideDiff({ original, simplified }) {
  const originalWords = original.split(' ');
  const simplifiedWords = simplified.split(' ');

  return (
    <div className="diff-grid">
      <div>
        <h4>Original</h4>
        <p>{original}</p>
      </div>
      <div>
        <h4>Simplified</h4>
        <p>{highlightDiff(originalWords, simplifiedWords)}</p>
      </div>
    </div>
  );
}

export default SideBySideDiff;