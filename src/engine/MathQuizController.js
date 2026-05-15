const QUESTION_TIME_LIMIT = 5000;
const NEXT_QUESTION_DELAY = 1200;
const QUICK_ANSWER_LIMIT = 2200;
const MAX_COMBO_LEVEL = 3;
const SpeechRecognitionApi =
	window.SpeechRecognition || window.webkitSpeechRecognition;

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
const [addSimple, addCarry, subtractSimple, subtractBorrow] = challengeTypes;
const difficultyProfiles = [
	{ max: 0.18, digits: [1], types: [addSimple, subtractSimple] },
	{ max: 0.36, digits: [2], types: [addSimple, subtractSimple] },
	{ max: 0.55, digits: [2, 3], types: [addCarry, subtractSimple] },
	{ max: 0.75, digits: [3], types: challengeTypes },
	{ max: 1, digits: [4], types: [addCarry, subtractBorrow, addSimple] },
];

const randomInt = (min, max) =>
	Math.floor(Math.random() * (max - min + 1)) + min;

const normalizeSpeech = (text) =>
	text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[.,!?]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const digitWords = {
	khong: 0,
	mot: 1,
	motj: 1,
	mots: 1,
	hai: 2,
	ba: 3,
	bon: 4,
	tu: 4,
	nam: 5,
	lam: 5,
	sau: 6,
	bay: 7,
	tam: 8,
	chin: 9,
};

const parseUnit = (word) => digitWords[word];

const parseBelowHundred = (tokens) => {
	const words = tokens.filter(Boolean);
	if (words.length === 0) return 0;
	if (words.length === 1) return parseUnit(words[0]);

	if (words[0] === 'muoi') {
		return 10 + (parseUnit(words[1]) ?? 0);
	}

	if (words[1] === 'muoi') {
		return (parseUnit(words[0]) ?? 0) * 10 + (parseUnit(words[2]) ?? 0);
	}

	if (['linh', 'le'].includes(words[0])) {
		return parseUnit(words[1]);
	}

	if (words.length === 2 && parseUnit(words[0]) > 1 && parseUnit(words[1]) === 5) {
		return parseUnit(words[0]) * 10 + 5;
	}

	return undefined;
};

const parseBelowThousand = (tokens) => {
	const hundredIndex = tokens.indexOf('tram');

	if (hundredIndex === -1) {
		return parseBelowHundred(tokens);
	}

	const hundred = parseUnit(tokens[hundredIndex - 1]);
	if (hundred === undefined) return undefined;

	const rest = parseBelowHundred(tokens.slice(hundredIndex + 1)) ?? 0;
	return hundred * 100 + rest;
};

export const parseVietnameseNumber = (text) => {
	const normalized = normalizeSpeech(text)
		.replace(/\bngan\b/g, 'nghin')
		.replace(/\bmuoi\b/g, 'muoi');
	const numeric = normalized.match(/\d+/);

	if (numeric) return Number(numeric[0]);

	const tokens = normalized.split(' ').filter(Boolean);
	const thousandIndex = tokens.indexOf('nghin');

	if (thousandIndex !== -1) {
		const thousand = parseBelowThousand(tokens.slice(0, thousandIndex));
		const rest = parseBelowThousand(tokens.slice(thousandIndex + 1)) ?? 0;
		if (thousand === undefined) return undefined;
		return thousand * 1000 + rest;
	}

	return parseBelowThousand(tokens);
};

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

export const buildQuestion = (difficultyProgress = 0) => {
	const profile =
		difficultyProfiles.find(({ max }) => difficultyProgress <= max) ??
		difficultyProfiles[difficultyProfiles.length - 1];
	const type = profile.types[randomInt(0, profile.types.length - 1)];
	const availableDigits = profile.digits.filter(
		(digits) => !(type.operation === '-' && type.regrouping && digits === 1)
	);
	const digits = availableDigits[randomInt(0, availableDigits.length - 1)];
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
		difficultyProgress,
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
	recognition = undefined;
	listening = false;
	comboLevel = 0;
	completedQuestions = 0;

	constructor({ onCorrect, onWrong, onTimeout, getDifficultyProgress }) {
		this.onCorrect = onCorrect;
		this.onWrong = onWrong;
		this.onTimeout = onTimeout;
		this.getDifficultyProgress = getDifficultyProgress;
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
				<button class="math-quiz__voice" type="button" aria-label="Tra loi bang giong noi">Mic</button>
				<button class="math-quiz__submit" type="submit">Danh</button>
			</form>
			<div class="math-quiz__combo">Combo x1</div>
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
		this.voiceButton = this.element.querySelector('.math-quiz__voice');
		this.comboElement = this.element.querySelector('.math-quiz__combo');

		this.formElement.addEventListener('submit', this.handleSubmit);
		this.voiceButton.addEventListener('click', this.handleVoiceClick);
		this.setupVoiceRecognition();
		document.querySelector('main').appendChild(this.element);
	};

	setupVoiceRecognition = () => {
		if (!SpeechRecognitionApi) {
			this.voiceButton.disabled = true;
			this.voiceButton.textContent = 'No mic';
			return;
		}

		this.recognition = new SpeechRecognitionApi();
		this.recognition.lang = 'vi-VN';
		this.recognition.continuous = false;
		this.recognition.interimResults = false;

		this.recognition.onstart = () => {
			this.listening = true;
			this.voiceButton.textContent = '...';
		};

		this.recognition.onend = () => {
			this.listening = false;
			this.voiceButton.textContent = 'Mic';
		};

		this.recognition.onerror = () => {
			this.feedbackElement.textContent = 'Khong nghe duoc. Hay nhap dap an.';
		};

		this.recognition.onresult = (event) => {
			const transcript = event.results[0][0].transcript;
			const parsed = parseVietnameseNumber(transcript);

			if (parsed === undefined || Number.isNaN(parsed)) {
				this.feedbackElement.textContent = `Khong hieu "${transcript}".`;
				return;
			}

			this.answerElement.value = String(parsed);
			this.submitAnswer();
		};
	};

	startQuestion = (time) => {
		window.clearTimeout(this.timeoutId);
		window.clearTimeout(this.nextQuestionId);
		this.active = true;
		const progress = Math.max(
			this.completedQuestions / 14,
			this.getDifficultyProgress?.() ?? 0
		);
		this.question = buildQuestion(Math.min(1, progress));
		this.question.startedAt = performance.now();
		this.deadline = performance.now() + QUESTION_TIME_LIMIT;
		this.modeElement.textContent = `${this.question.type.label} - ${this.question.digits} chu so`;
		this.questionElement.textContent = `${this.question.left} ${this.question.type.operation} ${this.question.right} = ?`;
		this.feedbackElement.textContent = '';
		this.answerElement.value = '';
		this.answerElement.disabled = false;
		this.voiceButton.disabled = !SpeechRecognitionApi;
		this.answerElement.focus();
		this.updateComboLabel();
		this.updateTimer(time);
		this.timeoutId = window.setTimeout(this.handleTimeout, QUESTION_TIME_LIMIT);
	};

	completeQuestion = (time, success, feedback, reason = 'answered') => {
		if (!this.active) return;
		window.clearTimeout(this.timeoutId);
		this.active = false;
		this.answerElement.disabled = true;
		this.voiceButton.disabled = true;
		this.feedbackElement.textContent = feedback;
		this.nextQuestionAt = time.previous + NEXT_QUESTION_DELAY;
		this.nextQuestionId = window.setTimeout(() => {
			if (!this.active && this.element.isConnected) {
				this.startQuestion(this.lastTime);
			}
		}, NEXT_QUESTION_DELAY);

		if (success) {
			this.question.responseTime = performance.now() - this.question.startedAt;
			this.comboLevel =
				this.question.responseTime <= QUICK_ANSWER_LIMIT
					? Math.min(MAX_COMBO_LEVEL, this.comboLevel + 1)
					: 1;
			this.question.comboLevel = this.comboLevel;
			this.updateComboLabel();
			this.feedbackElement.textContent =
				this.comboLevel > 1 ? `Dung! Combo x${this.comboLevel}.` : feedback;
			this.onCorrect(time, this.question);
		} else if (reason === 'timeout') {
			this.resetCombo();
			this.onTimeout(time, this.question);
		} else {
			this.resetCombo();
			this.onWrong(time, this.question);
		}

		this.completedQuestions++;
	};

	resetCombo = () => {
		this.comboLevel = 0;
		this.updateComboLabel();
	};

	updateComboLabel = () => {
		this.comboElement.textContent = `Combo x${Math.max(1, this.comboLevel)}`;
		this.comboElement.dataset.combo = String(Math.max(1, this.comboLevel));
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
		this.submitAnswer();
	};

	submitAnswer = () => {
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

	handleVoiceClick = () => {
		if (!this.active || !this.recognition || this.listening) return;
		this.recognition.start();
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
		this.recognition?.abort();
		this.formElement.removeEventListener('submit', this.handleSubmit);
		this.voiceButton.removeEventListener('click', this.handleVoiceClick);
		this.element.remove();
	};
}
