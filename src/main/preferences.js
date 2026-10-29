'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_PREFERENCES = Object.freeze({
  version: 1,
  autonomousMovement: true,
  activityMode: 'balanced',
  startAtLogin: false,
});

const ACTIVITY_MODES = Object.freeze({
  calm: Object.freeze({
    label: 'Tranquilo',
    initialMin: 5000,
    initialMax: 9000,
    pauseMin: 8000,
    pauseMax: 15000,
    walkSpeed: 75,
    runSpeed: 165,
  }),
  balanced: Object.freeze({
    label: 'Equilibrado',
    initialMin: 2500,
    initialMax: 6000,
    pauseMin: 3500,
    pauseMax: 10000,
    walkSpeed: 105,
    runSpeed: 230,
  }),
  playful: Object.freeze({
    label: 'Brincalhão',
    initialMin: 1500,
    initialMax: 3500,
    pauseMin: 1800,
    pauseMax: 5500,
    walkSpeed: 145,
    runSpeed: 300,
  }),
});

function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('As preferências precisam ser um objeto JSON.');
  }
  if (value.version !== 1) throw new RangeError(`Versão de preferências não suportada: ${value.version}`);
  if (typeof value.autonomousMovement !== 'boolean') {
    throw new TypeError('autonomousMovement precisa ser booleano.');
  }
  if (!Object.hasOwn(ACTIVITY_MODES, value.activityMode)) {
    throw new RangeError(`Modo de atividade inválido: ${value.activityMode}`);
  }
  if (typeof value.startAtLogin !== 'boolean') {
    throw new TypeError('startAtLogin precisa ser booleano.');
  }
  return {
    version: 1,
    autonomousMovement: value.autonomousMovement,
    activityMode: value.activityMode,
    startAtLogin: value.startAtLogin,
  };
}

function loadPreferences(filePath) {
  let contents;
  try {
    contents = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { ...DEFAULT_PREFERENCES };
    throw new Error(`Não foi possível ler as preferências em ${filePath}: ${error.message}`, { cause: error });
  }

  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`O arquivo de preferências contém JSON inválido: ${filePath}`, { cause: error });
  }
  return validatePreferences(parsed);
}

function savePreferences(filePath, value) {
  const preferences = validatePreferences(value);
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;
  fs.mkdirSync(directory, { recursive: true });
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(preferences, null, 2)}\n`, { flag: 'w' });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    if (fs.existsSync(temporaryPath)) {
      try {
        fs.unlinkSync(temporaryPath);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `Não foi possível salvar as preferências em ${filePath} nem limpar o arquivo temporário.`,
        );
      }
    }
    throw new Error(`Não foi possível salvar as preferências em ${filePath}: ${error.message}`, { cause: error });
  }
  return preferences;
}

module.exports = {
  ACTIVITY_MODES,
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  validatePreferences,
};
