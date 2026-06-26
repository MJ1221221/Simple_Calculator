/**
 * Aether Calc - Calculator Core Logic
 */

// DOM Elements
const expressionDisplay = document.getElementById('expressionDisplay');
const inputDisplay = document.getElementById('inputDisplay');
const historyDrawer = document.getElementById('historyDrawer');
const historyList = document.getElementById('historyList');
const noHistoryMsg = document.getElementById('noHistoryMsg');
const keyboardHint = document.getElementById('keyboardHint');

const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
const closeHistoryBtn = document.getElementById('closeHistoryBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const keypad = document.querySelector('.calc-keypad');

// State
let currentVal = '0';
let expression = '';
let shouldResetScreen = false;
let history = JSON.parse(localStorage.getItem('aether_calc_history')) || [];

// Operator Mapping for displays/math
const operators = {
  add: { symbol: '+', math: '+' },
  subtract: { symbol: '−', math: '-' },
  multiply: { symbol: '×', math: '*' },
  divide: { symbol: '÷', math: '/' }
};

// Initialize App
function init() {
  updateDisplay();
  renderHistory();
  setupEventListeners();
}

// Update Screen Displays
function updateDisplay() {
  inputDisplay.textContent = formatDisplayNumber(currentVal);
  expressionDisplay.textContent = expression;
  adjustFontSize();
}

// Adjust font size dynamically for long numbers to prevent overflow
function adjustFontSize() {
  const len = inputDisplay.textContent.length;
  if (len > 16) {
    inputDisplay.style.fontSize = '1.4rem';
  } else if (len > 12) {
    inputDisplay.style.fontSize = '1.8rem';
  } else if (len > 8) {
    inputDisplay.style.fontSize = '2.2rem';
  } else {
    inputDisplay.style.fontSize = '2.85rem';
  }
}

// Format number with commas for readability (exclude decimal dots while typing)
function formatDisplayNumber(numStr) {
  if (numStr === 'Error' || numStr === 'Infinity' || numStr === '-Infinity' || numStr === 'NaN') {
    return numStr;
  }
  
  // Split into parts to handle decimals
  const parts = numStr.split('.');
  let integerPart = parts[0];
  const decimalPart = parts.length > 1 ? parts[1] : null;

  // Format integer part with commas
  // Using a locale string formatting if it is a valid number
  const num = parseFloat(integerPart);
  if (!isNaN(num)) {
    // Keep signs but use locale formatting for commas
    integerPart = num.toLocaleString('en-US', { maximumFractionDigits: 0 });
    // Keep negative sign if it was lost during parseFloat (e.g., "-0")
    if (num === 0 && numStr.startsWith('-') && !integerPart.startsWith('-')) {
      integerPart = '-' + integerPart;
    }
  }

  return decimalPart !== null ? `${integerPart}.${decimalPart}` : integerPart;
}

// Reset Screen Helper
function resetScreenIfNeeded() {
  if (shouldResetScreen) {
    currentVal = '';
    shouldResetScreen = false;
  }
}

// Keypad Actions
const actions = {
  // Clear all
  clear() {
    currentVal = '0';
    expression = '';
    shouldResetScreen = false;
    updateDisplay();
  },

  // Backspace
  backspace() {
    if (shouldResetScreen) {
      expression = '';
      shouldResetScreen = false;
      return;
    }
    if (currentVal === 'Error' || currentVal.length <= 1 || (currentVal.length === 2 && currentVal.startsWith('-'))) {
      currentVal = '0';
    } else {
      currentVal = currentVal.slice(0, -1);
    }
    updateDisplay();
  },

  // Numbers and decimals
  appendNum(val) {
    resetScreenIfNeeded();
    
    // Prevent multiple decimals
    if (val === '.' && currentVal.includes('.')) return;
    
    // Replace initial 0 unless typing a decimal
    if (currentVal === '0' && val !== '.') {
      currentVal = val;
    } else {
      currentVal += val;
    }
    
    updateDisplay();
  },

  // Math Operators (+, -, *, /)
  setOperator(opKey) {
    const op = operators[opKey];
    if (!op) return;

    if (currentVal === 'Error') return;

    // If there's already an expression and we just finished typing a number, calculate first
    if (expression && !shouldResetScreen) {
      const success = actions.calculate(true); // silent calc to chain operation
      if (!success) return;
    }

    expression = `${currentVal} ${op.symbol} `;
    shouldResetScreen = true;
    updateDisplay();
  },

  // Negate sign (±)
  negate() {
    if (currentVal === '0' || currentVal === 'Error') return;
    if (currentVal.startsWith('-')) {
      currentVal = currentVal.substring(1);
    } else {
      currentVal = '-' + currentVal;
    }
    updateDisplay();
  },

  // Percentage (%)
  percent() {
    if (currentVal === 'Error') return;
    // Simply divide by 100
    const val = parseFloat(currentVal);
    if (isNaN(val)) return;
    
    // Handle floating point precision issue (e.g. 0.1 + 0.2)
    currentVal = stripPrecisionError(val / 100).toString();
    updateDisplay();
  },

  // Square (x²)
  square() {
    if (currentVal === 'Error') return;
    const val = parseFloat(currentVal);
    if (isNaN(val)) return;

    const result = val * val;
    const original = currentVal;
    currentVal = stripPrecisionError(result).toString();
    expression = `sqr(${original}) =`;
    shouldResetScreen = true;
    
    addToHistory(`sqr(${original})`, currentVal);
    updateDisplay();
  },

  // Square Root (√)
  sqrt() {
    if (currentVal === 'Error') return;
    const val = parseFloat(currentVal);
    if (isNaN(val)) return;

    if (val < 0) {
      currentVal = 'Error';
      expression = `sqrt(${val}) =`;
      shouldResetScreen = true;
      updateDisplay();
      return;
    }

    const result = Math.sqrt(val);
    const original = currentVal;
    currentVal = stripPrecisionError(result).toString();
    expression = `sqrt(${original}) =`;
    shouldResetScreen = true;

    addToHistory(`sqrt(${original})`, currentVal);
    updateDisplay();
  },

  // Evaluate Expression
  calculate(isChaining = false) {
    if (currentVal === 'Error') return false;
    if (!expression || expression.includes('=')) return false;

    // Retrieve operators
    const exprParts = expression.trim().split(' ');
    if (exprParts.length < 2) return false;

    const prevValStr = exprParts[0];
    const opSymbol = exprParts[1];
    
    // Resolve math operator
    let mathOp = null;
    for (const key in operators) {
      if (operators[key].symbol === opSymbol) {
        mathOp = operators[key].math;
        break;
      }
    }

    if (!mathOp) return false;

    const prev = parseFloat(prevValStr);
    const current = parseFloat(currentVal);

    if (isNaN(prev) || isNaN(current)) return false;

    let result = 0;
    switch (mathOp) {
      case '+': result = prev + current; break;
      case '-': result = prev - current; break;
      case '*': result = prev * current; break;
      case '/': 
        if (current === 0) {
          currentVal = 'Error';
          expression = `${prevValStr} ${opSymbol} ${currentVal} =`;
          shouldResetScreen = true;
          updateDisplay();
          return false;
        }
        result = prev / current; 
        break;
      default: return false;
    }

    // Strip float precision issue
    const resultStr = stripPrecisionError(result).toString();
    
    if (isChaining) {
      currentVal = resultStr;
    } else {
      const fullExpr = `${prevValStr} ${opSymbol} ${currentVal}`;
      expression = `${fullExpr} =`;
      addToHistory(fullExpr, resultStr);
      currentVal = resultStr;
      shouldResetScreen = true;
    }
    
    updateDisplay();
    return true;
  }
};

// JS Precision Helper (limits precision issues like 0.1 + 0.2 = 0.30000000000000004)
function stripPrecisionError(num) {
  return parseFloat(num.toPrecision(12));
}

// History Functions
function addToHistory(expr, result) {
  // Avoid duplicate successive entries
  if (history.length > 0 && history[0].expr === expr && history[0].result === result) {
    return;
  }
  
  history.unshift({ expr, result });
  
  // Cap history at 50 entries
  if (history.length > 50) {
    history.pop();
  }
  
  localStorage.setItem('aether_calc_history', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  if (history.length === 0) {
    noHistoryMsg.style.display = 'block';
    historyList.querySelectorAll('.history-item').forEach(el => el.remove());
    return;
  }

  noHistoryMsg.style.display = 'none';
  
  // Clear items except the empty state placeholder
  historyList.querySelectorAll('.history-item').forEach(el => el.remove());

  // Render items
  history.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');
    div.innerHTML = `
      <span class="history-expr">${item.expr}</span>
      <span class="history-result">${formatDisplayNumber(item.result)}</span>
    `;

    // Click history to restore result
    div.addEventListener('click', () => {
      currentVal = item.result;
      expression = '';
      shouldResetScreen = true;
      updateDisplay();
      closeHistory();
    });

    // Support keyboard activation on history item
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        div.click();
      }
    });

    historyList.appendChild(div);
  });
}

function clearHistory() {
  history = [];
  localStorage.removeItem('aether_calc_history');
  renderHistory();
}

// History Drawer Visibility
function openHistory() {
  historyDrawer.classList.add('open');
}

function closeHistory() {
  historyDrawer.classList.remove('open');
}

// Show a temporary keyboard hint overlay
let hintTimeout;
function showKeyboardHint() {
  keyboardHint.classList.add('show');
  clearTimeout(hintTimeout);
  hintTimeout = setTimeout(() => {
    keyboardHint.classList.remove('show');
  }, 2500);
}

// Button Click & Keyboard active visual feedback
function playKeyActiveFeedback(btnId) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  
  btn.classList.add('keyboard-active');
  setTimeout(() => {
    btn.classList.remove('keyboard-active');
  }, 100);
}

// Event Listeners
function setupEventListeners() {
  // Keypad clicks
  keypad.addEventListener('click', (e) => {
    const key = e.target.closest('.key');
    if (!key) return;

    const val = key.dataset.val;
    const operator = key.dataset.operator;
    const action = key.dataset.action;

    if (val !== undefined) {
      actions.appendNum(val);
      playKeyActiveFeedback(key.id);
    } else if (operator !== undefined) {
      if (['add', 'subtract', 'multiply', 'divide'].includes(operator)) {
        actions.setOperator(operator);
      } else if (operator === 'negate') {
        actions.negate();
      } else if (operator === 'percent') {
        actions.percent();
      } else if (operator === 'sqrt') {
        actions.sqrt();
      } else if (operator === 'square') {
        actions.square();
      }
      playKeyActiveFeedback(key.id);
    } else if (action !== undefined) {
      if (action === 'clear') {
        actions.clear();
      } else if (action === 'backspace') {
        actions.backspace();
      } else if (action === 'calculate') {
        actions.calculate();
      }
      playKeyActiveFeedback(key.id);
    }
  });

  // History panel triggers
  toggleHistoryBtn.addEventListener('click', openHistory);
  closeHistoryBtn.addEventListener('click', closeHistory);
  clearHistoryBtn.addEventListener('click', clearHistory);

  // Close drawer if user clicks outside of it
  document.addEventListener('click', (e) => {
    const isClickInsideCard = id => document.getElementById(id).contains(e.target);
    if (!isClickInsideCard('calculatorContainer') && historyDrawer.classList.contains('open')) {
      closeHistory();
    }
  });

  // Keyboard Listeners
  document.addEventListener('keydown', (e) => {
    const key = e.key;
    
    // Ignore input events if focusing on interactive elements like the clear history button
    if (document.activeElement.tagName === 'BUTTON' && (key === 'Enter' || key === ' ')) {
      return;
    }

    let buttonId = '';
    
    // Digits
    if (/[0-9]/.test(key)) {
      e.preventDefault();
      actions.appendNum(key);
      buttonId = `key-${key}`;
      showKeyboardHint();
    }
    // Decimal point
    else if (key === '.') {
      e.preventDefault();
      actions.appendNum('.');
      buttonId = 'key-decimal';
      showKeyboardHint();
    }
    // Basic Arithmetic operators
    else if (key === '+') {
      e.preventDefault();
      actions.setOperator('add');
      buttonId = 'key-add';
      showKeyboardHint();
    }
    else if (key === '-') {
      e.preventDefault();
      actions.setOperator('subtract');
      buttonId = 'key-subtract';
      showKeyboardHint();
    }
    else if (key === '*') {
      e.preventDefault();
      actions.setOperator('multiply');
      buttonId = 'key-multiply';
      showKeyboardHint();
    }
    else if (key === '/') {
      e.preventDefault();
      actions.setOperator('divide');
      buttonId = 'key-divide';
      showKeyboardHint();
    }
    // Percent
    else if (key === '%') {
      e.preventDefault();
      actions.percent();
      buttonId = 'key-percent';
      showKeyboardHint();
    }
    // Equals / Evaluation
    else if (key === 'Enter' || key === '=') {
      e.preventDefault();
      actions.calculate();
      buttonId = 'key-equals';
      showKeyboardHint();
    }
    // Backspace
    else if (key === 'Backspace') {
      e.preventDefault();
      actions.backspace();
      buttonId = 'key-backspace';
      showKeyboardHint();
    }
    // Clear (AC)
    else if (key === 'Escape' || key === 'Delete') {
      e.preventDefault();
      actions.clear();
      buttonId = 'key-clear';
      showKeyboardHint();
    }
    // Scientific Shortcut: s or S for Square
    else if (key.toLowerCase() === 's') {
      e.preventDefault();
      actions.square();
      buttonId = 'key-square';
      showKeyboardHint();
    }
    // Scientific Shortcut: r or R for Square Root
    else if (key.toLowerCase() === 'r') {
      e.preventDefault();
      actions.sqrt();
      buttonId = 'key-sqrt';
      showKeyboardHint();
    }
    // Scientific Shortcut: n or N for Negate sign
    else if (key.toLowerCase() === 'n') {
      e.preventDefault();
      actions.negate();
      buttonId = 'key-negate';
      showKeyboardHint();
    }
    
    // Play button press animations if matched
    if (buttonId) {
      playKeyActiveFeedback(buttonId);
    }
  });
}

// Run application
init();
