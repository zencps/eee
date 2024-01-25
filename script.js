(() => {
  'use strict';

  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');

  const OPERATORS = '+-*/';
  const DISPLAY_SYMBOLS = { '+': '+', '-': '\u2212', '*': '\u00D7', '/': '\u00F7' };
  const PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const MAX_LENGTH = 40;

  let display = '0';
  let history = '';
  let justEvaluated = false;
  let hasError = false;

  function prettify(expr) {
    let out = '';
    for (let i = 0; i < expr.length; i++) {
      const ch = expr.charAt(i);
      const prev = i > 0 ? expr.charAt(i - 1) : '';
      if (OPERATORS.includes(ch) && prev !== 'e' && prev !== 'E') {
        out += ' ' + DISPLAY_SYMBOLS[ch] + ' ';
      } else {
        out += ch;
      }
    }
    return out.trim();
  }

  function currentNumberSegment() {
    const match = display.match(/(\d+\.?\d*)$/);
    return match ? match[1] : '';
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return null;
    if (value === 0) return '0';
    const abs = Math.abs(value);
    if (abs >= 1e12 || abs < 1e-9) {
      return value.toExponential(6).replace(/\.?0+e/, 'e');
    }
    return String(parseFloat(value.toPrecision(12)));
  }

  function trimTrailingJunk(str) {
    let out = str;
    while (
      out.length > 0 &&
      (out.endsWith('.') || OPERATORS.includes(out.charAt(out.length - 1)))
    ) {
      out = out.slice(0, -1);
    }
    return out;
  }

  function popOperation(numbers, operators) {
    const b = numbers.pop();
    const a = numbers.pop();
    const op = operators.pop();
    let result;
    if (op === '+') result = a + b;
    else if (op === '-') result = a - b;
    else if (op === '*') result = a * b;
    else if (op === '/') result = b === 0 ? NaN : a / b;
    else result = NaN;
    numbers.push(result);
  }

  function tokenize(expr) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const ch = expr.charAt(i);
      if (/[0-9.]/.test(ch)) {
        let j = i + 1;
        while (j < expr.length && /[0-9.]/.test(expr.charAt(j))) j++;
        if (j < expr.length && (expr.charAt(j) === 'e' || expr.charAt(j) === 'E')) {
          let k = j + 1;
          if (k < expr.length && (expr.charAt(k) === '+' || expr.charAt(k) === '-')) k++;
          let m = k;
          while (m < expr.length && /[0-9]/.test(expr.charAt(m))) m++;
          if (m > k) j = m;
        }
        const literal = expr.slice(i, j);
        const mantissa = literal.split(/[eE]/)[0];
        const value = Number(literal);
        if ((mantissa.match(/\./g) || []).length > 1 || !Number.isFinite(value)) {
          throw new Error('Invalid expression');
        }
        tokens.push(value);
        i = j;
      } else if (ch === '-' && (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string')) {
        tokens.push(0);
        tokens.push('-');
        i++;
      } else if (OPERATORS.includes(ch)) {
        tokens.push(ch);
        i++;
      } else {
        throw new Error('Invalid expression');
      }
    }
    return tokens;
  }

  function evaluateTokens(tokens) {
    const validShape =
      tokens.length > 0 &&
      tokens.length % 2 === 1 &&
      tokens.every((token, index) =>
        index % 2 === 0 ? typeof token === 'number' && Number.isFinite(token) : OPERATORS.includes(token)
      );
    if (!validShape) throw new Error('Invalid expression');

    const numbers = [];
    const operators = [];
    for (const token of tokens) {
      if (typeof token === 'string') {
        while (
          operators.length > 0 &&
          PRECEDENCE[operators[operators.length - 1]] >= PRECEDENCE[token]
        ) {
          popOperation(numbers, operators);
        }
        operators.push(token);
      } else {
        numbers.push(token);
      }
    }
    while (operators.length > 0) popOperation(numbers, operators);

    const result = numbers[numbers.length - 1];
    if (numbers.length !== 1 || !Number.isFinite(result)) throw new Error('Invalid expression');
    return result;
  }

  function startFreshWith(text) {
    display = text;
    history = '';
    justEvaluated = false;
    hasError = false;
    render();
  }

  function inputDigit(digit) {
    if (hasError || justEvaluated) {
      startFreshWith(digit);
      return;
    }
    if (display.length >= MAX_LENGTH) return;
    const segment = currentNumberSegment();
    if (segment === '0') {
      display = display.slice(0, -1) + digit;
    } else {
      display += digit;
    }
    render();
  }

  function inputDecimal() {
    if (hasError || justEvaluated) {
      startFreshWith('0.');
      return;
    }
    if (display.length >= MAX_LENGTH) return;
    const segment = currentNumberSegment();
    if (segment.includes('.')) return;
    display += segment === '' ? '0.' : '.';
    render();
  }

  function inputOperator(operator) {
    if (hasError || display === '0') return;
    if (!justEvaluated && OPERATORS.includes(display.charAt(display.length - 1))) {
      display = display.slice(0, -1);
    }
    while (display.endsWith('.')) {
      display = display.slice(0, -1);
    }
    if (display.length >= MAX_LENGTH) return;
    justEvaluated = false;
    display += operator;
    render();
  }

  function pressEquals() {
    if (hasError || justEvaluated) return;
    const normalized = trimTrailingJunk(display);
    try {
      const raw = evaluateTokens(tokenize(normalized));
      const formatted = formatNumber(raw);
      if (formatted === null) throw new Error('Invalid expression');
      history = normalized;
      display = formatted;
      justEvaluated = true;
    } catch (err) {
      hasError = true;
    }
    render();
  }

  function pressDelete() {
    if (hasError) return;
    if (justEvaluated) {
      startFreshWith('0');
      return;
    }
    display = display.length <= 1 ? '0' : display.slice(0, -1);
    render();
  }

  function pressClear() {
    startFreshWith('0');
  }

  function render() {
    expressionEl.textContent =
      justEvaluated && !hasError ? prettify(history) + ' \u003D' : '\u00A0';
    resultEl.textContent = hasError ? 'Error' : display;
    resultEl.classList.toggle('error', hasError);
    resultEl.classList.remove('small', 'xsmall');
    const length = resultEl.textContent.length;
    if (length > 28) resultEl.classList.add('xxsmall');
    else if (length > 16) resultEl.classList.add('xsmall');
    else if (length > 11) resultEl.classList.add('small');
  }

  function flashKey(key) {
    let selector = null;
    if (/^[0-9.]$/.test(key)) selector = '[data-digit="' + key + '"]';
    else if (key === '+' || key === '-') selector = '[data-operator="' + key + '"]';
    else if (key === '*' || key === 'x' || key === 'X') selector = '[data-operator="*"]';
    else if (key === '/') selector = '[data-operator="/"]';
    else if (key === 'Enter' || key === '=') selector = '[data-action="equals"]';
    else if (key === 'Backspace') selector = '[data-action="delete"]';
    else if (key === 'Escape' || key === 'c' || key === 'C') selector = '[data-action="clear"]';
    if (!selector) return;

    const button = document.querySelector('.key' + selector);
    if (!button) return;
    button.classList.add('is-pressed');
    setTimeout(() => button.classList.remove('is-pressed'), 130);
  }

  document.querySelectorAll('.key').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.digit !== undefined) {
        button.dataset.digit === '.' ? inputDecimal() : inputDigit(button.dataset.digit);
      } else if (button.dataset.operator !== undefined) {
        inputOperator(button.dataset.operator);
      } else if (button.dataset.action === 'clear') {
        pressClear();
      } else if (button.dataset.action === 'delete') {
        pressDelete();
      } else if (button.dataset.action === 'equals') {
        pressEquals();
      }
    });
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const key = event.key;
    let action = null;

    if (/^[0-9]$/.test(key)) action = () => inputDigit(key);
    else if (key === '.' || key === ',') action = inputDecimal;
    else if (key === '+') action = () => inputOperator('+');
    else if (key === '-') action = () => inputOperator('-');
    else if (key === '*' || key === 'x' || key === 'X') action = () => inputOperator('*');
    else if (key === '/') action = () => inputOperator('/');
    else if (key === 'Enter' || key === '=') action = pressEquals;
    else if (key === 'Backspace') action = pressDelete;
    else if (key === 'Escape' || key === 'c' || key === 'C') action = pressClear;
    else if (key === ' ') event.preventDefault();

    if (!action) return;
    event.preventDefault();
    action();
    flashKey(key);
  });

  render();
})();
