import { Schema } from 'mongoose';
import { ACCOUNT_STATUSES, ADMIN_ROLES } from '../constants/domain.js';
import { options, text, email, state, passwordHash, compile } from './shared/schema.js';
const schema = new Schema({
  name: text(), email: email(), passwordHash: passwordHash(),
  role: state(ADMIN_ROLES, 'COUNSELLING_ADMIN'),
  status: state(ACCOUNT_STATUSES, 'ACTIVE'),
}, options);
schema.index({ email: 1 }, { unique: true });
export default compile('Admin', schema, 'admins');
