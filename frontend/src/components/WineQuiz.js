import React, { useState } from 'react';
import '../styles/WineQuiz.css';
import QuizResults from './QuizResults';

function WineQuiz({ user, onComplete }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const questions = [
    {
      id: 1,
      question: "How do you take your coffee in the morning?",
      answers: [
        "Black and strong (espresso style)",
        "Black with a splash of cream",
        "Latte or cappuccino (half coffee, half milk)",
        "Sweet coffee drink or I skip coffee entirely"
      ]
    },
    {
      id: 2,
      question: "What type of chocolate do you reach for?",
      answers: [
        "85%+ dark chocolate (very intense, bitter)",
        "60-70% dark chocolate (rich but balanced)",
        "Milk chocolate (sweet and creamy)",
        "White chocolate or fruit-flavored candy"
      ]
    },
    {
      id: 3,
      question: "What's your everyday tea preference?",
      answers: [
        "Strong black tea, completely unsweetened",
        "Green tea or herbal tea, unsweetened",
        "Flavored tea with a touch of honey",
        "Sweet iced tea or I don't drink tea"
      ]
    },
    {
      id: 4,
      question: "How do you feel about sour and tangy flavors?",
      answers: [
        "Love them intensely (citrus, vinegar, sharp)",
        "Like them in good measure",
        "Prefer them balanced with sweetness",
        "Prefer mild, smooth flavors overall"
      ]
    },
    {
      id: 5,
      question: "What's your ideal salad dressing?",
      answers: [
        "Sharp vinaigrette or lemon-based",
        "Balanced vinaigrette or light dressing",
        "Creamy ranch or Caesar",
        "Rich, oil-based or avocado dressing"
      ]
    },
    {
      id: 6,
      question: "What's your ideal morning beverage?",
      answers: [
        "Citrus juice (orange, grapefruit, lemon)",
        "Green smoothie or fresh fruit blend",
        "Regular smoothie or coffee with milk",
        "Hot chocolate, creamy latte, or milk drink"
      ]
    },
    {
      id: 7,
      question: "Which main course appeals to you most?",
      answers: [
        "Grilled beef with bold, charred flavors",
        "Herb-roasted chicken or pork",
        "Seared fish with citrus or light sauce",
        "Pasta with cream sauce or butter"
      ]
    },
    {
      id: 8,
      question: "What type of soup do you crave?",
      answers: [
        "Rich, creamy chowder or bisque",
        "Balanced tomato or vegetable soup",
        "Light tomato-based or minestrone",
        "Clear broth, consommé, or gazpacho"
      ]
    },
    {
      id: 9,
      question: "What's your go-to pasta sauce?",
      answers: [
        "Hearty meat sauce or rich Bolognese",
        "Balanced tomato-based or traditional marinara",
        "Light tomato or fresh basil sauce",
        "Olive oil, garlic, or light cream sauce"
      ]
    },
    {
      id: 10,
      question: "How important is dessert to you?",
      answers: [
        "Essential! I need something sweet daily",
        "I enjoy dessert several times a week",
        "Occasionally, when I'm in the mood",
        "Rarely or never, prefer savory"
      ]
    },
    {
      id: 11,
      question: "How sweet should your drinks be?",
      answers: [
        "Very sweet - the sweeter the better",
        "Moderately sweet is pleasant",
        "Lightly sweet or balanced",
        "Unsweetened or completely dry"
      ]
    },
    {
      id: 12,
      question: "How do you feel about spicy heat?",
      answers: [
        "Bring on maximum heat and intensity!",
        "Moderate spice with good flavor",
        "Mild spice or just a little kick",
        "No spice at all, prefer mild flavors"
      ]
    },
    {
      id: 13,
      question: "What flavor profile appeals to you most?",
      answers: [
        "Fresh, herbaceous, and floral notes",
        "Earthy, mineral, or woody flavors",
        "Fruity and bright flavors",
        "Rich, savory, or umami flavors"
      ]
    },
    {
      id: 14,
      question: "Which fruits do you naturally gravitate toward?",
      answers: [
        "Dark berries, plums, or cherries",
        "Tropical fruits like mango or pineapple",
        "Stone fruits like peach or apricot",
        "Citrus fruits like lemon, lime, or orange"
      ]
    },
    {
      id: 15,
      question: "What's your ideal dining scenario?",
      answers: [
        "Celebration with a big group of friends",
        "Cozy dinner at home with loved ones",
        "Fancy steakhouse or upscale restaurant",
        "Brunch, casual lunch, or relaxed meal"
      ]
    }
  ];

  const handleAnswerClick = (answerIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = answerIndex;
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Last question answered, submit quiz
      submitQuiz(newAnswers);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const submitQuiz = async (finalAnswers) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/quiz/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.userId,
          answers: finalAnswers
        })
      });

      const data = await response.json();
      if (response.ok) {
        setQuizResult(data);
        setShowResults(true);
      } else {
        console.error('Quiz submission failed:', data.error);
        alert('Failed to submit quiz. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      alert('Error submitting quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (showResults) {
    return (
      <QuizResults
        result={quizResult}
        user={user}
        onComplete={onComplete}
        onRetake={() => {
          // Reset quiz state to start over
          setCurrentQuestion(0);
          setAnswers([]);
          setShowResults(false);
          setQuizResult(null);
        }}
      />
    );
  }

  const question = questions[currentQuestion];
  const progressPercentage = ((currentQuestion + 1) / questions.length) * 100;

  return (
    <div className="quiz-container">
      <div className="quiz-header">
        <h2>Discover Your Wine Profile</h2>
        <p>Answer a few questions about your food and drink preferences</p>
      </div>

      <div className="quiz-progress">
        <div className="progress-bar" style={{ width: `${progressPercentage}%` }}></div>
        <p className="progress-text">Question {currentQuestion + 1} of {questions.length}</p>
      </div>

      <div className="quiz-content">
        <h3>{question.question}</h3>
        <div className="quiz-answers">
          {question.answers.map((answer, index) => (
            <button
              key={index}
              className={`answer-button ${answers[currentQuestion] === index ? 'selected' : ''}`}
              onClick={() => handleAnswerClick(index)}
              disabled={loading}
            >
              {answer}
            </button>
          ))}
        </div>
      </div>

      <div className="quiz-navigation">
        <button
          className="nav-button back-button"
          onClick={handleBack}
          disabled={currentQuestion === 0 || loading}
        >
          Back
        </button>
        <div className="nav-spacer"></div>
        {currentQuestion === questions.length - 1 ? (
          <button
            className="nav-button submit-button"
            onClick={() => handleAnswerClick(answers[currentQuestion])}
            disabled={answers[currentQuestion] === undefined || loading}
          >
            {loading ? 'Calculating...' : 'Submit Quiz'}
          </button>
        ) : (
          <button
            className="nav-button next-button"
            onClick={() => {
              if (answers[currentQuestion] !== undefined) {
                setCurrentQuestion(currentQuestion + 1);
              }
            }}
            disabled={answers[currentQuestion] === undefined}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

export default WineQuiz;
