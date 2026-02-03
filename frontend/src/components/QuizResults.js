import React, { useState, useEffect } from 'react';
import '../styles/QuizResults.css';

function QuizResults({ result, user, onComplete, onRetake }) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleNavigateToPairing();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleNavigateToPairing = () => {
    onComplete();
  };

  // Profile descriptions for each type
  const profileDescriptions = {
    'full-bodied-red-enthusiast': {
      description: 'You appreciate bold, full-bodied wines with high tannins and intense flavors. You enjoy strong coffee, dark chocolate, and grilled meats.',
      exampleWines: 'Cabernet Sauvignon, Malbec, Barolo'
    },
    'medium-bodied-red-aficionado': {
      description: 'You prefer fruity, approachable red wines with lower tannins and medium body. You enjoy milk chocolate, fruit smoothies, and roasted chicken.',
      exampleWines: 'Pinot Noir, Merlot, Grenache'
    },
    'spiced-red-connoisseur': {
      description: 'You love red wines with spicy notes and medium-full body. You enjoy BBQ sauce, black pepper, and grilled meats with bold seasoning.',
      exampleWines: 'Syrah/Shiraz, Zinfandel, Tempranillo'
    },
    'light-bodied-red-devotee': {
      description: 'You favor delicate, light-bodied red wines with low tannins. You enjoy fruit teas, light salads, and foods with subtle flavors.',
      exampleWines: 'Beaujolais, light Pinot Noir, Gamay'
    },
    'crisp-acidic-white-enthusiast': {
      description: 'You love bright, acidic white wines with citrus-forward flavors. You enjoy lemonade, citrus fruits, and fresh salads.',
      exampleWines: 'Sauvignon Blanc, Pinot Grigio, Albariño'
    },
    'full-bodied-white-aficionado': {
      description: 'You prefer rich, full-bodied white wines with buttery flavors. You enjoy creamy sauces, buttered popcorn, and luxurious pasta dishes.',
      exampleWines: 'Oaked Chardonnay, Viognier, White Burgundy'
    },
    'aromatic-white-connoisseur': {
      description: 'You appreciate aromatic white wines with floral and spice notes. You enjoy honey, floral teas, and aromatic cuisines.',
      exampleWines: 'Riesling, Gewürztraminer, Torrontés'
    },
    'fruit-forward-white-devotee': {
      description: 'You love fruit-forward white wines with tropical and citrus flavors. You enjoy tropical fruits, fruit salads, and light seafood.',
      exampleWines: 'Chenin Blanc, Vermentino, unoaked Chardonnay'
    },
    'sparkling-wine-enthusiast': {
      description: 'You love sparkling wines and celebrations! You enjoy brunch, appetizers, and festive occasions with crisp, refreshing bubbles.',
      exampleWines: 'Champagne, Prosecco, Cava, Crémant'
    },
    'dessert-wine-aficionado': {
      description: 'You have a sweet tooth and love dessert wines. You enjoy sweet treats, after-dinner drinks, and indulgent finishes to meals.',
      exampleWines: 'Port, Ice Wine, Moscato, Sauternes, Late Harvest'
    }
  };

  const profileInfo = profileDescriptions[result?.profileId] || {
    description: 'Your wine preferences have been calculated.',
    exampleWines: 'Various wines'
  };

  const characteristicsDisplay = result?.characteristics ? [
    { label: 'Acidity', value: result.characteristics.acidity },
    { label: 'Tannins', value: result.characteristics.tannins },
    { label: 'Body', value: result.characteristics.bodyWeight },
    { label: 'Sweetness', value: result.characteristics.sweetness }
  ] : [];

  return (
    <div className="results-container">
      <div className="results-content">
        <h2>🎉 Your Wine Profile</h2>

        <div className="profile-card">
          <h3>{result?.profile}</h3>
          <p className="profile-description">{profileInfo.description}</p>

          <div className="characteristics-grid">
            <h4>Your Wine Preferences</h4>
            <div className="characteristics">
              {characteristicsDisplay.map((char, index) => (
                <div key={index} className="characteristic">
                  <span className="char-label">{char.label}</span>
                  <span className="char-value">{char.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="example-wines">
            <h4>Example Wines You'll Love</h4>
            <p>{profileInfo.exampleWines}</p>
          </div>
        </div>

        <div className="auto-navigate-notice">
          <p>Redirecting to wine discovery in <strong>{secondsLeft}</strong> seconds...</p>
        </div>

        <div className="results-actions">
          <button className="action-button primary" onClick={handleNavigateToPairing}>
            Start Discovering Wines Now
          </button>
          {onRetake && (
            <button className="action-button secondary" onClick={onRetake}>
              Retake Quiz
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default QuizResults;
