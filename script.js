// Fetch gif.worker.js to avoid CORS and local file protocol issues
let gifWorkerBlobUrl = null;
fetch("https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js")
	.then((res) => res.text())
	.then((text) => {
		const blob = new Blob([text], { type: "application/javascript" });
		gifWorkerBlobUrl = URL.createObjectURL(blob);
	})
	.catch((err) => console.error("Error loading gif worker:", err));

const translations = {
	es: {
		themeSystem: "Sistema",
		themeLight: "Claro",
		themeDark: "Oscuro",
		languageLabel: "Idioma de la aplicación",
		themeLabel: "Tema de la aplicación",
		imageInputLabel: "Imagen Entrada",
		imageHelp: "PNG con transparencia recomendado.",
		maxAmplitudeLabel: "Max Amplitud",
		maxAmplitudeHelp:
			"Qué tan lejos se desplaza cada pixel de su posición original.",
		frequencyLabel: "Frecuencia",
		frequencyHelp: "Qué tan rápido oscila la onda a lo largo de la imagen.",
		phaseJumpLabel: "Salto de Fase",
		phaseJumpHelp:
			"Cuánto avanza la fase de la onda de un frame al siguiente.",
		sobelWeightLabel: "Peso Sobel",
		sobelWeightHelp:
			"Qué tanto se concentra el desplazamiento en los bordes detectados (líneas y contornos).",
		resetBtn: "Restaurar",
		originalLabel: "Original",
		previewLabel: "Previsualización",
		numFramesLabel: "Frames (2-30)",
		fpsLabel: "FPS",
		canvasBgColorLabel: "Color de fondo",
		transparencyLabel: "Transparencia",
		transparentToggleText: "Activa",
		playbackLabel: "Reproducción",
		playButton: "Reproducir",
		pauseButton: "Pausar",
		downloadZipBtn: "Descargar ZIP",
		downloadGifBtn: "Descargar GIF",
		uploadImageFirst: "Sube una imagen primero.",
		loadingGif:
			"El motor de GIF aún se está cargando. Intenta en unos segundos.",
		creatingZip: "Creando archivo ZIP...",
		zipSuccess: "¡ZIP descargado con éxito!",
		creatingGif: "Creando archivo GIF...",
		gifProgress: "Renderizando GIF: ",
		gifSuccess: "¡GIF descargado con éxito!",
	},
	en: {
		themeSystem: "System",
		themeLight: "Light",
		themeDark: "Dark",
		languageLabel: "Application language",
		themeLabel: "Application theme",
		imageInputLabel: "Input Image",
		imageHelp: "PNG with transparency is recommended.",
		maxAmplitudeLabel: "Max Amplitude",
		maxAmplitudeHelp:
			"How far each pixel moves from its original position.",
		frequencyLabel: "Frequency",
		frequencyHelp: "How quickly the wave oscillates across the image.",
		phaseJumpLabel: "Phase Jump",
		phaseJumpHelp:
			"How much the wave phase advances from one frame to the next.",
		sobelWeightLabel: "Sobel Weight",
		sobelWeightHelp:
			"How strongly the displacement is concentrated on detected edges (lines and contours).",
		resetBtn: "Reset",
		originalLabel: "Original",
		previewLabel: "Preview",
		numFramesLabel: "Frames (2-30)",
		fpsLabel: "FPS",
		canvasBgColorLabel: "Background color",
		transparencyLabel: "Transparency",
		transparentToggleText: "On",
		playbackLabel: "Playback",
		playButton: "Play",
		pauseButton: "Pause",
		downloadZipBtn: "Download ZIP",
		downloadGifBtn: "Download GIF",
		uploadImageFirst: "Upload an image first.",
		loadingGif:
			"The GIF engine is still loading. Please try again in a few seconds.",
		creatingZip: "Creating ZIP file...",
		zipSuccess: "ZIP downloaded successfully!",
		creatingGif: "Creating GIF file...",
		gifProgress: "Rendering GIF: ",
		gifSuccess: "GIF downloaded successfully!",
	},
};

const DEFAULT_VALUES = {
	numFrames: 6,
	maxAmplitude: 1.5,
	frequency: 0.02,
	phaseJump: 1.8,
	sobelWeight: 1.5,
};

let loadedImage = null;
let generatedFrames = [];
let isPlaying = false;
let currentPreviewFrame = 0;
let animationInterval = null;
let currentLanguage = localStorage.getItem("line-boil-language") || "es";

const originalCanvas = document.getElementById("originalCanvas");
const originalCtx = originalCanvas.getContext("2d");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const statusEl = document.getElementById("status");
const canvasBgColorInput = document.getElementById("canvasBgColor");
const transparentBgToggle = document.getElementById("transparentBgToggle");
const playPauseBtn = document.getElementById("playPauseBtn");
const fpsInput = document.getElementById("fpsInput");
const languageSelect = document.getElementById("languageSelect");
const themeSelect = document.getElementById("themeSelect");

const inputs = {
	imageInput: document.getElementById("imageInput"),
	numFrames: document.getElementById("numFrames"),
	maxAmplitude: document.getElementById("maxAmplitude"),
	frequency: document.getElementById("frequency"),
	phaseJump: document.getElementById("phaseJump"),
	sobelWeight: document.getElementById("sobelWeight"),
};

inputs.imageInput.value = "";

function updateTransparencyState() {
	const isTransparent = transparentBgToggle.checked;
	canvasBgColorInput.disabled = isTransparent;
	redrawCanvases();
}

function updatePlaybackButtonText() {
	playPauseBtn.textContent = isPlaying
		? translations[currentLanguage].pauseButton
		: translations[currentLanguage].playButton;
}

function updateThemeOptionsText() {
	const dictionary = translations[currentLanguage];
	const themeLabels = {
		system: dictionary.themeSystem,
		light: dictionary.themeLight,
		dark: dictionary.themeDark,
	};

	Array.from(themeSelect.options).forEach((option) => {
		option.textContent = themeLabels[option.value];
	});
}

function applyLanguage(lang) {
	currentLanguage = lang;
	document.documentElement.lang = lang;
	localStorage.setItem("line-boil-language", lang);
	languageSelect.value = lang;

	const dictionary = translations[lang];
	document.querySelectorAll("[data-i18n]").forEach((element) => {
		if (dictionary[element.dataset.i18n]) {
			element.textContent = dictionary[element.dataset.i18n];
		}
	});

	updateThemeOptionsText();
	updatePlaybackButtonText();
}

languageSelect.addEventListener("change", (event) => {
	applyLanguage(event.target.value);
});

transparentBgToggle.addEventListener("change", updateTransparencyState);

canvasBgColorInput.addEventListener("input", () => {
	if (!transparentBgToggle.checked) {
		redrawCanvases();
	}
});

function redrawCanvases() {
	if (loadedImage) {
		originalCtx.clearRect(
			0,
			0,
			originalCanvas.width,
			originalCanvas.height,
		);
		if (!transparentBgToggle.checked) {
			originalCtx.fillStyle = canvasBgColorInput.value;
			originalCtx.fillRect(
				0,
				0,
				originalCanvas.width,
				originalCanvas.height,
			);
		}
		originalCtx.drawImage(loadedImage, 0, 0);
	}

	if (generatedFrames.length > 0) {
		previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

		if (!transparentBgToggle.checked) {
			previewCtx.fillStyle = canvasBgColorInput.value;
			previewCtx.fillRect(
				0,
				0,
				previewCanvas.width,
				previewCanvas.height,
			);
		}

		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = previewCanvas.width;
		tempCanvas.height = previewCanvas.height;

		if (currentPreviewFrame >= generatedFrames.length) {
			currentPreviewFrame = 0;
		}

		tempCanvas
			.getContext("2d")
			.putImageData(generatedFrames[currentPreviewFrame], 0, 0);
		previewCtx.drawImage(tempCanvas, 0, 0);
	}
}

updateTransparencyState();

inputs.imageInput.addEventListener("change", (e) => {
	const file = e.target.files[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = (ev) => {
		const img = new Image();
		img.onload = () => {
			loadedImage = img;
			originalCanvas.width = img.width;
			originalCanvas.height = img.height;
			previewCanvas.width = img.width;
			previewCanvas.height = img.height;
			updateTransparencyState();
			updateAllFrames();

			if (!isPlaying && generatedFrames.length > 0) {
				startPreview();
			}
		};
		img.src = ev.target.result;
	};
	reader.readAsDataURL(file);
});

["numFrames", "maxAmplitude", "frequency", "phaseJump", "sobelWeight"].forEach(
	(id) => {
		inputs[id].addEventListener("input", () => {
			if (loadedImage) updateAllFrames();
		});
	},
);

document.getElementById("resetBtn").addEventListener("click", () => {
	inputs.numFrames.value = DEFAULT_VALUES.numFrames;
	inputs.maxAmplitude.value = DEFAULT_VALUES.maxAmplitude;
	inputs.frequency.value = DEFAULT_VALUES.frequency;
	inputs.phaseJump.value = DEFAULT_VALUES.phaseJump;
	inputs.sobelWeight.value = DEFAULT_VALUES.sobelWeight;
	if (loadedImage) updateAllFrames();
});

function computeGrayscale(pixels, width, height) {
	const gray = new Float32Array(width * height);
	for (let i = 0; i < pixels.length; i += 4) {
		gray[i / 4] =
			0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
	}
	return gray;
}

function sobelGradient(gray, width, x, y) {
	const gx =
		gray[(y - 1) * width + (x + 1)] +
		2 * gray[y * width + (x + 1)] +
		gray[(y + 1) * width + (x + 1)] -
		(gray[(y - 1) * width + (x - 1)] +
			2 * gray[y * width + (x - 1)] +
			gray[(y + 1) * width + (x - 1)]);
	const gy =
		gray[(y + 1) * width + (x - 1)] +
		2 * gray[(y + 1) * width + x] +
		gray[(y + 1) * width + (x + 1)] -
		(gray[(y - 1) * width + (x - 1)] +
			2 * gray[(y - 1) * width + x] +
			gray[(y - 1) * width + (x + 1)]);
	return { gx, gy };
}

function sampleBilinear(pixels, width, height, fx, fy) {
	const x0 = clamp(Math.floor(fx), 0, width - 1);
	const y0 = clamp(Math.floor(fy), 0, height - 1);
	const x1 = clamp(x0 + 1, 0, width - 1);
	const y1 = clamp(y0 + 1, 0, height - 1);

	const tx = fx - Math.floor(fx);
	const ty = fy - Math.floor(fy);

	const idx00 = (y0 * width + x0) * 4;
	const idx10 = (y0 * width + x1) * 4;
	const idx01 = (y1 * width + x0) * 4;
	const idx11 = (y1 * width + x1) * 4;

	const result = [0, 0, 0, 0];
	const weights = [
		(1 - tx) * (1 - ty),
		tx * (1 - ty),
		(1 - tx) * ty,
		tx * ty,
	];
	const indexes = [idx00, idx10, idx01, idx11];
	let alpha = 0;

	for (let i = 0; i < indexes.length; i++) {
		const pixelAlpha = pixels[indexes[i] + 3] / 255;
		alpha += pixelAlpha * weights[i];
		result[0] += pixels[indexes[i]] * pixelAlpha * weights[i];
		result[1] += pixels[indexes[i] + 1] * pixelAlpha * weights[i];
		result[2] += pixels[indexes[i] + 2] * pixelAlpha * weights[i];
	}

	result[3] = alpha * 255;
	if (alpha > 0) {
		result[0] /= alpha;
		result[1] /= alpha;
		result[2] /= alpha;
	}
	return result;
}

function renderBoilFrame(
	img,
	amplitude,
	frequency,
	phase,
	sobelWeight,
	targetCtx,
) {
	const w = img.width;
	const h = img.height;
	const srcCanvas = document.createElement("canvas");
	srcCanvas.width = w;
	srcCanvas.height = h;
	const sCtx = srcCanvas.getContext("2d");
	sCtx.drawImage(img, 0, 0);

	const srcData = sCtx.getImageData(0, 0, w, h);
	const src = srcData.data;
	const outputData = sCtx.createImageData(w, h);
	const out = outputData.data;
	const gray = computeGrayscale(src, w, h);

	for (let y = 1; y < h - 1; y++) {
		for (let x = 1; x < w - 1; x++) {
			const { gx, gy } = sobelGradient(gray, w, x, y);
			const absGx = Math.abs(gx);
			const absGy = Math.abs(gy);
			const totalGrad = absGx + absGy + 1e-5;

			const weightX = Math.pow(absGx / totalGrad, sobelWeight);
			const weightY = Math.pow(absGy / totalGrad, sobelWeight);

			const waveX =
				amplitude *
				Math.sin(2 * Math.PI * y * frequency + phase) *
				(0.65 + 0.35 * weightX);
			const waveY =
				amplitude *
				Math.cos(2 * Math.PI * x * frequency + phase) *
				(0.65 + 0.35 * weightY);

			const srcX = clamp(x + waveX, 0, w - 1);
			const srcY = clamp(y + waveY, 0, h - 1);

			const [r, g, b, a] = sampleBilinear(src, w, h, srcX, srcY);
			const outIdx = (y * w + x) * 4;

			out[outIdx] = r;
			out[outIdx + 1] = g;
			out[outIdx + 2] = b;
			out[outIdx + 3] = a;
		}
	}
	targetCtx.clearRect(0, 0, w, h);
	targetCtx.putImageData(outputData, 0, 0);
}

function clamp(val, min, max) {
	return Math.min(Math.max(val, min), max);
}

function updateAllFrames() {
	if (!loadedImage) return;
	const numFrames = parseInt(inputs.numFrames.value, 10);
	const amp = parseFloat(inputs.maxAmplitude.value);
	const freq = parseFloat(inputs.frequency.value);
	const phaseJump = parseFloat(inputs.phaseJump.value);
	const sobel = parseFloat(inputs.sobelWeight.value);

	generatedFrames = [];
	let phase = 0.0;

	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = loadedImage.width;
	tempCanvas.height = loadedImage.height;
	const tCtx = tempCanvas.getContext("2d");

	for (let i = 0; i < numFrames; i++) {
		renderBoilFrame(loadedImage, amp, freq, phase, sobel, tCtx);
		generatedFrames.push(
			tCtx.getImageData(0, 0, loadedImage.width, loadedImage.height),
		);
		phase += phaseJump;
	}

	if (currentPreviewFrame >= generatedFrames.length) {
		currentPreviewFrame = 0;
	}

	redrawCanvases();
}

playPauseBtn.addEventListener("click", () => {
	if (generatedFrames.length === 0) return;
	if (isPlaying) {
		stopPreview();
	} else {
		startPreview();
	}
});

function startPreview() {
	if (isPlaying) clearInterval(animationInterval);
	isPlaying = true;
	updatePlaybackButtonText();
	let fps = parseInt(fpsInput.value, 10);
	if (isNaN(fps) || fps <= 0) fps = 12;
	const intervalMs = 1000 / fps;

	animationInterval = setInterval(() => {
		currentPreviewFrame =
			(currentPreviewFrame + 1) % generatedFrames.length;
		redrawCanvases();
	}, intervalMs);
}

function stopPreview() {
	isPlaying = false;
	updatePlaybackButtonText();
	clearInterval(animationInterval);
}

fpsInput.addEventListener("input", () => {
	if (isPlaying) {
		stopPreview();
		startPreview();
	}
});

document.getElementById("zipBtn").addEventListener("click", async () => {
	if (!loadedImage || generatedFrames.length === 0) {
		alert(translations[currentLanguage].uploadImageFirst);
		return;
	}

	statusEl.innerText = translations[currentLanguage].creatingZip;
	const zip = new JSZip();
	const tempCanvas = document.createElement("canvas");
	tempCanvas.width = loadedImage.width;
	tempCanvas.height = loadedImage.height;
	const tCtx = tempCanvas.getContext("2d");

	const isTransparent = transparentBgToggle.checked;
	const bgColor = canvasBgColorInput.value;

	generatedFrames.forEach((frame, idx) => {
		tCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
		if (!isTransparent) {
			tCtx.fillStyle = bgColor;
			tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
		}

		const frameCanvas = document.createElement("canvas");
		frameCanvas.width = tempCanvas.width;
		frameCanvas.height = tempCanvas.height;
		frameCanvas.getContext("2d").putImageData(frame, 0, 0);

		tCtx.drawImage(frameCanvas, 0, 0);

		const dataUrl = tempCanvas.toDataURL("image/png");
		const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
		zip.file(`frame_${String(idx).padStart(3, "0")}.png`, base64Data, {
			base64: true,
		});
	});

	const content = await zip.generateAsync({ type: "blob" });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(content);
	link.download = "line_boil_frames.zip";
	link.click();

	statusEl.innerText = translations[currentLanguage].zipSuccess;
});

document.getElementById("gifBtn").addEventListener("click", () => {
	if (!loadedImage || generatedFrames.length === 0) {
		alert(translations[currentLanguage].uploadImageFirst);
		return;
	}

	if (!gifWorkerBlobUrl) {
		alert(translations[currentLanguage].loadingGif);
		return;
	}

	statusEl.innerText = translations[currentLanguage].creatingGif;

	let fps = parseInt(fpsInput.value, 10);
	if (isNaN(fps) || fps <= 0) fps = 12;

	const isTransparent = transparentBgToggle.checked;
	const bgColorHex = canvasBgColorInput.value;
	const gif = new GIF({
		workers: 2,
		quality: 10,
		width: loadedImage.width,
		height: loadedImage.height,
		workerScript: gifWorkerBlobUrl,
		transparent: isTransparent ? 0xff00ff : null,
	});

	generatedFrames.forEach((frameData) => {
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = loadedImage.width;
		tempCanvas.height = loadedImage.height;
		const tCtx = tempCanvas.getContext("2d");

		if (isTransparent) {
			const outData = tCtx.createImageData(
				tempCanvas.width,
				tempCanvas.height,
			);
			for (let i = 0; i < frameData.data.length; i += 4) {
				const alpha = frameData.data[i + 3];
				if (alpha < 128) {
					outData.data[i] = 255;
					outData.data[i + 1] = 0;
					outData.data[i + 2] = 255;
					outData.data[i + 3] = 255;
				} else {
					let r = frameData.data[i];
					let g = frameData.data[i + 1];
					let b = frameData.data[i + 2];
					if (r === 255 && g === 0 && b === 255) {
						b = 254;
					}
					outData.data[i] = r;
					outData.data[i + 1] = g;
					outData.data[i + 2] = b;
					outData.data[i + 3] = 255;
				}
			}
			tCtx.putImageData(outData, 0, 0);
		} else {
			tCtx.fillStyle = bgColorHex;
			tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

			const frameCanvas = document.createElement("canvas");
			frameCanvas.width = tempCanvas.width;
			frameCanvas.height = tempCanvas.height;
			frameCanvas.getContext("2d").putImageData(frameData, 0, 0);
			tCtx.drawImage(frameCanvas, 0, 0);
		}

		gif.addFrame(tempCanvas, { delay: 1000 / fps, copy: true });
	});

	gif.on("progress", function (p) {
		statusEl.innerText = `${translations[currentLanguage].gifProgress}${Math.round(p * 100)}%`;
	});

	gif.on("finished", function (blob) {
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = "line_boil_animation.gif";
		link.click();

		statusEl.innerText = translations[currentLanguage].gifSuccess;
		URL.revokeObjectURL(url);
	});

	gif.render();
});

const rootElement = document.documentElement;

function applyTheme(theme) {
	let resolvedTheme = theme;
	if (theme === "system") {
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		resolvedTheme = prefersDark ? "dark" : "light";
	}
	rootElement.setAttribute("data-theme", resolvedTheme);
	rootElement.style.colorScheme = resolvedTheme;
	localStorage.setItem("line-boil-theme", theme);
}

themeSelect.addEventListener("change", (event) =>
	applyTheme(event.target.value),
);

const savedTheme = localStorage.getItem("line-boil-theme") || "system";
themeSelect.value = savedTheme;
applyTheme(savedTheme);

window
	.matchMedia("(prefers-color-scheme: dark)")
	.addEventListener("change", (event) => {
		if (themeSelect.value === "system") {
			const resolvedTheme = event.matches ? "dark" : "light";
			rootElement.setAttribute("data-theme", resolvedTheme);
			rootElement.style.colorScheme = resolvedTheme;
		}
	});

languageSelect.value = currentLanguage;
applyLanguage(currentLanguage);
updatePlaybackButtonText();
