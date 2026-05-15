const QUESTION_TIME_LIMIT = 5000;
const NEXT_QUESTION_DELAY = 1200;

const digitRanges = {
	1: [1, 9],
	2: [10, 99],
	3: [100, 999],
	4: [1000, 9999],
};

const challengeTypes = [
	{ operation: '+', regrouping: false, label: 'Cong khong nho' },
	{ operation: '+', regrouping: true, label: 'Cong co nho' },
	{ operation: '-', regrouping: false, label: 'Tru khong nho' },
	{ operation: '-', regrouping: true, label: 'Tru co nho' },
];

const randomInt = (min, max) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

const getDigits = (number, digits) =>
	String(number).padStart(digits, '0').split('').map(Number).reverse();

const hasCarry = (left, right, digits) => {
	const leftDigits = getDigits(left, digits);
	const rightDigits = getDigits(right, digits);
	return leftDigits.some((digit, index) => digit + rightDigits[index] >= 10);
};

const hasBorrow = (left, right, digits) => {
	const leftDigits = getDigits(left, digits);
	const rightDigits = getDigits(right, digits);
	return leftDigits.some((digit, index) => digit < rightDigits[index]);
};

const buildNumberWithoutCarry = (digits) => {
	const leftDigits = [];
	const rightDigits = [];

	for (let index = 0; index < digits; index++) {
		const isLeading = index === digits - 1;
		const minLeft = isLeading ? 1 : 0;
		const left = randomInt(minLeft, isLeading && digits > 1 ? 8 : 9);
		const maxRight = 9 - left;
		const right = randomInt(isLeading && digits > 1 ? 1 : 0, maxRight);
		leftDigits.unshift(left);
		rightDigits.unshift(right);
	}

	return [Number(leftDigits.join('')), Number(rightDigits.join(''))];
};

const buildNumberWithoutBorrow = (digits) => {
	const leftDigits = [];
	const rightDigits = [];

	for (let index = 0; index < digits; index++) {
		const isLeading = index === digits - 1;
		const minLeft = isLeading ? 1 : 0;
		const left = randomInt(minLeft, 9);
		const right = randomInt(isLeading && digits > 1 ? 1 : 0, left);
		leftDigits.unshift(left);
		rightDigits.unshift(right);
	}

	return [Number(leftDigits.join('')), Number(rightDigits.join(''))];
};

const buildQuestion = () => {
	const type = challengeTypes[randomInt(0, challengeTypes.length - 1)];
	const digits =
		type.operation === '-' && type.regrouping ? randomInt(2, 4) : randomInt(1, 4);
	const [min, max] = digitRanges[digits];
	let left = 0;
	let right = 0;

	if (type.operation === '+' && !type.regrouping) {
		[left, right] = buildNumberWithoutCarry(digits);
	} else if (type.operation === '-' && !type.regrouping) {
		[left, right] = buildNumberWithoutBorrow(digits);
	} else {
		for (let attempt = 0; attempt < 200; attempt++) {
			left = randomInt(min, max);
			right = randomInt(min, max);

			if (type.operation === '-' && right > left) {
				[left, right] = [right, left];
			}

			const matches =
				type.operation === '+'
					? hasCarry(left, right, digits)
					: hasBorrow(left, right, digits);

			if (matches) break;
		}
	}

	return {
		left,
		right,
		digits,
		type,
		answer: type.operation === '+' ? left + right : left - right,
	};
};

export class MathQuizController {
	active = false;
	question = undefined;
	deadline = 0;
	nextQuestionAt = 0;
	lastTime = { previous: 0 };
	timeoutId = undefined;
	nextQuestionId = undefined;

	constructor({ onCorrect, onWrong, onTimeout }) {
		this.onCorrect = onCorrect;
		this.onWrong = onWrong;
		this.onTimeout = onTimeout;
		this.createElement();
	}

	createElement = () => {
		this.element = document.createElement('section');
		this.element.className = 'math-quiz';
		this.element.innerHTML = `
			<div class="math-quiz__topline">
				<span class="math-quiz__mode"></span>
				<span class="math-quiz__timer">5.0s</span>
			</div>
			<div class="math-quiz__question"></div>
			<form class="math-quiz__form">
				<input class="math-quiz__answer" type="number" inputmode="numeric" autocomplete="off" aria-label="Dap an" />
				<button class="math-quiz__submit" type="submit">Danh</button>
			</form>
			<div class="math-quiz__bar"><span></span></div>
			<div class="math-quiz__feedback"></div>
		`;

		this.modeElement = this.element.querySelector('.math-quiz__mode');
		this.timerElement = this.element.querySelector('.math-quiz__timer');
		this.questionElement = this.element.querySelector('.math-quiz__question');
		this.answerElement = this.element.querySelector('.math-quiz__answer');
		this.feedbackElement = this.element.querySelector('.math-quiz__feedback');
		this.timeBarElement = this.element.querySelector('.math-quiz__bar span');
		this.formElement = this.element.querySelector('.math-quiz__form');

		this.formElement.addEventListener('submit', this.handleSubmit);
		document.querySelector('main').appendChild(this.element);
	};

	startQuestion = (time) => {
		window.clearTimeout(this.timeoutId);
		window.clearTimeout(this.nextQuestionId);
		this.active = true;
		this.question = buildQuestion();
		this.deadline = performance.now() + QUESTION_TIME_LIMIT;
		this.modeElement.textContent = `${this.question.type.label} - ${this.question.digits} chu so`;
		this.questionElement.textContent = `${this.question.left} ${this.question.type.operation} ${this.question.right} = ?`;
		this.feedbackElement.textContent = '';
		this.answerElement.value = '';
		this.answerElement.disabled = false;
		this.answerElement.focus();
		this.updateTimer(time);
		this.timeoutId = window.setTimeout(this.handleTimeout, QUESTION_TIME_LIMIT);
	};

	completeQuestion = (time, success, feedback, reason = 'answered') => {
		if (!this.active) return;
		window.clearTimeout(this.timeoutId);
		this.active = false;
		this.answerElement.disabled = true;
		this.feedbackElement.textContent = feedback;
		this.nextQuestionAt = time.previous + NEXT_QUESTION_DELAY;
		this.nextQuestionId = window.setTimeout(() => {
			if (!this.active && this.element.isConnected) {
				this.startQuestion(this.lastTime);
			}
		}, NEXT_QUESTION_DELAY);

		if (success) {
			this.onCorrect(time, this.question);
		} else if (reason === 'timeout') {
			this.onTimeout(time, this.question);
		} else {
			this.onWrong(time, this.question);
		}
	};

	handleTimeout = () => {
		this.completeQuestion(
			this.lastTime,
			false,
			`Het gio. Dap an dung la ${this.question.answer}.`,
			'timeout'
		);
	};

	handleSubmit = (event) => {
		event.preventDefault();
		if (!this.active) return;

		const value = Number(this.answerElement.value);
		const answered = this.answerElement.value.trim() !== '';

		this.completeQuestion(
			this.lastTime,
			answered && value === this.question.answer,
			answered && value === this.question.answer
				? 'Dung! Ban ra don.'
				: `Sai. Dap an dung la ${this.question.answer}.`
		);
	};

	updateTimer = (time) => {
		const remaining = Math.max(0, this.deadline - performance.now());
		const progress = remaining / QUESTION_TIME_LIMIT;
		this.timerElement.textContent = `${(remaining / 1000).toFixed(1)}s`;
		this.timeBarElement.style.transform = `scaleX(${progress})`;
	};

	update = (time) => {
		this.lastTime = time;

		if (!this.question || (!this.active && time.previous >= this.nextQuestionAt)) {
			this.startQuestion(time);
			return;
		}

		if (!this.active) return;

		this.updateTimer(time);
	};

	destroy = () => {
		window.clearTimeout(this.timeoutId);
		window.clearTimeout(this.nextQuestionId);
		this.formElement.removeEventListener('submit', this.handleSubmit);
		this.element.remove();
	};
}
