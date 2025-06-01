import { useEffect, useCallback, useRef, useState } from 'react';
import { useGameState } from './hooks/useGameState';
import { useLevelManager } from './hooks/useLevelManager';
import { usePlayerInput } from './hooks/usePlayerInput';
import { useThemeManager } from './hooks/useThemeManager';
import { useQuestionManager } from './hooks/useQuestionManager';
import { useZombieManager } from './hooks/useZombieManager';
import { useSoundManager } from './hooks/useSoundManager';
import { GAME_CONFIG } from './gameConfig';
import { useVolumeControl } from '../../context/GameSettingsContext';
import SummaryPage from './SummaryPage';

// Import new CSS styles
import './ChallengeMode.css';

// Import character image
import zombieCharacter from './assets/images/characters/zombie-character.png';

/**
 * Challenge Mode Component
 * Main component for the typing challenge game mode
 * @param {Object} props - Component props
 * @param {Function} props.onBack - Callback to return to main menu
 */
export default function ChallengeMode({ onBack }) {
  // Game state variables
  const { gameState, updateGameState, initializeGameState } = useGameState();

  // Level management
  const levelManager = useLevelManager(gameState, updateGameState);

  // Theme management
  const themeManager = useThemeManager(gameState, updateGameState);

  // Question management
  const questionManager = useQuestionManager();

  // Zombie management
  const zombieManager = useZombieManager(gameState, updateGameState);

  // Sound management
  const soundManager = useSoundManager();
  const { volume } = useVolumeControl();
  soundManager.setMasterVolume(volume);

  // Add ref for measuring text width
  const textMeasureRef = useRef(null);
  const [panelWidth, setPanelWidth] = useState(740); // 預設2x尺寸 (370px × 2)

  // decide zombie bahavior from their types

  /**
   * Handles correct answer events
   * Updates accuracy statistics and spawns a new word
   * @param {Object} answerData - Data about the correct answer
   */
  const handleCorrectAnswer = (answerData) => {
    let answer = questionManager.currentQuestion;
    // Update accuracy statistics
    if (zombieManager.getCurrentZombie()?.behavior === 'mimic') {
      answer = zombieManager.getExtraState('realAnswer');
    }
    if (questionManager.currentQuestion) {
      questionManager.onCorrectAnswer({
        ...answerData,
        question: answer,
        isCorrect: true
      });
    }
    if (zombieBehaviors(zombieManager.getCurrentZombie(), 'correct')) return;

    // Update zombie defeat count in game state using functional update pattern
    updateGameState((prevState) => {
      return {
        ...prevState,
        zombiesDefeated: prevState.zombiesDefeated + 1
      };
    });

    // Play correct sound effect
    soundManager.playSound('accepted');

    // Reset zombie charge
    zombieManager.resetChargeRate();

    // Generate new zombie and question
    generateNewZombie();
  };

  /**
   * Handles wrong answer events
   * Updates accuracy statistics and applies penalties if applicable
   * @param {Object} answerData - Data about the wrong answer
   */
  const handleWrongAnswer = (answerData) => {
    // Update accuracy statistics
    if (questionManager.currentQuestion) {
      questionManager.onWrongAnswer({
        ...answerData,
        question: questionManager.currentQuestion,
        isCorrect: false
      });
    }

    // Apply penalty mechanism (for Level-4 and above)
    if (gameState.level >= 4) {
      zombieManager.charge(0.3);
    }

    zombieBehaviors(zombieManager.getCurrentZombie(), 'wrong');

    // Play error sound effect
    soundManager.playSound('wrongAnswer');
  };

  // Initialize PlayerInput hook with necessary callbacks
  const playerInput = usePlayerInput(
    gameState,
    updateGameState,
    handleCorrectAnswer,
    handleWrongAnswer
  );

  // Handle click anywhere to refocus input
  const handleContainerClick = useCallback(() => {
    const inputElement = document.querySelector('.typing-input');
    if (inputElement) {
      inputElement.focus();
    }
  }, []);

  // Initialize focus when game starts
  useEffect(() => {
    const focusInput = () => {
      const inputElement = document.querySelector('.typing-input');
      if (inputElement) {
        inputElement.focus();
      }
    };

    // Focus after a short delay to ensure DOM is ready
    const timeoutId = setTimeout(focusInput, 100);

    return () => clearTimeout(timeoutId);
  }, [gameState.gameOver]);

  /**
   * Fetch the type of zombie to spawn and request question(s)
   *
   * For future use:
   *   1. Replace generateNewZombie
   *   2. More powerful function
   *   3. Request question(s) based on zombie type
   *   4. Update zombieManager with the new zombie type
   *
   * This function will be called when the player defeats a zombie
   */
  /*
  const requestNextZombie = useCallback(() => {
    // TODO: Fetch or deside the type of zombie to spawn
    // TODO: Request question(s) based on zombie type
    // TODO: Update zombieManager with the new zombie type
    // TODO: Notify playerInput to update the current answer
  }, []);
  */

  /**
   * Calculate optimal panel width based on question text
   * Base size: 370×370px, only stretch width when needed
   */
  const calculatePanelWidth = useCallback((question) => {
    if (!question || !textMeasureRef.current) return 740; // 預設2x尺寸

    // Create temporary element for measuring
    const measureElement = textMeasureRef.current;

    // Measure English text width (using larger 2x font size)
    measureElement.style.cssText = ''; // 清空之前的樣式
    measureElement.style.font = '48px DonegalOne, Georgia, serif'; /* 配合CSS放大字體 24px × 2 */
    measureElement.style.fontWeight = 'bold';
    measureElement.style.letterSpacing = '2px'; /* 配合CSS字距 */
    measureElement.style.whiteSpace = 'nowrap'; /* 確保不換行 */
    measureElement.style.visibility = 'hidden'; /* 確保隱藏但保持layout */
    measureElement.style.position = 'absolute';
    measureElement.style.left = '-9999px';
    measureElement.textContent = question.description || '';
    const englishWidth = measureElement.offsetWidth;

    // Measure Chinese text width (using larger 2x font size)
    measureElement.style.cssText = ''; // 清空之前的樣式
    measureElement.style.font =
      '36px YujiBoku, Microsoft YaHei, sans-serif'; /* 配合CSS放大字體 18px × 2 */
    measureElement.style.fontWeight = 'normal';
    measureElement.style.letterSpacing = 'normal';
    measureElement.style.whiteSpace = 'nowrap'; /* 確保不換行 */
    measureElement.style.visibility = 'hidden'; /* 確保隱藏但保持layout */
    measureElement.style.position = 'absolute';
    measureElement.style.left = '-9999px';
    measureElement.textContent = question.translation || '';
    const chineseWidth = measureElement.offsetWidth;

    // Use the wider text as base (before scaling)
    const rawContentWidth = Math.max(englishWidth, chineseWidth);

    // 直接計算面板總寬度需求
    const paddingWidth = 80; // 50px + 30px (左右padding in 2x)
    const comfortSpace = 80; // 緩衝空間
    const letterSpacingBuffer = rawContentWidth * 0.1; // 字距緩衝，約10%寬度
    const requiredPanelWidth = rawContentWidth + paddingWidth + comfortSpace + letterSpacingBuffer;

    // 基礎面板寬度 (370px × 2)
    const basePanelWidth = 740;

    // 只有當需要的面板寬度超過基礎尺寸時才拉伸
    if (requiredPanelWidth <= basePanelWidth) {
      return basePanelWidth; // 使用預設最小尺寸 (370px × 2)
    } else {
      // 設定最大寬度限制 (2x scale)
      const maxWidth = 2000; // 1000px × 2，足夠容納超長題目

      return Math.min(requiredPanelWidth, maxWidth);
    }
  }, []);

  /**
   * Generate new zombie and question
   */
  const generateNewZombie = useCallback(() => {
    const zombie = zombieManager.changeCurrentZombie(questionManager.getCompletionRate());
    if (zombieBehaviors(zombie, 'generate')) return;

    const question = questionManager.selectQuestion();
    if (!question) {
      console.warn('No question available for difficulty:', gameState.currentDifficulty);
      return;
    }
    questionManager.updateCurrentQuestion(question);
    playerInput.updateCurrentAnswer(question.answer, question.difficulty);

    // Calculate and set panel width based on question content
    const newWidth = calculatePanelWidth(question);
    setPanelWidth(newWidth);
  }, [
    questionManager,
    playerInput,
    zombieManager,
    gameState.currentDifficulty,
    calculatePanelWidth
  ]);

  //extra handleinput for mimic
  const handleInputWithMimic = useCallback(
    (e) => {
      const value = e.target.value;
      const currentZombie = zombieManager.getCurrentZombie();
      const behavior = currentZombie?.behavior;

      if (behavior === 'mimic') {
        const revealed = zombieManager.getExtraState('mimicRevealed');
        const realQuestion = zombieManager.getExtraState('realAnswer');
        if (!revealed && value.length > 0) {
          zombieManager.setExtraState('mimicRevealed', true);
          questionManager.updateCurrentQuestion(realQuestion);
          const newWidth = calculatePanelWidth(realQuestion);
          setPanelWidth(newWidth);
          return;
        }
      }

      // if not mimic use origin handleinput
      playerInput.handleInputChange(e);
    },
    [zombieManager, questionManager, calculatePanelWidth, setPanelWidth, playerInput]
  );

  const zombieBehaviors = useCallback(
    (zombie, situation) => {
      const behavior = zombie.behavior;

      // Boss zombie generation logic
      if (behavior === 'boss' && situation === 'generate') {
        const boss_questionArray = questionManager.getCandidateQuestions('beginner');
        const boss_question =
          boss_questionArray[Math.floor(Math.random() * boss_questionArray.length)];
        if (!boss_question) {
          console.warn('No question available for difficulty:', gameState.currentDifficulty);
          return true;
        }
        questionManager.updateCurrentQuestion(boss_question);
        playerInput.updateCurrentAnswer(boss_question.answer, boss_question.difficulty);
        const newWidth = calculatePanelWidth(boss_question);
        setPanelWidth(newWidth);
        return true;
      }

      // Mimic zombie fake question logic
      if (behavior === 'mimic' && situation === 'generate') {
        const realQuestion = questionManager.selectQuestion();
        if (!realQuestion) {
          console.warn('No question available for difficulty:', gameState.currentDifficulty);
          return true;
        }
        const fakeQuestionArray = questionManager.getCandidateQuestions('beginner');
        const fakeQuestion =
          fakeQuestionArray[Math.floor(Math.random() * fakeQuestionArray.length)];
        questionManager.updateCurrentQuestion(fakeQuestion);
        playerInput.updateCurrentAnswer(realQuestion.answer, realQuestion.difficulty);
        zombieManager.setExtraState('mimicRevealed', false);
        zombieManager.setExtraState('realAnswer', realQuestion);
        const newWidth = calculatePanelWidth(fakeQuestion);
        setPanelWidth(newWidth);
        return true;
      }

      if (behavior === 'chameleon' && situation === 'wrong') {
        const newQuestion = questionManager.selectQuestion();
        if (newQuestion) {
          questionManager.updateCurrentQuestion(newQuestion);
          playerInput.updateCurrentAnswer(newQuestion.answer, newQuestion.difficulty);
          const newWidth = calculatePanelWidth(newQuestion);
          setPanelWidth(newWidth);
        }
        return;
      }
      // shield zombie break shield logic
      if (behavior === 'shield' && situation === 'correct') {
        if (!zombieManager.getExtraState('shieldHit')) {
          zombieManager.setExtraState('shieldHit', true);
          const newQuestion = questionManager.selectQuestion();
          if (newQuestion) {
            questionManager.updateCurrentQuestion(newQuestion);
            playerInput.updateCurrentAnswer(newQuestion.answer, newQuestion.difficulty);
            const newWidth = calculatePanelWidth(newQuestion);
            setPanelWidth(newWidth);
          }
          return true;
        }
        return false;
      }
      // boss zombie three question logic with theme change
      if (behavior === 'boss' && situation === 'correct') {
        const hp = zombieManager.getExtraState('bossHp') ?? 3;
        const stage = zombieManager.getExtraState('bossStage') ?? 0;
        if (hp > 1) {
          const nextStage = stage + 1;
          const difficultyOrder = ['beginner', 'medium', 'hard'];
          const nextDifficulty = difficultyOrder[nextStage];

          zombieManager.setExtraState('bossHp', hp - 1);
          zombieManager.setExtraState('bossStage', nextStage);
          const newQuestionArray = questionManager.getCandidateQuestions(nextDifficulty);
          const newQuestion = newQuestionArray[Math.floor(Math.random() * newQuestionArray.length)];
          if (newQuestion) {
            questionManager.updateCurrentQuestion(newQuestion);
            playerInput.updateCurrentAnswer(newQuestion.answer, newQuestion.difficulty);
            const newWidth = calculatePanelWidth(newQuestion);
            setPanelWidth(newWidth);
          }
          return true;
        } else {
          themeManager.rotateToNextTheme();
        }
        return false;
      }
    },
    [
      questionManager,
      playerInput,
      zombieManager,
      gameState.currentDifficulty,
      calculatePanelWidth,
      setPanelWidth,
      themeManager
    ]
  );

  // Initialize game, generate first zombie
  useEffect(() => {
    // Check that currentSample not only exists but has content
    const hasSamples =
      themeManager.currentSample &&
      (themeManager.currentSample.beginner.length > 0 ||
        themeManager.currentSample.medium.length > 0 ||
        themeManager.currentSample.hard.length > 0);

    if (hasSamples && !gameState.gameOver) {
      questionManager.updateSamplePool(themeManager.currentSample);
      generateNewZombie();
    }
  }, [themeManager.currentSample]);

  // Main game loop - handles zombie charging and lifecycle
  useEffect(() => {
    if (gameState.gameOver) return;

    let frameId;
    let lastChargeTime = performance.now();

    const tick = (now) => {
      frameId = requestAnimationFrame(tick);

      // Check if it's time for the next update
      if (now - lastChargeTime >= GAME_CONFIG.CHARGE_INTERVAL) {
        lastChargeTime = now;

        let chargeRate = zombieManager.getCurrentChargeRate();
        let chargeSpeed = levelManager.getChargeSpeed();
        let next =
          chargeRate + chargeSpeed * zombieManager.getCurrentZombie().chargeSpeedMultiplier;

        zombieManager.charge(chargeSpeed * zombieManager.getCurrentZombie().chargeSpeedMultiplier);

        if (next >= 1) {
          const newLives = gameState.lives - 1;
          if (newLives <= 0) {
            updateGameState({ gameOver: true });
            soundManager.playSound('defeated');
          } else {
            updateGameState({ lives: newLives });
            playerInput.clearInput();
            if (zombieManager.getCurrentZombie().name === 'boss') {
              zombieManager.resetChargeRate();
              console.log('reset');
              setTimeout(() => {
                zombieManager.charge(0.5);
              }, 100);
            } else {
              generateNewZombie();
            }
          }
          zombieManager.resetChargeRate();
        }
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [
    gameState.lives,
    gameState.gameOver,
    levelManager.getChargeSpeed,
    zombieManager.charge,
    zombieManager.getCurrentChargeRate,
    updateGameState,
    soundManager.playSound
  ]);

  useEffect(() => {
    if (
      gameState.currentTheme === '' &&
      Array.isArray(gameState.remainingThemes) &&
      gameState.remainingThemes.length === 0 &&
      !gameState.gameOver
    ) {
      themeManager.rotateToNextTheme();
    }
  }, [gameState.remainingThemes]);

  // Restart game function
  const handleRestart = useCallback(() => {
    console.log('[ChallengeMode] Restarting the game...');
    // Reset game state
    initializeGameState();

    // Reset player input
    playerInput.clearInput();

    // Reset zombie charge
    zombieManager.resetChargeRate();
  }, [initializeGameState, playerInput, zombieManager, themeManager, questionManager]);

  // Helper function to calculate countdown timer
  const getCountdownTime = useCallback(() => {
    const chargeRate = zombieManager.getCurrentChargeRate();
    const chargeSpeed = levelManager.getChargeSpeed();
    return Math.round((1 - chargeRate) / chargeSpeed / (1000 / GAME_CONFIG.CHARGE_INTERVAL));
  }, [zombieManager, levelManager]);

  // Helper function to get timer CSS class based on remaining time
  const getTimerClass = useCallback(() => {
    const timeLeft = getCountdownTime();
    if (timeLeft <= 2) return 'countdown-timer danger';
    if (timeLeft <= 5) return 'countdown-timer warning';
    return 'countdown-timer';
  }, [getCountdownTime]);

  // Helper function to render input letters with visual feedback
  const renderInputDisplay = () => {
    if (!questionManager.currentQuestion) return null;

    const targetWord = questionManager.currentQuestion.answer;
    const currentInput = playerInput.currentInput || '';

    return (
      <div className="input-display">
        {targetWord.split('').map((letter, index) => {
          let className = 'input-letter';
          let displayContent = '';

          if (index < currentInput.length) {
            // Character has been typed - show the player's actual input
            displayContent = currentInput[index];
            if (currentInput[index] === letter) {
              className += ' typed-correct';
            } else {
              className += ' typed-incorrect';
            }
          } else {
            // Not yet typed - show empty content but preserve space for underline
            displayContent = ''; // Empty string instead of '_'
            className += ' untyped';
          }

          return (
            <span
              key={index}
              className={className}
            >
              {displayContent}
            </span>
          );
        })}
      </div>
    );
  };

  // Render game UI
  return (
    <div
      className="challenge-mode-container fade-in"
      onClick={handleContainerClick}
    >
      {gameState.gameOver ? (
        // Game over screen
        <SummaryPage
          onBack={onBack}
          onRestart={handleRestart}
        />
      ) : (
        // Active game screen
        <>
          {/* Life Hearts - Top Left */}
          <div className="life-hearts-container">
            {[...Array(gameState.lives)].map((_, i) => (
              <div
                key={i}
                className="life-heart"
              />
            ))}
          </div>

          {/* Game Info - Top Right */}
          <div className="game-info-container">
            <div className="info-badge theme">Theme: {gameState.currentTheme}</div>
            <div className="info-badge level">Level: {gameState.level}</div>
          </div>

          {/* Boss HP Indicator */}
          {zombieManager.getCurrentZombie()?.behavior === 'boss' && (
            <div className="boss-hp-container">
              {[...Array(3)].map((_, i) => {
                const bossHp = zombieManager.getExtraState('bossHp') ?? 3;
                return (
                  <div
                    key={i}
                    className={`boss-hp-dot ${i < bossHp ? 'active' : 'inactive'}`}
                  />
                );
              })}
            </div>
          )}

          {/* Simplified Countdown Timer */}
          <div className={getTimerClass()}>{getCountdownTime()}</div>

          {/* Character Container */}
          <div className="character-container">
            <img
              src={zombieCharacter}
              alt="Zombie Character"
              className="zombie-character"
            />
          </div>

          {/* Question Panel */}
          <div className="question-panel-container">
            <div
              className="parchment-panel"
              style={{ width: `${panelWidth}px` }}
            >
              <div className="question-text-english">
                {questionManager.currentQuestion
                  ? questionManager.currentQuestion.description
                  : '錯誤：沒有題目'}
              </div>
              {/* Chinese translation */}
              <div className="question-text-chinese">
                {questionManager.currentQuestion?.translation || '此題沒有中文翻譯'}
              </div>
            </div>
          </div>

          {/* Hidden element for text measurement */}
          <div
            ref={textMeasureRef}
            style={{
              position: 'absolute',
              left: '-9999px',
              top: '-9999px',
              visibility: 'hidden',
              whiteSpace: 'nowrap'
            }}
          />

          {/* Input Area with Visual Display */}
          <div className="input-area-container">
            {/* Hidden actual input field for functionality */}
            <input
              type="text"
              ref={playerInput.registerInputRef}
              onChange={handleInputWithMimic}
              className="typing-input"
              autoFocus
              disabled={gameState.gameOver}
              style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
            />

            {/* Visual Text Display */}
            {renderInputDisplay()}
          </div>

          {/* Charge Progress Bar */}
          <div className="charge-progress-bar">
            <div
              className="charge-progress-fill"
              style={{ width: `${zombieManager.getCurrentChargeRate() * 100}%` }}
            />
          </div>
        </>
      )}
    </div>
  );
}
