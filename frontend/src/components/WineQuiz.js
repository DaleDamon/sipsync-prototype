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
      question: "How do you like your coffee?",
      answers: [
        "Black, no sugar",
        "With cream and sugar",
        "I prefer tea or juice"
      ]
    },
    {
      id: 2,
      question: "Dark chocolate or milk chocolate?",
      answers: [
        "Dark chocolate (85%+ cacao)",
        "Milk chocolate",
        "White chocolate or fruity candy"
      ]
    },
    {
      id: 3,
      question: "What's your go-to tea?",
      answers: [
        "Black tea, unsweetened",
        "Green tea or herbal tea",
        "Fruit tea or sweet iced tea"
      ]
    },
    {
      id: 4,
      question: "How do you feel about sour/tangy flavors?",
      answers: [
        "Love them! Gimme all the citrus",
        "Like them in moderation",
        "Prefer milder, less tangy flavors"
      ]
    },
    {
      id: 5,
      question: "What salad dressing do you prefer?",
      answers: [
        "Vinaigrette or lemon juice",
        "Ranch or Caesar",
        "Creamy or oil-based"
      ]
    },
    {
      id: 6,
      question: "What's your ideal morning drink?",
      answers: [
        "Orange juice or grapefruit juice",
        "Smoothie or fruit blend",
        "Hot chocolate or creamy latte"
      ]
    },
    {
      id: 7,
      question: "Which meal sounds most appealing?",
      answers: [
        "Grilled steak with bold sauce",
        "Roasted chicken with herbs",
        "Fresh fish with lemon"
      ]
    },
    {
      id: 8,
      question: "What soup do you crave?",
      answers: [
        "Rich, creamy chowder or bisque",
        "Tomato soup or minestrone",
        "Clear broth or light gazpacho"
      ]
    },
    {
      id: 9,
      question: "What pasta sauce is your favorite?",
      answers: [
        "Hearty meat sauce or Bolognese",
        "Tomato basil or marinara",
        "Light olive oil or pesto"
      ]
    },
    {
      id: 10,
      question: "How do you feel about dessert?",
      answers: [
        "Must have dessert every meal!",
        "Sometimes, when I'm in the mood",
        "Rarely eat sweets, prefer savory"
      ]
    },
    {
      id: 11,
      question: "How sweet do you like your drinks?",
      answers: [
        "The sweeter the better",
        "A little sweetness is nice",
        "I prefer unsweetened/dry"
      ]
    },
    {
      id: 12,
      question: "How do you handle spice?",
      answers: [
        "Bring on the heat!",
        "Medium spice is perfect",
        "Mild flavors please"
      ]
    },
    {
      id: 13,
      question: "Fresh herbs or earthy flavors?",
      answers: [
        "Love fresh herbs and floral flavors",
        "Prefer earthy, woody flavors",
        "Fruity and bright flavors"
      ]
    },
    {
      id: 14,
      question: "What fruits do you gravitate toward?",
      answers: [
        "Berries and cherries",
        "Tropical fruits (pineapple, mango)",
        "Citrus fruits (lemon, lime, orange)"
      ]
    },
    {
      id: 15,
      question: "What's your ideal dining occasion?",
      answers: [
        "Celebration with friends",
        "Cozy dinner at home",
        "Fancy steakhouse dinner",
        "Brunch or light lunch"
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
