import { Schema } from 'mongoose';
import { AUDIT_ACTIONS } from '../constants/domain.js';
import { options, text, reference, state, compile } from './shared/schema.js';
const schema = new Schema({
  action: state(AUDIT_ACTIONS),
  actorType: state(['Student', 'Admin', 'SYSTEM']),
  actor: { type: Schema.Types.ObjectId, refPath: 'actorType' },
  student: reference('Student', false), round: reference('Round', false),
  allocation: reference('Allocation', false),
  requestId: text(100), summary: text(500),
  occurredAt: { type: Date, required: true, default: Date.now },
}, options);
schema.pre('validate', function () {
  if ((this.actorType === 'SYSTEM') === Boolean(this.actor)) {
    this.invalidate('actor', 'Student/Admin actors require an id; SYSTEM actors must omit it');
  }
});
schema.index({ student: 1, occurredAt: -1 });
schema.index({ round: 1, occurredAt: -1 });
schema.index({ requestId: 1 });
export default compile('AuditEvent', schema, 'audit_events');
