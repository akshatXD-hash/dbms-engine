import mongoose from 'mongoose';

export const options = {
  timestamps: true,
  strict: 'throw',
  optimisticConcurrency: true,
  // Explicit db:init creates indexes before any future writer starts.
  autoIndex: false,
  autoCreate: false,
  bufferCommands: false,
  toJSON: { transform: redactSecrets },
  toObject: { transform: redactSecrets },
};

function redactSecrets(_doc, value) {
  delete value.passwordHash;
  return value;
}

export const text = (maxLength = 120) => ({ type: String, required: true, trim: true, minlength: 1, maxlength: maxLength });
export const code = () => ({ ...text(40), uppercase: true, match: /^[A-Z0-9][A-Z0-9_-]*$/ });
export const email = () => ({ ...text(254), lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ });
export const integer = (min = 0, max = Number.MAX_SAFE_INTEGER) => ({
  type: Number, required: true, min, max,
  validate: { validator: Number.isSafeInteger, message: '{PATH} must be a safe integer' },
});
export const year = () => integer(2000, 2200);
export const reference = (ref, required = true) => ({ type: mongoose.Schema.Types.ObjectId, ref, required });
export const state = (values, defaultValue) => ({ type: String, enum: values, required: true, ...(defaultValue === undefined ? {} : { default: defaultValue }) });
// The authentication phase will hash passwords. Accept only supported encoded hashes.
export const passwordHash = () => ({
  type: String, required: true, select: false,
  match: /^(?:\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}|\$argon2id\$v=19\$m=\d+,t=\d+,p=\d+\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+)$/,
});
export function uniqueValues(values) {
  return Array.isArray(values) && values.length === new Set(values.map(String)).size;
}
export function compile(name, schema, collection) {
  return mongoose.models[name] ?? mongoose.model(name, schema, collection);
}
