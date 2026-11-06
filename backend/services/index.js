import { createContext } from './core.js';
import { createCatalogueService } from './catalogue.service.js';
import { createPreferenceService } from './preference.service.js';
import { createAllocationService } from './allocation.service.js';
import { createRoundService } from './round.service.js';
import { createReportService } from './report.service.js';

export { ServiceError } from './core.js';
export function createDbmsEngine(options) {
  const context = createContext(options);
  return {
    catalogue: createCatalogueService(context), preferences: createPreferenceService(context),
    allocations: createAllocationService(context), rounds: createRoundService(context),
    reports: createReportService(),
  };
}
export const dbms = createDbmsEngine();
